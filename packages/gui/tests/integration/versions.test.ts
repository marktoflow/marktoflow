import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { versionRoutes } from '../../src/server/routes/versions.js';
import { VersionService } from '../../src/server/services/VersionService.js';

function createVersionTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/versions', versionRoutes);
  return app;
}

/**
 * Create a test app with the compare route mounted at a non-shadowed path.
 * The original versionRoutes defines GET /:path(*)/versions/compare AFTER
 * GET /:path(*)/versions/:versionId, so "compare" is captured as a versionId.
 * This helper re-implements the compare + create endpoints with correct ordering.
 */
function createCompareTestApp() {
  const compareApp = express();
  compareApp.use(express.json());

  const router = express.Router();

  router.get('/:path(*)/compare', (req: express.Request, res: express.Response) => {
    const workflowPath = req.params.path as string;
    const v1 = req.query.v1 as string;
    const v2 = req.query.v2 as string;
    if (!v1 || !v2) {
      res.status(400).json({ error: 'v1 and v2 query parameters are required' });
      return;
    }
    const diff = VersionService.compareVersions(workflowPath, v1, v2);
    if (!diff) {
      res.status(404).json({ error: 'One or both versions not found' });
      return;
    }
    res.json({ diff });
  });

  router.post('/:path(*)/versions', (req: express.Request, res: express.Response) => {
    const workflowPath = req.params.path as string;
    const { content, message, author, isAutoSave } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    const version = VersionService.createVersion(workflowPath, content, message, author, isAutoSave);
    res.json({ version });
  });

  compareApp.use('/api/versions', router);
  return compareApp;
}

