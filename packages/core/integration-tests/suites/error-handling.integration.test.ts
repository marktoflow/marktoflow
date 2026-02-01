/**
 * Error Handling Integration Tests
 *
 * Tests error handling mechanisms:
 * - Retry with exponential backoff
 * - Continue on error
 * - Fail fast behavior
 * - Try/catch/finally blocks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../src/engine.js';
import { loadInline } from '../utils/workflow-loader.js';
import { createMockExecutor, createSmartExecutor } from '../mock-executor.js';
import { WorkflowStatus, StepStatus } from '../../src/models.js';

describe('Error Handling Integration Tests', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  // ============================================================================
  // Retry Configuration
  // ============================================================================

  describe('Retry Configuration', () => {
    it('should retry failed steps up to max_retries', async () => {
      let attemptCount = 0;

      const { executor, registry } = createMockExecutor({
        byStepId: {
          'flaky-step': {
            dynamic: () => {
              attemptCount++;
              if (attemptCount < 3) {
                throw new Error('Transient failure');
              }
              return { success: true };
            },
          },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: retry-test
          name: Retry Test
        steps:
          - id: flaky-step
            type: action
            action: mock.flaky
            inputs:
              message: test
            error_handling:
              max_retries: 5
            output_variable: result
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.result).toEqual({ success: true });
      expect(attemptCount).toBe(3); // Initial + 2 retries to succeed
    });

    it('should fail after exhausting all retries', async () => {
      const { executor, registry, getCallCount } = createMockExecutor({
        byStepId: {
          'always-fails': {
            error: 'Persistent failure',
          },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: retry-exhaust-test
          name: Retry Exhaust Test
        steps:
          - id: always-fails
            type: action
            action: mock.fail
            inputs:
              message: test
            error_handling:
              action: stop
              max_retries: 2
            output_variable: result
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(getCallCount('always-fails')).toBe(3); // Initial + 2 retries
    });
  });

  // ============================================================================
  // Continue on Error
  // ============================================================================

  describe('Continue on Error', () => {
    it('should continue to next step when error_handling.action is continue', async () => {
      const { executor, registry, getCallCount } = createMockExecutor({
        byStepId: {
          'failing-step': { error: 'Expected failure' },
          'next-step': { returnValue: { ran: true } },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: continue-test
          name: Continue Test
        steps:
          - id: failing-step
            type: action
            action: mock.fail
            inputs:
              message: "This will fail"
            error_handling:
              action: continue
            output_variable: failed_result

          - id: next-step
            type: action
            action: mock.success
            inputs:
              message: "This should run"
            output_variable: success_result
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(getCallCount('failing-step')).toBeGreaterThanOrEqual(1);
      expect(getCallCount('next-step')).toBe(1);
      expect(result.output.success_result).toEqual({ ran: true });
    });

    it('should record failure metadata when continuing', async () => {
      const { executor, registry } = createMockExecutor({
        byStepId: {
          'failing-step': { error: 'Known error' },
          'check-status': { dynamic: (step) => step.inputs },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: continue-metadata-test
          name: Continue Metadata Test
        steps:
          - id: failing-step
            type: action
            action: mock.fail
            error_handling:
              action: continue

          - id: check-status
            type: action
            action: mock.check
            inputs:
              prevStatus: "{{ 'failing-step'.status | default('unknown') }}"
            output_variable: check
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
    });
  });

  // ============================================================================
  // Fail Fast (Stop on Error)
  // ============================================================================

  describe('Fail Fast', () => {
    it('should stop workflow when error_handling.action is stop', async () => {
      const { executor, registry, getCallCount } = createMockExecutor({
        byStepId: {
          'critical-step': { error: 'Critical failure' },
          'unreachable-step': { returnValue: { should_not_run: true } },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: fail-fast-test
          name: Fail Fast Test
        steps:
          - id: critical-step
            type: action
            action: mock.fail
            inputs:
              message: "Critical failure"
            error_handling:
              action: stop
            output_variable: failed_result

          - id: unreachable-step
            type: action
            action: mock.success
            inputs:
              message: "This should NOT run"
            output_variable: success_result
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(getCallCount('unreachable-step')).toBe(0);
      expect(result.output.success_result).toBeUndefined();
    });

    it('should stop by default when no error_handling specified', async () => {
      const { executor, registry, getCallCount } = createMockExecutor({
        byStepId: {
          'failing-step': { error: 'Unhandled failure' },
          'next-step': { returnValue: { ran: true } },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: default-stop-test
          name: Default Stop Test
        steps:
          - id: failing-step
            type: action
            action: mock.fail
            output_variable: result

          - id: next-step
            type: action
            action: mock.success
            output_variable: next_result
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(getCallCount('next-step')).toBe(0);
    });
  });

  // ============================================================================
  // Try/Catch/Finally
  // ============================================================================

  describe('Try/Catch/Finally', () => {
    it('should execute catch block on try block failure', async () => {
      const { executor, registry, getCallCount } = createMockExecutor({
        byStepId: {
          'risky': { error: 'Operation failed' },
          'recover': { returnValue: { recovered: true } },
          'cleanup': { returnValue: { cleaned: true } },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: try-catch-test
          name: Try Catch Test
        steps:
          - id: handler
            type: try
            try:
              - id: risky
                type: action
                action: mock.fail
            catch:
              - id: recover
                type: action
                action: mock.recover
                output_variable: recovery
            finally:
              - id: cleanup
                type: action
                action: mock.cleanup
                output_variable: cleanup_result
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(getCallCount('risky')).toBeGreaterThanOrEqual(1);
      expect(getCallCount('recover')).toBe(1);
      expect(getCallCount('cleanup')).toBe(1);
      expect(result.output.recovery).toEqual({ recovered: true });
      expect(result.output.cleanup_result).toEqual({ cleaned: true });
    });

    it('should execute finally block even on success', async () => {
      const { executor, registry, getCallCount } = createMockExecutor({
        byStepId: {
          'safe': { returnValue: { success: true } },
          'cleanup': { returnValue: { cleaned: true } },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: try-finally-test
          name: Try Finally Test
        steps:
          - id: handler
            type: try
            try:
              - id: safe
                type: action
                action: mock.success
                output_variable: result
            finally:
              - id: cleanup
                type: action
                action: mock.cleanup
                output_variable: cleanup_result
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(getCallCount('safe')).toBe(1);
      expect(getCallCount('cleanup')).toBe(1);
      expect(result.output.result).toEqual({ success: true });
      expect(result.output.cleanup_result).toEqual({ cleaned: true });
    });

    it('should provide error context in catch block', async () => {
      const { executor, registry } = createMockExecutor({
        byStepId: {
          'risky': { error: 'Specific error message' },
          'log-error': { dynamic: (step) => step.inputs },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: error-context-test
          name: Error Context Test
        steps:
          - id: handler
            type: try
            try:
              - id: risky
                type: action
                action: mock.fail
            catch:
              - id: log-error
                type: action
                action: mock.log
                inputs:
                  hasError: true
                output_variable: error_log
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.error_log.hasError).toBe(true);
    });

    it('should propagate error when no catch block', async () => {
      const { executor, registry } = createMockExecutor({
        byStepId: {
          'risky': { error: 'Unhandled error' },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: no-catch-test
          name: No Catch Test
        steps:
          - id: handler
            type: try
            try:
              - id: risky
                type: action
                action: mock.fail
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      // Try block failure without catch should mark the try step as failed
      expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
    });

    it('should handle catch block failure', async () => {
      const { executor, registry } = createMockExecutor({
        byStepId: {
          'risky': { error: 'Initial error' },
          'recover': { error: 'Recovery also failed' },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: catch-fail-test
          name: Catch Fail Test
        steps:
          - id: handler
            type: try
            try:
              - id: risky
                type: action
                action: mock.fail
            catch:
              - id: recover
                type: action
                action: mock.fail
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      // Both try and catch failed
      expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
    });
  });

  // ============================================================================
  // Error Handling in Loops
  // ============================================================================

  describe('Error Handling in Loops', () => {
    it('should stop loop iteration on error by default', async () => {
      let processedItems: string[] = [];

      const { executor, registry } = createMockExecutor({
        byStepId: {
          'process': {
            dynamic: (step) => {
              const value = step.inputs?.value;
              if (value === 'bad') {
                throw new Error('Bad item');
              }
              processedItems.push(String(value));
              return { processed: value };
            },
          },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: loop-error-stop-test
          name: Loop Error Stop Test
        steps:
          - id: loop
            type: for_each
            items: "{{ items }}"
            item_variable: item
            steps:
              - id: process
                type: action
                action: mock.process
                inputs:
                  value: "{{ item }}"
        ---
      `);

      const result = await engine.execute(
        workflow,
        { items: ['good1', 'bad', 'good2'] },
        registry,
        executor
      );

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(processedItems).toEqual(['good1']); // Stopped after first error
    });

    it('should continue loop on error when configured', async () => {
      let processedItems: string[] = [];

      const { executor, registry } = createMockExecutor({
        byStepId: {
          'process': {
            dynamic: (step) => {
              const value = step.inputs?.value;
              if (value === 'bad') {
                throw new Error('Bad item');
              }
              processedItems.push(String(value));
              return { processed: value };
            },
          },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: loop-error-continue-test
          name: Loop Error Continue Test
        steps:
          - id: loop
            type: for_each
            items: "{{ items }}"
            item_variable: item
            error_handling:
              action: continue
            steps:
              - id: process
                type: action
                action: mock.process
                inputs:
                  value: "{{ item }}"
        ---
      `);

      const result = await engine.execute(
        workflow,
        { items: ['good1', 'bad', 'good2'] },
        registry,
        executor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(processedItems).toEqual(['good1', 'good2']); // Skipped bad, continued
    });
  });

  // ============================================================================
  // Parallel Error Handling
  // ============================================================================

  describe('Parallel Error Handling', () => {
    it('should fail parallel step when any branch fails (default)', async () => {
      const { executor, registry } = createMockExecutor({
        byStepId: {
          'task-a': { returnValue: { result: 'A' } },
          'task-b': { error: 'Branch B failed' },
          'task-c': { returnValue: { result: 'C' } },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-error-stop-test
          name: Parallel Error Stop Test
        steps:
          - id: parallel
            type: parallel
            branches:
              - id: branch-a
                steps:
                  - id: task-a
                    type: action
                    action: mock.success
              - id: branch-b
                steps:
                  - id: task-b
                    type: action
                    action: mock.fail
              - id: branch-c
                steps:
                  - id: task-c
                    type: action
                    action: mock.success
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
    });

    it('should continue parallel step when on_error is continue', async () => {
      const { executor, registry } = createMockExecutor({
        byStepId: {
          'task-a': { returnValue: { result: 'A' } },
          'task-b': { error: 'Branch B failed' },
          'task-c': { returnValue: { result: 'C' } },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-error-continue-test
          name: Parallel Error Continue Test
        steps:
          - id: parallel
            type: parallel
            on_error: continue
            branches:
              - id: branch-a
                steps:
                  - id: task-a
                    type: action
                    action: mock.success
                    output_variable: result_a
              - id: branch-b
                steps:
                  - id: task-b
                    type: action
                    action: mock.fail
              - id: branch-c
                steps:
                  - id: task-c
                    type: action
                    action: mock.success
                    output_variable: result_c
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.stepResults[0].status).toBe(StepStatus.COMPLETED);
    });
  });
});
