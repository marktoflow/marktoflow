import { describe, it, expect, vi } from 'vitest';
import { WorkflowEngine, RetryPolicy, CircuitBreaker, resolveTemplates } from '../src/engine.js';
import { Workflow, WorkflowStatus, StepStatus, ExecutionContext } from '../src/models.js';
import { SDKRegistry } from '../src/sdk-registry.js';

describe('RetryPolicy', () => {
  it('should calculate exponential backoff delay', () => {
    const policy = new RetryPolicy(3, 1000, 30000, 2, 0);

    expect(policy.getDelay(0)).toBe(1000);
    expect(policy.getDelay(1)).toBe(2000);
    expect(policy.getDelay(2)).toBe(4000);
  });

  it('should respect max delay', () => {
    const policy = new RetryPolicy(10, 1000, 5000, 2, 0);

    expect(policy.getDelay(5)).toBe(5000);
    expect(policy.getDelay(10)).toBe(5000);
  });

  it('should add jitter', () => {
    const policy = new RetryPolicy(3, 1000, 30000, 2, 0.5);

    // With 50% jitter, delay should vary
    const delays = new Set<number>();
    for (let i = 0; i < 10; i++) {
      delays.add(policy.getDelay(0));
    }

    // Should have multiple different values due to jitter
    expect(delays.size).toBeGreaterThan(1);
  });
});

describe('CircuitBreaker', () => {
  it('should start in CLOSED state', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.canExecute()).toBe(true);
  });

  it('should open after threshold failures', () => {
    const breaker = new CircuitBreaker(3, 1000, 1);

    breaker.recordFailure();
    expect(breaker.getState()).toBe('CLOSED');

    breaker.recordFailure();
    expect(breaker.getState()).toBe('CLOSED');

    breaker.recordFailure();
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.canExecute()).toBe(false);
  });

  it('should reset on success', () => {
    const breaker = new CircuitBreaker(3, 1000, 1);

    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();

    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should transition to HALF_OPEN after recovery timeout', async () => {
    const breaker = new CircuitBreaker(1, 50, 1);

    breaker.recordFailure();
    expect(breaker.getState()).toBe('OPEN');

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe('HALF_OPEN');
  });
});

describe('resolveTemplates', () => {
  const context: ExecutionContext = {
    workflowId: 'test',
    runId: 'run-1',
    variables: {
      result: { data: { id: 123, name: 'Test' } },
      message: 'Hello World',
    },
    inputs: {
      channel: '#general',
    },
    startedAt: new Date(),
    currentStepIndex: 0,
    status: WorkflowStatus.RUNNING,
    stepMetadata: {},
  };

  it('should resolve simple variable', () => {
    const result = resolveTemplates('{{message}}', context);
    expect(result).toBe('Hello World');
  });

  it('should resolve nested variable', () => {
    const result = resolveTemplates('ID: {{result.data.id}}', context);
    expect(result).toBe('ID: 123');
  });

  it('should resolve input variable', () => {
    const result = resolveTemplates('Channel: {{inputs.channel}}', context);
    expect(result).toBe('Channel: #general');
  });

  it('should resolve in objects', () => {
    const input = {
      channel: '{{inputs.channel}}',
      text: 'Message: {{message}}',
    };
    const result = resolveTemplates(input, context);
    expect(result).toEqual({
      channel: '#general',
      text: 'Message: Hello World',
    });
  });

  it('should resolve in arrays', () => {
    const input = ['{{message}}', '{{inputs.channel}}'];
    const result = resolveTemplates(input, context);
    expect(result).toEqual(['Hello World', '#general']);
  });

  it('should return empty string for undefined variables', () => {
    const result = resolveTemplates('{{undefined_var}}', context);
    expect(result).toBe('');
  });
});

