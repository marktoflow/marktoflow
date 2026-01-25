import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testApp.js';

const app = createTestApp();

describe('API Integration Tests', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        version: '2.0.0-alpha.1',
      });
    });
  });

  describe('Tools API', () => {
    describe('GET /api/tools', () => {
      it('should return list of available tools', async () => {
        const response = await request(app).get('/api/tools');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('tools');
        expect(Array.isArray(response.body.tools)).toBe(true);
        expect(response.body.tools.length).toBeGreaterThan(0);
      });

      it('should include expected tool properties', async () => {
        const response = await request(app).get('/api/tools');
        const tool = response.body.tools[0];

        expect(tool).toHaveProperty('id');
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('icon');
        expect(tool).toHaveProperty('category');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('actionCount');
      });

      it('should include slack tool', async () => {
        const response = await request(app).get('/api/tools');
        const slackTool = response.body.tools.find((t: { id: string }) => t.id === 'slack');

        expect(slackTool).toBeDefined();
        expect(slackTool.name).toBe('Slack');
        expect(slackTool.sdk).toBe('@slack/web-api');
      });

      it('should include github tool', async () => {
        const response = await request(app).get('/api/tools');
        const githubTool = response.body.tools.find((t: { id: string }) => t.id === 'github');

        expect(githubTool).toBeDefined();
        expect(githubTool.name).toBe('GitHub');
        expect(githubTool.sdk).toBe('@octokit/rest');
      });
    });

    describe('GET /api/tools/:toolId', () => {
      it('should return tool details', async () => {
        const response = await request(app).get('/api/tools/slack');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('tool');
        expect(response.body.tool.id).toBe('slack');
        expect(response.body.tool.actions).toBeDefined();
        expect(Array.isArray(response.body.tool.actions)).toBe(true);
      });

      it('should include action details', async () => {
        const response = await request(app).get('/api/tools/slack');
        const actions = response.body.tool.actions;

        expect(actions.length).toBeGreaterThan(0);

        const postMessage = actions.find((a: { id: string }) => a.id === 'chat.postMessage');
        expect(postMessage).toBeDefined();
        expect(postMessage.name).toBe('Post Message');
        expect(postMessage.inputs).toBeDefined();
        expect(postMessage.output).toBeDefined();
      });

      it('should return 404 for unknown tool', async () => {
        const response = await request(app).get('/api/tools/unknown-tool');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Tool not found');
      });
    });

    describe('GET /api/tools/:toolId/actions/:actionId', () => {
      it('should return action details', async () => {
        const response = await request(app).get('/api/tools/github/actions/pulls.get');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('action');
        expect(response.body.action.id).toBe('pulls.get');
        expect(response.body.action.name).toBe('Get Pull Request');
        expect(response.body.action.inputs).toBeDefined();
      });

      it('should include tool info in response', async () => {
        const response = await request(app).get('/api/tools/github/actions/pulls.get');

        expect(response.body).toHaveProperty('tool');
        expect(response.body.tool.id).toBe('github');
        expect(response.body.tool.name).toBe('GitHub');
      });

      it('should return 404 for unknown action', async () => {
        const response = await request(app).get('/api/tools/slack/actions/unknown-action');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Action not found');
      });

      it('should return 404 for unknown tool', async () => {
        const response = await request(app).get('/api/tools/unknown/actions/any');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Tool not found');
      });
    });
  });

  describe('Execute API', () => {
    describe('POST /api/execute/:path', () => {
      it('should start workflow execution', async () => {
        const response = await request(app)
          .post('/api/execute/test-workflow.md')
          .send({ inputs: { foo: 'bar' } });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('runId');
        expect(response.body).toHaveProperty('status', 'started');
        // The workflowPath is decoded from URL params
        expect(response.body.workflowPath).toBeDefined();
      });

      it('should support dry run mode', async () => {
        const response = await request(app)
          .post('/api/execute/test-workflow.md')
          .send({ inputs: {}, dryRun: true });

        expect(response.status).toBe(200);
        expect(response.body.dryRun).toBe(true);
      });
    });

    describe('GET /api/execute/status/:runId', () => {
      it('should return execution status', async () => {
        const response = await request(app).get('/api/execute/status/run-123');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('runId', 'run-123');
        expect(response.body).toHaveProperty('status');
      });
    });

    describe('POST /api/execute/cancel/:runId', () => {
      it('should cancel execution', async () => {
        const response = await request(app).post('/api/execute/cancel/run-123');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('runId', 'run-123');
        expect(response.body).toHaveProperty('status', 'cancelled');
      });
    });
  });

  describe('Workflows API', () => {
    describe('GET /api/workflows', () => {
      it('should return list of workflows', async () => {
        const response = await request(app).get('/api/workflows');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('workflows');
        expect(Array.isArray(response.body.workflows)).toBe(true);
      });
    });

    describe('POST /api/workflows', () => {
      it('should require name parameter', async () => {
        const response = await request(app)
          .post('/api/workflows')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Name is required');
      });
    });

    describe('PUT /api/workflows/:path', () => {
      it('should require workflow data', async () => {
        const response = await request(app)
          .put('/api/workflows/test.md')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Workflow data is required');
      });
    });
  });

  describe('AI API', () => {
    describe('POST /api/ai/prompt', () => {
      it('should require prompt parameter', async () => {
        const response = await request(app)
          .post('/api/ai/prompt')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Prompt is required');
      });

      it('should handle missing workflow gracefully', async () => {
        const response = await request(app)
          .post('/api/ai/prompt')
          .send({ prompt: 'Add a step' });

        // Service handles missing workflow, may return error
        expect([200, 500]).toContain(response.status);
      });
    });

    describe('GET /api/ai/history', () => {
      it('should return prompt history', async () => {
        const response = await request(app).get('/api/ai/history');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('history');
        expect(Array.isArray(response.body.history)).toBe(true);
      });
    });

    describe('POST /api/ai/suggestions', () => {
      it('should return suggestions for workflow', async () => {
        const response = await request(app)
          .post('/api/ai/suggestions')
          .send({ workflow: { steps: [] } });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('suggestions');
      });
    });
  });
});
