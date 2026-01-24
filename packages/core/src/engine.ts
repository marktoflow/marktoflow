/**
 * Workflow Execution Engine for marktoflow v2.0
 *
 * Executes workflow steps with retry logic, variable resolution,
 * and SDK invocation.
 */

import {
  Workflow,
  WorkflowStep,
  ExecutionContext,
  StepResult,
  WorkflowResult,
  StepStatus,
  WorkflowStatus,
  createExecutionContext,
  createStepResult,
} from './models.js';
import { StateStore } from './state.js';
import {
  DEFAULT_FAILOVER_CONFIG,
  AgentHealthTracker,
  type FailoverConfig,
  type FailoverEvent,
  FailoverReason,
} from './failover.js';
import { RollbackRegistry } from './rollback.js';

// ============================================================================
// Types
// ============================================================================

export interface EngineConfig {
  /** Default timeout for steps in milliseconds */
  defaultTimeout?: number;
  /** Maximum retries for failed steps */
  maxRetries?: number;
  /** Base delay for retry backoff in milliseconds */
  retryBaseDelay?: number;
  /** Maximum delay for retry backoff in milliseconds */
  retryMaxDelay?: number;
  /** Optional rollback registry for rollback error handling */
  rollbackRegistry?: RollbackRegistry;
  /** Failover configuration for step execution */
  failoverConfig?: Partial<FailoverConfig>;
  /** Optional agent health tracker */
  healthTracker?: AgentHealthTracker;
}

export interface SDKRegistryLike {
  /** Load an SDK by name */
  load(sdkName: string): Promise<unknown>;
  /** Check if SDK is available */
  has(sdkName: string): boolean;
}

export type StepExecutor = (
  step: WorkflowStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike
) => Promise<unknown>;

export interface EngineEvents {
  onStepStart?: (step: WorkflowStep, context: ExecutionContext) => void;
  onStepComplete?: (step: WorkflowStep, result: StepResult) => void;
  onStepError?: (step: WorkflowStep, error: Error, retryCount: number) => void;
  onWorkflowStart?: (workflow: Workflow, context: ExecutionContext) => void;
  onWorkflowComplete?: (workflow: Workflow, result: WorkflowResult) => void;
}

// ============================================================================
// Retry Policy
// ============================================================================

export class RetryPolicy {
  constructor(
    public readonly maxRetries: number = 3,
    public readonly baseDelay: number = 1000,
    public readonly maxDelay: number = 30000,
    public readonly exponentialBase: number = 2,
    public readonly jitter: number = 0.1
  ) {}

  /**
   * Calculate delay for a given retry attempt.
   */
  getDelay(attempt: number): number {
    const exponentialDelay = this.baseDelay * Math.pow(this.exponentialBase, attempt);
    const clampedDelay = Math.min(exponentialDelay, this.maxDelay);

    // Add jitter
    const jitterAmount = clampedDelay * this.jitter * (Math.random() * 2 - 1);
    return Math.max(0, clampedDelay + jitterAmount);
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;

  constructor(
    public readonly failureThreshold: number = 5,
    public readonly recoveryTimeout: number = 30000,
    public readonly halfOpenMaxCalls: number = 3
  ) {}

  canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN
    return this.halfOpenCalls < this.halfOpenMaxCalls;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.halfOpenCalls = 0;
  }
}

// ============================================================================
// Variable Resolution
// ============================================================================

/**
 * Resolve template variables in a value.
 * Supports {{variable}} and {{inputs.name}} syntax.
 */
export function resolveTemplates(value: unknown, context: ExecutionContext): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{([^}]+)\}\}/g, (_, varPath) => {
      const path = varPath.trim();
      const resolved = resolveVariablePath(path, context);
      return resolved !== undefined ? String(resolved) : '';
    });
  }

  if (Array.isArray(value)) {
    return value.map((v) => resolveTemplates(v, context));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveTemplates(v, context);
    }
    return result;
  }

  return value;
}

/**
 * Resolve a variable path from context.
 * First checks inputs.*, then variables, then stepMetadata, then direct context properties.
 * Exported to allow access from condition evaluation.
 */
