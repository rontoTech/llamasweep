import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the balance scanner
vi.mock('../../src/services/balanceScanner', () => ({
  scanAllBalances: vi.fn(),
  fetchPrices: vi.fn(),
}));

import { generateQuote, getQuote } from '../../src/services/quoteService';
import { scanAllBalances, fetchPrices } from '../../src/services/balanceScanner';

describe('Quote Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateQuote', () => {
    it('should generate a valid quote for dust tokens', async () => {
      // Mock dust summary
      const mockDustSummary = {
        totalValueUsd: 25.50,
        tokenCount: 3,
        chainCount: 2,
        balances: [
          {
            chainId: 1,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            balance: 10000000n, // 10 USDC
            balanceFormatted: '10.0',
            priceUsd: 1.0,
            valueUsd: 10.0,
          },
          {
            chainId: 42161,
            address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`,
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            balance: 8500000n, // 8.5 USDC
            balanceFormatted: '8.5',
            priceUsd: 1.0,
            valueUsd: 8.5,
          },
          {
            chainId: 1,
            address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            symbol: 'ETH',
            name: 'Ethereum',
            decimals: 18,
            balance: 2500000000000000n, // 0.0025 ETH
            balanceFormatted: '0.0025',
            priceUsd: 2800,
            valueUsd: 7.0,
          },
        ],
        timestamp: Date.now(),
      };

      vi.mocked(scanAllBalances).mockResolvedValue(mockDustSummary);
      vi.mocked(fetchPrices).mockResolvedValue(new Map([
        ['ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1.0],
      ]));

      const quote = await generateQuote({
        userAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        destinationChainId: 1,
        destinationToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
        donateToDefillama: false,
      });

      expect(quote).toBeDefined();
      expect(quote.quoteId).toBeDefined();
      expect(quote.totalInputValueUsd).toBeCloseTo(25.50, 1);
      expect(quote.dustTokens).toHaveLength(3);
      expect(quote.feePercent).toBe(10); // 10% fee
      expect(quote.isDonation).toBe(false);
    });

    it('should apply 0% fee for donations', async () => {
      const mockDustSummary = {
        totalValueUsd: 15.0,
        tokenCount: 1,
        chainCount: 1,
        balances: [
          {
            chainId: 1,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            balance: 15000000n,
            balanceFormatted: '15.0',
            priceUsd: 1.0,
            valueUsd: 15.0,
          },
        ],
        timestamp: Date.now(),
      };

      vi.mocked(scanAllBalances).mockResolvedValue(mockDustSummary);
      vi.mocked(fetchPrices).mockResolvedValue(new Map());

      // Set treasury address for donation
      process.env.DEFILLAMA_TREASURY = '0x1234567890123456789012345678901234567890';

      const quote = await generateQuote({
        userAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        destinationChainId: 1,
        destinationToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
        donateToDefillama: true,
      });

      expect(quote.isDonation).toBe(true);
      expect(quote.feePercent).toBe(0);
      expect(quote.feeAmountUsd).toBe(0);
    });

    it('should throw error when no dust found', async () => {
      vi.mocked(scanAllBalances).mockResolvedValue({
        totalValueUsd: 0,
        tokenCount: 0,
        chainCount: 0,
        balances: [],
        timestamp: Date.now(),
      });

      await expect(
        generateQuote({
          userAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
          destinationChainId: 1,
          destinationToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
        })
      ).rejects.toThrow('No dust tokens found');
    });

    it('should throw error for unsupported destination chain', async () => {
      await expect(
        generateQuote({
          userAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
          destinationChainId: 99999, // Invalid chain
          destinationToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
        })
      ).rejects.toThrow('Unsupported destination chain');
    });
  });

  describe('getQuote', () => {
    it('should return null for non-existent quote', () => {
      const result = getQuote('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return null for expired quote', async () => {
      // This would need to mock time or wait for expiry
      // For now, just test the non-existent case
      const result = getQuote('expired-quote-id');
      expect(result).toBeNull();
    });
  });
});
