import { createPublicClient, http, type Chain } from 'viem';
import {
  mainnet,
  arbitrum,
  optimism,
  base,
  bsc,
  polygon,
  gnosis,
  scroll,
  zora,
  mode,
  zksync,
} from 'viem/chains';

// EIP-7702 supported chains (as of Pectra upgrade, April 2025)
// Source: Ethereum Pectra hard fork rollout

export interface ChainConfig {
  chain: Chain;
  rpcUrl: string;
  delegateAddress?: `0x${string}`;
  vaultAddress?: `0x${string}`;
  wrappedNative: `0x${string}`;
  stablecoins: `0x${string}`[];
  minDustValueUsd: number;
}

// Chain configurations - EIP-7702 supported chains (Pectra upgrade)
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  // Ethereum Mainnet
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
  // Arbitrum
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
  // Optimism
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
  // Base
  8453: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    wrappedNative: '0x4200000000000000000000000000000000000006', // WETH
    stablecoins: [
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    ],
    minDustValueUsd: 0.01,
  },
  // BNB Smart Chain (BSC)
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
  // Polygon
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
  // Gnosis
  100: {
    chain: gnosis,
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com',
    wrappedNative: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // WXDAI
    stablecoins: [
      '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83', // USDC
    ],
    minDustValueUsd: 0.01,
  },
  // Scroll
  534352: {
    chain: scroll,
    rpcUrl: process.env.SCROLL_RPC_URL || 'https://rpc.scroll.io',
    wrappedNative: '0x5300000000000000000000000000000000000004', // WETH
    stablecoins: [
      '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4', // USDC
    ],
    minDustValueUsd: 0.01,
  },
  // Zora
  7777777: {
    chain: zora,
    rpcUrl: process.env.ZORA_RPC_URL || 'https://rpc.zora.energy',
    wrappedNative: '0x4200000000000000000000000000000000000006', // WETH
    stablecoins: [],
    minDustValueUsd: 0.01,
  },
  // Mode
  34443: {
    chain: mode,
    rpcUrl: process.env.MODE_RPC_URL || 'https://mainnet.mode.network',
    wrappedNative: '0x4200000000000000000000000000000000000006', // WETH
    stablecoins: [
      '0xd988097fb8612cc24eeC14542bC03424c656005f', // USDC
    ],
    minDustValueUsd: 0.01,
  },
  // ZKsync Era
  324: {
    chain: zksync,
    rpcUrl: process.env.ZKSYNC_RPC_URL || 'https://mainnet.era.zksync.io',
    wrappedNative: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', // WETH
    stablecoins: [
      '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', // USDC
    ],
    minDustValueUsd: 0.01,
  },
  // Additional EIP-7702 chains (not yet configured):
  // - Soneium
  // - Unichain
  // - Ink
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

// Chain name mapping (EIP-7702 supported chains)
export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  8453: 'Base',
  56: 'BNB Chain',
  137: 'Polygon',
  100: 'Gnosis',
  534352: 'Scroll',
  7777777: 'Zora',
  34443: 'Mode',
  324: 'ZKsync',
};

export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}
