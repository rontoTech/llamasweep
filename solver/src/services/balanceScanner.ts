import { formatUnits, type Address, erc20Abi } from 'viem';
import axios from 'axios';
import { createChainClient, getSupportedChainIds, getChainName, config } from '../config';
import type { TokenBalance, DustSummary } from '../types';

// DefiLlama coins API response
interface DefiLlamaCoin {
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
}

// DeBank token response
interface DebankToken {
  id: string;
  chain: string;
  name: string;
  symbol: string;
  decimals: number;
  logo_url: string;
  price: number;
  amount: number;
  raw_amount: number;
}

/**
 * Fetch token prices from DefiLlama
 */
async function fetchPrices(
  tokens: { chainId: number; address: Address }[]
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  if (tokens.length === 0) return prices;
  
  // Build coins query: chain:address format
  const chainIdToLlama: Record<number, string> = {
    1: 'ethereum',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
    137: 'polygon',
    56: 'bsc',
    43114: 'avax',
  };
  
  const coins = tokens
    .map(t => {
      const chain = chainIdToLlama[t.chainId];
      if (!chain) return null;
      return `${chain}:${t.address.toLowerCase()}`;
    })
    .filter(Boolean);
  
  if (coins.length === 0) return prices;
  
  try {
    const response = await axios.get<{ coins: Record<string, DefiLlamaCoin> }>(
      `${config.defiLlamaApi}/prices/current/${coins.join(',')}`,
      { timeout: 10000 }
    );
    
    for (const [key, data] of Object.entries(response.data.coins)) {
      prices.set(key.toLowerCase(), data.price);
    }
  } catch (error) {
    console.error('Failed to fetch prices from DefiLlama:', error);
  }
  
  return prices;
}

/**
 * Fetch all token balances for a user across supported chains
 * Uses DeBank API if available, fallback to on-chain queries
 */
export async function scanAllBalances(
  userAddress: Address,
  options?: {
    minValueUsd?: number;
    maxValueUsd?: number;
    includeChains?: number[];
    excludeChains?: number[];
  }
): Promise<DustSummary> {
  const minValue = options?.minValueUsd ?? config.minDustValueUsd;
  const maxValue = options?.maxValueUsd ?? config.maxDustValueUsd;
  
  let chainIds = getSupportedChainIds();
  
  if (options?.includeChains?.length) {
    chainIds = chainIds.filter(id => options.includeChains!.includes(id));
  }
  if (options?.excludeChains?.length) {
    chainIds = chainIds.filter(id => !options.excludeChains!.includes(id));
  }
  
  const allBalances: TokenBalance[] = [];
  
  // Scan each chain in parallel
  const chainResults = await Promise.allSettled(
    chainIds.map(chainId => scanChainBalances(userAddress, chainId))
  );
  
  for (const result of chainResults) {
    if (result.status === 'fulfilled') {
      allBalances.push(...result.value);
    }
  }
  
  // Filter by value range (dust)
  const dustBalances = allBalances.filter(
    b => b.valueUsd >= minValue && b.valueUsd <= maxValue
  );
  
  // Sort by value descending
  dustBalances.sort((a, b) => b.valueUsd - a.valueUsd);
  
  // Calculate summary
  const totalValueUsd = dustBalances.reduce((sum, b) => sum + b.valueUsd, 0);
  const uniqueChains = new Set(dustBalances.map(b => b.chainId));
  
  return {
    totalValueUsd,
    tokenCount: dustBalances.length,
    chainCount: uniqueChains.size,
    balances: dustBalances,
    timestamp: Date.now(),
  };
}

/**
 * Scan token balances on a specific chain
 */
