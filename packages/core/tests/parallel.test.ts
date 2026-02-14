/**
 * Parallel Operations Unit Tests
 *
 * Tests parallel.spawn and parallel.map operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeParallelSpawn,
  executeParallelMap,
  isParallelOperation,
  type ParallelSpawnInputs,
  type ParallelMapInputs,
} from '../src/parallel.js';
import { WorkflowStatus } from '../src/models.js';
import type { ExecutionContext, WorkflowStep } from '../src/models.js';

describe('Parallel Operations', () => {
  let mockContext: ExecutionContext;
  let mockSdkRegistry: any;
  let mockStepExecutor: any;

  beforeEach(() => {
    mockContext = {
      workflowId: 'test-workflow',
      runId: 'test-run',
      variables: { var1: 'value1' },
      inputs: { test: 'data' },
      startedAt: new Date(),
      currentStepIndex: 0,
      status: WorkflowStatus.PENDING,
      stepMetadata: {},
    };
    mockSdkRegistry = {};
    mockStepExecutor = vi.fn();
  });

  // ============================================================================
  // isParallelOperation Tests
  // ============================================================================

  describe('isParallelOperation', () => {
    it('should identify parallel.spawn as parallel operation', () => {
      expect(isParallelOperation('parallel.spawn')).toBe(true);
    });

    it('should identify parallel.map as parallel operation', () => {
      expect(isParallelOperation('parallel.map')).toBe(true);
    });

    it('should return false for non-parallel operations', () => {
      expect(isParallelOperation('core.set')).toBe(false);
      expect(isParallelOperation('file.read')).toBe(false);
      expect(isParallelOperation('github.issues.list')).toBe(false);
    });
  });

  // ============================================================================
  // parallel.spawn Tests
  // ============================================================================

  describe('parallel.spawn', () => {
    it('should execute multiple agents in parallel', async () => {
      const inputs: ParallelSpawnInputs = {
        agents: [
          { id: 'agent1', provider: 'claude', model: 'sonnet', prompt: 'Test 1' },
          { id: 'agent2', provider: 'copilot', prompt: 'Test 2' },
        ],
        wait: 'all',
        timeout: '60s',
      };

      mockStepExecutor.mockResolvedValueOnce({ result: 'output1' });
      mockStepExecutor.mockResolvedValueOnce({ result: 'output2' });

      const result = await executeParallelSpawn(
        inputs,
        mockContext,
        mockSdkRegistry,
        mockStepExecutor
      );

      expect(result.successful).toEqual(['agent1', 'agent2']);
      expect(result.failed).toEqual([]);
      expect(result.results.agent1.success).toBe(true);
      expect(result.results.agent2.success).toBe(true);
      expect(mockStepExecutor).toHaveBeenCalledTimes(2);
    });

    it('should handle agent failures with onError: continue', async () => {
      const inputs: ParallelSpawnInputs = {
        agents: [
          { id: 'agent1', provider: 'claude', prompt: 'Test 1' },
          { id: 'agent2', provider: 'copilot', prompt: 'Test 2' },
        ],
        wait: 'all',
        onError: 'continue',
      };

      mockStepExecutor.mockResolvedValueOnce({ result: 'output1' });
      mockStepExecutor.mockRejectedValueOnce(new Error('Agent 2 failed'));

      const result = await executeParallelSpawn(
        inputs,
        mockContext,
        mockSdkRegistry,
        mockStepExecutor
      );

      expect(result.successful).toEqual(['agent1']);
      expect(result.failed).toEqual(['agent2']);
      expect(result.results.agent1.success).toBe(true);
      expect(result.results.agent2.success).toBe(false);
      expect(result.results.agent2.error).toContain('failed');
    });

    it('should fail fast with onError: fail', async () => {
      const inputs: ParallelSpawnInputs = {
        agents: [
          { id: 'agent1', provider: 'claude', prompt: 'Test 1' },
          { id: 'agent2', provider: 'copilot', prompt: 'Test 2' },
        ],
        wait: 'all',
        onError: 'fail',
      };

      mockStepExecutor.mockResolvedValueOnce({ result: 'output1' });
      mockStepExecutor.mockRejectedValueOnce(new Error('Agent 2 failed'));

      await expect(
        executeParallelSpawn(inputs, mockContext, mockSdkRegistry, mockStepExecutor)
      ).rejects.toThrow('Parallel execution failed');
    });

    it('should wait for majority of agents', async () => {
      const inputs: ParallelSpawnInputs = {
        agents: [
          { id: 'agent1', provider: 'claude', prompt: 'Test 1' },
          { id: 'agent2', provider: 'copilot', prompt: 'Test 2' },
          { id: 'agent3', provider: 'ollama', prompt: 'Test 3' },
        ],
        wait: 'majority',
      };

      // Make agents respond at different times
      mockStepExecutor
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ result: 'output1' }), 100)))
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ result: 'output2' }), 50)))
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ result: 'output3' }), 200)));

      const result = await executeParallelSpawn(
        inputs,
        mockContext,
        mockSdkRegistry,
        mockStepExecutor
      );

      // Should have at least 2 results (majority of 3)
      expect(result.successful.length).toBeGreaterThanOrEqual(2);
    });

    it('should wait for any agent with wait: any', async () => {
      const inputs: ParallelSpawnInputs = {
        agents: [
          { id: 'slow', provider: 'claude', prompt: 'Slow' },
          { id: 'fast', provider: 'ollama', prompt: 'Fast' },
        ],
        wait: 'any',
      };

      mockStepExecutor
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ result: 'slow' }), 1000)))
        .mockImplementationOnce(() => Promise.resolve({ result: 'fast' }));

      const startTime = Date.now();
      const result = await executeParallelSpawn(
        inputs,
        mockContext,
        mockSdkRegistry,
        mockStepExecutor
      );
      const duration = Date.now() - startTime;

      // Should complete quickly (not wait for slow agent)
      expect(duration).toBeLessThan(500);
      expect(result.successful.length).toBeGreaterThanOrEqual(1);
    });

    it('should track costs and timing', async () => {
      const inputs: ParallelSpawnInputs = {
        agents: [
          { id: 'agent1', provider: 'claude', prompt: 'Test 1' },
        ],
        wait: 'all',
      };

      // Add small delay to ensure duration > 0
      mockStepExecutor.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ result: 'output1' }), 5))
      );

      const result = await executeParallelSpawn(
        inputs,
        mockContext,
        mockSdkRegistry,
        mockStepExecutor
      );

      expect(result.timing).toBeDefined();
      expect(result.timing.duration).toBeGreaterThan(0);
      expect(result.timing.started).toBeDefined();
      expect(result.timing.completed).toBeDefined();
      expect(result.costs).toBeDefined();
      expect(result.costs.total).toBeDefined();
      expect(result.costs.byAgent).toBeDefined();
    });

    it('should require at least one agent', async () => {
      const inputs: ParallelSpawnInputs = {
        agents: [],
        wait: 'all',
      };

      await expect(
        executeParallelSpawn(inputs, mockContext, mockSdkRegistry, mockStepExecutor)
      ).rejects.toThrow('at least one agent');
    });

    it('should handle timeout correctly', async () => {
      const inputs: ParallelSpawnInputs = {
        agents: [
          { id: 'agent1', provider: 'claude', prompt: 'Test' },
        ],
        wait: 'all',
        timeout: '100ms',
        onError: 'continue', // Continue and return results even on timeout
      };

      // Mock a slow agent
      mockStepExecutor.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ result: 'too slow' }), 500))
      );

      const result = await executeParallelSpawn(
        inputs,
        mockContext,
        mockSdkRegistry,
        mockStepExecutor
      );

      expect(result.results.agent1.success).toBe(false);
      expect(result.results.agent1.error).toContain('timed out');
    });

    it('should resolve templates in agent prompts', async () => {
      mockContext.variables.code = 'function test() {}';

      const inputs: ParallelSpawnInputs = {
        agents: [
          { id: 'agent1', provider: 'claude', prompt: 'Review: {{ code }}' },
        ],
        wait: 'all',
      };

      mockStepExecutor.mockResolvedValueOnce({ result: 'reviewed' });

      await executeParallelSpawn(inputs, mockContext, mockSdkRegistry, mockStepExecutor);

      const calledStep = mockStepExecutor.mock.calls[0][0] as WorkflowStep;
      expect(calledStep.inputs.messages[0].content).toContain('function test()');
    });
  });

  // ============================================================================
  // parallel.map Tests
  // ============================================================================

  describe('parallel.map', () => {
    it('should process array items in parallel', async () => {
      const inputs: ParallelMapInputs = {
        items: [1, 2, 3],
        agent: {
          provider: 'claude',
          model: 'haiku',
          prompt: 'Process: {{ item }}',
        },
        concurrency: 3,
      };

      mockStepExecutor
        .mockResolvedValueOnce({ result: 'result1' })
        .mockResolvedValueOnce({ result: 'result2' })
        .mockResolvedValueOnce({ result: 'result3' });

      const results = await executeParallelMap(
        inputs,
        mockContext,
        mockSdkRegistry,
        mockStepExecutor
      );

      expect(results).toHaveLength(3);
      expect(mockStepExecutor).toHaveBeenCalledTimes(3);
    });

    it('should respect concurrency limit', async () => {
      const inputs: ParallelMapInputs = {
        items: [1, 2, 3, 4, 5],
        agent: {
          provider: 'claude',
          prompt: 'Process: {{ item }}',
        },
        concurrency: 2,
      };

      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      mockStepExecutor.mockImplementation(() => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
        return new Promise((resolve) => {
          setTimeout(() => {
            concurrentCalls--;
            resolve({ result: 'done' });
          }, 10);
        });
      });

      await executeParallelMap(inputs, mockContext, mockSdkRegistry, mockStepExecutor);

      // Should never exceed concurrency limit
      expect(maxConcurrentCalls).toBeLessThanOrEqual(2);
    });

    it('should handle errors with onError: continue', async () => {
      const inputs: ParallelMapInputs = {
        items: [1, 2, 3],
        agent: {
          provider: 'claude',
          prompt: 'Process: {{ item }}',
        },
        onError: 'continue',
      };

      mockStepExecutor
        .mockResolvedValueOnce({ result: 'result1' })
        .mockRejectedValueOnce(new Error('Item 2 failed'))
        .mockResolvedValueOnce({ result: 'result3' });

      const results = await executeParallelMap(
        inputs,
        mockContext,
        mockSdkRegistry,
        mockStepExecutor
      );

      expect(results).toHaveLength(3);
      expect(results[1]).toBeInstanceOf(Error);
    });

    it('should fail fast with onError: fail', async () => {
      const inputs: ParallelMapInputs = {
        items: [1, 2, 3],
        agent: {
          provider: 'claude',
          prompt: 'Process: {{ item }}',
        },
        onError: 'fail',
      };

      mockStepExecutor
        .mockResolvedValueOnce({ result: 'result1' })
        .mockRejectedValueOnce(new Error('Item 2 failed'))
        .mockResolvedValueOnce({ result: 'result3' });

      await expect(
        executeParallelMap(inputs, mockContext, mockSdkRegistry, mockStepExecutor)
      ).rejects.toThrow();
    });

    it('should provide item and itemIndex in context', async () => {
      const inputs: ParallelMapInputs = {
        items: ['a', 'b', 'c'],
        agent: {
          provider: 'claude',
          prompt: 'Process {{ item }} at index {{ itemIndex }}',
        },
      };

      mockStepExecutor.mockResolvedValue({ result: 'done' });

      await executeParallelMap(inputs, mockContext, mockSdkRegistry, mockStepExecutor);

      // Check that context was enriched with item variables
      const firstCall = mockStepExecutor.mock.calls[0][1] as ExecutionContext;
      expect(firstCall.variables.item).toBe('a');
      expect(firstCall.variables.itemIndex).toBe(0);
    });

    it('should handle empty array', async () => {
      const inputs: ParallelMapInputs = {
        items: [],
        agent: {
          provider: 'claude',
          prompt: 'Process: {{ item }}',
        },
      };

      const results = await executeParallelMap(
        inputs,
        mockContext,
        mockSdkRegistry,
        mockStepExecutor
      );

      expect(results).toEqual([]);
      expect(mockStepExecutor).not.toHaveBeenCalled();
    });

    it('should require items to be an array', async () => {
      const inputs: any = {
        items: 'not an array',
        agent: {
          provider: 'claude',
          prompt: 'Process: {{ item }}',
        },
      };

      await expect(
        executeParallelMap(inputs, mockContext, mockSdkRegistry, mockStepExecutor)
      ).rejects.toThrow('array');
    });

    it('should handle timeout per item', async () => {
      const inputs: ParallelMapInputs = {
        items: [1, 2],
        agent: {
          provider: 'claude',
          prompt: 'Process: {{ item }}',
        },
        timeout: '100ms',
        onError: 'continue', // Allow continuing after timeout
      };

      mockStepExecutor
        .mockResolvedValueOnce({ result: 'fast' })
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ result: 'slow' }), 500)));

      const results = await executeParallelMap(
        inputs,
        mockContext,
        mockSdkRegistry,
        mockStepExecutor
      );

      // First should succeed, second should timeout
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeInstanceOf(Error);
    });

    it('should use default concurrency of 5', async () => {
      const inputs: ParallelMapInputs = {
        items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        agent: {
          provider: 'claude',
          prompt: 'Process: {{ item }}',
        },
        // No concurrency specified - should default to 5
      };

      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      mockStepExecutor.mockImplementation(() => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
        return new Promise((resolve) => {
          setTimeout(() => {
            concurrentCalls--;
            resolve({ result: 'done' });
          }, 10);
        });
      });

      await executeParallelMap(inputs, mockContext, mockSdkRegistry, mockStepExecutor);

      expect(maxConcurrentCalls).toBeLessThanOrEqual(5);
    });
  });
});
