import { Router, type Router as RouterType } from 'express';
import multer from 'multer';
import { WorkflowService } from '../services/WorkflowService.js';

const router: RouterType = Router();
const workflowService = new WorkflowService();

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.md', '.yaml', '.yml', '.zip'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .md, .yaml, .yml, and .zip files are allowed.'));
    }
  },
});

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
    // Express captures wildcard routes in params[0]
    const workflowPath = decodeURIComponent((req.params as any)[0] || '');
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

// Import workflow from file upload
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await workflowService.importWorkflow(
      req.file.buffer,
      req.file.originalname
    );

    res.json(result);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      error: 'Failed to import workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as workflowRoutes };
