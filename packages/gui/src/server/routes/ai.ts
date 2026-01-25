import { Router, type Router as RouterType } from 'express';
import { AIService } from '../services/AIService.js';

const router: RouterType = Router();
const aiService = new AIService();

// Process AI prompt
router.post('/prompt', async (req, res) => {
  try {
    const { prompt, workflow } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await aiService.processPrompt(prompt, workflow);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process prompt',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get prompt history
router.get('/history', async (_req, res) => {
  try {
    const history = await aiService.getHistory();
    res.json({ history });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get AI suggestions for current context
router.post('/suggestions', async (req, res) => {
  try {
    const { workflow, selectedStepId } = req.body;
    const suggestions = await aiService.getSuggestions(workflow, selectedStepId);
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get available AI providers and status
router.get('/providers', async (_req, res) => {
  try {
    const status = aiService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get providers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Set active AI provider
router.post('/providers/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { apiKey, baseUrl, model } = req.body;

    const success = await aiService.setProvider(providerId, { apiKey, baseUrl, model });

    if (success) {
      const status = aiService.getStatus();
      res.json({ success: true, status });
    } else {
      res.status(400).json({
        error: 'Failed to set provider',
        message: `Provider "${providerId}" is not available or failed to initialize`,
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to set provider',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as aiRoutes };
