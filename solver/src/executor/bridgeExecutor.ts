import axios from 'axios';
import {
  createWalletClient,
  http,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainConfig, config } from '../config';

interface BridgeQuote {
  bridgeName: string;
  fromChainId: number;
  toChainId: number;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  estimatedTime: number; // seconds
  calldata: `0x${string}`;
  to: Address;
  value: bigint;
}

interface BridgeResult {
  success: boolean;
  txHash?: Hash;
  bridgeName?: string;
  estimatedArrival?: number;
  error?: string;
}

/**
 * Get bridge quote from LI.FI or Socket
 */
export async function getBridgeQuote(
  fromChainId: number,
  toChainId: number,
  token: Address,
  amount: bigint,
  fromAddress: Address,
  toAddress: Address
): Promise<BridgeQuote | null> {
  // Try LI.FI first
  try {
    const lifiQuote = await getLiFiQuote(
      fromChainId,
      toChainId,
      token,
      amount,
      fromAddress,
      toAddress
    );
    if (lifiQuote) return lifiQuote;
  } catch (error) {
    console.warn('LI.FI quote failed:', error);
  }

  // Fallback to Socket
  try {
    return await getSocketQuote(
      fromChainId,
      toChainId,
      token,
      amount,
      fromAddress,
      toAddress
    );
  } catch (error) {
    console.error('Socket quote failed:', error);
    return null;
  }
}

/**
 * Get quote from LI.FI
 */
async function getLiFiQuote(
  fromChainId: number,
  toChainId: number,
  token: Address,
  amount: bigint,
  fromAddress: Address,
  toAddress: Address
): Promise<BridgeQuote | null> {
  const url = 'https://li.quest/v1/quote';

  const response = await axios.get(url, {
    params: {
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken: token,
      toToken: token, // Same token on destination (or native gas token)
      fromAmount: amount.toString(),
      fromAddress,
      toAddress,
      slippage: 0.03, // 3% slippage for bridges
    },
    timeout: 15000,
  });

  if (!response.data?.transactionRequest) return null;

  const tx = response.data.transactionRequest;
  const estimate = response.data.estimate;

  return {
    bridgeName: response.data.toolDetails?.name || 'LI.FI',
    fromChainId,
    toChainId,
    tokenIn: token,
    tokenOut: estimate?.toToken?.address || token,
    amountIn: amount,
    amountOut: BigInt(estimate?.toAmount || '0'),
    estimatedTime: estimate?.executionDuration || 300,
    calldata: tx.data as `0x${string}`,
    to: tx.to as Address,
    value: BigInt(tx.value || '0'),
  };
}

/**
 * Get quote from Socket
 */
async function getSocketQuote(
  fromChainId: number,
  toChainId: number,
  token: Address,
  amount: bigint,
  fromAddress: Address,
  toAddress: Address
): Promise<BridgeQuote | null> {
  const url = 'https://api.socket.tech/v2/quote';

  const response = await axios.get(url, {
    params: {
      fromChainId,
      toChainId,
      fromTokenAddress: token,
      toTokenAddress: token,
      fromAmount: amount.toString(),
      userAddress: fromAddress,
      recipient: toAddress,
      uniqueRoutesPerBridge: true,
      sort: 'output', // Maximize output
    },
    headers: {
      'API-KEY': process.env.SOCKET_API_KEY || '',
    },
    timeout: 15000,
  });

  const routes = response.data?.result?.routes;
  if (!routes || routes.length === 0) return null;

  // Select best route (highest output)
  const bestRoute = routes[0];

  // Get transaction data for the route
  const buildUrl = 'https://api.socket.tech/v2/build-tx';
  const buildResponse = await axios.post(
    buildUrl,
    { route: bestRoute },
    {
      headers: {
        'API-KEY': process.env.SOCKET_API_KEY || '',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  const tx = buildResponse.data?.result;
  if (!tx) return null;

  return {
    bridgeName: bestRoute.usedBridgeNames?.join(', ') || 'Socket',
    fromChainId,
    toChainId,
    tokenIn: token,
    tokenOut: token,
    amountIn: amount,
    amountOut: BigInt(bestRoute.toAmount || '0'),
    estimatedTime: bestRoute.serviceTime || 300,
    calldata: tx.txData as `0x${string}`,
    to: tx.txTarget as Address,
    value: BigInt(tx.value || '0'),
  };
}

/**
 * Execute a bridge transaction
 */
export async function executeBridge(
  quote: BridgeQuote
): Promise<BridgeResult> {
  if (!config.solverPrivateKey) {
    return { success: false, error: 'Solver private key not configured' };
  }

  const chainConfig = getChainConfig(quote.fromChainId);
  if (!chainConfig) {
    return { success: false, error: `Unsupported chain: ${quote.fromChainId}` };
  }

  const account = privateKeyToAccount(config.solverPrivateKey);
  
  const client = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  try {
    // Approve token if needed (for ERC20)
    if (quote.tokenIn !== '0x0000000000000000000000000000000000000000' as Address) {
      // In production: check allowance and approve if needed
    }

    // Execute bridge transaction
    const txHash = await client.sendTransaction({
      to: quote.to,
      data: quote.calldata,
      value: quote.value,
    });

    return {
      success: true,
      txHash,
      bridgeName: quote.bridgeName,
      estimatedArrival: Date.now() + quote.estimatedTime * 1000,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bridge failed',
    };
  }
}

/**
 * Check bridge status using LI.FI status endpoint
 */
export async function checkBridgeStatus(
  bridgeTxHash: Hash,
  fromChainId: number,
  toChainId: number
): Promise<{
  status: 'pending' | 'completed' | 'failed';
  destinationTxHash?: Hash;
}> {
  try {
    const url = 'https://li.quest/v1/status';
    const response = await axios.get(url, {
      params: {
        txHash: bridgeTxHash,
        fromChain: fromChainId,
        toChain: toChainId,
      },
      timeout: 10000,
    });

    const status = response.data?.status;
    
    if (status === 'DONE') {
      return {
        status: 'completed',
        destinationTxHash: response.data?.receiving?.txHash,
      };
    } else if (status === 'FAILED') {
      return { status: 'failed' };
    } else {
      return { status: 'pending' };
    }
  } catch (error) {
    return { status: 'pending' };
  }
}
