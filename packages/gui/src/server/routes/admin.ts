import { Router, type Request, type Response } from 'express';

export const adminRoutes = Router();

// In-memory governance state
interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface Environment {
  id: string;
  name: string;
  label: string;
  config: Record<string, string>;
  isActive: boolean;
}

interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
  ip?: string;
}

interface Secret {
  id: string;
  name: string;
  environment: string;
  maskedValue: string;
  lastRotated: string;
}

const roles: Role[] = [
  { id: 'admin', name: 'Administrator', permissions: ['*'] },
  { id: 'editor', name: 'Editor', permissions: ['workflow:read', 'workflow:write', 'workflow:execute'] },
  { id: 'viewer', name: 'Viewer', permissions: ['workflow:read'] },
  { id: 'operator', name: 'Operator', permissions: ['workflow:read', 'workflow:execute'] },
];

const environments: Environment[] = [
  { id: 'dev', name: 'development', label: 'Development', config: {}, isActive: true },
  { id: 'staging', name: 'staging', label: 'Staging', config: {}, isActive: false },
  { id: 'prod', name: 'production', label: 'Production', config: {}, isActive: false },
];

const auditLog: AuditEntry[] = [];
const secrets: Secret[] = [];

// Roles
adminRoutes.get('/roles', (_req: Request, res: Response) => {
  res.json({ roles });
});

adminRoutes.post('/roles', (req: Request, res: Response) => {
  const { name, permissions } = req.body;
  const role: Role = {
    id: `role-${Date.now().toString(36)}`,
    name,
    permissions: permissions || [],
  };
  roles.push(role);
  addAudit('system', 'role:create', role.id, `Created role: ${name}`);
  res.json({ role });
});

adminRoutes.put('/roles/:id', (req: Request, res: Response) => {
  const role = roles.find((r) => r.id === req.params.id);
  if (!role) { res.status(404).json({ error: 'Role not found' }); return; }
  if (req.body.name) role.name = req.body.name;
  if (req.body.permissions) role.permissions = req.body.permissions;
  addAudit('system', 'role:update', role.id, `Updated role: ${role.name}`);
  res.json({ role });
});

// Environments
adminRoutes.get('/environments', (_req: Request, res: Response) => {
  res.json({ environments });
});

adminRoutes.post('/environments/:id/activate', (req: Request, res: Response) => {
  environments.forEach((e) => (e.isActive = false));
  const env = environments.find((e) => e.id === req.params.id);
  if (!env) { res.status(404).json({ error: 'Environment not found' }); return; }
  env.isActive = true;
  addAudit('system', 'env:activate', env.id, `Activated environment: ${env.label}`);
  res.json({ environment: env });
});

// Secrets
adminRoutes.get('/secrets', (_req: Request, res: Response) => {
  res.json({ secrets: secrets.map(({ maskedValue, ...s }) => ({ ...s, maskedValue })) });
});

adminRoutes.post('/secrets', (req: Request, res: Response) => {
  const { name, environment, value } = req.body;
  const secret: Secret = {
    id: `secret-${Date.now().toString(36)}`,
    name,
    environment: environment || 'dev',
    maskedValue: '*'.repeat(Math.min(value?.length || 8, 20)),
    lastRotated: new Date().toISOString(),
  };
  secrets.push(secret);
  addAudit('system', 'secret:create', secret.id, `Created secret: ${name}`);
  res.json({ secret });
});

// Audit log
adminRoutes.get('/audit', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '50', 10);
  const offset = parseInt(req.query.offset as string || '0', 10);
  res.json({
    entries: auditLog.slice(offset, offset + limit).reverse(),
    total: auditLog.length,
  });
});

function addAudit(userId: string, action: string, resource: string, details: string) {
  auditLog.push({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    action,
    resource,
    details,
    timestamp: new Date().toISOString(),
  });
}