describe('WorkflowEngine', () => {
  const createMockWorkflow = (steps: Workflow['steps']): Workflow => ({
    metadata: { id: 'test', name: 'Test', version: '1.0.0' },
    tools: {},
    steps,
  });

  const createMockSDKRegistry = (): SDKRegistry => {
    return new SDKRegistry({
      async load() {
        return {};
      },
    });
  };

  it('should execute a simple workflow', async () => {
    const workflow = createMockWorkflow([
      { id: 'step1', action: 'test.action', inputs: { value: 1 } },
    ]);

    const engine = new WorkflowEngine();
    const registry = createMockSDKRegistry();
    const executor = vi.fn().mockResolvedValue({ success: true });

    const result = await engine.execute(workflow, {}, registry, executor);

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(result.stepResults).toHaveLength(1);
    expect(result.stepResults[0].status).toBe(StepStatus.COMPLETED);
    expect(executor).toHaveBeenCalledOnce();
  });

  it('should store output variables', async () => {
    const workflow = createMockWorkflow([
      { id: 'step1', action: 'test.action', inputs: {}, outputVariable: 'result1' },
      { id: 'step2', action: 'test.action', inputs: { prev: '{{result1}}' } },
    ]);

    const engine = new WorkflowEngine();
    const registry = createMockSDKRegistry();
    const executor = vi
      .fn()
      .mockResolvedValueOnce({ value: 'first' })
      .mockResolvedValueOnce({ value: 'second' });

    const result = await engine.execute(workflow, {}, registry, executor);

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(result.output).toHaveProperty('result1');
  });

  it('should skip steps with false conditions', async () => {
    const workflow = createMockWorkflow([
      { id: 'step1', action: 'test.action', inputs: {}, outputVariable: 'result' },
      { id: 'step2', action: 'test.action', inputs: {}, conditions: ['result == "skip"'] },
    ]);

    const engine = new WorkflowEngine();
    const registry = createMockSDKRegistry();
    const executor = vi.fn().mockResolvedValue('not-skip');

    const result = await engine.execute(workflow, {}, registry, executor);

    expect(result.stepResults[1].status).toBe(StepStatus.SKIPPED);
    expect(executor).toHaveBeenCalledOnce();
  });

  it('should retry on failure', async () => {
    const workflow = createMockWorkflow([{ id: 'step1', action: 'test.action', inputs: {} }]);

    const engine = new WorkflowEngine({ maxRetries: 2, retryBaseDelay: 10 });
    const registry = createMockSDKRegistry();
    const executor = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue({ success: true });

    const result = await engine.execute(workflow, {}, registry, executor);

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(executor).toHaveBeenCalledTimes(3);
  });

  it('should fail after max retries', async () => {
    const workflow = createMockWorkflow([{ id: 'step1', action: 'test.action', inputs: {} }]);

    const engine = new WorkflowEngine({ maxRetries: 2, retryBaseDelay: 10 });
    const registry = createMockSDKRegistry();
    const executor = vi.fn().mockRejectedValue(new Error('Always fails'));

    const result = await engine.execute(workflow, {}, registry, executor);

    expect(result.status).toBe(WorkflowStatus.FAILED);
    expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
    expect(executor).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it('should call event handlers', async () => {
    const workflow = createMockWorkflow([{ id: 'step1', action: 'test.action', inputs: {} }]);

    const onStepStart = vi.fn();
    const onStepComplete = vi.fn();
    const onWorkflowStart = vi.fn();
    const onWorkflowComplete = vi.fn();

    const engine = new WorkflowEngine(
      {},
      {
        onStepStart,
        onStepComplete,
        onWorkflowStart,
        onWorkflowComplete,
      }
    );

    const registry = createMockSDKRegistry();
    const executor = vi.fn().mockResolvedValue({});

    await engine.execute(workflow, {}, registry, executor);

    expect(onWorkflowStart).toHaveBeenCalledOnce();
    expect(onStepStart).toHaveBeenCalledOnce();
    expect(onStepComplete).toHaveBeenCalledOnce();
    expect(onWorkflowComplete).toHaveBeenCalledOnce();
  });
});
