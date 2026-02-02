/**
 * Comprehensive Integration Tests for GUI Execution System
 *
 * Tests the ExecutionManager, execute routes, and their integration
 * with StateStore and WebSocket events.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { join } from 'path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import express, { type Express } from 'express';
import { StateStore, VERSION } from '@marktoflow/core';
import { ExecutionManager, type WsEmitter } from '../../src/server/services/ExecutionManager.js';
import { executeRoutes, setExecutionManager } from '../../src/server/routes/execute.js';

// Track temp directories for cleanup
const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'marktoflow-exec-test-'));
  tempDirs.push(dir);
  return dir;
}

function cleanupTempDirs(): void {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
  tempDirs.length = 0;
}

// Create a simple test workflow
function createTestWorkflow(dir: string, name: string = 'test-workflow.md'): string {
  const workflowPath = join(dir, name);
  const content = `---
workflow:
  id: test-workflow
  name: "Test Workflow"
  version: "1.0.0"

steps:
  - id: step1
    action: workflow.log
    inputs:
      message: "Hello from test workflow!"
---

# Test Workflow

A simple test workflow for integration testing.
`;
  writeFileSync(workflowPath, content);
  return workflowPath;
}

// Create a workflow with multiple steps
function createMultiStepWorkflow(dir: string): string {
  const workflowPath = join(dir, 'multi-step.md');
  const content = `---
workflow:
  id: multi-step-workflow
  name: "Multi-Step Workflow"
  version: "1.0.0"

inputs:
  name:
    type: string
    required: true

steps:
  - id: step1
    action: workflow.log
    inputs:
      message: "Starting workflow"
    output_variable: step1_result

  - id: step2
    action: workflow.log
    inputs:
      message: "Hello {{ inputs.name }}"
    output_variable: step2_result

  - id: step3
    action: workflow.log
    inputs:
      message: "Workflow complete"
    output_variable: step3_result
---

# Multi-Step Workflow

A workflow with multiple steps for testing progress tracking.
`;
  writeFileSync(workflowPath, content);
  return workflowPath;
}

afterAll(() => {
  cleanupTempDirs();
});

describe('ExecutionManager', () => {
  let tempDir: string;
  let stateStore: StateStore;
  let executionManager: ExecutionManager;
  let mockWsEmitter: WsEmitter;
  let wsEvents: Array<{ event: string; data: unknown }>;

  beforeEach(() => {
    tempDir = createTempDir();
    stateStore = new StateStore(join(tempDir, 'state.db'));
    wsEvents = [];

    mockWsEmitter = {
      emitExecutionStarted: vi.fn((runId, data) => {
        wsEvents.push({ event: 'execution:started', data: { runId, ...data } });
      }),
      emitExecutionStep: vi.fn((runId, data) => {
        wsEvents.push({ event: 'execution:step', data: { runId, ...data } });
      }),
      emitExecutionCompleted: vi.fn((runId, data) => {
        wsEvents.push({ event: 'execution:completed', data: { runId, ...data } });
      }),
    };

    executionManager = new ExecutionManager(stateStore, mockWsEmitter, tempDir);
  });

  afterEach(async () => {
    await executionManager.waitForAll(5000);
    stateStore.close();
  });

  describe('startExecution()', () => {
    it('should start a workflow execution and return a runId', async () => {
      const workflowPath = createTestWorkflow(tempDir);
      const runId = await executionManager.startExecution(workflowPath, {});

      expect(runId).toBeDefined();
      expect(runId).toMatch(/^run-\d+-[a-z0-9]+$/);
    });

    it('should create an execution record in StateStore', async () => {
      const workflowPath = createTestWorkflow(tempDir);
      const runId = await executionManager.startExecution(workflowPath, {});

      const execution = stateStore.getExecution(runId);
      expect(execution).toBeDefined();
      expect(execution?.runId).toBe(runId);
      expect(execution?.workflowId).toBe('test-workflow');
    });

    it('should emit WebSocket events on start', async () => {
      const workflowPath = createTestWorkflow(tempDir);
      await executionManager.startExecution(workflowPath, {});

      // Wait a bit for async execution to emit events
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockWsEmitter.emitExecutionStarted).toHaveBeenCalled();
      const startEvent = wsEvents.find(e => e.event === 'execution:started');
      expect(startEvent).toBeDefined();
    });

    it('should track active executions', async () => {
      const workflowPath = createTestWorkflow(tempDir);
      const runId = await executionManager.startExecution(workflowPath, {});

      expect(executionManager.isActive(runId)).toBe(true);
      expect(executionManager.getActiveCount()).toBeGreaterThanOrEqual(1);
    });

    it('should throw error for non-existent workflow', async () => {
      await expect(
        executionManager.startExecution('/non/existent/workflow.md', {})
      ).rejects.toThrow();
    });
  });

  describe('getExecutionStatus()', () => {
    it('should return status for active execution', async () => {
      const workflowPath = createTestWorkflow(tempDir);
      const runId = await executionManager.startExecution(workflowPath, {});

      const status = executionManager.getExecutionStatus(runId);
      expect(status).toBeDefined();
      expect(status?.runId).toBe(runId);
      expect(status?.workflowId).toBe('test-workflow');
      expect(['running', 'completed']).toContain(status?.status);
    });

    it('should return null for non-existent execution', () => {
      const status = executionManager.getExecutionStatus('non-existent-run');
      expect(status).toBeNull();
    });

    it('should return status from StateStore for completed execution', async () => {
      const workflowPath = createTestWorkflow(tempDir);
      const runId = await executionManager.startExecution(workflowPath, {});

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const status = executionManager.getExecutionStatus(runId);
      expect(status).toBeDefined();
      expect(['completed', 'failed', 'running']).toContain(status?.status);
    });
  });

  describe('cancelExecution()', () => {
    it('should cancel an active execution', async () => {
      const workflowPath = createMultiStepWorkflow(tempDir);
      const runId = await executionManager.startExecution(workflowPath, { name: 'Test' });

      const cancelled = await executionManager.cancelExecution(runId);
      expect(cancelled).toBe(true);

      const status = executionManager.getExecutionStatus(runId);
      expect(status?.status).toBe('cancelled');
    });

    it('should return false for non-existent execution', async () => {
      const cancelled = await executionManager.cancelExecution('non-existent-run');
      expect(cancelled).toBe(false);
    });

    it('should emit WebSocket completion event on cancel', async () => {
      const workflowPath = createMultiStepWorkflow(tempDir);
      const runId = await executionManager.startExecution(workflowPath, { name: 'Test' });

      await executionManager.cancelExecution(runId);

      expect(mockWsEmitter.emitExecutionCompleted).toHaveBeenCalled();
    });
  });

  describe('listExecutions()', () => {
    it('should list recent executions', async () => {
      const workflowPath = createTestWorkflow(tempDir);

      // Start a few executions
      await executionManager.startExecution(workflowPath, {});
      await executionManager.startExecution(workflowPath, {});

      // Wait for them to be recorded
      await new Promise(resolve => setTimeout(resolve, 100));

      const executions = executionManager.listExecutions({ limit: 10 });
      expect(executions.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect limit parameter', async () => {
      const workflowPath = createTestWorkflow(tempDir);

      // Start multiple executions
      for (let i = 0; i < 5; i++) {
        await executionManager.startExecution(workflowPath, {});
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const executions = executionManager.listExecutions({ limit: 3 });
      expect(executions.length).toBeLessThanOrEqual(3);
    });
  });
});

describe('Execute API Routes', () => {
  let app: Express;
  let tempDir: string;
  let stateStore: StateStore;
  let executionManager: ExecutionManager;

  beforeEach(() => {
    tempDir = createTempDir();
    stateStore = new StateStore(join(tempDir, 'state.db'));
    executionManager = new ExecutionManager(stateStore, null, tempDir);

    app = express();
    app.use(express.json());
    setExecutionManager(executionManager, tempDir);
    app.use('/api/execute', executeRoutes);
  });

  afterEach(async () => {
    await executionManager.waitForAll(5000);
    stateStore.close();
  });

  describe('POST /api/execute/:path', () => {
    it('should return 404 for non-existent workflow', async () => {
      const response = await request(app)
        .post('/api/execute/non-existent.md')
        .send({ inputs: {} });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Workflow not found');
    });

    it('should start execution for valid workflow', async () => {
      const workflowPath = createTestWorkflow(tempDir);

      const response = await request(app)
        .post(`/api/execute/${encodeURIComponent('test-workflow.md')}`)
        .send({ inputs: {} });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('status', 'started');
    });

    it('should handle dry-run mode', async () => {
      const workflowPath = createTestWorkflow(tempDir);

      const response = await request(app)
        .post(`/api/execute/${encodeURIComponent('test-workflow.md')}`)
        .send({ inputs: {}, dryRun: true });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('dryRun', true);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('workflow');
    });

    it('should accept inputs', async () => {
      createMultiStepWorkflow(tempDir);

      const response = await request(app)
        .post(`/api/execute/${encodeURIComponent('multi-step.md')}`)
        .send({ inputs: { name: 'TestUser' } });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('runId');
    });
  });

  describe('GET /api/execute/status/:runId', () => {
    it('should return 404 for non-existent run', async () => {
      const response = await request(app).get('/api/execute/status/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });

    it('should return status for existing run', async () => {
      createTestWorkflow(tempDir);

      // Start an execution first
      const startResponse = await request(app)
        .post(`/api/execute/${encodeURIComponent('test-workflow.md')}`)
        .send({ inputs: {} });

      const runId = startResponse.body.runId;

      // Get status
      const response = await request(app).get(`/api/execute/status/${runId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('runId', runId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');
    });
  });

  describe('POST /api/execute/cancel/:runId', () => {
    it('should return 404 for non-existent run', async () => {
      const response = await request(app).post('/api/execute/cancel/non-existent');

      expect(response.status).toBe(404);
    });

    it('should cancel an active execution', async () => {
      createMultiStepWorkflow(tempDir);

      // Start an execution
      const startResponse = await request(app)
        .post(`/api/execute/${encodeURIComponent('multi-step.md')}`)
        .send({ inputs: { name: 'Test' } });

      const runId = startResponse.body.runId;

      // Cancel it
      const response = await request(app).post(`/api/execute/cancel/${runId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'cancelled');
    });
  });

  describe('GET /api/execute/list', () => {
    it('should return list of executions', async () => {
      const response = await request(app).get('/api/execute/list');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('executions');
      expect(Array.isArray(response.body.executions)).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('activeCount');
    });

    it('should respect limit parameter', async () => {
      createTestWorkflow(tempDir);

      // Start some executions
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/execute/${encodeURIComponent('test-workflow.md')}`)
          .send({ inputs: {} });
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app).get('/api/execute/list?limit=3');

      expect(response.status).toBe(200);
      expect(response.body.executions.length).toBeLessThanOrEqual(3);
    });
  });
});

describe('Execution Flow Integration', () => {
  let tempDir: string;
  let stateStore: StateStore;
  let wsEvents: Array<{ event: string; runId: string; data: unknown }>;
  let mockWsEmitter: WsEmitter;
  let executionManager: ExecutionManager;

  beforeEach(() => {
    tempDir = createTempDir();
    stateStore = new StateStore(join(tempDir, 'state.db'));
    wsEvents = [];

    mockWsEmitter = {
      emitExecutionStarted: vi.fn((runId, data) => {
        wsEvents.push({ event: 'started', runId, data });
      }),
      emitExecutionStep: vi.fn((runId, data) => {
        wsEvents.push({ event: 'step', runId, data });
      }),
      emitExecutionCompleted: vi.fn((runId, data) => {
        wsEvents.push({ event: 'completed', runId, data });
      }),
    };

    executionManager = new ExecutionManager(stateStore, mockWsEmitter, tempDir);
  });

  afterEach(async () => {
    await executionManager.waitForAll(5000);
    stateStore.close();
  });

  it('should emit step events for each step', async () => {
    createMultiStepWorkflow(tempDir);
    const runId = await executionManager.startExecution(
      join(tempDir, 'multi-step.md'),
      { name: 'Test' }
    );

    // Wait for execution to complete
    await executionManager.waitForAll(3000);

    const stepEvents = wsEvents.filter(e => e.event === 'step' && e.runId === runId);
    expect(stepEvents.length).toBeGreaterThan(0);
  });

  it('should emit completion event when workflow finishes', async () => {
    createTestWorkflow(tempDir);
    const runId = await executionManager.startExecution(
      join(tempDir, 'test-workflow.md'),
      {}
    );

    // Wait for execution to complete
    await executionManager.waitForAll(3000);

    const completedEvents = wsEvents.filter(
      e => e.event === 'completed' && e.runId === runId
    );
    expect(completedEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('should persist checkpoints for each step', async () => {
    createMultiStepWorkflow(tempDir);
    const runId = await executionManager.startExecution(
      join(tempDir, 'multi-step.md'),
      { name: 'Test' }
    );

    // Wait for execution to complete
    await executionManager.waitForAll(3000);

    const checkpoints = stateStore.getCheckpoints(runId);
    expect(checkpoints.length).toBeGreaterThan(0);
  });

  it('should update execution record on completion', async () => {
    createTestWorkflow(tempDir);
    const runId = await executionManager.startExecution(
      join(tempDir, 'test-workflow.md'),
      {}
    );

    // Wait for execution to complete
    await executionManager.waitForAll(3000);

    const execution = stateStore.getExecution(runId);
    expect(execution).toBeDefined();
    expect(['completed', 'failed']).toContain(execution?.status);
    expect(execution?.completedAt).toBeDefined();
  });
});
