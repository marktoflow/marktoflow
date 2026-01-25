import { Router, type Router as RouterType } from 'express';
import { WorkflowService } from '../services/WorkflowService.js';

const router: RouterType = Router();
const workflowService = new WorkflowService();

// List all workflows
router.get('/', async (_req, res) => {
  try {
    const workflows = await workflowService.listWorkflows();
    res.json({ workflows });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list workflows',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get a specific workflow
router.get('/:path(*)', async (req, res) => {
  try {
    const workflowPath = decodeURIComponent((req.params as Record<string, string>)['path(*)']);
    const workflow = await workflowService.getWorkflow(workflowPath);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({ workflow });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create a new workflow
router.post('/', async (req, res) => {
  try {
    const { name, template } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const workflow = await workflowService.createWorkflow(name, template);
    res.status(201).json({ workflow });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update a workflow
router.put('/:path(*)', async (req, res) => {
  try {
    const workflowPath = decodeURIComponent((req.params as Record<string, string>)['path(*)']);
    const { workflow } = req.body;

    if (!workflow) {
      return res.status(400).json({ error: 'Workflow data is required' });
    }

    const updated = await workflowService.updateWorkflow(workflowPath, workflow);
    res.json({ workflow: updated });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete a workflow
router.delete('/:path(*)', async (req, res) => {
  try {
    const workflowPath = decodeURIComponent((req.params as Record<string, string>)['path(*)']);
    await workflowService.deleteWorkflow(workflowPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get workflow execution history
router.get('/:path(*)/runs', async (req, res) => {
  try {
    const workflowPath = decodeURIComponent((req.params as Record<string, string>)['path(*)']);
    const runs = await workflowService.getExecutionHistory(workflowPath);
    res.json({ runs });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get execution history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as workflowRoutes };
