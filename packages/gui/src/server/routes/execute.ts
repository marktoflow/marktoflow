import { Router, type Router as RouterType } from 'express';

const router: RouterType = Router();

// Note: Specific routes must come before catch-all routes

// Get execution status
router.get('/status/:runId', async (req, res) => {
  try {
    const { runId } = req.params;

    // TODO: Get actual execution status from state store

    res.json({
      runId,
      status: 'running',
      currentStep: 'step-1',
      progress: 50,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get execution status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Cancel execution
router.post('/cancel/:runId', async (req, res) => {
  try {
    const { runId } = req.params;

    // TODO: Cancel actual execution

    res.json({
      runId,
      status: 'cancelled',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to cancel execution',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Execute a workflow (catch-all route - must be last)
router.post('/:path(*)', async (req, res) => {
  try {
    const workflowPath = decodeURIComponent((req.params as Record<string, string>)['path(*)']);
    const { inputs, dryRun } = req.body;

    // TODO: Integrate with @marktoflow/core WorkflowEngine
    // For now, return a placeholder response

    res.json({
      runId: `run-${Date.now()}`,
      status: 'started',
      workflowPath,
      inputs,
      dryRun: dryRun || false,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to execute workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as executeRoutes };
