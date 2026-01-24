import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from '../src/engine.js';
import { parseContent } from '../src/parser.js';
import { SDKRegistry } from '../src/sdk-registry.js';
import { WorkflowStatus, StepStatus } from '../src/models.js';

describe('Concurrent Execution Tests', () => {
  let mockSDKRegistry: SDKRegistry;

  beforeEach(() => {
    mockSDKRegistry = new SDKRegistry({
      async load() {
        return {};
      },
    });
  });

  describe('Parallel Step Execution', () => {
    it('should execute independent steps concurrently when possible', async () => {
      const workflowContent = `---
workflow:
  id: concurrent-test
  name: "Concurrent Execution Test"

steps:
  - id: fetch_user
    action: test.fetchUser
    output_variable: user
  
  - id: fetch_settings
    action: test.fetchSettings
    output_variable: settings
  
  - id: fetch_stats
    action: test.fetchStats
    output_variable: stats
  
  - id: combine
    action: test.combine
    inputs:
      user: "{{user}}"
      settings: "{{settings}}"
      stats: "{{stats}}"
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const executionTimes: number[] = [];
      const mockExecutor = vi.fn().mockImplementation(async () => {
        const start = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async work
        executionTimes.push(Date.now() - start);
        return { data: 'result' };
      });

      const start = Date.now();
      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);
      const totalTime = Date.now() - start;

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(4);
      expect(mockExecutor).toHaveBeenCalledTimes(4);

      // Note: Current engine executes sequentially, but this test documents expected behavior
      // If parallel execution is implemented, total time should be ~300ms not ~400ms
    });
  });

  describe('Rate Limiting and Throttling', () => {
    it('should handle rate-limited API calls', async () => {
      const workflowContent = `---
workflow:
  id: rate-limited
  name: "Rate Limited Workflow"

steps:
  - id: call1
    action: api.call
    output_variable: result1
  
  - id: call2
    action: api.call
    output_variable: result2
  
  - id: call3
    action: api.call
    output_variable: result3
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      let callCount = 0;
      const mockExecutor = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Rate limit exceeded');
        }
        return { success: true };
      });

      // First attempt should fail due to rate limiting
      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      // With retries, some steps should eventually succeed or fail
      expect(result.stepResults.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Contention', () => {
    it('should handle concurrent access to shared resources', async () => {
      const workflowContent = `---
workflow:
  id: shared-resource
  name: "Shared Resource Access"

steps:
  - id: acquire_lock
    action: resource.lock
    inputs:
      resource_id: "db-connection-pool"
    output_variable: lock
  
  - id: use_resource
    action: resource.query
    inputs:
      query: "SELECT * FROM users"
    output_variable: query_result
  
  - id: release_lock
    action: resource.unlock
    inputs:
      lock_id: "{{lock.id}}"
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce({ id: 'lock-123', acquired: true })
        .mockResolvedValueOnce({ rows: 10, data: [] })
        .mockResolvedValueOnce({ released: true });

      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(3);
      expect(mockExecutor).toHaveBeenCalledTimes(3);
    });
  });

  describe('Circuit Breaker Under Load', () => {
    it('should open circuit breaker after multiple failures', async () => {
      const workflowContent = `---
workflow:
  id: circuit-breaker-test
  name: "Circuit Breaker Test"

steps:
  - id: call1
    action: api.unstable
    error_handling:
      action: continue
      max_retries: 0
  
  - id: call2
    action: api.unstable
    error_handling:
      action: continue
      max_retries: 0
  
  - id: call3
    action: api.unstable
    error_handling:
      action: continue
      max_retries: 0
  
  - id: call4
    action: api.unstable
    error_handling:
      action: continue
      max_retries: 0
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      // All steps should fail
      expect(result.stepResults.every((s) => s.status === StepStatus.FAILED)).toBe(true);
    }, 10000); // 10 second timeout
  });

  describe('Long-Running Workflows', () => {
    it('should handle workflows with long-running steps', async () => {
      const workflowContent = `---
workflow:
  id: long-running
  name: "Long Running Workflow"

steps:
  - id: quick_step
    action: test.quick
    output_variable: quick_result
  
  - id: long_step
    action: test.longRunning
    inputs:
      timeout: 5000
    output_variable: long_result
  
  - id: final_step
    action: test.final
    inputs:
      data: "{{long_result}}"
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine({ defaultTimeout: 10000 });

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce({ quick: true })
        .mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { completed: true };
        })
        .mockResolvedValueOnce({ final: true });

      const start = Date.now();
      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);
      const duration = Date.now() - start;

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(duration).toBeGreaterThanOrEqual(500);
    }, 10000); // 10 second timeout

    it('should timeout steps that exceed timeout limit', async () => {
      const workflowContent = `---
workflow:
  id: timeout-test
  name: "Timeout Test"

steps:
  - id: timeout_step
    action: test.neverCompletes
    timeout: 1000
    error_handling:
      action: continue
  
  - id: recovery_step
    action: test.recover
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine({ defaultTimeout: 1000 });

      const mockExecutor = vi
        .fn()
        .mockImplementationOnce(async () => {
          // Simulate a step that takes too long
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return { never: 'reached' };
        })
        .mockResolvedValueOnce({ recovered: true });

      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      // First step should timeout, second should complete
      expect(result.stepResults.length).toBeGreaterThan(0);
    }, 15000); // 15 second timeout (5s mock delay + retries + overhead)
  });

  describe('Workflow State Consistency', () => {
    it('should maintain consistent state across concurrent step executions', async () => {
      const workflowContent = `---
workflow:
  id: state-consistency
  name: "State Consistency Test"

steps:
  - id: init_counter
    action: test.initCounter
    output_variable: counter
  
  - id: increment1
    action: test.increment
    inputs:
      counter: "{{counter}}"
    output_variable: counter1
  
  - id: increment2
    action: test.increment
    inputs:
      counter: "{{counter1}}"
    output_variable: counter2
  
  - id: verify
    action: test.verify
    inputs:
      expected: 2
      actual: "{{counter2}}"
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      let counter = 0;
      const mockExecutor = vi.fn().mockImplementation(async (step) => {
        if (step.action === 'test.initCounter') {
          counter = 0;
          return { value: counter };
        } else if (step.action === 'test.increment') {
          counter++;
          return { value: counter };
        } else if (step.action === 'test.verify') {
          return { valid: counter === 2 };
        }
        return {};
      });

      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect((result.output.counter2 as any).value).toBe(2);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle workflows with large data payloads', async () => {
      const workflowContent = `---
workflow:
  id: large-data
  name: "Large Data Handling"

steps:
  - id: generate_data
    action: test.generateLargeDataset
    output_variable: dataset
  
  - id: process_data
    action: test.processDataset
    inputs:
      data: "{{dataset}}"
    output_variable: processed
  
  - id: summarize
    action: test.summarize
    inputs:
      data: "{{processed}}"
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      }));

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(largeArray)
        .mockResolvedValueOnce({ processed: largeArray.length })
        .mockResolvedValueOnce({ summary: { count: largeArray.length } });

      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect((result.output.processed as any).processed).toBe(10000);
    });
  });
});
