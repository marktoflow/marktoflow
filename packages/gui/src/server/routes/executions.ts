/**
 * API routes for execution history
 */

import { Router, type Request, type Response } from 'express';
import { getStateStore } from '../index.js';

export const executionRoutes = Router();

/**
 * GET /api/executions
 * List all executions with optional filtering
 */
executionRoutes.get('/', (req: Request, res: Response) => {
  try {
    const stateStore = getStateStore();
    const { workflowId, status, limit, offset } = req.query;

    // Helper to extract string from query param
    const getString = (val: unknown): string | undefined => {
      if (typeof val === 'string') return val;
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') return val[0];
      return undefined;
    };

    const workflowIdStr = getString(workflowId);
    const statusStr = getString(status);
    const limitNum = parseInt(getString(limit) || '50', 10);
    const offsetNum = getString(offset) ? parseInt(getString(offset)!, 10) : undefined;

    const executions = stateStore.listExecutions({
      workflowId: workflowIdStr,
      status: statusStr as any,
      limit: limitNum,
      offset: offsetNum,
    });

    res.json(executions);
  } catch (error) {
    console.error('Error listing executions:', error);
    res.status(500).json({
      error: 'Failed to list executions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/executions/:runId
 * Get details for a specific execution
 */
executionRoutes.get('/:runId', (req: Request, res: Response) => {
  try {
    const stateStore = getStateStore();
    const runId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;

    const execution = stateStore.getExecution(runId);
    if (!execution) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    res.json(execution);
  } catch (error) {
    console.error('Error getting execution:', error);
    res.status(500).json({
      error: 'Failed to get execution',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/executions/:runId/checkpoints
 * Get checkpoints for a specific execution
 */
executionRoutes.get('/:runId/checkpoints', (req: Request, res: Response) => {
  try {
    const stateStore = getStateStore();
    const runId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;

    const checkpoints = stateStore.getCheckpoints(runId);
    res.json(checkpoints);
  } catch (error) {
    console.error('Error getting checkpoints:', error);
    res.status(500).json({
      error: 'Failed to get checkpoints',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/executions/:runId/stats
 * Get execution statistics
 */
executionRoutes.get('/:runId/stats', (req: Request, res: Response) => {
  try {
    const stateStore = getStateStore();
    const runId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;

    const execution = stateStore.getExecution(runId);
    if (!execution) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    const checkpoints = stateStore.getCheckpoints(runId);
    const completedSteps = checkpoints.filter((c) => c.status === 'completed').length;
    const failedSteps = checkpoints.filter((c) => c.status === 'failed').length;

    const stats = {
      runId,
      workflowId: execution.workflowId,
      status: execution.status,
      totalSteps: execution.totalSteps,
      completedSteps,
      failedSteps,
      currentStep: execution.currentStep,
      duration:
        execution.completedAt && execution.startedAt
          ? execution.completedAt.getTime() - execution.startedAt.getTime()
          : null,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting execution stats:', error);
    res.status(500).json({
      error: 'Failed to get execution stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
