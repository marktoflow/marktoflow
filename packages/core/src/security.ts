/**
 * Security module for marktoflow.
 *
 * Provides RBAC (Role-Based Access Control), approval workflows, and audit logging.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';

// ============================================================================
// RBAC - Role-Based Access Control
// ============================================================================

export enum Permission {
  // Workflow permissions
  WORKFLOW_READ = 'workflow:read',
  WORKFLOW_EXECUTE = 'workflow:execute',
  WORKFLOW_CREATE = 'workflow:create',
  WORKFLOW_EDIT = 'workflow:edit',
  WORKFLOW_DELETE = 'workflow:delete',

  // Tool permissions
  TOOL_USE = 'tool:use',
  TOOL_CONFIGURE = 'tool:configure',

  // Admin permissions
  USER_MANAGE = 'user:manage',
  ROLE_MANAGE = 'role:manage',
  CONFIG_MANAGE = 'config:manage',
  AUDIT_READ = 'audit:read',

  // Approval permissions
  APPROVAL_REQUEST = 'approval:request',
  APPROVAL_APPROVE = 'approval:approve',
  APPROVAL_REJECT = 'approval:reject',
}

export interface Role {
  name: string;
  permissions: Set<Permission>;
  description?: string;
  inheritsFrom?: string[];
}

export interface User {
  id: string;
  username: string;
  email?: string;
  roles: string[];
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const PREDEFINED_ROLES: Record<string, Role> = {
  viewer: {
    name: 'viewer',
    permissions: new Set([Permission.WORKFLOW_READ, Permission.AUDIT_READ]),
    description: 'Can view workflows and audit logs',
  },
  executor: {
    name: 'executor',
    permissions: new Set([
      Permission.WORKFLOW_READ,
      Permission.WORKFLOW_EXECUTE,
      Permission.TOOL_USE,
      Permission.APPROVAL_REQUEST,
    ]),
    description: 'Can execute workflows and use tools',
    inheritsFrom: ['viewer'],
  },
  developer: {
    name: 'developer',
    permissions: new Set([
      Permission.WORKFLOW_READ,
      Permission.WORKFLOW_EXECUTE,
      Permission.WORKFLOW_CREATE,
      Permission.WORKFLOW_EDIT,
      Permission.TOOL_USE,
      Permission.TOOL_CONFIGURE,
      Permission.APPROVAL_REQUEST,
    ]),
    description: 'Can create and edit workflows',
    inheritsFrom: ['executor'],
  },
  approver: {
    name: 'approver',
    permissions: new Set([
      Permission.WORKFLOW_READ,
      Permission.APPROVAL_APPROVE,
      Permission.APPROVAL_REJECT,
      Permission.AUDIT_READ,
    ]),
    description: 'Can approve or reject workflow executions',
    inheritsFrom: ['viewer'],
  },
  admin: {
    name: 'admin',
    permissions: new Set(Object.values(Permission)),
    description: 'Full system access',
  },
};

export class RBACManager {
  private roles: Map<string, Role> = new Map();
  private users: Map<string, User> = new Map();

  constructor(customRoles?: Role[]) {
    // Load predefined roles
    for (const role of Object.values(PREDEFINED_ROLES)) {
      this.roles.set(role.name, role);
    }
    // Load custom roles
    if (customRoles) {
      for (const role of customRoles) {
        this.roles.set(role.name, role);
      }
    }
  }

  addRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getUserPermissions(userId: string): Set<Permission> {
    const user = this.getUser(userId);
    if (!user || !user.isActive) {
      return new Set();
    }

    const permissions = new Set<Permission>();
    const visitedRoles = new Set<string>();

    const collectPermissions = (roleName: string) => {
      if (visitedRoles.has(roleName)) return;
      visitedRoles.add(roleName);

      const role = this.getRole(roleName);
      if (role) {
        for (const perm of role.permissions) {
          permissions.add(perm);
        }
        if (role.inheritsFrom) {
          for (const inherited of role.inheritsFrom) {
            collectPermissions(inherited);
          }
        }
      }
    };

    for (const roleName of user.roles) {
      collectPermissions(roleName);
    }

    return permissions;
  }

  checkPermission(userId: string, permission: Permission): boolean {
    const perms = this.getUserPermissions(userId);
    return perms.has(permission);
  }
}

// ============================================================================
// Approval Workflows
// ============================================================================

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  requesterId: string;
  title: string;
  description?: string | undefined;
  status: ApprovalStatus;
  requiredApprovers: string[];
  minApprovals: number;
  approvals: Array<{ approverId: string; comment?: string | undefined; timestamp: Date }>;
  rejections: Array<{ rejectorId: string; reason?: string | undefined; timestamp: Date }>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date | undefined;
  resolvedAt?: Date | undefined;
}

export interface ApprovalHandler {
  onApprovalRequested(request: ApprovalRequest): Promise<void>;
  onApprovalApproved(request: ApprovalRequest, approverId: string): Promise<void>;
  onApprovalRejected(request: ApprovalRequest, rejectorId: string): Promise<void>;
}

export class ApprovalManager {
  private requests: Map<string, ApprovalRequest> = new Map();
  private handlers: ApprovalHandler[] = [];
  private rbac?: RBACManager | undefined;

  constructor(rbac?: RBACManager | undefined) {
    this.rbac = rbac;
  }

  addHandler(handler: ApprovalHandler): void {
    this.handlers.push(handler);
  }

  async createRequest(params: {
    requesterId: string;
    workflowId: string;
    title: string;
    description?: string;
    requiredApprovers?: string[];
    minApprovals?: number;
    expiresInHours?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ApprovalRequest> {
    if (this.rbac) {
      if (!this.rbac.checkPermission(params.requesterId, Permission.APPROVAL_REQUEST)) {
        throw new Error(`User ${params.requesterId} does not have permission to request approval`);
      }
    }

    const expiresAt = params.expiresInHours
      ? new Date(Date.now() + params.expiresInHours * 3600000)
      : undefined;

    const request: ApprovalRequest = {
      id: randomUUID(),
      workflowId: params.workflowId,
      requesterId: params.requesterId,
      title: params.title,
      description: params.description,
      status: ApprovalStatus.PENDING,
      requiredApprovers: params.requiredApprovers || [],
      minApprovals: params.minApprovals || 1,
      approvals: [],
      rejections: [],
      metadata: params.metadata || {},
      createdAt: new Date(),
      expiresAt,
    };

    this.requests.set(request.id, request);

    for (const handler of this.handlers) {
      await handler.onApprovalRequested(request);
    }

    return request;
  }

  getRequest(requestId: string): ApprovalRequest | undefined {
    const request = this.requests.get(requestId);
    if (request && request.status === ApprovalStatus.PENDING && request.expiresAt && new Date() > request.expiresAt) {
      request.status = ApprovalStatus.EXPIRED;
    }
    return request;
  }

  async approve(requestId: string, approverId: string, comment?: string): Promise<ApprovalRequest> {
    const request = this.getRequest(requestId);
    if (!request) throw new Error('Request not found');
    if (request.status !== ApprovalStatus.PENDING) throw new Error(`Request is not pending: ${request.status}`);

    if (this.rbac && !this.rbac.checkPermission(approverId, Permission.APPROVAL_APPROVE)) {
      throw new Error('Permission denied');
    }

    if (request.requiredApprovers.length > 0 && !request.requiredApprovers.includes(approverId)) {
      throw new Error('Not an authorized approver');
    }

    if (request.approvals.some(a => a.approverId === approverId)) {
      throw new Error('Already approved by this user');
    }

    request.approvals.push({
      approverId,
      comment,
      timestamp: new Date(),
    });

    if (request.approvals.length >= request.minApprovals) {
      request.status = ApprovalStatus.APPROVED;
      request.resolvedAt = new Date();
    }

    for (const handler of this.handlers) {
      await handler.onApprovalApproved(request, approverId);
    }

    return request;
  }

  async reject(requestId: string, rejectorId: string, reason?: string): Promise<ApprovalRequest> {
    const request = this.getRequest(requestId);
    if (!request) throw new Error('Request not found');
    if (request.status !== ApprovalStatus.PENDING) throw new Error(`Request is not pending: ${request.status}`);

    if (this.rbac && !this.rbac.checkPermission(rejectorId, Permission.APPROVAL_REJECT)) {
      throw new Error('Permission denied');
    }

    if (request.requiredApprovers.length > 0 && !request.requiredApprovers.includes(rejectorId)) {
      throw new Error('Not an authorized approver');
    }

    request.rejections.push({
      rejectorId,
      reason,
      timestamp: new Date(),
    });

    request.status = ApprovalStatus.REJECTED;
    request.resolvedAt = new Date();

    for (const handler of this.handlers) {
      await handler.onApprovalRejected(request, rejectorId);
    }

    return request;
  }
}

// ============================================================================
// Audit Logging
// ============================================================================

export enum AuditEventType {
  LOGIN = 'auth.login',
  WORKFLOW_EXECUTED = 'workflow.executed',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  PERMISSION_DENIED = 'security.permission_denied',
}

export interface AuditEvent {
  id: string;
  eventType: AuditEventType | string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface AuditStore {
  save(event: AuditEvent): Promise<void>;
  query(filters: {
    eventType?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]>;
}

export class InMemoryAuditStore implements AuditStore {
  private events: AuditEvent[] = [];

  async save(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async query(filters: any): Promise<AuditEvent[]> {
    return this.events.filter(e => {
      if (filters.eventType && e.eventType !== filters.eventType) return false;
      if (filters.userId && e.userId !== filters.userId) return false;
      return true;
    }).slice(filters.offset || 0, (filters.offset || 0) + (filters.limit || 100));
  }
}

export class SQLiteAuditStore implements AuditStore {
  private db: Database.Database;

  constructor(dbPath: string = '.marktoflow/state/audit.db') {
    const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        resource_type TEXT,
        resource_id TEXT,
        action TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp TEXT NOT NULL,
        success INTEGER,
        error_message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
    `);
  }

  async save(event: AuditEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO audit_events (
        id, event_type, user_id, resource_type, resource_id, action,
        details, ip_address, user_agent, timestamp, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      event.id,
      event.eventType,
      event.userId,
      event.resourceType,
      event.resourceId,
      event.action,
      JSON.stringify(event.details),
      event.ipAddress,
      event.userAgent,
      event.timestamp.toISOString(),
      event.success ? 1 : 0,
      event.errorMessage
    );
  }

  async query(filters: any): Promise<AuditEvent[]> {
    let sql = 'SELECT * FROM audit_events WHERE 1=1';
    const params: any[] = [];

    if (filters.eventType) {
      sql += ' AND event_type = ?';
      params.push(filters.eventType);
    }
    if (filters.userId) {
      sql += ' AND user_id = ?';
      params.push(filters.userId);
    }
    
    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 100, filters.offset || 0);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      userId: row.user_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      action: row.action,
      details: JSON.parse(row.details),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      timestamp: new Date(row.timestamp),
      success: !!row.success,
      errorMessage: row.error_message
    }));
  }
}

export class AuditLogger {
  private store: AuditStore;

  constructor(store?: AuditStore) {
    this.store = store || new InMemoryAuditStore();
  }

  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    const fullEvent: AuditEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      ...event
    };
    await this.store.save(fullEvent);
    return fullEvent.id;
  }
}
