import { Hono } from 'hono';
import { z } from 'zod';
import { generateQuote, getQuote } from '../services/quoteService';
import { scanAllBalances } from '../services/balanceScanner';
import { getSupportedChainIds, CHAIN_NAMES, config } from '../config';
import type { ApiResponse, DustSummary, SweepQuote } from '../types';

// Create router
export const api = new Hono();

// Helper to serialize BigInt values to strings for JSON
function serializeBigInts<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'bigint') {
    return obj.toString() as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value);
    }
    return result as T;
  }
  return obj;
}

// Request validation schemas
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const getBalancesSchema = z.object({
  address: addressSchema,
  minValueUsd: z.coerce.number().optional(),
  maxValueUsd: z.coerce.number().optional(),
  chains: z.string().optional(), // comma-separated chain IDs
});

const getQuoteSchema = z.object({
  userAddress: addressSchema,
  destinationChainId: z.coerce.number(),
  destinationToken: addressSchema,
  donateToDefillama: z.coerce.boolean().optional(),
  minTokenValueUsd: z.coerce.number().optional(),
  maxTokenValueUsd: z.coerce.number().optional(),
  includeChains: z.string().optional(),
  excludeChains: z.string().optional(),
});

// Health check
api.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      version: '0.1.0',
      timestamp: Date.now(),
    },
  });
});

// Get supported chains
api.get('/chains', (c) => {
  const chains = getSupportedChainIds().map(id => ({
    chainId: id,
    name: CHAIN_NAMES[id],
  }));
  
  return c.json<ApiResponse<typeof chains>>({
    success: true,
    data: chains,
    timestamp: Date.now(),
  });
});

// Get dust balances for an address
api.get('/balances/:address', async (c) => {
  try {
    const address = c.req.param('address');
    const query = c.req.query();
    
    // Validate
    const parsed = getBalancesSchema.safeParse({ address, ...query });
    if (!parsed.success) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: `Invalid request: ${parsed.error.message}`,
        timestamp: Date.now(),
      }, 400);
    }
    
    const { minValueUsd, maxValueUsd, chains } = parsed.data;
    const includeChains = chains?.split(',').map(Number).filter(n => !isNaN(n));
    
    const summary = await scanAllBalances(
      address as `0x${string}`,
      { minValueUsd, maxValueUsd, includeChains }
    );
    
    // Serialize BigInt values to strings for JSON
    return c.json<ApiResponse<DustSummary>>(serializeBigInts({
      success: true,
      data: summary,
      timestamp: Date.now(),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json<ApiResponse<null>>({
      success: false,
      error: message,
      timestamp: Date.now(),
    }, 500);
  }
});

// Get sweep quote
api.post('/quote', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate
    const parsed = getQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: `Invalid request: ${parsed.error.message}`,
        timestamp: Date.now(),
      }, 400);
    }
    
    const { includeChains, excludeChains, ...rest } = parsed.data;
    
    const quote = await generateQuote({
      ...rest,
      userAddress: rest.userAddress as `0x${string}`,
      destinationToken: rest.destinationToken as `0x${string}`,
      includeChains: includeChains?.split(',').map(Number).filter(n => !isNaN(n)),
      excludeChains: excludeChains?.split(',').map(Number).filter(n => !isNaN(n)),
    });
    
    // Serialize BigInt values to strings for JSON
    return c.json<ApiResponse<SweepQuote>>(serializeBigInts({
      success: true,
      data: quote,
      timestamp: Date.now(),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json<ApiResponse<null>>({
      success: false,
      error: message,
      timestamp: Date.now(),
    }, 500);
  }
});

// Get donation quote (shorthand)
api.post('/donate', async (c) => {
  try {
    const body = await c.req.json();
    
    if (!config.defiLlamaTreasury) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: 'DefiLlama treasury address not configured',
        timestamp: Date.now(),
      }, 400);
    }
    
    // Validate address
    const addressResult = addressSchema.safeParse(body.userAddress);
    if (!addressResult.success) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid user address',
        timestamp: Date.now(),
      }, 400);
    }
    
    // Generate quote with donation flag
    const quote = await generateQuote({
      userAddress: body.userAddress as `0x${string}`,
      destinationChainId: body.destinationChainId || 1, // Default to mainnet
      destinationToken: body.destinationToken || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      donateToDefillama: true,
    });
    
    // Serialize BigInt values to strings for JSON
    return c.json<ApiResponse<SweepQuote>>(serializeBigInts({
      success: true,
      data: quote,
      timestamp: Date.now(),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json<ApiResponse<null>>({
      success: false,
      error: message,
      timestamp: Date.now(),
    }, 500);
  }
});

// Get existing quote
api.get('/quote/:quoteId', (c) => {
  const quoteId = c.req.param('quoteId');
  const quote = getQuote(quoteId);
  
  if (!quote) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: 'Quote not found or expired',
      timestamp: Date.now(),
    }, 404);
  }
  
  // Serialize BigInt values to strings for JSON
  return c.json<ApiResponse<SweepQuote>>(serializeBigInts({
    success: true,
    data: quote,
    timestamp: Date.now(),
  }));
});

// Execute sweep (placeholder - full implementation requires more infrastructure)
api.post('/execute', async (c) => {
  try {
    const body = await c.req.json();
    const { quoteId, signatures } = body;
    
    // Get quote
    const quote = getQuote(quoteId);
    if (!quote) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: 'Quote not found or expired',
        timestamp: Date.now(),
      }, 404);
    }
    
    // Validate signatures exist
    if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: 'Signatures required',
        timestamp: Date.now(),
      }, 400);
    }
    
    // In production: verify signatures, execute sweep transactions
    // For MVP, return pending status
    return c.json({
      success: true,
      data: {
        sweepId: `sweep_${quoteId}`,
        status: 'pending',
        message: 'Sweep execution queued. Full execution implementation pending.',
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json<ApiResponse<null>>({
      success: false,
      error: message,
      timestamp: Date.now(),
    }, 500);
  }
});

// Get sweep status (placeholder)
api.get('/sweep/:sweepId', (c) => {
  const sweepId = c.req.param('sweepId');
  
  // In production: lookup sweep status from database
  return c.json({
    success: true,
    data: {
      sweepId,
      status: 'pending',
      message: 'Status tracking implementation pending.',
    },
    timestamp: Date.now(),
  });
});
