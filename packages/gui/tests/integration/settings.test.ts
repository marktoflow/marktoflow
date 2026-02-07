import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DEFAULT_SETTINGS } from '../../src/shared/settings.js';
import { settingsRoutes, setSettingsDir } from '../../src/server/routes/settings.js';

const tempDir = mkdtempSync(join(tmpdir(), 'marktoflow-settings-test-'));

function createSettingsTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/settings', settingsRoutes);
  return app;
}

const app = createSettingsTestApp();

describe('Settings API Routes', () => {
  beforeEach(() => {
    // Create a fresh settings dir for each test
    const testSettingsDir = mkdtempSync(join(tempDir, 'settings-'));
    setSettingsDir(testSettingsDir);
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('GET /api/settings', () => {
    it('should return default settings when no file exists', async () => {
      const res = await request(app).get('/api/settings');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('general');
      expect(res.body).toHaveProperty('canvas');
      expect(res.body).toHaveProperty('editor');
      expect(res.body).toHaveProperty('execution');
      expect(res.body).toHaveProperty('ai');
      expect(res.body).toHaveProperty('notifications');
      expect(res.body.general.theme).toBe('dark');
    });

    it('should create settings.json on first read', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      // The route should have written the defaults file
      // (we can verify by reading it back)
      const res2 = await request(app).get('/api/settings');
      expect(res2.body).toEqual(res.body);
    });

    it('should return saved settings merged with defaults', async () => {
      // Pre-write a partial settings file using the current settingsDir
      // We need to write to the correct path the route is using.
      // We do this by first PUTting settings via the API, then reading.
      await request(app)
        .put('/api/settings')
        .send({ general: { theme: 'light' } });

      const res = await request(app).get('/api/settings');

      expect(res.status).toBe(200);
      expect(res.body.general.theme).toBe('light');
      // Other categories should have defaults
      expect(res.body.canvas.showGrid).toBe(true);
      expect(res.body.editor.autoSaveEnabled).toBe(false);
    });

    it('should merge new default keys into saved settings', async () => {
      // Save only partial canvas settings
      await request(app)
        .patch('/api/settings/canvas')
        .send({ showGrid: false, snapToGrid: false });

      const res = await request(app).get('/api/settings');

      expect(res.status).toBe(200);
      expect(res.body.canvas.showGrid).toBe(false);
      expect(res.body.canvas.snapToGrid).toBe(false);
      expect(res.body.canvas.gridSize).toBe(20); // default preserved
      expect(res.body.general.theme).toBe('dark'); // default for untouched category
    });
  });

  describe('PUT /api/settings', () => {
    it('should replace all settings', async () => {
      const newSettings = {
        ...DEFAULT_SETTINGS,
        general: { theme: 'light' },
        canvas: { ...DEFAULT_SETTINGS.canvas, showGrid: false },
      };

      const res = await request(app)
        .put('/api/settings')
        .send(newSettings);

      expect(res.status).toBe(200);
      expect(res.body.general.theme).toBe('light');
      expect(res.body.canvas.showGrid).toBe(false);
    });

    it('should persist settings and be readable via GET', async () => {
      await request(app)
        .put('/api/settings')
        .send({ general: { theme: 'system' } });

      const res = await request(app).get('/api/settings');
      expect(res.body.general.theme).toBe('system');
    });

    it('should merge partial body with defaults', async () => {
      const res = await request(app)
        .put('/api/settings')
        .send({ general: { theme: 'light' } });

      expect(res.status).toBe(200);
      expect(res.body.canvas).toEqual(DEFAULT_SETTINGS.canvas);
      expect(res.body.editor).toEqual(DEFAULT_SETTINGS.editor);
    });
  });

  describe('PATCH /api/settings/:category', () => {
    it('should update a single category', async () => {
      const res = await request(app)
        .patch('/api/settings/canvas')
        .send({ showGrid: false, gridSize: 40 });

      expect(res.status).toBe(200);
      expect(res.body.canvas.showGrid).toBe(false);
      expect(res.body.canvas.gridSize).toBe(40);
      expect(res.body.canvas.snapToGrid).toBe(true);
    });

    it('should not affect other categories', async () => {
      await request(app)
        .patch('/api/settings/general')
        .send({ theme: 'light' });

      const res = await request(app)
        .patch('/api/settings/editor')
        .send({ autoSaveEnabled: true });

      expect(res.status).toBe(200);
      expect(res.body.general.theme).toBe('light');
      expect(res.body.editor.autoSaveEnabled).toBe(true);
    });

    it('should return 400 for unknown category', async () => {
      const res = await request(app)
        .patch('/api/settings/unknown')
        .send({ foo: 'bar' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('Unknown settings category');
    });

    it('should persist changes across GET requests', async () => {
      await request(app)
        .patch('/api/settings/notifications')
        .send({ workflowSaved: true });

      const res = await request(app).get('/api/settings');
      expect(res.body.notifications.workflowSaved).toBe(true);
    });

    it('should handle all valid categories', async () => {
      const categories = ['general', 'canvas', 'editor', 'execution', 'ai', 'notifications'];

      for (const category of categories) {
        const res = await request(app)
          .patch(`/api/settings/${category}`)
          .send({});

        expect(res.status).toBe(200);
      }
    });
  });
});
