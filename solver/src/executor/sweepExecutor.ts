import {
  createWalletClient,
  http,
  type Address,
  type Hash,
  encodeFunctionData,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainConfig, config } from '../config';
import type { SweepQuote, ChainTransaction, SweepStatus } from '../types';

// LlamaSweepDelegate ABI (minimal)
const DELEGATE_ABI = parseAbi([
  'function sweep(address[] calldata tokens, uint256[] calldata amounts, uint256 deadline) external',
  'function sweepNative(uint256 amount, uint256 deadline) external',
  'function sweepAll(address token, uint256 deadline) external',
  'function sweepAllNative(uint256 deadline) external',
]);

interface SweepResult {
  chainId: number;
  txHash: Hash;
  success: boolean;
  error?: string;
}

/**
 * Execute sweeps across all chains for a given quote
 */
export async function executeSweeps(
  quote: SweepQuote,
  signatures: Map<number, `0x${string}`>
): Promise<{
  results: SweepResult[];
  status: SweepStatus;
}> {
  if (!config.solverPrivateKey) {
    throw new Error('Solver private key not configured');
  }

  const account = privateKeyToAccount(config.solverPrivateKey);
  const results: SweepResult[] = [];

  // Group tokens by chain
  const tokensByChain = new Map<number, typeof quote.dustTokens>();
  for (const token of quote.dustTokens) {
    const existing = tokensByChain.get(token.chainId) || [];
    existing.push(token);
    tokensByChain.set(token.chainId, existing);
  }

  // Execute sweeps on each chain
  for (const [chainId, tokens] of tokensByChain) {
    const chainConfig = getChainConfig(chainId);
    if (!chainConfig?.delegateAddress) {
      results.push({
        chainId,
        txHash: '0x' as Hash,
        success: false,
        error: `No delegate address configured for chain ${chainId}`,
      });
      continue;
    }

    try {
      const result = await executeSweepOnChain(
        account,
        chainId,
        chainConfig.delegateAddress,
        tokens,
        quote.authorizationData.deadline
      );
      results.push(result);
    } catch (error) {
      results.push({
        chainId,
        txHash: '0x' as Hash,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Determine overall status
  const allSuccess = results.every((r) => r.success);
  const anySuccess = results.some((r) => r.success);

  let status: SweepStatus;
  if (allSuccess) {
    status = 'swapping';
  } else if (anySuccess) {
    status = 'sweeping'; // Partial success, continue
  } else {
    status = 'failed';
  }

  return { results, status };
}

/**
 * Execute sweep on a specific chain
 */
async function executeSweepOnChain(
  account: ReturnType<typeof privateKeyToAccount>,
  chainId: number,
  delegateAddress: Address,
  tokens: Array<{ address: Address; amount: bigint }>,
  deadline: number
): Promise<SweepResult> {
  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  const client = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  // Separate native and ERC20 tokens
  const nativeToken = tokens.find(
    (t) => t.address === '0x0000000000000000000000000000000000000000'
  );
  const erc20Tokens = tokens.filter(
    (t) => t.address !== '0x0000000000000000000000000000000000000000'
  );

  let txHash: Hash = '0x' as Hash;

  // Sweep ERC20 tokens
  if (erc20Tokens.length > 0) {
    const tokenAddresses = erc20Tokens.map((t) => t.address);
    const amounts = erc20Tokens.map((t) => t.amount);

    const data = encodeFunctionData({
      abi: DELEGATE_ABI,
      functionName: 'sweep',
      args: [tokenAddresses, amounts, BigInt(deadline)],
    });

    // Note: In production with EIP-7702, this would be a special transaction type
    // that includes the user's authorization signature
    txHash = await client.sendTransaction({
      to: delegateAddress,
      data,
    });
  }

  // Sweep native token
  if (nativeToken) {
    const data = encodeFunctionData({
      abi: DELEGATE_ABI,
      functionName: 'sweepNative',
      args: [nativeToken.amount, BigInt(deadline)],
    });

    txHash = await client.sendTransaction({
      to: delegateAddress,
      data,
    });
  }

  return {
    chainId,
    txHash,
    success: true,
  };
}

/**
 * Wait for a transaction to be confirmed
 */
export async function waitForTransaction(
  chainId: number,
  txHash: Hash
): Promise<{ confirmed: boolean; blockNumber?: bigint }> {
  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  const { createPublicClient, http } = await import('viem');
  const client = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  try {
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000, // 1 minute timeout
    });

    return {
      confirmed: receipt.status === 'success',
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    return { confirmed: false };
  }
}
