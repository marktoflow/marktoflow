import { Router } from 'express';
import { AIService } from '../services/AIService.js';

const router = Router();
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
router.get('/history', async (req, res) => {
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

export { router as aiRoutes };
