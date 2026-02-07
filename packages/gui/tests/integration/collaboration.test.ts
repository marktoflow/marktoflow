import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { collaborationRoutes } from '../../src/server/routes/collaboration.js';

function createCollabTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/collaboration', collaborationRoutes);
  return app;
}

describe('Collaboration Routes Integration', () => {
  const app = createCollabTestApp();

  describe('POST /lock', () => {
    it('acquires lock with workflowPath and userId', async () => {
      const res = await request(app)
        .post('/api/collaboration/lock')
        .send({ workflowPath: 'collab/lock-acquire.md', userId: 'user-1' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('lock');
      expect(res.body.lock.workflowPath).toBe('collab/lock-acquire.md');
      expect(res.body.lock.lockedBy).toBe('user-1');
      expect(res.body.lock.lockedAt).toBeDefined();
      expect(res.body.lock.expiresAt).toBeDefined();
    });

    it('returns 400 when workflowPath or userId is missing', async () => {
      const res1 = await request(app)
        .post('/api/collaboration/lock')
        .send({ workflowPath: 'collab/lock-400.md' });
      expect(res1.status).toBe(400);
      expect(res1.body).toHaveProperty('error');

      const res2 = await request(app)
        .post('/api/collaboration/lock')
        .send({ userId: 'user-1' });
      expect(res2.status).toBe(400);

      const res3 = await request(app)
        .post('/api/collaboration/lock')
        .send({});
      expect(res3.status).toBe(400);
    });

    it('returns 409 when a different user holds the lock', async () => {
      const wfPath = 'collab/lock-conflict.md';

      // User 1 acquires lock
      await request(app)
        .post('/api/collaboration/lock')
        .send({ workflowPath: wfPath, userId: 'user-1' });

      // User 2 tries to acquire the same lock
      const res = await request(app)
        .post('/api/collaboration/lock')
        .send({ workflowPath: wfPath, userId: 'user-2' });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('lock');
      expect(res.body.lock.lockedBy).toBe('user-1');
    });

    it('allows same user to re-acquire their own lock', async () => {
      const wfPath = 'collab/lock-reacquire.md';

      await request(app)
        .post('/api/collaboration/lock')
        .send({ workflowPath: wfPath, userId: 'user-1' });

      const res = await request(app)
        .post('/api/collaboration/lock')
        .send({ workflowPath: wfPath, userId: 'user-1' });

      expect(res.status).toBe(200);
      expect(res.body.lock.lockedBy).toBe('user-1');
    });
  });

  describe('POST /unlock', () => {
    it('releases lock', async () => {
      const wfPath = 'collab/unlock.md';

      // Acquire lock
      await request(app)
        .post('/api/collaboration/lock')
        .send({ workflowPath: wfPath, userId: 'user-1' });

      // Release lock
      const unlockRes = await request(app)
        .post('/api/collaboration/unlock')
        .send({ workflowPath: wfPath, userId: 'user-1' });

      expect(unlockRes.status).toBe(200);
      expect(unlockRes.body).toHaveProperty('success', true);

      // Verify lock is released
      const statusRes = await request(app).get(`/api/collaboration/lock/${wfPath}`);
      expect(statusRes.body.locked).toBe(false);
    });
  });

  describe('GET /lock/:path', () => {
    it('returns locked status when lock is held', async () => {
      const wfPath = 'collab/lock-status-held.md';

      await request(app)
        .post('/api/collaboration/lock')
        .send({ workflowPath: wfPath, userId: 'user-1' });

      const res = await request(app).get(`/api/collaboration/lock/${wfPath}`);

      expect(res.status).toBe(200);
      expect(res.body.locked).toBe(true);
      expect(res.body).toHaveProperty('lock');
      expect(res.body.lock.lockedBy).toBe('user-1');
    });

    it('returns not locked status when no lock exists', async () => {
      const res = await request(app).get('/api/collaboration/lock/collab/no-lock.md');

      expect(res.status).toBe(200);
      expect(res.body.locked).toBe(false);
    });
  });

  describe('GET /comments/:path', () => {
    it('returns empty comments initially', async () => {
      const res = await request(app).get('/api/collaboration/comments/collab/no-comments.md');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('comments');
      expect(res.body.comments).toEqual([]);
    });
  });

  describe('POST /comments', () => {
    it('adds a comment with workflowPath, text, and author', async () => {
      const wfPath = 'collab/comments-add.md';

      const res = await request(app)
        .post('/api/collaboration/comments')
        .send({ workflowPath: wfPath, text: 'Looks good!', author: 'alice' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('comment');
      expect(res.body.comment.workflowPath).toBe(wfPath);
      expect(res.body.comment.text).toBe('Looks good!');
      expect(res.body.comment.author).toBe('alice');
      expect(res.body.comment.resolved).toBe(false);
      expect(res.body.comment.id).toBeDefined();
      expect(res.body.comment.createdAt).toBeDefined();
    });

    it('comments appear in GET /comments/:path', async () => {
      const wfPath = 'collab/comments-list.md';

      await request(app)
        .post('/api/collaboration/comments')
        .send({ workflowPath: wfPath, text: 'Comment 1', author: 'alice' });
      await request(app)
        .post('/api/collaboration/comments')
        .send({ workflowPath: wfPath, text: 'Comment 2', author: 'bob' });

      const res = await request(app).get(`/api/collaboration/comments/${wfPath}`);
      expect(res.status).toBe(200);
      expect(res.body.comments.length).toBe(2);
    });
  });

  describe('POST /comments/:commentId/resolve', () => {
    it('resolves a comment', async () => {
      const wfPath = 'collab/comments-resolve.md';

      // Create a comment
      const createRes = await request(app)
        .post('/api/collaboration/comments')
        .send({ workflowPath: wfPath, text: 'Fix this', author: 'alice' });
      const commentId = createRes.body.comment.id;

      // Resolve it
      const resolveRes = await request(app)
        .post(`/api/collaboration/comments/${commentId}/resolve`)
        .send({ workflowPath: wfPath });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.comment.resolved).toBe(true);
      expect(resolveRes.body.comment.id).toBe(commentId);
    });

    it('returns 404 for unknown commentId', async () => {
      const res = await request(app)
        .post('/api/collaboration/comments/comment-nonexistent/resolve')
        .send({ workflowPath: 'collab/comments-resolve-404.md' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /activity/:path', () => {
    it('returns activity feed including comment activities', async () => {
      const wfPath = 'collab/activity-feed.md';

      // Add a comment (which triggers activity tracking)
      await request(app)
        .post('/api/collaboration/comments')
        .send({ workflowPath: wfPath, text: 'Activity test', author: 'alice' });

      const res = await request(app).get(`/api/collaboration/activity/${wfPath}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('activities');
      expect(res.body.activities.length).toBeGreaterThanOrEqual(1);

      const activity = res.body.activities[0];
      expect(activity).toHaveProperty('id');
      expect(activity).toHaveProperty('workflowPath', wfPath);
      expect(activity).toHaveProperty('author', 'alice');
      expect(activity).toHaveProperty('action', 'comment');
      expect(activity).toHaveProperty('details');
      expect(activity).toHaveProperty('createdAt');
    });

    it('returns empty activity feed for unknown path', async () => {
      const res = await request(app).get('/api/collaboration/activity/collab/no-activity.md');

      expect(res.status).toBe(200);
      expect(res.body.activities).toEqual([]);
    });
  });
});
