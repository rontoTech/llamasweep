import { formatUnits, type Address } from 'viem';
import { randomBytes } from 'crypto';
import { scanAllBalances, fetchPrices } from './balanceScanner';
import { config, getChainConfig, getSupportedChainIds } from '../config';
import type {
  SweepQuoteRequest,
  SweepQuote,
  SweepTokenInput,
  AuthorizationData,
  ChainAuthorization,
} from '../types';

// In-memory quote storage (use Redis in production)
const quoteStore = new Map<string, { quote: SweepQuote; createdAt: number }>();

// Cleanup expired quotes periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of quoteStore.entries()) {
    if (entry.quote.expiresAt < now) {
      quoteStore.delete(id);
    }
  }
}, 60000); // Every minute

/**
 * Generate a sweep quote for the user
 */
export async function generateQuote(request: SweepQuoteRequest): Promise<SweepQuote> {
  const {
    userAddress,
    destinationChainId,
    destinationToken,
    donateToDefillama = false,
    minTokenValueUsd,
    maxTokenValueUsd,
    includeChains,
    excludeChains,
  } = request;
  
  // Validate destination chain
  const destChainConfig = getChainConfig(destinationChainId);
  if (!destChainConfig) {
    throw new Error(`Unsupported destination chain: ${destinationChainId}`);
  }
  
  // Scan user's dust balances
  const dustSummary = await scanAllBalances(userAddress, {
    minValueUsd: minTokenValueUsd,
    maxValueUsd: maxTokenValueUsd,
    includeChains,
    excludeChains,
  });
  
  if (dustSummary.tokenCount === 0) {
    throw new Error('No dust tokens found to sweep');
  }
  
  // Calculate fees
  const isDonation = donateToDefillama && !!config.defiLlamaTreasury;
  const feePercent = isDonation ? 0 : config.defaultFeeBps / 100;
  const feeAmountUsd = (dustSummary.totalValueUsd * feePercent) / 100;
  const netValueUsd = dustSummary.totalValueUsd - feeAmountUsd;
  
  // Determine recipient
  const recipient = isDonation 
    ? config.defiLlamaTreasury!
    : userAddress;
  
  // Get destination token price
  const destPrices = await fetchPrices([
    { chainId: destinationChainId, address: destinationToken }
  ]);
  
  const chainToLlama: Record<number, string> = {
    1: 'ethereum',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
    137: 'polygon',
    56: 'bsc',
    43114: 'avax',
  };
  
  const destTokenKey = `${chainToLlama[destinationChainId]}:${destinationToken.toLowerCase()}`;
  const destTokenPrice = destPrices.get(destTokenKey) || 1; // Default to $1 for stablecoins
  
  // Estimate output amount (accounting for slippage and gas costs)
  const slippageFactor = 0.98; // 2% slippage allowance
  const estimatedGasCostUsd = dustSummary.chainCount * 0.5; // Rough estimate per chain
  const netAfterGas = Math.max(0, netValueUsd - estimatedGasCostUsd);
  const estimatedOutputValueUsd = netAfterGas * slippageFactor;
  
  // Get destination token decimals (hardcoded for common tokens, fetch in production)
  const destTokenDecimals = getTokenDecimals(destinationToken, destinationChainId);
  const estimatedOutputAmount = BigInt(
    Math.floor((estimatedOutputValueUsd / destTokenPrice) * 10 ** destTokenDecimals)
  );
  
  // Generate quote ID
  const quoteId = randomBytes(16).toString('hex');
  
  // Build authorization data for EIP-7702
  const authorizationData = buildAuthorizationData(
    userAddress,
    dustSummary.balances,
    config.sweepDeadlineSeconds
  );
  
  // Convert balances to sweep inputs
  const dustTokens: SweepTokenInput[] = dustSummary.balances.map(b => ({
    chainId: b.chainId,
    address: b.address,
    symbol: b.symbol,
    amount: b.balance,
    amountFormatted: b.balanceFormatted,
    valueUsd: b.valueUsd,
  }));
  
  const quote: SweepQuote = {
    quoteId,
    userAddress,
    
    dustTokens,
    totalInputValueUsd: dustSummary.totalValueUsd,
    
    destinationChainId,
    destinationToken,
    estimatedOutputAmount,
    estimatedOutputAmountFormatted: formatUnits(estimatedOutputAmount, destTokenDecimals),
    estimatedOutputValueUsd,
    
    isDonation,
    feePercent,
    feeAmountUsd,
    
    recipient,
    
    expiresAt: Date.now() + config.quoteExpirySeconds * 1000,
    estimatedDurationSeconds: 60 + dustSummary.chainCount * 30, // Rough estimate
    
    authorizationData,
  };
  
  // Store quote
  quoteStore.set(quoteId, { quote, createdAt: Date.now() });
  
  return quote;
}

/**
 * Get an existing quote by ID
 */
export function getQuote(quoteId: string): SweepQuote | null {
  const entry = quoteStore.get(quoteId);
  if (!entry) return null;
  if (entry.quote.expiresAt < Date.now()) {
    quoteStore.delete(quoteId);
    return null;
  }
  return entry.quote;
}

/**
 * Build EIP-7702 authorization data
 */
function buildAuthorizationData(
  userAddress: Address,
  balances: Array<{ chainId: number; address: Address; balance: bigint }>,
  deadlineSeconds: number
): AuthorizationData {
  // Group balances by chain
  const byChain = new Map<number, Array<{ address: Address; amount: bigint }>>();
  
  for (const balance of balances) {
    const chainBalances = byChain.get(balance.chainId) || [];
    chainBalances.push({ address: balance.address, amount: balance.balance });
    byChain.set(balance.chainId, chainBalances);
  }
  
  const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;
  const authorizations: ChainAuthorization[] = [];
  
  for (const [chainId, tokens] of byChain.entries()) {
    const chainConfig = getChainConfig(chainId);
    if (!chainConfig?.delegateAddress) continue;
    
    authorizations.push({
      chainId,
      delegateAddress: chainConfig.delegateAddress,
      tokens: tokens.map(t => t.address),
      amounts: tokens.map(t => t.amount),
      nonce: 0n, // Would be fetched from chain in production
    });
  }
  
  // Build message for signing
  // In production, this would be a proper EIP-712 typed data structure
  const message = JSON.stringify({
    action: 'llamasweep',
    user: userAddress,
    deadline,
    authorizations: authorizations.map(a => ({
      chainId: a.chainId,
      delegate: a.delegateAddress,
      tokenCount: a.tokens.length,
    })),
  });
  
  return {
    authorizations,
    message,
    deadline,
  };
}

/**
 * Get token decimals (simplified, use token list in production)
 */
function getTokenDecimals(address: Address, chainId: number): number {
  // Common stablecoins
  const stablecoins6: Record<string, boolean> = {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': true, // USDC mainnet
    '0xdac17f958d2ee523a2206206994597c13d831ec7': true, // USDT mainnet
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': true, // USDC arbitrum
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': true, // USDT arbitrum
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85': true, // USDC optimism
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': true, // USDT optimism
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': true, // USDC base
    '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': true, // USDC polygon
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': true, // USDT polygon
    '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': true, // USDC avalanche
  };
  
  if (stablecoins6[address.toLowerCase()]) {
    return 6;
  }
  
  // Default to 18 (ETH, most tokens)
  return 18;
}
