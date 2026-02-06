import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { api } from './api/routes';
import { config } from './config';

// Create main app
const app = new Hono();

// Middleware
app.use('*', cors({
  origin: '*', // Configure properly in production
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
app.use('*', logger());

// Mount API routes
app.route('/api', api);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'LlamaSweep Solver',
    version: '0.1.0',
    description: 'Multi-chain dust consolidation solver',
    docs: '/api/health',
    endpoints: {
      health: 'GET /api/health',
      chains: 'GET /api/chains',
      balances: 'GET /api/balances/:address',
      quote: 'POST /api/quote',
      donate: 'POST /api/donate',
      execute: 'POST /api/execute',
      status: 'GET /api/sweep/:sweepId',
    },
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not found',
    timestamp: Date.now(),
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    success: false,
    error: 'Internal server error',
    timestamp: Date.now(),
  }, 500);
});

// Start server
const port = config.port;
const host = config.host;

console.log(`
╔═══════════════════════════════════════════════╗
║           🦙 LlamaSweep Solver                ║
╠═══════════════════════════════════════════════╣
║  Starting server...                           ║
║  Port: ${port}                                    ║
║  Host: ${host}                              ║
╚═══════════════════════════════════════════════╝
`);

serve({
  fetch: app.fetch,
  port,
  hostname: host,
}, (info) => {
  console.log(`🚀 Server running at http://${info.address}:${info.port}`);
  console.log(`📚 API docs at http://${info.address}:${info.port}/`);
});

export { app };
