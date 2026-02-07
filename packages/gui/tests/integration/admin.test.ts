import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { adminRoutes } from '../../src/server/routes/admin.js';

function createAdminTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  return app;
}

const app = createAdminTestApp();

describe('Admin (Governance) Routes', () => {
  describe('Roles', () => {
    it('GET /roles — returns default roles with admin having * permission', async () => {
      const res = await request(app).get('/api/admin/roles');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('roles');
      expect(res.body.roles).toHaveLength(4);

      const roleNames = res.body.roles.map((r: any) => r.id);
      expect(roleNames).toContain('admin');
      expect(roleNames).toContain('editor');
      expect(roleNames).toContain('viewer');
      expect(roleNames).toContain('operator');

      const adminRole = res.body.roles.find((r: any) => r.id === 'admin');
      expect(adminRole.permissions).toContain('*');
    });

    it('POST /roles — creates a new role and returns it with id', async () => {
      const res = await request(app)
        .post('/api/admin/roles')
        .send({ name: 'Deployer', permissions: ['workflow:execute', 'workflow:read'] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('role');
      expect(res.body.role).toHaveProperty('id');
      expect(res.body.role.name).toBe('Deployer');
      expect(res.body.role.permissions).toEqual(['workflow:execute', 'workflow:read']);
    });

    it('PUT /roles/:id — updates an existing role', async () => {
      const res = await request(app)
        .put('/api/admin/roles/admin')
        .send({ name: 'Super Admin', permissions: ['*', 'super'] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('role');
      expect(res.body.role.id).toBe('admin');
      expect(res.body.role.name).toBe('Super Admin');
      expect(res.body.role.permissions).toEqual(['*', 'super']);
    });

    it('PUT /roles/:id — returns 404 for non-existent role', async () => {
      const res = await request(app)
        .put('/api/admin/roles/nonexistent-role')
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Environments', () => {
    it('GET /environments — returns 3 default environments with dev active', async () => {
      const res = await request(app).get('/api/admin/environments');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('environments');
      expect(res.body.environments).toHaveLength(3);

      const dev = res.body.environments.find((e: any) => e.id === 'dev');
      expect(dev.isActive).toBe(true);

      const staging = res.body.environments.find((e: any) => e.id === 'staging');
      expect(staging.isActive).toBe(false);

      const prod = res.body.environments.find((e: any) => e.id === 'prod');
      expect(prod.isActive).toBe(false);
    });

    it('POST /environments/:id/activate — activates staging, deactivates dev', async () => {
      const res = await request(app).post('/api/admin/environments/staging/activate');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('environment');
      expect(res.body.environment.id).toBe('staging');
      expect(res.body.environment.isActive).toBe(true);

      // Verify dev is no longer active
      const envRes = await request(app).get('/api/admin/environments');
      const dev = envRes.body.environments.find((e: any) => e.id === 'dev');
      expect(dev.isActive).toBe(false);

      const staging = envRes.body.environments.find((e: any) => e.id === 'staging');
      expect(staging.isActive).toBe(true);
    });

    it('POST /environments/:id/activate — returns 404 for unknown environment', async () => {
      const res = await request(app).post('/api/admin/environments/unknown-env/activate');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Secrets', () => {
    it('GET /secrets — empty initially', async () => {
      const res = await request(app).get('/api/admin/secrets');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('secrets');
      expect(Array.isArray(res.body.secrets)).toBe(true);
    });

    it('POST /secrets — creates secret with maskedValue as asterisks', async () => {
      const res = await request(app)
        .post('/api/admin/secrets')
        .send({ name: 'SLACK_TOKEN', environment: 'dev', value: 'xoxb-secret-token-value' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('secret');
      expect(res.body.secret.name).toBe('SLACK_TOKEN');
      expect(res.body.secret.environment).toBe('dev');
      expect(res.body.secret.maskedValue).toMatch(/^\*+$/);
      expect(res.body.secret).not.toHaveProperty('value');
      expect(res.body.secret).toHaveProperty('id');
      expect(res.body.secret).toHaveProperty('lastRotated');
    });
  });

  describe('Audit Log', () => {
    it('GET /audit — returns audit entries from previous operations', async () => {
      const res = await request(app).get('/api/admin/audit');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('entries');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.entries)).toBe(true);
      // Previous tests created roles, activated environments, and added secrets
      expect(res.body.total).toBeGreaterThan(0);

      const entry = res.body.entries[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('userId');
      expect(entry).toHaveProperty('action');
      expect(entry).toHaveProperty('resource');
      expect(entry).toHaveProperty('details');
      expect(entry).toHaveProperty('timestamp');
    });

    it('GET /audit?limit=1 — respects limit parameter', async () => {
      const res = await request(app).get('/api/admin/audit?limit=1');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      // Total should still reflect all entries
      expect(res.body.total).toBeGreaterThan(1);
    });
  });
});
