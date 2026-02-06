import axios from 'axios';
import {
  createWalletClient,
  http,
  type Address,
  type Hash,
  parseUnits,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainConfig, config } from '../config';

interface SwapQuote {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  route: string;
  calldata: `0x${string}`;
  to: Address;
  value: bigint;
}

interface SwapResult {
  success: boolean;
  txHash?: Hash;
  amountOut?: bigint;
  error?: string;
}

// Chain ID to 1inch chain identifier
const CHAIN_TO_1INCH: Record<number, string> = {
  1: '1',
  42161: '42161',
  10: '10',
  8453: '8453',
  137: '137',
  56: '56',
  43114: '43114',
};

// 1inch Router addresses
const INCH_ROUTER: Record<number, Address> = {
  1: '0x1111111254EEB25477B68fb85Ed929f73A960582',
  42161: '0x1111111254EEB25477B68fb85Ed929f73A960582',
  10: '0x1111111254EEB25477B68fb85Ed929f73A960582',
  8453: '0x1111111254EEB25477B68fb85Ed929f73A960582',
  137: '0x1111111254EEB25477B68fb85Ed929f73A960582',
  56: '0x1111111254EEB25477B68fb85Ed929f73A960582',
  43114: '0x1111111254EEB25477B68fb85Ed929f73A960582',
};

/**
 * Get a swap quote from 1inch or LlamaSwap
 */
export async function getSwapQuote(
  chainId: number,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fromAddress: Address
): Promise<SwapQuote | null> {
  // Try LlamaSwap first (DefiLlama's aggregator)
  try {
    const llamaQuote = await getLlamaSwapQuote(
      chainId,
      tokenIn,
      tokenOut,
      amountIn,
      fromAddress
    );
    if (llamaQuote) return llamaQuote;
  } catch (error) {
    console.warn('LlamaSwap quote failed, trying 1inch:', error);
  }

  // Fallback to 1inch
  try {
    return await get1inchQuote(chainId, tokenIn, tokenOut, amountIn, fromAddress);
  } catch (error) {
    console.error('1inch quote failed:', error);
    return null;
  }
}

/**
 * Get quote from LlamaSwap (DefiLlama's aggregator)
 */
async function getLlamaSwapQuote(
  chainId: number,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fromAddress: Address
): Promise<SwapQuote | null> {
  const chainNames: Record<number, string> = {
    1: 'ethereum',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
    137: 'polygon',
    56: 'bsc',
    43114: 'avax',
  };

  const chain = chainNames[chainId];
  if (!chain) return null;

  const url = `https://swap.defillama.com/v1/dexAgg/quote`;
  
  const response = await axios.get(url, {
    params: {
      chain,
      tokenIn: tokenIn.toLowerCase(),
      tokenOut: tokenOut.toLowerCase(),
      amount: amountIn.toString(),
      from: fromAddress,
      slippage: 1, // 1% slippage
    },
    timeout: 10000,
  });

  if (!response.data?.tx) return null;

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut: BigInt(response.data.toAmount || '0'),
    route: response.data.protocol || 'llamaswap',
    calldata: response.data.tx.data as `0x${string}`,
    to: response.data.tx.to as Address,
    value: BigInt(response.data.tx.value || '0'),
  };
}

/**
 * Get quote from 1inch
 */
async function get1inchQuote(
  chainId: number,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fromAddress: Address
): Promise<SwapQuote | null> {
  const chain = CHAIN_TO_1INCH[chainId];
  if (!chain) return null;

  const url = `https://api.1inch.dev/swap/v5.2/${chain}/swap`;
  
  const response = await axios.get(url, {
    params: {
      src: tokenIn,
      dst: tokenOut,
      amount: amountIn.toString(),
      from: fromAddress,
      slippage: 1,
      disableEstimate: true,
    },
    headers: {
      Authorization: `Bearer ${process.env.ONEINCH_API_KEY || ''}`,
    },
    timeout: 10000,
  });

  if (!response.data?.tx) return null;

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut: BigInt(response.data.toAmount || '0'),
    route: '1inch',
    calldata: response.data.tx.data as `0x${string}`,
    to: response.data.tx.to as Address,
    value: BigInt(response.data.tx.value || '0'),
  };
}

/**
 * Execute a swap
 */
export async function executeSwap(
  chainId: number,
  quote: SwapQuote
): Promise<SwapResult> {
  if (!config.solverPrivateKey) {
    return { success: false, error: 'Solver private key not configured' };
  }

  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    return { success: false, error: `Unsupported chain: ${chainId}` };
  }

  const account = privateKeyToAccount(config.solverPrivateKey);
  
  const client = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  try {
    // Approve token if needed (skip for native)
    if (quote.tokenIn !== '0x0000000000000000000000000000000000000000' as Address) {
      // In production: check allowance and approve if needed
    }

    // Execute swap
    const txHash = await client.sendTransaction({
      to: quote.to,
      data: quote.calldata,
      value: quote.value,
    });

    return {
      success: true,
      txHash,
      amountOut: quote.amountOut,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Swap failed',
    };
  }
}

/**
 * Batch swap multiple tokens to a single output token
 */
export async function batchSwap(
  chainId: number,
  tokens: Array<{ address: Address; amount: bigint }>,
  outputToken: Address,
  fromAddress: Address
): Promise<{ totalOutput: bigint; results: SwapResult[] }> {
  const results: SwapResult[] = [];
  let totalOutput = 0n;

  for (const token of tokens) {
    // Skip if same as output
    if (token.address.toLowerCase() === outputToken.toLowerCase()) {
      totalOutput += token.amount;
      continue;
    }

    // Get quote
    const quote = await getSwapQuote(
      chainId,
      token.address,
      outputToken,
      token.amount,
      fromAddress
    );

    if (!quote) {
      results.push({
        success: false,
        error: `No quote available for ${token.address}`,
      });
      continue;
    }

    // Execute swap
    const result = await executeSwap(chainId, quote);
    results.push(result);

    if (result.success && result.amountOut) {
      totalOutput += result.amountOut;
    }
  }

  return { totalOutput, results };
}
