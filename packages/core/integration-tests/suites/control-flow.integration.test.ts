/**
 * Control Flow Integration Tests
 *
 * Tests all 12 control flow step types:
 * - if/else
 * - switch/case
 * - for_each
 * - while
 * - map
 * - filter
 * - reduce
 * - parallel
 * - try/catch/finally
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../src/engine.js';
import { loadInline } from '../utils/workflow-loader.js';
import { createMockExecutor, createSmartExecutor } from '../mock-executor.js';
import { WorkflowStatus, StepStatus } from '../../src/models.js';

describe('Control Flow Integration Tests', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  // ============================================================================
  // If/Else Tests
  // ============================================================================

  describe('if/else', () => {
    it('should execute then branch when condition is true', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: if-then-test
          name: If Then Test
        steps:
          - id: check
            type: if
            condition: "value > 5"
            then:
              - id: high
                type: action
                action: mock.set
                inputs:
                  result: high
                output_variable: outcome
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, { value: 10 }, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.outcome).toEqual({ result: 'high' });
    });

    it('should execute else branch when condition is false', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: if-else-test
          name: If Else Test
        steps:
          - id: check
            type: if
            condition: "value > 5"
            then:
              - id: high
                type: action
                action: mock.set
                inputs:
                  result: high
                output_variable: outcome
            else:
              - id: low
                type: action
                action: mock.set
                inputs:
                  result: low
                output_variable: outcome
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, { value: 3 }, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.outcome).toEqual({ result: 'low' });
    });

    it('should skip if block when condition is false and no else', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: if-skip-test
          name: If Skip Test
        steps:
          - id: check
            type: if
            condition: "false"
            then:
              - id: never
                type: action
                action: mock.fail
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults[0].status).toBe(StepStatus.SKIPPED);
    });

    it('should handle nested if statements', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: nested-if-test
          name: Nested If Test
        steps:
          - id: outer
            type: if
            condition: "level >= 1"
            then:
              - id: inner
                type: if
                condition: "level >= 2"
                then:
                  - id: deep
                    type: action
                    action: mock.set
                    inputs:
                      result: deep
                    output_variable: depth
                else:
                  - id: shallow
                    type: action
                    action: mock.set
                    inputs:
                      result: shallow
                    output_variable: depth
        ---
      `);

      const { executor, registry } = createSmartExecutor();

      const deep = await engine.execute(workflow, { level: 3 }, registry, executor);
      expect(deep.output.depth).toEqual({ result: 'deep' });

      const shallow = await engine.execute(workflow, { level: 1 }, registry, executor);
      expect(shallow.output.depth).toEqual({ result: 'shallow' });
    });

    it('should evaluate complex boolean expressions', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: complex-condition-test
          name: Complex Condition Test
        steps:
          - id: check
            type: if
            condition: "count > 0"
            then:
              - id: positive
                type: action
                action: mock.set
                inputs:
                  result: positive
                output_variable: outcome
        ---
      `);

      const { executor, registry } = createSmartExecutor();

      const positive = await engine.execute(workflow, { count: 5 }, registry, executor);
      expect(positive.output.outcome).toEqual({ result: 'positive' });

      const negative = await engine.execute(workflow, { count: 0 }, registry, executor);
      expect(negative.stepResults[0].status).toBe(StepStatus.SKIPPED);
    });
  });

  // ============================================================================
  // Switch/Case Tests
  // ============================================================================

  describe('switch/case', () => {
    it('should route to matching case', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: switch-test
          name: Switch Test
        steps:
          - id: route
            type: switch
            expression: "{{ priority }}"
            cases:
              high:
                - id: urgent
                  type: action
                  action: mock.set
                  inputs:
                    queue: urgent
                  output_variable: result
              low:
                - id: batch
                  type: action
                  action: mock.set
                  inputs:
                    queue: batch
                  output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, { priority: 'high' }, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.result).toEqual({ queue: 'urgent' });
    });

    it('should use default case when no match', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: switch-default-test
          name: Switch Default Test
        steps:
          - id: route
            type: switch
            expression: "{{ priority }}"
            cases:
              high:
                - id: urgent
                  type: action
                  action: mock.set
                  inputs:
                    queue: urgent
                  output_variable: result
            default:
              - id: normal
                type: action
                action: mock.set
                inputs:
                  queue: normal
                output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, { priority: 'unknown' }, registry, executor);

      expect(result.output.result).toEqual({ queue: 'normal' });
    });

    it('should handle expression-based routing', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: switch-expression-test
          name: Switch Expression Test
        steps:
          - id: route
            type: switch
            expression: "{{ status | upper }}"
            cases:
              ACTIVE:
                - id: active
                  type: action
                  action: mock.set
                  inputs:
                    state: active
                  output_variable: result
              INACTIVE:
                - id: inactive
                  type: action
                  action: mock.set
                  inputs:
                    state: inactive
                  output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, { status: 'active' }, registry, executor);

      expect(result.output.result).toEqual({ state: 'active' });
    });
  });

  // ============================================================================
  // For-Each Tests
  // ============================================================================

  describe('for_each', () => {
    it('should iterate over array items', async () => {
      const { executor, registry, getCapturedInputs } = createMockExecutor({
        defaultBehavior: { dynamic: (step) => step.inputs },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: foreach-test
          name: ForEach Test
        steps:
          - id: loop
            type: for_each
            items: "{{ items }}"
            item_variable: item
            index_variable: idx
            steps:
              - id: process
                type: action
                action: mock.process
                inputs:
                  value: "{{ item }}"
                  index: "{{ idx }}"
        ---
      `);

      const result = await engine.execute(
        workflow,
        { items: ['a', 'b', 'c'] },
        registry,
        executor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);

      const inputs = getCapturedInputs('process');
      expect(inputs).toHaveLength(3);
      expect(inputs[0]).toEqual({ value: 'a', index: 0 });
      expect(inputs[1]).toEqual({ value: 'b', index: 1 });
      expect(inputs[2]).toEqual({ value: 'c', index: 2 });
    });

    it('should provide loop metadata (first, last, length)', async () => {
      const { executor, registry, getCapturedInputs } = createMockExecutor({
        defaultBehavior: { dynamic: (step) => step.inputs },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: foreach-meta-test
          name: ForEach Meta Test
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
                  first: "{{ loop.first }}"
                  last: "{{ loop.last }}"
                  length: "{{ loop.length }}"
        ---
      `);

      const result = await engine.execute(
        workflow,
        { items: [1, 2, 3] },
        registry,
        executor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);

      const inputs = getCapturedInputs('process');
      expect(inputs[0]).toMatchObject({ first: true, last: false, length: 3 });
      expect(inputs[1]).toMatchObject({ first: false, last: false, length: 3 });
      expect(inputs[2]).toMatchObject({ first: false, last: true, length: 3 });
    });

    it('should skip when items is empty', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: foreach-empty-test
          name: ForEach Empty Test
        steps:
          - id: loop
            type: for_each
            items: "{{ items }}"
            item_variable: item
            steps:
              - id: process
                type: action
                action: mock.fail
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, { items: [] }, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults[0].status).toBe(StepStatus.SKIPPED);
    });
  });

  // ============================================================================
  // While Loop Tests
  // ============================================================================

  describe('while', () => {
    it('should loop while condition is true', async () => {
      const { executor, registry, getCallCount } = createMockExecutor({
        byStepId: {
          'init': { returnValue: 0 },
          'increment': { dynamic: (step, ctx) => (ctx.variables.counter as number) + 1 },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: while-test
          name: While Test
        steps:
          - id: init
            type: action
            action: mock.set
            inputs:
              value: 0
            output_variable: counter
          - id: loop
            type: while
            condition: "counter < 3"
            max_iterations: 10
            steps:
              - id: increment
                type: action
                action: mock.increment
                output_variable: counter
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.counter).toBe(3);
      expect(getCallCount('increment')).toBe(3);
    });

    it('should respect max iterations', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: while-max-test
          name: While Max Test
        steps:
          - id: loop
            type: while
            condition: "true"
            max_iterations: 5
            steps:
              - id: noop
                type: action
                action: mock.noop
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(result.error).toContain('Max iterations');
    });
  });

  // ============================================================================
  // Map/Filter/Reduce Tests
  // ============================================================================

  describe('map', () => {
    it('should transform each item', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: map-test
          name: Map Test
        steps:
          - id: double
            type: map
            items: "{{ numbers }}"
            item_variable: n
            expression: "{{ n * 2 }}"
            output_variable: doubled
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, { numbers: [1, 2, 3] }, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.doubled).toEqual([2, 4, 6]);
    });
  });

  describe('filter', () => {
    it('should filter items by condition', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: filter-test
          name: Filter Test
        steps:
          - id: filter-high
            type: filter
            items: "{{ numbers }}"
            item_variable: n
            condition: "n > 5"
            output_variable: high
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { numbers: [2, 7, 4, 9, 1, 8] },
        registry,
        executor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.high).toEqual([7, 9, 8]);
    });
  });

  describe('reduce', () => {
    it('should reduce items to single value', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: reduce-test
          name: Reduce Test
        steps:
          - id: sum
            type: reduce
            items: "{{ numbers }}"
            item_variable: n
            accumulator_variable: total
            initial_value: 0
            expression: "{{ total + n }}"
            output_variable: sum
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { numbers: [1, 2, 3, 4, 5] },
        registry,
        executor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.sum).toBe(15);
    });
  });

  // ============================================================================
  // Parallel Execution Tests
  // ============================================================================

  describe('parallel', () => {
    it('should execute branches concurrently', async () => {
      const { executor, registry, getCallCount } = createMockExecutor({
        defaultBehavior: { dynamic: (step) => step.inputs },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-test
          name: Parallel Test
        steps:
          - id: parallel
            type: parallel
            branches:
              - id: branch-a
                steps:
                  - id: task-a
                    type: action
                    action: mock.process
                    inputs:
                      name: A
                    output_variable: result_a
              - id: branch-b
                steps:
                  - id: task-b
                    type: action
                    action: mock.process
                    inputs:
                      name: B
                    output_variable: result_b
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(getCallCount('task-a')).toBe(1);
      expect(getCallCount('task-b')).toBe(1);
    });

    it('should isolate branch contexts', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-isolation-test
          name: Parallel Isolation Test
        steps:
          - id: parallel
            type: parallel
            branches:
              - id: branch-a
                steps:
                  - id: set-a
                    type: action
                    action: core.set
                    inputs:
                      value: "A"
                    output_variable: local_var
              - id: branch-b
                steps:
                  - id: set-b
                    type: action
                    action: core.set
                    inputs:
                      value: "B"
                    output_variable: local_var
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      // Each branch has its own context, merged with prefix
      expect(result.output['branch-a.local_var']).toEqual({ value: 'A' });
      expect(result.output['branch-b.local_var']).toEqual({ value: 'B' });
    });
  });

  // ============================================================================
  // Try/Catch/Finally Tests
  // ============================================================================

  describe('try/catch/finally', () => {
    it('should catch errors and execute catch block', async () => {
      const { executor, registry } = createMockExecutor({
        byStepId: {
          'risky': { error: 'Simulated failure' },
          'handle': { dynamic: (step) => step.inputs },
          'cleanup': { dynamic: (step) => step.inputs },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: try-catch-test
          name: Try Catch Test
        steps:
          - id: error-handler
            type: try
            try:
              - id: risky
                type: action
                action: mock.fail
            catch:
              - id: handle
                type: action
                action: mock.set
                inputs:
                  handled: true
                output_variable: recovery
            finally:
              - id: cleanup
                type: action
                action: mock.set
                inputs:
                  cleaned: true
                output_variable: cleanup_result
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.recovery).toEqual({ handled: true });
      expect(result.output.cleanup_result).toEqual({ cleaned: true });
    });

    it('should execute finally even without error', async () => {
      const { executor, registry, getCallCount } = createMockExecutor({
        byStepId: {
          'safe': { returnValue: { ok: true } },
          'cleanup': { returnValue: { cleaned: true } },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: try-finally-test
          name: Try Finally Test
        steps:
          - id: safe-handler
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
    });

    it('should propagate error when no catch block', async () => {
      const { executor, registry } = createMockExecutor({
        byStepId: {
          'risky': { error: 'Critical error' },
        },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: try-no-catch-test
          name: Try No Catch Test
        steps:
          - id: unhandled
            type: try
            try:
              - id: risky
                type: action
                action: mock.fail
        ---
      `);

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
    });
  });
});
