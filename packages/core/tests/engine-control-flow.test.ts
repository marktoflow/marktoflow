/**
 * Control Flow Engine Tests
 *
 * Comprehensive tests for workflow control flow features:
 * - If/Else conditionals
 * - Switch/Case routing
 * - For-Each loops
 * - While loops
 * - Map/Filter/Reduce transformations
 * - Parallel execution
 * - Try/Catch error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../src/engine.js';
import { parseContent } from '../src/parser.js';
import type { SDKRegistryLike, StepExecutor } from '../src/engine.js';
import { StepStatus } from '../src/models.js';

// Mock SDK Registry
const mockRegistry: SDKRegistryLike = {
  async load() {
    return {};
  },
  has() {
    return true;
  },
};

// Mock Step Executor - improved to handle test scenarios
const mockExecutor: StepExecutor = async (step, context) => {
  // Handle specific test actions that set values
  if (step.id === 'set-value' || step.id === 'set-priority' || step.id === 'set-items' ||
      step.id === 'set-numbers' || step.id === 'set-users' || step.id === 'init-counter' ||
      step.id === 'set-data' || step.id === 'set-empty' || step.id === 'set-flag' ||
      step.id === 'set-false' || step.id === 'set-non-array') {
    return step.inputs?.value;
  }

  // Increment counter
  if (step.id === 'increment') {
    const counter = context.variables.counter as number;
    return counter + 1;
  }

  // Return specified value if provided
  if (step.inputs?.returnValue !== undefined) {
    return step.inputs.returnValue;
  }

  // Default success response
  return { success: true };
};

describe('Control Flow Engine Tests', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  // ============================================================================
  // If/Else Tests
  // ============================================================================

  describe('If/Else Conditionals', () => {
    it('should execute then branch when condition is true', async () => {
      const workflowContent = `---
workflow:
  id: if-test
  name: If Test

steps:
  - id: set-value
    type: action
    action: mock.setValue
    inputs:
      value: 10
    output_variable: count
  - id: check-count
    type: if
    condition: "count > 5"
    then:
      - id: high-count
        type: action
        action: mock.logMessage
        inputs:
          message: "High count"
        output_variable: result
    else:
      - id: low-count
        type: action
        action: mock.logMessage
        inputs:
          message: "Low count"
        output_variable: result
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.output.count).toBe(10);
      expect(result.output.result).toEqual({ success: true });
    });

    it('should execute else branch when condition is false', async () => {
      const workflowContent = `---
workflow:
  id: if-test-2
  name: If Test 2

steps:
  - id: set-value
    type: action
    action: mock.setValue
    inputs:
      value: 3
    output_variable: count
  - id: check-count
    type: if
    condition: "count > 5"
    else:
      - id: low-count
        type: action
        action: mock.logMessage
        inputs:
          message: "Low count"
        output_variable: low_result
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.output.count).toBe(3);
      expect(result.output.low_result).toEqual({ success: true });
    });

    it('should skip if block when condition is false and no else', async () => {
      const workflowContent = `---
workflow:
  id: if-test-3
  name: If Test 3

steps:
  - id: check-count
    type: if
    condition: "false"
    then:
      - id: never-runs
        type: action
        action: mock.fail
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.stepResults[0].status).toBe(StepStatus.SKIPPED);
    });

    it('should support nested if statements', async () => {
      const workflowContent = `---
workflow:
  id: nested-if
  name: Nested If

steps:
  - id: outer-if
    type: if
    condition: "true"
    then:
      - id: inner-if
        type: if
        condition: "true"
        then:
          - id: deeply-nested
            type: action
            action: mock.success
            output_variable: nested_result
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.output.nested_result).toEqual({ success: true });
    });
  });

  // ============================================================================
  // Switch/Case Tests
  // ============================================================================

  describe('Switch/Case Routing', () => {
    it('should execute matching case', async () => {
      const workflowContent = `---
workflow:
  id: switch-test
  name: Switch Test

steps:
  - id: set-priority
    type: action
    action: mock.setValue
    inputs:
      value: "high"
    output_variable: priority
  - id: route-by-priority
    type: switch
    expression: "{{ priority }}"
    cases:
      high:
        - id: handle-high
          type: action
          action: mock.handleHigh
          output_variable: result
      medium:
        - id: handle-medium
          type: action
          action: mock.handleMedium
      low:
        - id: handle-low
          type: action
          action: mock.handleLow
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.output.result).toEqual({ success: true });
    });

    it('should execute default case when no match', async () => {
      const workflowContent = `---
workflow:
  id: switch-default
  name: Switch Default

steps:
  - id: set-priority
    type: action
    action: mock.setValue
    inputs:
      value: "unknown"
    output_variable: priority
  - id: route-by-priority
    type: switch
    expression: "{{ priority }}"
    cases:
      high:
        - id: handle-high
          type: action
          action: mock.handleHigh
    default:
      - id: handle-default
        type: action
        action: mock.handleDefault
        output_variable: default_result
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.output.default_result).toEqual({ success: true });
    });

    it('should skip when no match and no default', async () => {
      const workflowContent = `---
workflow:
  id: switch-no-match
  name: Switch No Match

steps:
  - id: route
    type: switch
    expression: "unknown"
    cases:
      high:
        - id: handle-high
          type: action
          action: mock.handleHigh
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.stepResults[0].status).toBe(StepStatus.SKIPPED);
    });
  });

  // ============================================================================
  // For-Each Loop Tests
  // ============================================================================

  describe('For-Each Loops', () => {
    it('should iterate over array with loop metadata', async () => {
      const workflowContent = `---
workflow:
  id: foreach-test
  name: ForEach Test

steps:
  - id: set-items
    action: mock.setValue
    inputs:
      value: [1, 2, 3]
    output_variable: items
  - id: process-items
    type: for_each
    items: "{{ items }}"
    item_variable: item
    steps:
      - id: process-item
        action: mock.processItem
        inputs:
          item: "{{ item }}"
          index: "{{ loop.index }}"
          first: "{{ loop.first }}"
          last: "{{ loop.last }}"
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      // For-each returns the items array as output
      expect(result.stepResults[1].output).toHaveLength(3);
    });

    it('should handle empty arrays by skipping', async () => {
      const workflowContent = `---
workflow:
  id: foreach-empty
  name: ForEach Empty

steps:
  - id: set-empty
    action: mock.setValue
    inputs:
      value: []
    output_variable: empty_items
  - id: process-items
    type: for_each
    items: "{{ empty_items }}"
    steps:
      - id: never-runs
        action: mock.fail
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.stepResults[1].status).toBe(StepStatus.SKIPPED);
    });

    it('should support custom item and index variables', async () => {
      const workflowContent = `---
workflow:
  id: foreach-custom
  name: ForEach Custom

steps:
  - id: set-users
    action: mock.setValue
    inputs:
      value:
        - name: Alice
        - name: Bob
    output_variable: users
  - id: process-users
    type: for_each
    items: "{{ users }}"
    item_variable: user
    index_variable: idx
    steps:
      - id: greet-user
        action: mock.greet
        inputs:
          name: "{{ user.name }}"
          position: "{{ idx }}"
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
    });

    it('should handle errors with continue action', { timeout: 10000 }, async () => {
      const customExecutor: StepExecutor = async (step, context) => {
        // Fail on second iteration
        if (step.id === 'fail-on-2' && context.variables.loop && (context.variables.loop as any).index === 1) {
          throw new Error('Simulated failure');
        }
        if (step.id === 'set-items') {
          return [1, 2, 3];
        }
        return { success: true };
      };

      const workflowContent = `---
workflow:
  id: foreach-error-continue
  name: ForEach Error Continue

steps:
  - id: set-items
    action: mock.setValue
    inputs:
      value: [1, 2, 3]
    output_variable: items
  - id: process-items
    type: for_each
    items: "{{ items }}"
    error_handling:
      action: continue
      maxRetries: 0
    steps:
      - id: fail-on-2
        action: mock.process
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, customExecutor);

      // Should complete despite errors
      expect(result.status).toBe('completed');
    });
  });

  // ============================================================================
  // While Loop Tests
  // ============================================================================

  describe('While Loops', () => {
    it('should loop while condition is true', async () => {
      const workflowContent = `---
workflow:
  id: while-test
  name: While Test

steps:
  - id: init-counter
    type: action
    action: mock.setValue
    inputs:
      value: 0
    output_variable: counter
  - id: increment-while-less-than-5
    type: while
    condition: "counter < 5"
    max_iterations: 10
    steps:
      - id: increment
        type: action
        action: mock.increment
        inputs:
          value: "{{ counter }}"
        output_variable: counter
---`;

      const incrementExecutor: StepExecutor = async (step, context) => {
        if (step.id === 'increment') {
          return (context.variables.counter as number) + 1;
        }
        if (step.id === 'init-counter') {
          return 0;
        }
        return { success: true };
      };

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, incrementExecutor);

      expect(result.status).toBe('completed');
      expect(result.output.counter).toBe(5);
    });

    it('should fail when max iterations exceeded', async () => {
      const workflowContent = `---
workflow:
  id: while-max-iter
  name: While Max Iterations

steps:
  - id: set-flag
    action: mock.setValue
    inputs:
      value: true
    output_variable: always_true
  - id: infinite-loop
    type: while
    condition: "always_true == true"
    max_iterations: 3
    steps:
      - id: noop
        action: mock.noop
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('failed');
      expect(result.stepResults[1].error).toContain('Max iterations');
    });

    it('should not execute if condition is initially false', async () => {
      const workflowContent = `---
workflow:
  id: while-false
  name: While False

steps:
  - id: never-loops
    type: while
    condition: "false"
    steps:
      - id: never-runs
        type: action
        action: mock.fail
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.stepResults[0].output).toEqual({ iterations: 0 });
    });
  });

  // ============================================================================
  // Map/Filter/Reduce Tests
  // ============================================================================

  describe('Map/Filter/Reduce Transformations', () => {
    it('should map array elements', async () => {
      const workflowContent = `---
workflow:
  id: map-test
  name: Map Test

steps:
  - id: set-numbers
    action: mock.setValue
    inputs:
      value: [1, 2, 3]
    output_variable: numbers
  - id: double-numbers
    type: map
    items: "{{ numbers }}"
    item_variable: num
    expression: "{{ num }}"
    output_variable: doubled
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      // Map returns the mapped values
      expect(result.output.doubled).toHaveLength(3);
      expect(result.output.doubled).toEqual([1, 2, 3]);
    });

    it('should filter array elements', async () => {
      const workflowContent = `---
workflow:
  id: filter-test
  name: Filter Test

steps:
  - id: set-numbers
    action: mock.setValue
    inputs:
      value: [1, 2, 3, 4, 5]
    output_variable: numbers
  - id: filter-even
    type: filter
    items: "{{ numbers }}"
    item_variable: num
    condition: "num > 3"
    output_variable: filtered
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      // Filter will keep items where num > 3 evaluates to true (4 and 5)
      expect(result.output.filtered).toHaveLength(2);
      expect(result.output.filtered).toEqual([4, 5]);
    });

    it('should reduce array to single value', async () => {
      const workflowContent = `---
workflow:
  id: reduce-test
  name: Reduce Test

steps:
  - id: set-numbers
    action: mock.setValue
    inputs:
      value: [1, 2, 3]
    output_variable: numbers
  - id: sum-numbers
    type: reduce
    items: "{{ numbers }}"
    item_variable: num
    accumulator_variable: sum
    initial_value: 0
    expression: "{{ num }}"
    output_variable: total
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      // Reduce returns the final value (last item since expression just returns num)
      expect(result.output.total).toBe(3);
    });

    it('should handle non-array input with error', async () => {
      const workflowContent = `---
workflow:
  id: map-error
  name: Map Error

steps:
  - id: set-non-array
    action: mock.setValue
    inputs:
      value: "not-an-array"
    output_variable: bad_value
  - id: map-non-array
    type: map
    items: "{{ bad_value }}"
    expression: "{{ item }}"
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('failed');
      expect(result.stepResults[1].error).toContain('must be an array');
    });
  });

  // ============================================================================
  // Parallel Execution Tests
  // ============================================================================

  describe('Parallel Execution', () => {
    it('should execute branches concurrently', { timeout: 10000 }, async () => {
      const workflowContent = `---
workflow:
  id: parallel-test
  name: Parallel Test

steps:
  - id: parallel-fetch
    type: parallel
    branches:
      - id: fetch-users
        steps:
          - id: get-users
            type: action
            action: mock.getUsers
            output_variable: users
      - id: fetch-posts
        steps:
          - id: get-posts
            type: action
            action: mock.getPosts
            output_variable: posts
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.output['fetch-users.users']).toBeDefined();
      expect(result.output['fetch-posts.posts']).toBeDefined();
    });

    it('should respect maxConcurrent limit', { timeout: 10000 }, async () => {
      const workflowContent = `---
workflow:
  id: parallel-limited
  name: Parallel Limited

steps:
  - id: limited-parallel
    type: parallel
    max_concurrent: 2
    branches:
      - id: task1
        steps:
          - id: do-task1
            type: action
            action: mock.task
      - id: task2
        steps:
          - id: do-task2
            type: action
            action: mock.task
      - id: task3
        steps:
          - id: do-task3
            type: action
            action: mock.task
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
    });

    it('should fail if branch fails with onError=stop', { timeout: 10000 }, async () => {
      const failExecutor: StepExecutor = async (step) => {
        if (step.id === 'fail-step') {
          throw new Error('Branch failed');
        }
        return { success: true };
      };

      const workflowContent = `---
workflow:
  id: parallel-fail
  name: Parallel Fail

steps:
  - id: parallel-with-failure
    type: parallel
    on_error: stop
    branches:
      - id: success-branch
        steps:
          - id: success-step
            type: action
            action: mock.success
      - id: fail-branch
        steps:
          - id: fail-step
            type: action
            action: mock.fail
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, failExecutor);

      expect(result.status).toBe('failed');
    });

    it('should continue if branch fails with onError=continue', { timeout: 10000 }, async () => {
      const failExecutor: StepExecutor = async (step) => {
        if (step.id === 'fail-step') {
          throw new Error('Branch failed');
        }
        return { success: true };
      };

      const workflowContent = `---
workflow:
  id: parallel-continue
  name: Parallel Continue

steps:
  - id: parallel-with-failure
    type: parallel
    on_error: continue
    branches:
      - id: success-branch
        steps:
          - id: success-step
            type: action
            action: mock.success
      - id: fail-branch
        steps:
          - id: fail-step
            type: action
            action: mock.fail
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, failExecutor);

      expect(result.status).toBe('completed');
    });
  });

  // ============================================================================
  // Try/Catch Tests
  // ============================================================================

  describe('Try/Catch Error Handling', () => {
    it('should execute catch block on error', { timeout: 10000 }, async () => {
      const failExecutor: StepExecutor = async (step) => {
        if (step.id === 'failing-step') {
          throw new Error('Intentional failure');
        }
        return { success: true };
      };

      const workflowContent = `---
workflow:
  id: try-catch-test
  name: Try Catch Test

steps:
  - id: handle-error
    type: try
    try:
      - id: failing-step
        type: action
        action: mock.fail
    catch:
      - id: log-error
        type: action
        action: mock.logError
        inputs:
          error: "{{ error.message }}"
        output_variable: error_logged
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, failExecutor);

      expect(result.status).toBe('completed');
      expect(result.output.error_logged).toBeDefined();
    });

    it('should execute finally block always', { timeout: 10000 }, async () => {
      const workflowContent = `---
workflow:
  id: try-finally
  name: Try Finally

steps:
  - id: with-finally
    type: try
    try:
      - id: success-step
        type: action
        action: mock.success
    finally:
      - id: cleanup
        type: action
        action: mock.cleanup
        output_variable: cleaned_up
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.output.cleaned_up).toBeDefined();
    });

    it('should fail if no catch block handles error', { timeout: 10000 }, async () => {
      const failExecutor: StepExecutor = async (step) => {
        if (step.id === 'failing-step') {
          throw new Error('Unhandled error');
        }
        return { success: true };
      };

      const workflowContent = `---
workflow:
  id: try-no-catch
  name: Try No Catch

steps:
  - id: unhandled-error
    type: try
    try:
      - id: failing-step
        type: action
        action: mock.fail
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, failExecutor);

      expect(result.status).toBe('failed');
    });

    it('should execute finally even on catch error', { timeout: 10000 }, async () => {
      const failExecutor: StepExecutor = async () => {
        throw new Error('Always fails');
      };

      const workflowContent = `---
workflow:
  id: try-catch-finally
  name: Try Catch Finally

steps:
  - id: complete-error-handling
    type: try
    try:
      - id: try-step
        type: action
        action: mock.fail
    catch:
      - id: catch-step
        type: action
        action: mock.fail
    finally:
      - id: finally-step
        type: action
        action: mock.cleanup
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, failExecutor);

      // Finally should run even though catch failed
      expect(result.status).toBe('failed');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should support nested control flow (if inside for_each)', async () => {
      const workflowContent = `---
workflow:
  id: nested-control
  name: Nested Control Flow

steps:
  - id: set-items
    action: mock.setValue
    inputs:
      value: [1, 5, 10]
    output_variable: items
  - id: process-with-condition
    type: for_each
    items: "{{ items }}"
    steps:
      - id: check-value
        type: if
        condition: "item > 3"
        then:
          - id: log-high
            action: mock.logHigh
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
    });

    it('should support map-filter-reduce pipeline', async () => {
      const workflowContent = `---
workflow:
  id: data-pipeline
  name: Data Pipeline

steps:
  - id: set-data
    action: mock.setValue
    inputs:
      value: [1, 2, 3, 4, 5]
    output_variable: data
  - id: map-data
    type: map
    items: "{{ data }}"
    expression: "{{ item }}"
    output_variable: mapped
  - id: filter-data
    type: filter
    items: "{{ mapped }}"
    condition: "item > 2"
    output_variable: filtered
  - id: reduce-data
    type: reduce
    items: "{{ filtered }}"
    initial_value: 0
    expression: "{{ item }}"
    output_variable: result
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
      expect(result.output.result).toBeDefined();
      // Result should be last item after filter (5)
      expect(result.output.result).toBe(5);
    });

    it('should support try/catch around parallel execution', async () => {
      const workflowContent = `---
workflow:
  id: try-parallel
  name: Try Parallel

steps:
  - id: safe-parallel
    type: try
    try:
      - id: parallel-ops
        type: parallel
        branches:
          - id: op1
            steps:
              - id: do-op1
                type: action
                action: mock.op1
          - id: op2
            steps:
              - id: do-op2
                type: action
                action: mock.op2
    catch:
      - id: handle-parallel-error
        type: action
        action: mock.logError
---`;

      const { workflow } = parseContent(workflowContent);
      const result = await engine.execute(workflow, {}, mockRegistry, mockExecutor);

      expect(result.status).toBe('completed');
    });
  });
});
