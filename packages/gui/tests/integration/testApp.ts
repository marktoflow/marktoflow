import express, { type Express } from 'express';
import cors from 'cors';
import { join } from 'path';
import { workflowRoutes } from '../../src/server/routes/workflows.js';
import { aiRoutes } from '../../src/server/routes/ai.js';
import { executeRoutes, setExecutionManager } from '../../src/server/routes/execute.js';
import { toolsRoutes } from '../../src/server/routes/tools.js';
import type { ExecutionManager, ExecutionStatus } from '../../src/server/services/ExecutionManager.js';
import { getAgentRegistry } from '../../src/server/services/agents/registry.js';

/**
 * Create a test Express app with all routes configured
 * This allows testing the API without starting an actual server
 */
export function createTestApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Mock AgentRegistry auto-detection to prevent timeouts
  const registry = getAgentRegistry();
  registry.autoDetectProvider = async () => 'demo';

  // Setup Mock ExecutionManager
  const mockExecutionManager = {
    startExecution: async () => 'run-123',
    getExecutionStatus: (runId: string) => {
      if (runId === 'run-123') {
        const status: ExecutionStatus = {
          runId: 'run-123',
          workflowPath: 'test-workflow.md',
          workflowId: 'test-workflow',
          status: 'running',
          currentStep: 1,
          totalSteps: 5,
          startedAt: new Date(),
          completedAt: null,
          error: null,
          stepResults: [],
        };
        return status;
      }
      return null;
    },
    cancelExecution: async (runId: string) => {
      if (runId === 'run-123') return true;
      return false;
    },
    listExecutions: () => [],
    getActiveCount: () => 0,
  } as unknown as ExecutionManager;

  // Initialize routes with mock manager
  // Use fixtures directory
  setExecutionManager(mockExecutionManager, join(__dirname, 'fixtures'));

  // Routes
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/execute', executeRoutes);
  app.use('/api/tools', toolsRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '2.0.0-alpha.5' });
  });

  return app;
}
