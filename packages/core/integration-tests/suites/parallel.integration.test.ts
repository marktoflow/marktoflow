/**
 * Parallel Execution Integration Tests
 *
 * Tests parallel.spawn and parallel.map in real workflow scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../src/engine.js';
import { loadInline } from '../utils/workflow-loader.js';
import { createSmartExecutor } from '../mock-executor.js';
import { WorkflowStatus } from '../../src/models.js';

describe('Parallel Execution Integration Tests', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  // ============================================================================
  // parallel.spawn Tests
  // ============================================================================

  describe('parallel.spawn', () => {
    it('should execute multiple agents in parallel and wait for all', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-spawn-test
          name: Parallel Spawn Test
        steps:
          - id: parallel-review
            type: action
            action: parallel.spawn
            inputs:
              agents:
                - id: security
                  provider: mock
                  prompt: "Security review"
                - id: performance
                  provider: mock
                  prompt: "Performance review"
              wait: all
            output_variable: results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async (inputs: any) => ({
          choices: [{ message: { content: `Reviewed: ${inputs.messages[0].content}` } }],
        }),
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.results.successful).toHaveLength(2);
      expect(result.output.results.successful).toContain('security');
      expect(result.output.results.successful).toContain('performance');
      expect(result.output.results.failed).toHaveLength(0);
    });

    it('should handle agent failures with onError: continue', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-error-handling
          name: Parallel Error Handling
        steps:
          - id: parallel-with-errors
            type: action
            action: parallel.spawn
            inputs:
              agents:
                - id: success1
                  provider: mock
                  prompt: "Will succeed"
                - id: failure
                  provider: error
                  prompt: "Will fail"
                - id: success2
                  provider: mock
                  prompt: "Will succeed"
              wait: all
              onError: continue
            output_variable: results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async () => ({ result: 'success' }),
        'error.chat.completions': async () => {
          throw new Error('Simulated failure');
        },
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.results.successful).toHaveLength(2);
      expect(result.output.results.failed).toHaveLength(1);
      expect(result.output.results.failed[0]).toBe('failure');
    });

    it('should wait for majority of agents', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-majority
          name: Parallel Majority Wait
        steps:
          - id: parallel-majority
            type: action
            action: parallel.spawn
            inputs:
              agents:
                - id: agent1
                  provider: mock
                  prompt: "Agent 1"
                - id: agent2
                  provider: mock
                  prompt: "Agent 2"
                - id: agent3
                  provider: mock
                  prompt: "Agent 3"
              wait: majority
            output_variable: results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async (inputs: any) => ({
          result: `Processed: ${inputs.messages[0].content}`,
        }),
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      // Should have at least 2 out of 3 (majority)
      expect(result.output.results.successful.length).toBeGreaterThanOrEqual(2);
    });

    it('should track costs and timing', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-metrics
          name: Parallel Metrics Test
        steps:
          - id: parallel-with-metrics
            type: action
            action: parallel.spawn
            inputs:
              agents:
                - id: agent1
                  provider: mock
                  prompt: "Test"
            output_variable: results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async () => ({ result: 'done' }),
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.results.timing).toBeDefined();
      expect(result.output.results.timing.duration).toBeGreaterThanOrEqual(0);
      expect(result.output.results.costs).toBeDefined();
      expect(result.output.results.costs.total).toBeDefined();
    });

    it('should resolve template variables in prompts', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-templates
          name: Parallel Template Resolution
        steps:
          - id: set-data
            type: action
            action: core.set
            inputs:
              code: "function test() { return 42; }"
            output_variable: data
          
          - id: parallel-review
            type: action
            action: parallel.spawn
            inputs:
              agents:
                - id: reviewer
                  provider: mock
                  prompt: "Review this code: {{ data.code }}"
              wait: all
            output_variable: results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async (inputs: any) => {
          return { reviewed: inputs.messages[0].content };
        },
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.results.successful).toContain('reviewer');
    });
  });

  // ============================================================================
  // parallel.map Tests
  // ============================================================================

  describe('parallel.map', () => {
    it('should process array items in parallel', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-map-test
          name: Parallel Map Test
        steps:
          - id: map-items
            type: action
            action: parallel.map
            inputs:
              items:
                - name: Alice
                - name: Bob
                - name: Charlie
              agent:
                provider: mock
                prompt: "Process user: {{ item.name }}"
              concurrency: 3
            output_variable: results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async (inputs: any) => ({
          processed: inputs.messages[0].content,
        }),
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.results).toHaveLength(3);
    });

    it('should handle errors with onError: continue', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-map-errors
          name: Parallel Map Error Handling
        steps:
          - id: map-with-errors
            type: action
            action: parallel.map
            inputs:
              items: [1, 2, 3]
              agent:
                provider: conditional
                prompt: "Process: {{ item }}"
              concurrency: 3
              onError: continue
            output_variable: results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'conditional.chat.completions': async (inputs: any) => {
          // Fail on item "2"
          if (inputs.messages[0].content.includes('2')) {
            throw new Error('Item 2 failed');
          }
          return { result: 'success' };
        },
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.results).toHaveLength(3);
      // Check that item 2 is an error
      expect(result.output.results[1]).toBeInstanceOf(Error);
    });

    it('should respect concurrency limits', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-map-concurrency
          name: Parallel Map Concurrency Test
        steps:
          - id: map-concurrent
            type: action
            action: parallel.map
            inputs:
              items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
              agent:
                provider: mock
                prompt: "Process: {{ item }}"
              concurrency: 2
            output_variable: results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async () => {
          // Add small delay to test concurrency
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { result: 'done' };
        },
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.results).toHaveLength(10);
    });

    it('should provide item and itemIndex in agent context', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-map-context
          name: Parallel Map Context Test
        steps:
          - id: map-with-context
            type: action
            action: parallel.map
            inputs:
              items: ["apple", "banana", "cherry"]
              agent:
                provider: mock
                prompt: "Item {{ itemIndex }}: {{ item }}"
            output_variable: results
        ---
      `);

      const receivedPrompts: string[] = [];
      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async (inputs: any) => {
          receivedPrompts.push(inputs.messages[0].content);
          return { result: 'processed' };
        },
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(receivedPrompts[0]).toContain('Item 0: apple');
      expect(receivedPrompts[1]).toContain('Item 1: banana');
      expect(receivedPrompts[2]).toContain('Item 2: cherry');
    });

    it('should handle empty array', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-map-empty
          name: Parallel Map Empty Array
        steps:
          - id: map-empty
            type: action
            action: parallel.map
            inputs:
              items: []
              agent:
                provider: mock
                prompt: "Process: {{ item }}"
            output_variable: results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async () => ({ result: 'done' }),
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.results).toEqual([]);
    });

    it('should work with template expressions for items', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parallel-map-template-items
          name: Parallel Map Template Items
        steps:
          - id: create-data
            type: action
            action: core.set
            inputs:
              numbers:
                - 10
                - 20
                - 30
            output_variable: data
          
          - id: map-template-items
            type: action
            action: parallel.map
            inputs:
              items: "{{ data.numbers }}"
              agent:
                provider: mock
                prompt: "Double {{ item }}"
            output_variable: results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async (inputs: any) => ({
          result: inputs.messages[0].content,
        }),
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.results).toHaveLength(3);
    });
  });

  // ============================================================================
  // Combined Scenarios
  // ============================================================================

  describe('combined scenarios', () => {
    it('should combine parallel.spawn and parallel.map in workflow', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: combined-parallel
          name: Combined Parallel Operations
        steps:
          # First: spawn multiple agents for analysis
          - id: analyze
            type: action
            action: parallel.spawn
            inputs:
              agents:
                - id: analyzer1
                  provider: mock
                  prompt: "Analyze dataset"
                - id: analyzer2
                  provider: mock
                  prompt: "Analyze dataset"
              wait: all
            output_variable: analysis
          
          # Then: process items based on analysis
          - id: process-items
            type: action
            action: parallel.map
            inputs:
              items: [1, 2, 3]
              agent:
                provider: mock
                prompt: "Process {{ item }} based on analysis"
              concurrency: 3
            output_variable: processed
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async () => ({ result: 'done' }),
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.analysis.successful).toHaveLength(2);
      expect(result.output.processed).toHaveLength(3);
    });

    it('should use parallel operations in conditional blocks', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: conditional-parallel
          name: Conditional Parallel Execution
        steps:
          - id: set-flag
            type: action
            action: core.set
            inputs:
              needsReview: true
            output_variable: config
          
          - id: conditional-parallel
            type: if
            condition: "config.needsReview"
            then:
              - id: parallel-review
                type: action
                action: parallel.spawn
                inputs:
                  agents:
                    - id: reviewer
                      provider: mock
                      prompt: "Review code"
                output_variable: review_results
        ---
      `);

      const { executor, registry } = createSmartExecutor({
        'mock.chat.completions': async () => ({ result: 'reviewed' }),
      });

      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.review_results).toBeDefined();
      expect(result.output.review_results.successful).toContain('reviewer');
    });
  });
});
