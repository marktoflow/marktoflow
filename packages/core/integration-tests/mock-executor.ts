/**
 * Mock Executor for Integration Tests
 *
 * Provides a configurable mock executor that can:
 * - Return static values per step ID or action
 * - Throw errors on demand
 * - Add delays for timing tests
 * - Execute dynamic functions for context capture
 */

import type { WorkflowStep, ExecutionContext } from '../src/models.js';
import type { SDKRegistryLike, StepExecutor, StepExecutorContext } from '../src/engine.js';

// ============================================================================
// Types
// ============================================================================

export interface StepBehavior {
  /** Static value to return */
  returnValue?: unknown;
  /** Error to throw (string message or Error object) */
  error?: string | Error;
  /** Delay before returning (ms) */
  delay?: number;
  /** Dynamic function to execute (receives step, context, returns value) */
  dynamic?: (
    step: WorkflowStep,
    context: ExecutionContext,
    executorContext?: StepExecutorContext
  ) => unknown | Promise<unknown>;
  /** Call count tracking */
  callCount?: number;
  /** Capture inputs for later assertion */
  capturedInputs?: Record<string, unknown>[];
}

export interface MockExecutorConfig {
  /** Behavior by step ID */
  byStepId?: Record<string, StepBehavior>;
  /** Behavior by action name */
  byAction?: Record<string, StepBehavior>;
  /** Default behavior for unmatched steps */
  defaultBehavior?: StepBehavior;
}

export interface MockExecutorResult {
  executor: StepExecutor;
  registry: SDKRegistryLike;
  /** Get call count for a step ID */
  getCallCount: (stepId: string) => number;
  /** Get captured inputs for a step ID */
  getCapturedInputs: (stepId: string) => Record<string, unknown>[];
  /** Reset all call counts and captured data */
  reset: () => void;
}

// ============================================================================
// Mock Executor Factory
// ============================================================================

/**
 * Create a configurable mock executor for testing workflows.
 *
 * @example
 * const { executor, registry } = createMockExecutor({
 *   byStepId: {
 *     'fetch-data': { returnValue: { orders: [...] } },
 *     'failing-step': { error: 'Simulated failure' }
 *   },
 *   byAction: {
 *     'mock.processItem': { dynamic: (step, ctx) => ({ item: ctx.variables.item }) }
 *   },
 *   defaultBehavior: { returnValue: { success: true } }
 * });
 */
export function createMockExecutor(config: MockExecutorConfig = {}): MockExecutorResult {
  const callCounts: Record<string, number> = {};
  const capturedInputs: Record<string, Record<string, unknown>[]> = {};

  // Initialize tracking for configured steps
  if (config.byStepId) {
    for (const stepId of Object.keys(config.byStepId)) {
      callCounts[stepId] = 0;
      capturedInputs[stepId] = [];
    }
  }

  const executor: StepExecutor = async (step, context, _sdkRegistry, executorContext) => {
    // Track call count
    callCounts[step.id] = (callCounts[step.id] || 0) + 1;

    // Capture inputs
    if (!capturedInputs[step.id]) {
      capturedInputs[step.id] = [];
    }
    capturedInputs[step.id].push({ ...step.inputs });

    // Find behavior - check step ID first, then action, then default
    let behavior: StepBehavior | undefined;

    if (config.byStepId?.[step.id]) {
      behavior = config.byStepId[step.id];
    } else if ('action' in step && typeof step.action === 'string' && config.byAction?.[step.action]) {
      behavior = config.byAction[step.action];
    } else {
      behavior = config.defaultBehavior;
    }

    // Apply delay if specified
    if (behavior?.delay) {
      await new Promise((resolve) => setTimeout(resolve, behavior.delay));
    }

    // Throw error if specified
    if (behavior?.error) {
      const error = typeof behavior.error === 'string' ? new Error(behavior.error) : behavior.error;
      throw error;
    }

    // Execute dynamic function if specified
    if (behavior?.dynamic) {
      return behavior.dynamic(step, context, executorContext);
    }

    // Return static value if specified
    if (behavior?.returnValue !== undefined) {
      return behavior.returnValue;
    }

    // Default: return inputs (for testing variable resolution)
    return step.inputs;
  };

  const registry: SDKRegistryLike = {
    async load() {
      return {};
    },
    has() {
      return true;
    },
  };

  return {
    executor,
    registry,
    getCallCount: (stepId: string) => callCounts[stepId] || 0,
    getCapturedInputs: (stepId: string) => capturedInputs[stepId] || [],
    reset: () => {
      for (const key of Object.keys(callCounts)) {
        callCounts[key] = 0;
      }
      for (const key of Object.keys(capturedInputs)) {
        capturedInputs[key] = [];
      }
    },
  };
}

// ============================================================================
// Preset Mock Executors
// ============================================================================

/**
 * Create a simple mock executor that returns step inputs.
 */
export function createPassthroughExecutor(): MockExecutorResult {
  return createMockExecutor({
    defaultBehavior: {
      dynamic: (step) => step.inputs,
    },
  });
}

/**
 * Create a mock executor that always succeeds with { success: true }.
 */
export function createSuccessExecutor(): MockExecutorResult {
  return createMockExecutor({
    defaultBehavior: {
      returnValue: { success: true },
    },
  });
}

/**
 * Create a mock executor that always fails.
 */
export function createFailingExecutor(errorMessage: string = 'Mock failure'): MockExecutorResult {
  return createMockExecutor({
    defaultBehavior: {
      error: errorMessage,
    },
  });
}

/**
 * Create a mock executor that handles common test patterns.
 * - Steps with action containing 'set' return their inputs.value
 * - Steps with action containing 'fail' throw errors
 * - All other steps return { success: true }
 */
export function createSmartExecutor(): MockExecutorResult {
  return createMockExecutor({
    defaultBehavior: {
      dynamic: (step) => {
        const action = 'action' in step ? String(step.action) : '';

        // Handle set/assign operations
        if (action.includes('set') || action.includes('assign') || step.id.startsWith('set-')) {
          return step.inputs?.value ?? step.inputs;
        }

        // Handle intentional failures
        if (action.includes('fail') || step.id.includes('fail')) {
          throw new Error(String(step.inputs?.message ?? 'Intentional test failure'));
        }

        // Handle echo/log operations
        if (action.includes('log') || action.includes('echo')) {
          return { logged: step.inputs?.message ?? step.inputs };
        }

        // Default success
        return { success: true };
      },
    },
  });
}
