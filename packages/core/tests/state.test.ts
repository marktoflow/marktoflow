import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateStore, ExecutionRecord, StepCheckpoint } from '../src/state.js';
import { WorkflowStatus, StepStatus } from '../src/models.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

describe('StateStore', () => {
  let store: StateStore;
  const testDir = '.marktoflow-test';
  const dbPath = join(testDir, 'test-state.db');

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    store = new StateStore(dbPath);
  });

  afterEach(() => {
    store.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('Execution Records', () => {
    it('should create and retrieve an execution', () => {
      const record: ExecutionRecord = {
        runId: 'run-123',
        workflowId: 'workflow-1',
        workflowPath: '/path/to/workflow.md',
        status: WorkflowStatus.RUNNING,
        startedAt: new Date(),
        completedAt: null,
        currentStep: 0,
        totalSteps: 3,
        inputs: { foo: 'bar' },
        outputs: null,
        error: null,
        metadata: null,
      };

      store.createExecution(record);

      const retrieved = store.getExecution('run-123');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.runId).toBe('run-123');
      expect(retrieved!.workflowId).toBe('workflow-1');
      expect(retrieved!.status).toBe(WorkflowStatus.RUNNING);
      expect(retrieved!.inputs).toEqual({ foo: 'bar' });
    });

    it('should update an execution', () => {
      const record: ExecutionRecord = {
        runId: 'run-456',
        workflowId: 'workflow-2',
        workflowPath: '/path/to/workflow.md',
        status: WorkflowStatus.RUNNING,
        startedAt: new Date(),
        completedAt: null,
        currentStep: 0,
        totalSteps: 2,
        inputs: null,
        outputs: null,
        error: null,
        metadata: null,
      };

      store.createExecution(record);

      store.updateExecution('run-456', {
        status: WorkflowStatus.COMPLETED,
        completedAt: new Date(),
        outputs: { result: 'success' },
      });

      const retrieved = store.getExecution('run-456');
      expect(retrieved!.status).toBe(WorkflowStatus.COMPLETED);
      expect(retrieved!.completedAt).not.toBeNull();
      expect(retrieved!.outputs).toEqual({ result: 'success' });
    });

    it('should list executions with filters', () => {
      for (let i = 0; i < 5; i++) {
        store.createExecution({
          runId: `run-${i}`,
          workflowId: i < 3 ? 'workflow-a' : 'workflow-b',
          workflowPath: '/path.md',
          status: i % 2 === 0 ? WorkflowStatus.COMPLETED : WorkflowStatus.FAILED,
          startedAt: new Date(Date.now() - i * 1000),
          completedAt: new Date(),
          currentStep: 0,
          totalSteps: 1,
          inputs: null,
          outputs: null,
          error: null,
          metadata: null,
        });
      }

      expect(store.listExecutions()).toHaveLength(5);
      expect(store.listExecutions({ workflowId: 'workflow-a' })).toHaveLength(3);
      expect(store.listExecutions({ status: WorkflowStatus.COMPLETED })).toHaveLength(3);
      expect(store.listExecutions({ limit: 2 })).toHaveLength(2);
    });

    it('should get running and failed executions', () => {
      store.createExecution({
        runId: 'running-1',
        workflowId: 'wf',
        workflowPath: '/path.md',
        status: WorkflowStatus.RUNNING,
        startedAt: new Date(),
        completedAt: null,
        currentStep: 0,
        totalSteps: 1,
        inputs: null,
        outputs: null,
        error: null,
        metadata: null,
      });

      store.createExecution({
        runId: 'failed-1',
        workflowId: 'wf',
        workflowPath: '/path.md',
        status: WorkflowStatus.FAILED,
        startedAt: new Date(),
        completedAt: new Date(),
        currentStep: 0,
        totalSteps: 1,
        inputs: null,
        outputs: null,
        error: 'Test error',
        metadata: null,
      });

      expect(store.getRunningExecutions()).toHaveLength(1);
      expect(store.getFailedExecutions()).toHaveLength(1);
    });
  });

  describe('Step Checkpoints', () => {
    beforeEach(() => {
      store.createExecution({
        runId: 'run-with-checkpoints',
        workflowId: 'wf',
        workflowPath: '/path.md',
        status: WorkflowStatus.RUNNING,
        startedAt: new Date(),
        completedAt: null,
        currentStep: 0,
        totalSteps: 3,
        inputs: null,
        outputs: null,
        error: null,
        metadata: null,
      });
    });

    it('should save and retrieve checkpoints', () => {
      const checkpoint: StepCheckpoint = {
        runId: 'run-with-checkpoints',
        stepIndex: 0,
        stepName: 'step-1',
        status: StepStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        inputs: { a: 1 },
        outputs: { b: 2 },
        error: null,
        retryCount: 0,
      };

      store.saveCheckpoint(checkpoint);

      const checkpoints = store.getCheckpoints('run-with-checkpoints');
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].stepName).toBe('step-1');
    });

    it('should get last checkpoint', () => {
      store.saveCheckpoint({
        runId: 'run-with-checkpoints',
        stepIndex: 0,
        stepName: 'step-1',
        status: StepStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        inputs: null,
        outputs: null,
        error: null,
        retryCount: 0,
      });

      store.saveCheckpoint({
        runId: 'run-with-checkpoints',
        stepIndex: 1,
        stepName: 'step-2',
        status: StepStatus.FAILED,
        startedAt: new Date(),
        completedAt: new Date(),
        inputs: null,
        outputs: null,
        error: 'Failed',
        retryCount: 2,
      });

      const last = store.getLastCheckpoint('run-with-checkpoints');
      expect(last).not.toBeNull();
      expect(last!.stepIndex).toBe(1);
      expect(last!.status).toBe(StepStatus.FAILED);
    });

    it('should calculate resume point', () => {
      store.saveCheckpoint({
        runId: 'run-with-checkpoints',
        stepIndex: 0,
        stepName: 'step-1',
        status: StepStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        inputs: null,
        outputs: null,
        error: null,
        retryCount: 0,
      });

      // After completed step, resume from next
      expect(store.getResumePoint('run-with-checkpoints')).toBe(1);

      store.saveCheckpoint({
        runId: 'run-with-checkpoints',
        stepIndex: 1,
        stepName: 'step-2',
        status: StepStatus.FAILED,
        startedAt: new Date(),
        completedAt: new Date(),
        inputs: null,
        outputs: null,
        error: 'Error',
        retryCount: 0,
      });

      // After failed step, resume from same step
      expect(store.getResumePoint('run-with-checkpoints')).toBe(1);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      const now = new Date();

      for (let i = 0; i < 10; i++) {
        const startedAt = new Date(now.getTime() - 10000);
        const completedAt = new Date(now.getTime() - 5000 + i * 100);

        store.createExecution({
          runId: `stat-run-${i}`,
          workflowId: 'stat-workflow',
          workflowPath: '/path.md',
          status: i < 7 ? WorkflowStatus.COMPLETED : WorkflowStatus.FAILED,
          startedAt,
          completedAt,
          currentStep: 0,
          totalSteps: 1,
          inputs: null,
          outputs: null,
          error: null,
          metadata: null,
        });
      }
    });

    it('should calculate stats', () => {
      const stats = store.getStats();

      expect(stats.totalExecutions).toBe(10);
      expect(stats.completed).toBe(7);
      expect(stats.failed).toBe(3);
      expect(stats.successRate).toBeCloseTo(0.7);
    });

    it('should filter stats by workflow', () => {
      const stats = store.getStats('stat-workflow');
      expect(stats.totalExecutions).toBe(10);
    });
  });

  describe('Cleanup', () => {
    it('should delete old records', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      store.createExecution({
        runId: 'old-run',
        workflowId: 'wf',
        workflowPath: '/path.md',
        status: WorkflowStatus.COMPLETED,
        startedAt: oldDate,
        completedAt: oldDate,
        currentStep: 0,
        totalSteps: 1,
        inputs: null,
        outputs: null,
        error: null,
        metadata: null,
      });

      store.createExecution({
        runId: 'new-run',
        workflowId: 'wf',
        workflowPath: '/path.md',
        status: WorkflowStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        currentStep: 0,
        totalSteps: 1,
        inputs: null,
        outputs: null,
        error: null,
        metadata: null,
      });

      const deleted = store.cleanup(30);

      expect(deleted).toBe(1);
      expect(store.getExecution('old-run')).toBeNull();
      expect(store.getExecution('new-run')).not.toBeNull();
    });
  });
});
