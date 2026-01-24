import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  RBACManager, Permission, Role, User, 
  ApprovalManager, ApprovalStatus, 
  AuditLogger, InMemoryAuditStore, AuditEventType 
} from '../src/security.js';
import { randomUUID } from 'crypto';

describe('RBACManager', () => {
  let rbac: RBACManager;

  beforeEach(() => {
    rbac = new RBACManager();
  });

  it('should check predefined roles', () => {
    const user: User = {
      id: 'u1',
      username: 'alice',
      roles: ['viewer'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    rbac.addUser(user);

    expect(rbac.checkPermission('u1', Permission.WORKFLOW_READ)).toBe(true);
    expect(rbac.checkPermission('u1', Permission.WORKFLOW_EXECUTE)).toBe(false);
  });

  it('should handle inheritance', () => {
    const user: User = {
      id: 'u2',
      username: 'bob',
      roles: ['executor'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    rbac.addUser(user);

    // Executor inherits from viewer
    expect(rbac.checkPermission('u2', Permission.WORKFLOW_READ)).toBe(true);
    expect(rbac.checkPermission('u2', Permission.WORKFLOW_EXECUTE)).toBe(true);
  });
});

describe('ApprovalManager', () => {
  let approval: ApprovalManager;

  beforeEach(() => {
    approval = new ApprovalManager();
  });

  it('should create and approve request', async () => {
    const req = await approval.createRequest({
      requesterId: 'alice',
      workflowId: 'wf-1',
      title: 'Deploy'
    });

    expect(req.status).toBe(ApprovalStatus.PENDING);

    const updated = await approval.approve(req.id, 'approver1', 'LGTM');
    expect(updated.status).toBe(ApprovalStatus.APPROVED);
    expect(updated.approvals).toHaveLength(1);
  });

  it('should reject request', async () => {
    const req = await approval.createRequest({
      requesterId: 'alice',
      workflowId: 'wf-1',
      title: 'Deploy'
    });

    const updated = await approval.reject(req.id, 'rejector1', 'No good');
    expect(updated.status).toBe(ApprovalStatus.REJECTED);
  });
});

describe('AuditLogger', () => {
  it('should log events', async () => {
    const store = new InMemoryAuditStore();
    const logger = new AuditLogger(store);

    await logger.log({
      eventType: AuditEventType.WORKFLOW_EXECUTED,
      details: { runId: '123' },
      success: true,
      timestamp: new Date() // Normally provided by logger if omitted, but typescript might complain on omit if interface strict? No, interface has it.
      // Wait, log() takes Omit<AuditEvent, 'id' | 'timestamp'>.
      // So I shouldn't pass timestamp?
      // Ah, type definition in test is implicit.
    } as any);

    const events = await store.query({});
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(AuditEventType.WORKFLOW_EXECUTED);
  });
});