export function resolveVariablePath(path: string, context: ExecutionContext): unknown {
  // Handle inputs.* prefix
  if (path.startsWith('inputs.')) {
    const inputPath = path.slice(7); // Remove 'inputs.'
    return getNestedValue(context.inputs, inputPath);
  }

  // Check variables first (most common case)
  const fromVars = getNestedValue(context.variables, path);
  if (fromVars !== undefined) {
    return fromVars;
  }

  // Check step metadata (for status checks like: step_id.status)
  const fromStepMeta = getNestedValue(context.stepMetadata, path);
  if (fromStepMeta !== undefined) {
    return fromStepMeta;
  }

  // Fall back to direct context access
  return getNestedValue(context as Record<string, unknown>, path);
}

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

// ============================================================================
// Engine Implementation
// ============================================================================

interface InternalEngineConfig {
  defaultTimeout: number;
  maxRetries: number;
  retryBaseDelay: number;
  retryMaxDelay: number;
}

export class WorkflowEngine {
  private config: InternalEngineConfig;
  private retryPolicy: RetryPolicy;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private events: EngineEvents;
  private stateStore?: StateStore | undefined;
  private rollbackRegistry?: RollbackRegistry | undefined;
  private failoverConfig: FailoverConfig;
  private healthTracker: AgentHealthTracker;
  private failoverEvents: FailoverEvent[] = [];

  constructor(config: EngineConfig = {}, events: EngineEvents = {}, stateStore?: StateStore) {
    this.config = {
      defaultTimeout: config.defaultTimeout ?? 60000,
      maxRetries: config.maxRetries ?? 3,
      retryBaseDelay: config.retryBaseDelay ?? 1000,
      retryMaxDelay: config.retryMaxDelay ?? 30000,
    };

    this.retryPolicy = new RetryPolicy(
      this.config.maxRetries,
      this.config.retryBaseDelay,
      this.config.retryMaxDelay
    );

    this.events = events;
    this.stateStore = stateStore;
    this.rollbackRegistry = config.rollbackRegistry;
    this.failoverConfig = { ...DEFAULT_FAILOVER_CONFIG, ...(config.failoverConfig ?? {}) };
    this.healthTracker = config.healthTracker ?? new AgentHealthTracker();
  }

