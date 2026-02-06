// Token balance with USD value
export interface TokenBalance {
  chainId: number;
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  balanceFormatted: string;
  priceUsd: number;
  valueUsd: number;
  logoUrl?: string;
}

// Aggregated dust across chains
export interface DustSummary {
  totalValueUsd: number;
  tokenCount: number;
  chainCount: number;
  balances: TokenBalance[];
  timestamp: number;
}

// Sweep quote request
export interface SweepQuoteRequest {
  userAddress: `0x${string}`;
  destinationChainId: number;
  destinationToken: `0x${string}`;
  donateToDefillama?: boolean;
  minTokenValueUsd?: number;
  maxTokenValueUsd?: number;
  includeChains?: number[];
  excludeChains?: number[];
}

// Sweep quote response
export interface SweepQuote {
  quoteId: string;
  userAddress: `0x${string}`;
  
  // Input: dust to sweep
  dustTokens: SweepTokenInput[];
  totalInputValueUsd: number;
  
  // Output: what user receives
  destinationChainId: number;
  destinationToken: `0x${string}`;
  estimatedOutputAmount: bigint;
  estimatedOutputAmountFormatted: string;
  estimatedOutputValueUsd: number;
  
  // Fees
  isDonation: boolean;
  feePercent: number;
  feeAmountUsd: number;
  
  // Recipient
  recipient: `0x${string}`;
  
  // Timing
  expiresAt: number;
  estimatedDurationSeconds: number;
  
  // Authorization data for EIP-7702
  authorizationData: AuthorizationData;
}

// Individual token to sweep
export interface SweepTokenInput {
  chainId: number;
  address: `0x${string}`;
  symbol: string;
  amount: bigint;
  amountFormatted: string;
  valueUsd: number;
}

// EIP-7702 authorization data
export interface AuthorizationData {
  // Per-chain authorizations the user needs to sign
  authorizations: ChainAuthorization[];
  
  // Combined signature message
  message: string;
  
  // Deadline for the sweep
  deadline: number;
}

// Authorization for a specific chain
export interface ChainAuthorization {
  chainId: number;
  delegateAddress: `0x${string}`;
  tokens: `0x${string}`[];
  amounts: bigint[];
  nonce: bigint;
}

// Sweep execution request
export interface SweepExecuteRequest {
  quoteId: string;
  userAddress: `0x${string}`;
  signatures: ChainSignature[];
}

// Signature for a chain
export interface ChainSignature {
  chainId: number;
  signature: `0x${string}`;
}

// Sweep execution result
export interface SweepExecutionResult {
  success: boolean;
  sweepId: string;
  status: SweepStatus;
  transactions: ChainTransaction[];
  outputAmount?: bigint;
  outputAmountFormatted?: string;
  error?: string;
}

// Transaction on a specific chain
export interface ChainTransaction {
  chainId: number;
  txHash: `0x${string}`;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: bigint;
}

// Sweep status
export type SweepStatus = 
  | 'pending'
  | 'sweeping'
  | 'swapping'
  | 'bridging'
  | 'settling'
  | 'completed'
  | 'failed'
  | 'expired';

// Price data
export interface TokenPrice {
  address: `0x${string}`;
  chainId: number;
  priceUsd: number;
  timestamp: number;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}
