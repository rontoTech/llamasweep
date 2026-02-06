import { describe, it, expect } from 'vitest';
import {
  getChainConfig,
  getSupportedChainIds,
  getChainName,
  SUPPORTED_CHAINS,
} from '../../src/config/chains';

describe('Chain Configuration', () => {
  describe('SUPPORTED_CHAINS', () => {
    it('should have all major EVM chains', () => {
      const expectedChains = [1, 42161, 10, 8453, 137, 56, 43114];
      
      for (const chainId of expectedChains) {
        expect(SUPPORTED_CHAINS[chainId]).toBeDefined();
      }
    });

    it('should have valid RPC URLs for all chains', () => {
      for (const [chainId, config] of Object.entries(SUPPORTED_CHAINS)) {
        expect(config.rpcUrl).toBeTruthy();
        expect(config.rpcUrl.startsWith('http')).toBe(true);
      }
    });

    it('should have wrapped native token addresses', () => {
      for (const [chainId, config] of Object.entries(SUPPORTED_CHAINS)) {
        expect(config.wrappedNative).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });

    it('should have at least one stablecoin per chain', () => {
      for (const [chainId, config] of Object.entries(SUPPORTED_CHAINS)) {
        expect(config.stablecoins.length).toBeGreaterThan(0);
        
        for (const stablecoin of config.stablecoins) {
          expect(stablecoin).toMatch(/^0x[a-fA-F0-9]{40}$/);
        }
      }
    });
  });

  describe('getChainConfig', () => {
    it('should return config for valid chain ID', () => {
      const config = getChainConfig(1);
      
      expect(config).toBeDefined();
      expect(config?.chain.id).toBe(1);
      expect(config?.rpcUrl).toBeTruthy();
    });

    it('should return undefined for invalid chain ID', () => {
      const config = getChainConfig(99999);
      expect(config).toBeUndefined();
    });
  });

  describe('getSupportedChainIds', () => {
    it('should return array of chain IDs', () => {
      const chainIds = getSupportedChainIds();
      
      expect(Array.isArray(chainIds)).toBe(true);
      expect(chainIds.length).toBeGreaterThan(0);
      expect(chainIds).toContain(1); // Ethereum
      expect(chainIds).toContain(42161); // Arbitrum
    });
  });

  describe('getChainName', () => {
    it('should return correct names for known chains', () => {
      expect(getChainName(1)).toBe('Ethereum');
      expect(getChainName(42161)).toBe('Arbitrum');
      expect(getChainName(10)).toBe('Optimism');
      expect(getChainName(8453)).toBe('Base');
      expect(getChainName(137)).toBe('Polygon');
      expect(getChainName(56)).toBe('BSC');
      expect(getChainName(43114)).toBe('Avalanche');
    });

    it('should return fallback name for unknown chains', () => {
      const name = getChainName(99999);
      expect(name).toBe('Chain 99999');
    });
  });
});