  /**
   * Execute a workflow.
   */
  async execute(
    workflow: Workflow,
    inputs: Record<string, unknown> = {},
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<WorkflowResult> {
    const context = createExecutionContext(workflow, inputs);
    const stepResults: StepResult[] = [];
    const startedAt = new Date();

    context.status = WorkflowStatus.RUNNING;
    this.events.onWorkflowStart?.(workflow, context);

    if (this.stateStore) {
      this.stateStore.createExecution({
        runId: context.runId,
        workflowId: workflow.metadata.id,
        workflowPath: 'unknown',
        status: WorkflowStatus.RUNNING,
        startedAt: startedAt,
        completedAt: null,
        currentStep: 0,
        totalSteps: workflow.steps.length,
        inputs: inputs,
        outputs: null,
        error: null,
        metadata: null,
      });
    }

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        context.currentStepIndex = i;

        // Check conditions
        if (step.conditions && !this.evaluateConditions(step.conditions, context)) {
          const skipResult = createStepResult(step.id, StepStatus.SKIPPED, null, new Date());
          stepResults.push(skipResult);
          continue;
        }

        // Execute step with retry
        const result = await this.executeStepWithFailover(step, context, sdkRegistry, stepExecutor);
        stepResults.push(result);

        // Store step metadata (status, error, etc.) in separate field for condition evaluation
        // This allows conditions like: step_id.status == 'failed'
        context.stepMetadata[step.id] = {
          status: result.status.toLowerCase(),
          retryCount: result.retryCount,
          ...(result.error ? { error: result.error } : {}),
        };

        // Store output variable
        if (step.outputVariable && result.status === StepStatus.COMPLETED) {
          context.variables[step.outputVariable] = result.output;
        }

        // Handle failure
        if (result.status === StepStatus.FAILED) {
          const errorAction = step.errorHandling?.action ?? 'stop';

          if (errorAction === 'stop') {
            context.status = WorkflowStatus.FAILED;
            const workflowError = result.error || `Step ${step.id} failed`;
            const workflowResult = this.buildWorkflowResult(
              workflow,
              context,
              stepResults,
              startedAt,
              workflowError
            );
            this.events.onWorkflowComplete?.(workflow, workflowResult);
            return workflowResult;
          }
          // 'continue' - keep going
          if (errorAction === 'rollback') {
            if (this.rollbackRegistry) {
              await this.rollbackRegistry.rollbackAllAsync({
                context,
                inputs: context.inputs,
                variables: context.variables,
              });
            }
            context.status = WorkflowStatus.FAILED;
            const workflowError = result.error || `Step ${step.id} failed`;
            const workflowResult = this.buildWorkflowResult(
              workflow,
              context,
              stepResults,
              startedAt,
              workflowError
            );
            this.events.onWorkflowComplete?.(workflow, workflowResult);
            return workflowResult;
          }
        }
      }

      // Determine final status
      context.status = WorkflowStatus.COMPLETED;
    } catch (error) {
      context.status = WorkflowStatus.FAILED;

      if (this.stateStore) {
        this.stateStore.updateExecution(context.runId, {
          status: WorkflowStatus.FAILED,
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const workflowResult = this.buildWorkflowResult(
        workflow,
        context,
        stepResults,
        startedAt,
        error instanceof Error ? error.message : String(error)
      );

      this.events.onWorkflowComplete?.(workflow, workflowResult);
      return workflowResult;
    }

    const workflowResult = this.buildWorkflowResult(workflow, context, stepResults, startedAt);

    if (this.stateStore) {
      this.stateStore.updateExecution(context.runId, {
        status: context.status,
        completedAt: new Date(),
        outputs: context.variables,
      });
    }

    this.events.onWorkflowComplete?.(workflow, workflowResult);
    return workflowResult;
  }

  getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverEvents];
  }

  /**
   * Execute a step with retry logic.
   */
  private async executeStepWithRetry(
    step: WorkflowStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const maxRetries = step.errorHandling?.maxRetries ?? this.config.maxRetries;
    const startedAt = new Date();
    let lastError: Error | undefined;

    // Get or create circuit breaker for this step's action
    const [serviceName] = step.action.split('.');
    let circuitBreaker = this.circuitBreakers.get(serviceName);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker();
      this.circuitBreakers.set(serviceName, circuitBreaker);
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Check circuit breaker
      if (!circuitBreaker.canExecute()) {
        return createStepResult(
          step.id,
          StepStatus.FAILED,
          null,
          startedAt,
          attempt,
          `Circuit breaker open for service: ${serviceName}`
        );
      }

      this.events.onStepStart?.(step, context);

      try {
        // Resolve templates in inputs
        const resolvedInputs = resolveTemplates(step.inputs, context) as Record<string, unknown>;
        const stepWithResolvedInputs = { ...step, inputs: resolvedInputs };

        // Execute step
        const output = await this.executeWithTimeout(
          () => stepExecutor(stepWithResolvedInputs, context, sdkRegistry),
          step.timeout ?? this.config.defaultTimeout
        );

        circuitBreaker.recordSuccess();

        const result = createStepResult(step.id, StepStatus.COMPLETED, output, startedAt, attempt);
        this.events.onStepComplete?.(step, result);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        circuitBreaker.recordFailure();
        this.events.onStepError?.(step, lastError, attempt);

        // Wait before retry (unless last attempt)
        if (attempt < maxRetries) {
          const delay = this.retryPolicy.getDelay(attempt);
          await sleep(delay);
        }
      }
    }