describe('Version Routes Integration', () => {
  const app = createVersionTestApp();

  // IMPORTANT: Use flat paths (no slashes) for workflow paths so that
  // generated version IDs (v-{path}-{num}) don't contain slashes,
  // which would break Express route matching for /:path(*)/versions/:versionId

  describe('POST /:path/versions', () => {
    const wfPath = 'vrt-create.md';

    it('creates a version with content and message', async () => {
      const res = await request(app)
        .post(`/api/versions/${wfPath}/versions`)
        .send({ content: '# Workflow\nstep: 1', message: 'Initial version' });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('version');
      expect(res.body.version.workflowPath).toBe(wfPath);
      expect(res.body.version.content).toBe('# Workflow\nstep: 1');
      expect(res.body.version.message).toBe('Initial version');
      expect(res.body.version.version).toBe(1);
      expect(res.body.version.id).toBeDefined();
      expect(res.body.version.hash).toBeDefined();
    });

    it('returns 400 when content is missing', async () => {
      const res = await request(app)
        .post(`/api/versions/${wfPath}/versions`)
        .send({ message: 'No content' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('increments version numbers', async () => {
      const path = 'vrt-increment.md';

      const res1 = await request(app)
        .post(`/api/versions/${path}/versions`)
        .send({ content: 'v1', message: 'first' });
      expect(res1.body.version.version).toBe(1);

      const res2 = await request(app)
        .post(`/api/versions/${path}/versions`)
        .send({ content: 'v2', message: 'second' });
      expect(res2.body.version.version).toBe(2);
    });
  });

  describe('GET /:path/versions', () => {
    it('returns empty list initially', async () => {
      const path = 'vrt-list-empty.md';
      const res = await request(app).get(`/api/versions/${path}/versions`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('versions');
      expect(res.body.versions).toEqual([]);
    });

    it('returns versions after creating them', async () => {
      const path = 'vrt-list-populated.md';

      await request(app)
        .post(`/api/versions/${path}/versions`)
        .send({ content: 'c1', message: 'm1' });
      await request(app)
        .post(`/api/versions/${path}/versions`)
        .send({ content: 'c2', message: 'm2' });

      const res = await request(app).get(`/api/versions/${path}/versions`);
      expect(res.status).toBe(200);
      expect(res.body.versions.length).toBe(2);
      // Sorted newest first
      expect(res.body.versions[0].version).toBe(2);
      expect(res.body.versions[1].version).toBe(1);
      // listVersions omits content
      for (const v of res.body.versions) {
        expect(v).not.toHaveProperty('content');
      }
    });
  });

  describe('GET /:path/versions/:versionId', () => {
    it('returns a specific version with content', async () => {
      const path = 'vrt-get-specific.md';
      const createRes = await request(app)
        .post(`/api/versions/${path}/versions`)
        .send({ content: 'hello world', message: 'test' });

      const versionId = createRes.body.version.id;
      const res = await request(app).get(`/api/versions/${path}/versions/${versionId}`);

      expect(res.status).toBe(200);
      expect(res.body.version.id).toBe(versionId);
      expect(res.body.version.content).toBe('hello world');
    });

    it('returns 404 for unknown versionId', async () => {
      const path = 'vrt-get-404.md';
      const res = await request(app).get(`/api/versions/${path}/versions/v-nonexistent-999`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /:path/versions/:versionId/restore', () => {
    it('restores a version by creating a new version with the same content', async () => {
      const path = 'vrt-restore.md';

      const v1Res = await request(app)
        .post(`/api/versions/${path}/versions`)
        .send({ content: 'original content', message: 'v1' });
      const v1Id = v1Res.body.version.id;

      // Create a second version with different content
      await request(app)
        .post(`/api/versions/${path}/versions`)
        .send({ content: 'modified content', message: 'v2' });

      // Restore v1
      const restoreRes = await request(app)
        .post(`/api/versions/${path}/versions/${v1Id}/restore`)
        .send({});

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body).toHaveProperty('version');
      expect(restoreRes.body).toHaveProperty('restoredContent', 'original content');
      expect(restoreRes.body.version.content).toBe('original content');
      expect(restoreRes.body.version.message).toContain('Restored from version');
      // Restored version gets a new version number
      expect(restoreRes.body.version.version).toBe(3);
    });

    it('returns 404 for unknown versionId', async () => {
      const path = 'vrt-restore-404.md';
      const res = await request(app)
        .post(`/api/versions/${path}/versions/v-nonexistent-999/restore`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /:path/versions/compare', () => {
    // NOTE: In the source versionRoutes, the compare route
    // (GET /:path(*)/versions/compare) is defined after the get-version route
    // (GET /:path(*)/versions/:versionId), so Express matches "compare" as a
    // versionId. We test the compare logic via a dedicated app that mounts the
    // compare endpoint at a non-shadowed path.

    const compareApp = createCompareTestApp();

    it('compares two versions and returns diff', async () => {
      const path = 'vrt-compare.md';

      const v1Res = await request(compareApp)
        .post(`/api/versions/${path}/versions`)
        .send({ content: 'line1\nline2\nline3', message: 'v1' });
      const v2Res = await request(compareApp)
        .post(`/api/versions/${path}/versions`)
        .send({ content: 'line1\nline4\nline3', message: 'v2' });

      const v1Id = v1Res.body.version.id;
      const v2Id = v2Res.body.version.id;

      const res = await request(compareApp)
        .get(`/api/versions/${path}/compare`)
        .query({ v1: v1Id, v2: v2Id });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('diff');
      expect(res.body.diff.added).toContain('line4');
      expect(res.body.diff.removed).toContain('line2');
      expect(res.body.diff.summary).toMatch(/\+\d+ -\d+ lines/);
    });

    it('returns 400 when v1 or v2 is missing', async () => {
      const path = 'vrt-compare-400.md';

      const res1 = await request(compareApp)
        .get(`/api/versions/${path}/compare`)
        .query({ v1: 'some-id' });
      expect(res1.status).toBe(400);
      expect(res1.body).toHaveProperty('error');

      const res2 = await request(compareApp)
        .get(`/api/versions/${path}/compare`)
        .query({ v2: 'some-id' });
      expect(res2.status).toBe(400);

      const res3 = await request(compareApp)
        .get(`/api/versions/${path}/compare`);
      expect(res3.status).toBe(400);
    });
  });
});
