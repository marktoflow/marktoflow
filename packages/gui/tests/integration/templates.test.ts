import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { templateRoutes } from '../../src/server/routes/templates.js';

function createTemplateTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/templates', templateRoutes);
  return app;
}

const app = createTemplateTestApp();

describe('Template Routes', () => {
  describe('GET /api/templates', () => {
    it('returns templates array including built-in ones', async () => {
      const res = await request(app).get('/api/templates');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('templates');
      expect(Array.isArray(res.body.templates)).toBe(true);

      // Should have at least the 3 built-in templates
      expect(res.body.templates.length).toBeGreaterThanOrEqual(3);

      const ids = res.body.templates.map((t: any) => t.id);
      expect(ids).toContain('blank');
      expect(ids).toContain('api-integration');
      expect(ids).toContain('data-pipeline');

      // Verify template structure
      const blank = res.body.templates.find((t: any) => t.id === 'blank');
      expect(blank.name).toBe('Blank Workflow');
      expect(blank.category).toBe('basic');
      expect(blank.tags).toContain('starter');
    });

    it('GET /?category=basic — filters by category', async () => {
      const res = await request(app).get('/api/templates?category=basic');

      expect(res.status).toBe(200);
      expect(res.body.templates.length).toBeGreaterThanOrEqual(1);

      // All returned templates should be in the basic category
      for (const template of res.body.templates) {
        expect(template.category).toBe('basic');
      }

      const ids = res.body.templates.map((t: any) => t.id);
      expect(ids).toContain('blank');
    });

    it('GET /?search=api — searches by name, description, and tags', async () => {
      const res = await request(app).get('/api/templates?search=api');

      expect(res.status).toBe(200);
      expect(res.body.templates.length).toBeGreaterThanOrEqual(1);

      const ids = res.body.templates.map((t: any) => t.id);
      expect(ids).toContain('api-integration');
    });
  });

  describe('GET /api/templates/:id', () => {
    it('returns a known template by id', async () => {
      // Ensure cache is populated
      await request(app).get('/api/templates');

      const res = await request(app).get('/api/templates/blank');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('template');
      expect(res.body).toHaveProperty('content');
      expect(res.body.template.id).toBe('blank');
      expect(res.body.template.name).toBe('Blank Workflow');
      expect(res.body.template.category).toBe('basic');
    });

    it('returns 404 for unknown template', async () => {
      // Ensure cache is populated first
      await request(app).get('/api/templates');

      const res = await request(app).get('/api/templates/nonexistent-template-xyz');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });
});
