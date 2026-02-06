import { createPublicClient, http, type Chain } from 'viem';
import {
  mainnet,
  arbitrum,
  optimism,
  base,
  polygon,
  bsc,
  avalanche,
} from 'viem/chains';

export interface ChainConfig {
  chain: Chain;
  rpcUrl: string;
  delegateAddress?: `0x${string}`;
  vaultAddress?: `0x${string}`;
  wrappedNative: `0x${string}`;
  stablecoins: `0x${string}`[];
  minDustValueUsd: number;
}

// Chain configurations
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  1: {
    chain: mainnet,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    wrappedNative: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    stablecoins: [
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      '0x6B175474E89094C44Da98b954EescdeCB5BE3830', // DAI
    ],
    minDustValueUsd: 0.01,
  },
  42161: {
    chain: arbitrum,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    wrappedNative: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
    stablecoins: [
      '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
      '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
    ],
    minDustValueUsd: 0.01,
  },
  10: {
    chain: optimism,
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    wrappedNative: '0x4200000000000000000000000000000000000006', // WETH
    stablecoins: [
      '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
      '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT
    ],
    minDustValueUsd: 0.01,
  },
  8453: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    wrappedNative: '0x4200000000000000000000000000000000000006', // WETH
    stablecoins: [
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    ],
    minDustValueUsd: 0.01,
  },
  137: {
    chain: polygon,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    wrappedNative: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    stablecoins: [
      '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
    ],
    minDustValueUsd: 0.01,
  },
  56: {
    chain: bsc,
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    wrappedNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    stablecoins: [
      '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
      '0x55d398326f99059fF775485246999027B3197955', // USDT
    ],
    minDustValueUsd: 0.01,
  },
  43114: {
    chain: avalanche,
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    wrappedNative: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
    stablecoins: [
      '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // USDC
    ],
    minDustValueUsd: 0.01,
  },
};

// Get chain by ID
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chainId];
}

// Get all supported chain IDs
export function getSupportedChainIds(): number[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}

// Create public client for a chain
export function createChainClient(chainId: number) {
  const config = getChainConfig(chainId);
  if (!config) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

// Chain name mapping
export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  8453: 'Base',
  137: 'Polygon',
  56: 'BSC',
  43114: 'Avalanche',
};

export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}
