/**
 * State store resilience tests - validates safe handling of corrupted data.
 */

import { describe, it, expect, vi } from 'vitest';
import { StateStore } from '../src/state.js';

describe('StateStore: corrupted JSON handling', () => {
  it('should handle corrupted inputs JSON gracefully', () => {
    const store = new StateStore(':memory:');

    // Insert a record with valid data first
    store.createExecution({
      runId: 'corrupt-test-1',
      workflowId: 'wf-1',
      workflowPath: '/tmp/test.md',
      status: 'completed' as any,
      startedAt: new Date(),
      completedAt: new Date(),
      currentStep: 1,
      totalSteps: 1,
      inputs: { key: 'value' },
      outputs: null,
      error: null,
      metadata: null,
    });

    // Manually corrupt the inputs field
    const db = (store as any).db;
    db.prepare("UPDATE executions SET inputs = 'not-valid-json{' WHERE run_id = ?").run(
      'corrupt-test-1'
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Should not throw, should warn and return null for corrupted field
    const record = store.getExecution('corrupt-test-1');
    expect(record).not.toBeNull();
    expect(record!.runId).toBe('corrupt-test-1');
    // Corrupted JSON should result in null
    expect(record!.inputs).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    store.close();
  });

  it('should handle corrupted checkpoint JSON gracefully', () => {
    const store = new StateStore(':memory:');

    store.createExecution({
      runId: 'corrupt-cp-1',
      workflowId: 'wf-1',
      workflowPath: '/tmp/test.md',
      status: 'running' as any,
      startedAt: new Date(),
      completedAt: null,
      currentStep: 0,
      totalSteps: 2,
      inputs: null,
      outputs: null,
      error: null,
      metadata: null,
    });

    store.saveCheckpoint({
      runId: 'corrupt-cp-1',
      stepIndex: 0,
      stepName: 'step-1',
      status: 'completed' as any,
      startedAt: new Date(),
      completedAt: new Date(),
      inputs: { data: 'test' },
      outputs: { result: 'ok' },
      error: null,
      retryCount: 0,
    });

    // Corrupt the outputs field
    const db = (store as any).db;
    db.prepare(
      "UPDATE checkpoints SET outputs = '{broken' WHERE run_id = ? AND step_index = ?"
    ).run('corrupt-cp-1', 0);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const checkpoints = store.getCheckpoints('corrupt-cp-1');
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].outputs).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    store.close();
  });
});

describe('StateStore: default pagination', () => {
  it('should limit listExecutions results by default', () => {
    const store = new StateStore(':memory:');

    // Create a few records
    for (let i = 0; i < 5; i++) {
      store.createExecution({
        runId: `pagination-${i}`,
        workflowId: 'wf-1',
        workflowPath: '/tmp/test.md',
        status: 'completed' as any,
        startedAt: new Date(Date.now() - i * 1000),
        completedAt: new Date(),
        currentStep: 1,
        totalSteps: 1,
        inputs: null,
        outputs: null,
        error: null,
        metadata: null,
      });
    }

    // With no limit specified, should still return results (with default cap)
    const results = store.listExecutions({});
    expect(results.length).toBe(5);
    expect(results.length).toBeLessThanOrEqual(1000);

    store.close();
  });
});
