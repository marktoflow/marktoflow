import express, { type Express } from 'express';
import cors from 'cors';
import { workflowRoutes } from '../../src/server/routes/workflows.js';
import { aiRoutes } from '../../src/server/routes/ai.js';
import { executeRoutes } from '../../src/server/routes/execute.js';
import { toolsRoutes } from '../../src/server/routes/tools.js';

/**
 * Create a test Express app with all routes configured
 * This allows testing the API without starting an actual server
 */
export function createTestApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/execute', executeRoutes);
  app.use('/api/tools', toolsRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '2.0.0-alpha.2' });
  });

  return app;
}
