import { type Address, type Hash, type Hex, keccak256, encodePacked, toHex } from 'viem';

/**
 * EIP-7702 Authorization structure
 * 
 * EIP-7702 allows EOAs to temporarily act as smart contracts by
 * authorizing a delegate contract address. When authorized, calls to
 * the EOA will execute the delegate's code.
 */
export interface EIP7702Authorization {
  /** Chain ID where the authorization is valid */
  chainId: number;
  /** Address of the delegate contract */
  address: Address;
  /** Nonce to prevent replay attacks */
  nonce: bigint;
}

/**
 * Signed EIP-7702 authorization
 */
export interface SignedAuthorization extends EIP7702Authorization {
  /** ECDSA signature components */
  yParity: number;
  r: Hex;
  s: Hex;
}

/**
 * Create the authorization hash for EIP-7702 signing
 * 
 * The hash is computed as:
 * keccak256(MAGIC || rlp([chain_id, address, nonce]))
 * 
 * Where MAGIC = 0x05 (EIP-7702 type)
 */
export function getAuthorizationHash(auth: EIP7702Authorization): Hash {
  // EIP-7702 uses a specific prefix
  const MAGIC = '0x05';
  
  // Encode the authorization tuple
  // Note: This is a simplified version. Real implementation needs proper RLP encoding
  const encoded = encodePacked(
    ['bytes1', 'uint256', 'address', 'uint256'],
    [MAGIC as Hex, BigInt(auth.chainId), auth.address, auth.nonce]
  );
  
  return keccak256(encoded);
}

/**
 * Create authorization data for multiple chains
 */
export function createMultiChainAuthorization(
  delegateAddresses: Record<number, Address>,
  nonces: Record<number, bigint>
): EIP7702Authorization[] {
  const authorizations: EIP7702Authorization[] = [];
  
  for (const [chainIdStr, address] of Object.entries(delegateAddresses)) {
    const chainId = parseInt(chainIdStr, 10);
    const nonce = nonces[chainId] || 0n;
    
    authorizations.push({
      chainId,
      address,
      nonce,
    });
  }
  
  return authorizations;
}

/**
 * Format authorization for signing with a wallet
 * 
 * This creates a human-readable message that wallets can display
 */
export function formatAuthorizationMessage(
  authorizations: EIP7702Authorization[],
  deadline: number,
  dustValueUsd: number
): string {
  const chainNames: Record<number, string> = {
    1: 'Ethereum',
    42161: 'Arbitrum',
    10: 'Optimism',
    8453: 'Base',
    137: 'Polygon',
    56: 'BSC',
    43114: 'Avalanche',
  };
  
  const chains = authorizations
    .map(a => chainNames[a.chainId] || `Chain ${a.chainId}`)
    .join(', ');
  
  const expiresIn = Math.max(0, Math.floor((deadline * 1000 - Date.now()) / 60000));
  
  return `LlamaSweep Authorization

You are authorizing LlamaSweep to sweep your dust tokens.

Chains: ${chains}
Value: ~$${dustValueUsd.toFixed(2)}
Expires: ${expiresIn} minutes

This authorization allows the LlamaSweep solver to transfer tokens from your wallet on the specified chains. You can revoke this at any time by making any transaction.`;
}

/**
 * Validate an authorization hasn't expired
 */
export function isAuthorizationValid(deadline: number): boolean {
  return Date.now() < deadline * 1000;
}

/**
 * EIP-7702 transaction type identifier
 */
export const EIP7702_TX_TYPE = 0x04;

/**
 * Create an EIP-7702 transaction envelope
 * 
 * Note: This is for reference. Actual signing depends on wallet support.
 * Most wallets don't yet support EIP-7702 directly, so we may need
 * to use a smart contract wallet or wait for wallet updates.
 */
export interface EIP7702Transaction {
  type: typeof EIP7702_TX_TYPE;
  chainId: number;
  nonce: number;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  gasLimit: bigint;
  to: Address;
  value: bigint;
  data: Hex;
  accessList: Array<{ address: Address; storageKeys: Hex[] }>;
  authorizationList: SignedAuthorization[];
}

/**
 * Check if the current wallet supports EIP-7702
 * 
 * As of early 2026, support is limited. This checks for common indicators.
 */
export async function checkWalletEIP7702Support(): Promise<boolean> {
  // Check if window.ethereum is available
  if (typeof window === 'undefined' || !window.ethereum) {
    return false;
  }
  
  try {
    // Try to get the wallet capabilities
    // Modern wallets expose this via wallet_getCapabilities
    const capabilities = await window.ethereum.request({
      method: 'wallet_getCapabilities',
      params: [],
    });
    
    // Check for EIP-7702 support flag
    return capabilities?.eip7702 === true;
  } catch {
    // Wallet doesn't support capability checking
    // Try alternative detection methods
    return false;
  }
}

/**
 * Fallback: Use a smart account wrapper for non-7702 wallets
 * 
 * If the wallet doesn't support EIP-7702, we can still achieve
 * similar functionality using ERC-4337 account abstraction.
 */
export function shouldUseFallbackMode(): boolean {
  // For MVP, always use fallback mode since EIP-7702 wallet support is limited
  return true;
}
