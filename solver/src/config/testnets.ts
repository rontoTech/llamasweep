import { createPublicClient, http, type Chain } from 'viem';
import { sepolia, arbitrumSepolia, baseSepolia, optimismSepolia } from 'viem/chains';

export interface TestnetConfig {
  chain: Chain;
  rpcUrl: string;
  delegateAddress?: `0x${string}`;
  vaultAddress?: `0x${string}`;
  faucetUrl: string;
}

// Testnet configurations
export const TESTNETS: Record<number, TestnetConfig> = {
  // Sepolia (Ethereum testnet)
  11155111: {
    chain: sepolia,
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    faucetUrl: 'https://sepoliafaucet.com',
  },
  // Arbitrum Sepolia
  421614: {
    chain: arbitrumSepolia,
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    faucetUrl: 'https://faucet.arbitrum.io',
  },
  // Base Sepolia
  84532: {
    chain: baseSepolia,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    faucetUrl: 'https://www.alchemy.com/faucets/base-sepolia',
  },
  // Optimism Sepolia
  11155420: {
    chain: optimismSepolia,
    rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL || 'https://sepolia.optimism.io',
    faucetUrl: 'https://app.optimism.io/faucet',
  },
};

// Check if running in testnet mode
export function isTestnetMode(): boolean {
  return process.env.TESTNET_MODE === 'true';
}

// Get testnet config
export function getTestnetConfig(chainId: number): TestnetConfig | undefined {
  return TESTNETS[chainId];
}

// Create testnet client
export function createTestnetClient(chainId: number) {
  const config = getTestnetConfig(chainId);
  if (!config) {
    throw new Error(`Unsupported testnet: ${chainId}`);
  }
  
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

// Get all testnet chain IDs
export function getTestnetChainIds(): number[] {
  return Object.keys(TESTNETS).map(Number);
}

export const TESTNET_NAMES: Record<number, string> = {
  11155111: 'Sepolia',
  421614: 'Arbitrum Sepolia',
  84532: 'Base Sepolia',
  11155420: 'Optimism Sepolia',
};