    // All retries exhausted
    const result = createStepResult(
      step.id,
      StepStatus.FAILED,
      null,
      startedAt,
      maxRetries,
      lastError?.message
    );
    this.events.onStepComplete?.(step, result);
    return result;
  }

  /**
   * Execute a step with retry + failover support.
   */
  private async executeStepWithFailover(
    step: WorkflowStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const primaryResult = await this.executeStepWithRetry(step, context, sdkRegistry, stepExecutor);
    const [primaryTool, ...methodParts] = step.action.split('.');
    const method = methodParts.join('.');

    if (primaryResult.status === StepStatus.COMPLETED) {
      this.healthTracker.markHealthy(primaryTool);
      return primaryResult;
    }

    const errorMessage = primaryResult.error ?? '';
    const isTimeout = errorMessage.includes('timed out');
    if (isTimeout && !this.failoverConfig.failoverOnTimeout) {
      this.healthTracker.markUnhealthy(primaryTool, errorMessage);
      return primaryResult;
    }
    if (!isTimeout && !this.failoverConfig.failoverOnStepFailure) {
      this.healthTracker.markUnhealthy(primaryTool, errorMessage);
      return primaryResult;
    }

    if (!method || this.failoverConfig.fallbackAgents.length === 0) {
      this.healthTracker.markUnhealthy(primaryTool, errorMessage);
      return primaryResult;
    }

    let attempts = 0;
    for (const fallbackTool of this.failoverConfig.fallbackAgents) {
      if (fallbackTool === primaryTool) continue;
      if (attempts >= this.failoverConfig.maxFailoverAttempts) break;

      const fallbackStep: WorkflowStep = { ...step, action: `${fallbackTool}.${method}` };
      const result = await this.executeStepWithRetry(
        fallbackStep,
        context,
        sdkRegistry,
        stepExecutor
      );
      this.failoverEvents.push({
        timestamp: new Date(),
        fromAgent: primaryTool,
        toAgent: fallbackTool,
        reason: isTimeout ? FailoverReason.TIMEOUT : FailoverReason.STEP_EXECUTION_FAILED,
        stepIndex: context.currentStepIndex,
        error: errorMessage || undefined,
      });
      attempts += 1;

      if (result.status === StepStatus.COMPLETED) {
        this.healthTracker.markHealthy(fallbackTool);
        return result;
      }
    }

    this.healthTracker.markUnhealthy(primaryTool, errorMessage);
    return primaryResult;
  }

  /**
   * Execute a function with a timeout.
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Step timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Evaluate step conditions.
   */
  private evaluateConditions(conditions: string[], context: ExecutionContext): boolean {
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition.
   * Supports: ==, !=, >, <, >=, <=
   * Also supports nested property access (e.g., check_result.success)
   * and step status checks (e.g., step_id.status == 'failed')
   */
  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    // Simple expression parsing
    const operators = ['==', '!=', '>=', '<=', '>', '<'];
    let operator: string | undefined;
    let parts: string[] = [];

    for (const op of operators) {
      if (condition.includes(op)) {
        operator = op;
        parts = condition.split(op).map((s) => s.trim());
        break;
      }
    }

    if (!operator || parts.length !== 2) {
      // Treat as boolean variable reference with nested property support
      const value = this.resolveConditionValue(condition, context);
      return Boolean(value);
    }

    const left = this.resolveConditionValue(parts[0], context);
    const right = this.parseValue(parts[1]);

    switch (operator) {
      case '==':
        return left == right;
      case '!=':
        return left != right;
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      default:
        return false;
    }
  }

  /**
   * Resolve a condition value with support for nested properties.
   * Handles direct variable references and nested paths.
   */
  private resolveConditionValue(path: string, context: ExecutionContext): unknown {
    // Try to resolve the path directly from variables
    const resolved = resolveVariablePath(path, context);

    // Return the resolved value directly
    return resolved;
  }

  /**
   * Parse a value from a condition string.
   */
  private parseValue(value: string): unknown {
    // Remove quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    // Numbers
    if (!isNaN(Number(value))) {
      return Number(value);
    }

    // Booleans
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;

    return value;
  }

  /**
   * Build the final workflow result.
   */
  private buildWorkflowResult(
    workflow: Workflow,
    context: ExecutionContext,
    stepResults: StepResult[],
    startedAt: Date,
    error?: string
  ): WorkflowResult {
    const completedAt = new Date();

    return {
      workflowId: workflow.metadata.id,
      runId: context.runId,
      status: context.status,
      stepResults,
      output: context.variables,
      error,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
    };
  }

  /**
   * Reset all circuit breakers.
   */
  resetCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
