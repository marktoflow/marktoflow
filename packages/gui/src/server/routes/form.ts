/**
 * Form routes for human-in-the-loop workflows
 *
 * Handles form rendering and submission for workflows paused with wait steps.
 */

import { Router, type Router as RouterType, type Request, type Response } from 'express';
import type { ExecutionManager } from '../services/ExecutionManager.js';

const router: RouterType = Router();

// ExecutionManager instance (set via setExecutionManager)
let executionManager: ExecutionManager | null = null;

/**
 * Set the ExecutionManager instance (called from server/index.ts)
 */
export function setExecutionManager(manager: ExecutionManager): void {
  executionManager = manager;
}

/**
 * GET /form/:runId/:stepId/:token
 * Retrieve form schema and render form page
 */
router.get('/:runId/:stepId/:token', async (req: Request, res: Response) => {
  try {
    const runId = String(req.params.runId);
    const stepId = String(req.params.stepId);
    const token = String(req.params.token);

    if (!executionManager) {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'ExecutionManager not initialized',
      });
      return;
    }

    // Get execution status to verify it's waiting
    const status = executionManager.getExecutionStatus(runId);

    if (!status) {
      res.status(404).json({
        error: 'Not found',
        message: `Execution ${runId} not found`,
      });
      return;
    }

    if (status.status !== 'running') {
      res.status(400).json({
        error: 'Invalid state',
        message: `Execution is not running (status: ${status.status})`,
      });
      return;
    }

    // Find the step that's waiting for form input
    const waitingStep = status.stepResults.find(
      sr => sr.stepId === stepId && sr.status === 'completed'
    );

    if (!waitingStep || !waitingStep.output) {
      res.status(404).json({
        error: 'Not found',
        message: `No waiting step found for ${stepId}`,
      });
      return;
    }

    const stepOutput = waitingStep.output as any;

    // Verify token matches
    if (stepOutput.resumeToken !== token) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid resume token',
      });
      return;
    }

    // Verify mode is form
    if (stepOutput.mode !== 'form') {
      res.status(400).json({
        error: 'Invalid mode',
        message: `Step is not in form mode (mode: ${stepOutput.mode})`,
      });
      return;
    }

    // Return form schema
    res.json({
      runId,
      stepId,
      workflowId: status.workflowId,
      workflowPath: status.workflowPath,
      fields: stepOutput.fields || {},
      submitUrl: `/api/form/${runId}/${stepId}/${token}`,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get form',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /form/:runId/:stepId/:token
 * Submit form data and resume workflow execution
 */
router.post('/:runId/:stepId/:token', async (req: Request, res: Response) => {
  try {
    const runId = String(req.params.runId);
    const stepId = String(req.params.stepId);
    const token = String(req.params.token);
    const formData = req.body;

    if (!executionManager) {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'ExecutionManager not initialized',
      });
      return;
    }

    // Verify execution exists and is waiting
    const status = executionManager.getExecutionStatus(runId);

    if (!status) {
      res.status(404).json({
        error: 'Not found',
        message: `Execution ${runId} not found`,
      });
      return;
    }

    if (status.status !== 'running') {
      res.status(400).json({
        error: 'Invalid state',
        message: `Execution is not running (status: ${status.status})`,
      });
      return;
    }

    // Find the waiting step
    const waitingStep = status.stepResults.find(
      sr => sr.stepId === stepId && sr.status === 'completed'
    );

    if (!waitingStep || !waitingStep.output) {
      res.status(404).json({
        error: 'Not found',
        message: `No waiting step found for ${stepId}`,
      });
      return;
    }

    const stepOutput = waitingStep.output as any;

    // Verify token
    if (stepOutput.resumeToken !== token) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid resume token',
      });
      return;
    }

    // Validate form data against field schema
    const fields = stepOutput.fields as Record<string, { type?: string; required?: boolean }> | undefined;
    if (fields) {
      const errors: string[] = [];
      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        if (fieldDef.required && (formData[fieldName] === undefined || formData[fieldName] === '')) {
          errors.push(`Field "${fieldName}" is required`);
        }
        if (formData[fieldName] !== undefined && formData[fieldName] !== '' && fieldDef.type) {
          const value = formData[fieldName];
          if (fieldDef.type === 'number' && typeof value === 'string' && isNaN(Number(value))) {
            errors.push(`Field "${fieldName}" must be a number`);
          }
          if (fieldDef.type === 'boolean' && !['true', 'false', true, false].includes(value)) {
            errors.push(`Field "${fieldName}" must be a boolean`);
          }
        }
      }
      if (errors.length > 0) {
        res.status(400).json({
          error: 'Validation failed',
          message: errors.join('; '),
          errors,
        });
        return;
      }
    }

    // Resume execution with form data
    await executionManager.resumeExecution(runId, stepId, formData);

    res.json({
      success: true,
      runId,
      stepId,
      message: 'Form submitted successfully. Workflow execution resumed.',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to submit form',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as formRoutes };
