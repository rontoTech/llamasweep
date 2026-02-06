import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hash,
  parseAbi,
  encodeFunctionData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainConfig, config } from '../config';
import type { SweepQuote } from '../types';

// SolverVault ABI (minimal)
const VAULT_ABI = parseAbi([
  'function settle(address user, address token, uint256 amount, bool isDonation) external',
  'function settleNative(address user, uint256 amount, bool isDonation) external payable',
  'function calculateFee(uint256 amount, bool isDonation) external view returns (uint256 fee, uint256 userAmount)',
]);

interface SettlementResult {
  success: boolean;
  txHash?: Hash;
  amountSent?: bigint;
  fee?: bigint;
  error?: string;
}

/**
 * Settle funds to the user (or DefiLlama treasury for donations)
 */
export async function settleFunds(
  quote: SweepQuote,
  totalCollected: bigint,
  collectedToken: Address
): Promise<SettlementResult> {
  if (!config.solverPrivateKey) {
    return { success: false, error: 'Solver private key not configured' };
  }

  const chainConfig = getChainConfig(quote.destinationChainId);
  if (!chainConfig?.vaultAddress) {
    return { 
      success: false, 
      error: `No vault address for chain ${quote.destinationChainId}` 
    };
  }

  const account = privateKeyToAccount(config.solverPrivateKey);
  
  const client = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  try {
    const isNative = collectedToken === '0x0000000000000000000000000000000000000000' as Address;
    let txHash: Hash;

    if (isNative) {
      // Settle native token
      const data = encodeFunctionData({
        abi: VAULT_ABI,
        functionName: 'settleNative',
        args: [quote.recipient, totalCollected, quote.isDonation],
      });

      txHash = await client.sendTransaction({
        to: chainConfig.vaultAddress,
        data,
        value: totalCollected,
      });
    } else {
      // Settle ERC20
      const data = encodeFunctionData({
        abi: VAULT_ABI,
        functionName: 'settle',
        args: [quote.recipient, collectedToken, totalCollected, quote.isDonation],
      });

      txHash = await client.sendTransaction({
        to: chainConfig.vaultAddress,
        data,
      });
    }

    // Calculate what was actually sent
    const feeAmount = quote.isDonation ? 0n : (totalCollected * BigInt(config.defaultFeeBps)) / 10000n;
    const userAmount = totalCollected - feeAmount;

    return {
      success: true,
      txHash,
      amountSent: userAmount,
      fee: feeAmount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Settlement failed',
    };
  }
}

/**
 * Direct transfer without vault (for simpler cases)
 */
export async function directTransfer(
  chainId: number,
  recipient: Address,
  token: Address,
  amount: bigint
): Promise<SettlementResult> {
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
    const isNative = token === '0x0000000000000000000000000000000000000000' as Address;
    let txHash: Hash;

    if (isNative) {
      txHash = await client.sendTransaction({
        to: recipient,
        value: amount,
      });
    } else {
      const ERC20_ABI = parseAbi([
        'function transfer(address to, uint256 amount) external returns (bool)',
      ]);

      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [recipient, amount],
      });

      txHash = await client.sendTransaction({
        to: token,
        data,
      });
    }

    return {
      success: true,
      txHash,
      amountSent: amount,
      fee: 0n,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transfer failed',
    };
  }
}

/**
 * Get current fee calculation from vault
 */
export async function getVaultFeeCalculation(
  chainId: number,
  amount: bigint,
  isDonation: boolean
): Promise<{ fee: bigint; userAmount: bigint } | null> {
  const chainConfig = getChainConfig(chainId);
  if (!chainConfig?.vaultAddress) {
    return null;
  }

  const client = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  try {
    const result = await client.readContract({
      address: chainConfig.vaultAddress,
      abi: VAULT_ABI,
      functionName: 'calculateFee',
      args: [amount, isDonation],
    });

    return {
      fee: result[0],
      userAmount: result[1],
    };
  } catch (error) {
    console.error('Failed to get fee calculation:', error);
    return null;
  }
}
