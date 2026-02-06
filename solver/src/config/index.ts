import 'dotenv/config';

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  
  // Fees
  defaultFeeBps: parseInt(process.env.DEFAULT_FEE_BPS || '1000', 10),
  maxFeeBps: 2000,
  
  // Dust thresholds
  minDustValueUsd: 0.01,
  maxDustValueUsd: 10,
  
  // DefiLlama treasury
  defiLlamaTreasury: process.env.DEFILLAMA_TREASURY as `0x${string}` | undefined,
  
  // Solver wallet
  solverPrivateKey: process.env.SOLVER_PRIVATE_KEY as `0x${string}` | undefined,
  
  // API endpoints
  defiLlamaApi: 'https://coins.llama.fi',
  debankApi: 'https://pro-openapi.debank.com/v1',
  
  // Rate limiting
  rateLimitRps: 10,
  
  // Timeouts
  sweepDeadlineSeconds: 3600, // 1 hour
  quoteExpirySeconds: 300, // 5 minutes
};

export * from './chains';