async function scanChainBalances(
  userAddress: Address,
  chainId: number
): Promise<TokenBalance[]> {
  const client = createChainClient(chainId);
  const balances: TokenBalance[] = [];
  
  // For production, you would use an indexer like DeBank, Covalent, or Alchemy
  // For MVP, we'll query common tokens directly
  
  // Get native balance
  const nativeBalance = await client.getBalance({ address: userAddress });
  if (nativeBalance > 0n) {
    // Get native token price
    const chainToNative: Record<number, string> = {
      1: 'ethereum:0x0000000000000000000000000000000000000000',
      42161: 'arbitrum:0x0000000000000000000000000000000000000000',
      10: 'optimism:0x0000000000000000000000000000000000000000',
      8453: 'base:0x0000000000000000000000000000000000000000',
      137: 'polygon:0x0000000000000000000000000000000000000000',
      56: 'bsc:0x0000000000000000000000000000000000000000',
      43114: 'avax:0x0000000000000000000000000000000000000000',
    };
    
    const nativeSymbols: Record<number, string> = {
      1: 'ETH',
      42161: 'ETH',
      10: 'ETH',
      8453: 'ETH',
      137: 'MATIC',
      56: 'BNB',
      43114: 'AVAX',
    };
    
    const prices = await fetchPrices([
      { chainId, address: '0x0000000000000000000000000000000000000000' as Address }
    ]);
    const nativePrice = prices.get(chainToNative[chainId]?.toLowerCase() || '') || 0;
    
    const formattedBalance = formatUnits(nativeBalance, 18);
    const valueUsd = parseFloat(formattedBalance) * nativePrice;
    
    balances.push({
      chainId,
      address: '0x0000000000000000000000000000000000000000' as Address,
      symbol: nativeSymbols[chainId] || 'ETH',
      name: `${getChainName(chainId)} Native`,
      decimals: 18,
      balance: nativeBalance,
      balanceFormatted: formattedBalance,
      priceUsd: nativePrice,
      valueUsd,
    });
  }
  
  // Query common tokens
  // In production, use an indexer to get all tokens with balance
  const commonTokens = await getCommonTokensForChain(chainId);
  
  if (commonTokens.length > 0) {
    // Batch read balances
    const balanceResults = await Promise.allSettled(
      commonTokens.map(async (token) => {
        const balance = await client.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userAddress],
        });
        return { token, balance };
      })
    );
    
    // Collect tokens with balance
    const tokensWithBalance = balanceResults
      .filter((r): r is PromiseFulfilledResult<{ token: typeof commonTokens[0]; balance: bigint }> => 
        r.status === 'fulfilled' && r.value.balance > 0n
      )
      .map(r => r.value);
    
    if (tokensWithBalance.length > 0) {
      // Fetch prices
      const prices = await fetchPrices(
        tokensWithBalance.map(t => ({ chainId, address: t.token.address }))
      );
      
      const chainName = getChainName(chainId).toLowerCase().replace(' ', '');
      const chainToLlama: Record<number, string> = {
        1: 'ethereum',
        42161: 'arbitrum',
        10: 'optimism',
        8453: 'base',
        137: 'polygon',
        56: 'bsc',
        43114: 'avax',
      };
      
      for (const { token, balance } of tokensWithBalance) {
        const key = `${chainToLlama[chainId]}:${token.address.toLowerCase()}`;
        const price = prices.get(key) || 0;
        const formattedBalance = formatUnits(balance, token.decimals);
        const valueUsd = parseFloat(formattedBalance) * price;
        
        balances.push({
          chainId,
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance,
          balanceFormatted: formattedBalance,
          priceUsd: price,
          valueUsd,
        });
      }
    }
  }
  
  return balances;
}

/**
 * Get common tokens for a chain
 * In production, this would be dynamically loaded or use an indexer
 */
async function getCommonTokensForChain(
  chainId: number
): Promise<Array<{ address: Address; symbol: string; name: string; decimals: number }>> {
  // Common tokens per chain (subset for MVP)
  const tokens: Record<number, Array<{ address: Address; symbol: string; name: string; decimals: number }>> = {
    1: [
      { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether', decimals: 6 },
      { address: '0x6B175474E89094C44Da98b954EescdeCB5BE3830', symbol: 'DAI', name: 'Dai', decimals: 18 },
      { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8 },
      { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', name: 'Chainlink', decimals: 18 },
    ],
    42161: [
      { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', name: 'Tether', decimals: 6 },
      { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8 },
    ],
    10: [
      { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', name: 'Tether', decimals: 6 },
    ],
    8453: [
      { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    ],
    137: [
      { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether', decimals: 6 },
    ],
    56: [
      { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', name: 'USD Coin', decimals: 18 },
      { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Tether', decimals: 18 },
    ],
    43114: [
      { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    ],
  };
  
  return tokens[chainId] || [];
}

export { fetchPrices };
