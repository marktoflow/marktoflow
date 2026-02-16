/**
 * Execute routes for workflow execution via GUI
 *
 * Provides REST API endpoints for starting, monitoring, and cancelling
 * workflow executions with real-time updates via WebSocket.
 */

import { Router, type Router as RouterType, type Request, type Response } from 'express';
import { join, resolve, relative, isAbsolute } from 'path';
import { existsSync } from 'fs';
import type { ExecutionManager } from '../services/ExecutionManager.js';

const router: RouterType = Router();

// ExecutionManager instance (set via setExecutionManager)
let executionManager: ExecutionManager | null = null;
let workflowDir: string = process.cwd();

/**
 * Set the ExecutionManager instance (called from server/index.ts)
 */
export function setExecutionManager(manager: ExecutionManager, dir: string): void {
  executionManager = manager;
  workflowDir = dir;
}

/**
 * Resolve workflow path relative to workflow directory
 */
function resolveWorkflowPath(requestPath: string): string | null {
  const sanitizedPath = requestPath.trim();
  const normalizedRequestPath = sanitizedPath.replace(/\\/g, '/');

  if (
    !sanitizedPath ||
    sanitizedPath.includes('\0') ||
    isAbsolute(sanitizedPath) ||
    normalizedRequestPath.split('/').includes('..')
  ) {
    return null;
  }

  const baseWorkflowDir = resolve(workflowDir);
  const allowedLocalPath = resolve(baseWorkflowDir, sanitizedPath);
  const allowedMarktoflowDir = resolve(baseWorkflowDir, '.marktoflow', 'workflows');
  const allowedMarktoflowPath = resolve(allowedMarktoflowDir, sanitizedPath);

  const localRelative = relative(baseWorkflowDir, allowedLocalPath);
  if (
    !localRelative.startsWith('..') &&
    !isAbsolute(localRelative) &&
    existsSync(allowedLocalPath)
  ) {
    return allowedLocalPath;
  }

  const marktoflowRelative = relative(allowedMarktoflowDir, allowedMarktoflowPath);
  if (
    !marktoflowRelative.startsWith('..') &&
    !isAbsolute(marktoflowRelative) &&
    existsSync(allowedMarktoflowPath)
  ) {
    return allowedMarktoflowPath;
  }

  // Try relative to workflow directory for backwards compatibility
  const relativePath = join(workflowDir, sanitizedPath);
  if (existsSync(relativePath)) {
    return relativePath;
  }

  // Try in .marktoflow/workflows for backwards compatibility
  const marktoflowPath = join(workflowDir, '.marktoflow', 'workflows', sanitizedPath);
  if (existsSync(marktoflowPath)) {
    return marktoflowPath;
  }

  return null;
}

function isInvalidWorkflowPath(requestPath: string): boolean {
  const sanitizedPath = requestPath.trim();
  const normalizedRequestPath = sanitizedPath.replace(/\\/g, '/');
  return (
    !sanitizedPath ||
    sanitizedPath.includes('\0') ||
    isAbsolute(sanitizedPath) ||
    normalizedRequestPath.split('/').includes('..')
  );
}

// Note: Specific routes must come before catch-all routes

// Get execution status
router.get('/status/:runId', async (req: Request, res: Response) => {
  try {
    const runId = String(req.params.runId);

    if (!executionManager) {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'ExecutionManager not initialized',
      });
      return;
    }

    const status = executionManager.getExecutionStatus(runId);

    if (!status) {
      res.status(404).json({
        error: 'Not found',
        message: `Execution ${runId} not found`,
      });
      return;
    }

    res.json({
      runId: status.runId,
      workflowPath: status.workflowPath,
      workflowId: status.workflowId,
      status: status.status,
      currentStep: status.currentStep,
      totalSteps: status.totalSteps,
      progress: status.totalSteps > 0
        ? Math.round((status.currentStep / status.totalSteps) * 100)
        : 0,
      startedAt: status.startedAt?.toISOString() || null,
      completedAt: status.completedAt?.toISOString() || null,
      error: status.error,
      stepResults: status.stepResults,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get execution status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Cancel execution
router.post('/cancel/:runId', async (req: Request, res: Response) => {
  try {
    const runId = String(req.params.runId);

    if (!executionManager) {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'ExecutionManager not initialized',
      });
      return;
    }

    const cancelled = await executionManager.cancelExecution(runId);

    if (!cancelled) {
      res.status(404).json({
        error: 'Not found or not cancellable',
        message: `Execution ${runId} not found or already completed`,
      });
      return;
    }

    res.json({
      runId,
      status: 'cancelled',
      message: 'Execution cancelled successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to cancel execution',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// List recent executions
router.get('/list', async (req: Request, res: Response) => {
  try {
    if (!executionManager) {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'ExecutionManager not initialized',
      });
      return;
    }

    const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limit = limitParam ? parseInt(String(limitParam), 10) : 50;
    const statusParam = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
    const status = statusParam ? String(statusParam) : undefined;

    const executions = executionManager.listExecutions({ limit, status });

    res.json({
      executions: executions.map(exec => ({
        runId: exec.runId,
        workflowPath: exec.workflowPath,
        workflowId: exec.workflowId,
        status: exec.status,
        currentStep: exec.currentStep,
        totalSteps: exec.totalSteps,
        progress: exec.totalSteps > 0
          ? Math.round((exec.currentStep / exec.totalSteps) * 100)
          : 0,
        startedAt: exec.startedAt?.toISOString() || null,
        completedAt: exec.completedAt?.toISOString() || null,
        error: exec.error,
      })),
      total: executions.length,
      activeCount: executionManager.getActiveCount(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list executions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Execute a workflow (catch-all route - must be last)
router.post('/:path(*)', async (req: Request, res: Response) => {
  try {
    const pathParam = req.params.path || req.params[0] || '';
    const requestPath = decodeURIComponent(Array.isArray(pathParam) ? pathParam[0] : pathParam);
    const { inputs = {}, dryRun = false } = req.body;

    if (!executionManager) {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'ExecutionManager not initialized',
      });
      return;
    }

    if (isInvalidWorkflowPath(requestPath)) {
      res.status(400).json({
        error: 'Invalid workflow path',
        message: 'Path must be relative and stay within the workflow directory',
      });
      return;
    }

    // Resolve workflow path
    const workflowPath = resolveWorkflowPath(requestPath);
    if (!workflowPath) {
      res.status(404).json({
        error: 'Workflow not found',
        message: `Workflow not found at path: ${requestPath}`,
      });
      return;
    }

    // Handle dry-run mode (just parse and validate)
    if (dryRun) {
      try {
        const { parseFile } = await import('@marktoflow/core');
        const { workflow, warnings } = await parseFile(workflowPath);

        res.json({
          dryRun: true,
          valid: true,
          workflow: {
            id: workflow.metadata.id,
            name: workflow.metadata.name,
            version: workflow.metadata.version,
            description: workflow.metadata.description,
          },
          steps: workflow.steps.map(s => ({
            id: s.id,
            action: s.action,
            description: s.description,
          })),
          inputs: workflow.inputs,
          warnings,
        });
      } catch (parseError) {
        res.status(400).json({
          dryRun: true,
          valid: false,
          error: 'Failed to parse workflow',
          message: parseError instanceof Error ? parseError.message : 'Unknown error',
        });
      }
      return;
    }

    // Start execution
    const runId = await executionManager.startExecution(workflowPath, inputs);

    res.json({
      runId,
      status: 'started',
      workflowPath,
      inputs,
      message: 'Workflow execution started. Subscribe to WebSocket for real-time updates.',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to execute workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as executeRoutes };
