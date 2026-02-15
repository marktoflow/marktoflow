/**
 * Workflow Execution Engine for marktoflow v2.0
 *
 * Thin orchestrator that delegates to focused modules:
 * - engine/control-flow.ts — if, switch, for-each, while, map, filter, reduce, parallel, try, script, wait, merge
 * - engine/retry.ts — RetryPolicy, CircuitBreaker
 * - engine/conditions.ts — condition evaluation
 * - engine/variable-resolution.ts — template and variable resolution
 * - engine/subworkflow.ts — sub-workflow and sub-agent execution
 * - engine/types.ts — shared type definitions
 * - utils/duration.ts — duration parsing
 * - utils/errors.ts — error conversion utilities
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
  isActionStep,
  isSubWorkflowStep,
  isIfStep,
  isSwitchStep,
  isForEachStep,
  isWhileStep,
  isMapStep,
  isFilterStep,
  isReduceStep,
  isParallelStep,
  isTryStep,
  isScriptStep,
  isWaitStep,
  isMergeStep,
  type ActionStep,
  type Permissions,
} from './models.js';
import {
  mergePermissions,
  toSecurityPolicy,
} from './permissions.js';
import {
  loadPromptFile,
  resolvePromptTemplate,
  validatePromptInputs,
  type LoadedPrompt,
} from './prompt-loader.js';
import { StateStore } from './state.js';
import {
  DEFAULT_FAILOVER_CONFIG,
  AgentHealthTracker,
  type FailoverConfig,
  type FailoverEvent,
  FailoverReason,
} from './failover.js';
import { RollbackRegistry } from './rollback.js';
import { parseFile } from './parser.js';
import { resolve } from 'node:path';
import { executeBuiltInOperation, isBuiltInOperation } from './built-in-operations.js';
import { executeParallelOperation, isParallelOperation } from './parallel.js';

// Engine sub-modules
import { RetryPolicy, CircuitBreaker } from './engine/retry.js';
import { evaluateConditions } from './engine/conditions.js';
import { resolveTemplates } from './engine/variable-resolution.js';
import {
  executeIfStep,
  executeSwitchStep,
  executeForEachStep,
  executeWhileStep,
  executeMapStep,
  executeFilterStep,
  executeReduceStep,
  executeParallelStep,
  executeTryStep,
  executeScriptStep,
  executeWaitStep,
  executeMergeStep,
} from './engine/control-flow.js';
import {
  executeSubWorkflow,
  executeSubWorkflowWithAgent,
} from './engine/subworkflow.js';
import { errorToString } from './utils/errors.js';

// Re-export types and classes for backward compatibility
export { RetryPolicy, CircuitBreaker } from './engine/retry.js';
export type { CircuitState } from './engine/retry.js';
export { resolveTemplates, resolveVariablePath } from './engine/variable-resolution.js';
export type {
  EngineConfig,
  SDKRegistryLike,
  StepExecutorContext,
  StepExecutor,
  EngineEvents,
} from './engine/types.js';

// Import types for local use
import type {
  EngineConfig,
  SDKRegistryLike,
  StepExecutorContext,
  StepExecutor,
  EngineEvents,
} from './engine/types.js';

// ============================================================================
// Engine Implementation
// ============================================================================

interface InternalEngineConfig {
  defaultTimeout: number;
  maxRetries: number;
  retryBaseDelay: number;
  retryMaxDelay: number;
  defaultAgent: string | undefined;
  defaultModel: string | undefined;
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
  public workflowPath?: string;
  private workflowPermissions?: Permissions;
  private promptCache: Map<string, LoadedPrompt> = new Map();

  constructor(config: EngineConfig = {}, events: EngineEvents = {}, stateStore?: StateStore) {
    this.config = {
      defaultTimeout: config.defaultTimeout ?? (process.env.MARKTOFLOW_TIMEOUT ? parseInt(process.env.MARKTOFLOW_TIMEOUT, 10) : 60000),
      maxRetries: config.maxRetries ?? (process.env.MARKTOFLOW_MAX_RETRIES ? parseInt(process.env.MARKTOFLOW_MAX_RETRIES, 10) : 3),
      retryBaseDelay: config.retryBaseDelay ?? (process.env.MARKTOFLOW_RETRY_BASE_DELAY ? parseInt(process.env.MARKTOFLOW_RETRY_BASE_DELAY, 10) : 1000),
      retryMaxDelay: config.retryMaxDelay ?? (process.env.MARKTOFLOW_RETRY_MAX_DELAY ? parseInt(process.env.MARKTOFLOW_RETRY_MAX_DELAY, 10) : 30000),
      defaultAgent: config.defaultAgent,
      defaultModel: config.defaultModel,
    };

    this.retryPolicy = new RetryPolicy(
      this.config.maxRetries,
      this.config.retryBaseDelay,
      this.config.retryMaxDelay,
    );

    this.events = events;
    this.stateStore = stateStore;
    this.rollbackRegistry = config.rollbackRegistry;
    this.failoverConfig = { ...DEFAULT_FAILOVER_CONFIG, ...(config.failoverConfig ?? {}) };
    this.healthTracker = config.healthTracker ?? new AgentHealthTracker();
  }

  // ============================================================================
  // Step Dispatcher
  // ============================================================================

  /**
   * Execute a single step - dispatches to specialized execution methods.
   */
  private async executeStep(
    step: WorkflowStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor,
  ): Promise<StepResult> {
    // Check conditions first (applies to all step types)
    if (step.conditions && !evaluateConditions(step.conditions, context)) {
      return createStepResult(step.id, StepStatus.SKIPPED, null, new Date());
    }

    // Bind the dispatcher for recursive step execution
    const dispatch = (s: WorkflowStep, c: ExecutionContext, sr: SDKRegistryLike, se: StepExecutor) =>
      this.executeStep(s, c, sr, se);

    // Dispatch to specialized execution method based on step type
    if (isIfStep(step)) {
      return executeIfStep(step, context, sdkRegistry, stepExecutor, dispatch);
    }

    if (isSwitchStep(step)) {
      return executeSwitchStep(step, context, sdkRegistry, stepExecutor, dispatch);
    }

    if (isForEachStep(step)) {
      return executeForEachStep(step, context, sdkRegistry, stepExecutor, dispatch);
    }

    if (isWhileStep(step)) {
      return executeWhileStep(step, context, sdkRegistry, stepExecutor, dispatch);
    }

    if (isMapStep(step)) {
      return executeMapStep(step, context);
    }

    if (isFilterStep(step)) {
      return executeFilterStep(step, context);
    }

    if (isReduceStep(step)) {
      return executeReduceStep(step, context);
    }

    if (isParallelStep(step)) {
      return executeParallelStep(
        step, context, sdkRegistry, stepExecutor, dispatch,
        (c) => this.cloneContext(c),
        (main, branch, id) => this.mergeContexts(main, branch, id),
        (promises, limit) => this.executeConcurrentlyWithLimit(promises, limit),
      );
    }

    if (isTryStep(step)) {
      return executeTryStep(step, context, sdkRegistry, stepExecutor, dispatch);
    }

    if (isScriptStep(step)) {
      return executeScriptStep(step, context);
    }

    if (isWaitStep(step)) {
      return executeWaitStep(step, context, this.stateStore);
    }

    if (isMergeStep(step)) {
      return executeMergeStep(step, context);
    }

    // Default: action or workflow step
    return this.executeStepWithFailover(step, context, sdkRegistry, stepExecutor);
  }

  // ============================================================================
  // Workflow Execution
  // ============================================================================

  /**
   * Execute a workflow.
   */
  async execute(
    workflow: Workflow,
    inputs: Record<string, unknown> = {},
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor,
  ): Promise<WorkflowResult> {
    const context = createExecutionContext(workflow, inputs);
    const stepResults: StepResult[] = [];
    const startedAt = new Date();

    // Store workflow-level permissions and defaults
    this.workflowPermissions = workflow.permissions;

    // Use workflow defaults if not set in engine config
    if (!this.config.defaultAgent && workflow.defaultAgent) {
      this.config.defaultAgent = workflow.defaultAgent;
    }
    if (!this.config.defaultModel && workflow.defaultModel) {
      this.config.defaultModel = workflow.defaultModel;
    }

    context.status = WorkflowStatus.RUNNING;
    this.events.onWorkflowStart?.(workflow, context);

    if (this.stateStore) {
      this.stateStore.createExecution({
        runId: context.runId,
        workflowId: workflow.metadata.id,
        workflowPath: this.workflowPath ?? 'unknown',
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

        const result = await this.executeStep(step, context, sdkRegistry, stepExecutor);
        stepResults.push(result);

        // Store step metadata for condition evaluation
        context.stepMetadata[step.id] = {
          status: result.status.toLowerCase(),
          retryCount: result.retryCount,
          ...(result.error ? { error: errorToString(result.error) } : {}),
        };

        // Store output variable
        if (step.outputVariable && result.status === StepStatus.COMPLETED) {
          context.variables[step.outputVariable] = result.output;
        }

        // Check if this step set workflow outputs (from workflow.set_outputs action)
        if (result.status === StepStatus.COMPLETED &&
            result.output &&
            typeof result.output === 'object' &&
            '__workflow_outputs__' in result.output) {
          const outputObj = result.output as Record<string, unknown>;
          const outputs = outputObj['__workflow_outputs__'] as Record<string, unknown>;
          context.workflowOutputs = outputs;
        }

        // Handle failure
        if (result.status === StepStatus.FAILED) {
          let errorAction = 'stop';
          if ('errorHandling' in step && step.errorHandling?.action) {
            errorAction = step.errorHandling.action;
          }

          if (errorAction === 'stop') {
            context.status = WorkflowStatus.FAILED;
            const workflowError = result.error ? errorToString(result.error) : `Step ${step.id} failed`;
            const workflowResult = this.buildWorkflowResult(workflow, context, stepResults, startedAt, workflowError);
            this.events.onWorkflowComplete?.(workflow, workflowResult);
            return workflowResult;
          }
          if (errorAction === 'rollback') {
            if (this.rollbackRegistry) {
              await this.rollbackRegistry.rollbackAllAsync({
                context,
                inputs: context.inputs,
                variables: context.variables,
              });
            }
            context.status = WorkflowStatus.FAILED;
            const workflowError = result.error ? errorToString(result.error) : `Step ${step.id} failed`;
            const workflowResult = this.buildWorkflowResult(workflow, context, stepResults, startedAt, workflowError);
            this.events.onWorkflowComplete?.(workflow, workflowResult);
            return workflowResult;
          }
        }
      }

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
        workflow, context, stepResults, startedAt,
        error instanceof Error ? error.message : String(error),
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

  /**
   * Resume a paused execution (e.g., after form submission).
   */
  async resumeExecution(
    runId: string,
    stepId: string,
    resumeData: Record<string, unknown>,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor,
  ): Promise<WorkflowResult> {
    if (!this.stateStore) {
      throw new Error('Cannot resume execution: StateStore not configured');
    }

    const execution = this.stateStore.getExecution(runId);
    if (!execution) {
      throw new Error(`Execution ${runId} not found`);
    }

    if (execution.status !== WorkflowStatus.RUNNING) {
      throw new Error(`Cannot resume execution ${runId}: status is ${execution.status}`);
    }

    const { workflow } = await parseFile(execution.workflowPath);
    this.workflowPath = execution.workflowPath;

    const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      throw new Error(`Step ${stepId} not found in workflow`);
    }

    // Load all checkpoints to rebuild context
    const checkpoints = this.stateStore.getCheckpoints(runId);
    const stepResults: StepResult[] = [];
    const context = createExecutionContext(workflow, execution.inputs || {});
    context.runId = runId;
    context.status = WorkflowStatus.RUNNING;

    // Rebuild context from checkpoints
    for (let i = 0; i < stepIndex; i++) {
      const checkpoint = checkpoints.find(cp => cp.stepIndex === i);
      if (checkpoint) {
        const step = workflow.steps[i];
        const result = createStepResult(
          step.id, checkpoint.status, checkpoint.outputs,
          checkpoint.startedAt, checkpoint.retryCount,
          checkpoint.error || undefined,
        );
        stepResults.push(result);

        context.stepMetadata[step.id] = {
          status: checkpoint.status.toLowerCase(),
          retryCount: checkpoint.retryCount,
          ...(checkpoint.error ? { error: checkpoint.error } : {}),
        };

        if (step.outputVariable && checkpoint.status === StepStatus.COMPLETED) {
          context.variables[step.outputVariable] = checkpoint.outputs;
        }
      }
    }

    // Inject resume data into context
    context.variables[`${stepId}_response`] = resumeData;

    // Continue execution from next step
    const startedAt = new Date(execution.startedAt);
    this.workflowPermissions = workflow.permissions;

    try {
      for (let i = stepIndex + 1; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        context.currentStepIndex = i;

        const result = await this.executeStep(step, context, sdkRegistry, stepExecutor);
        stepResults.push(result);

        context.stepMetadata[step.id] = {
          status: result.status.toLowerCase(),
          retryCount: result.retryCount,
          ...(result.error ? { error: errorToString(result.error) } : {}),
        };

        if (step.outputVariable && result.status === StepStatus.COMPLETED) {
          context.variables[step.outputVariable] = result.output;
        }

        if (result.status === StepStatus.COMPLETED &&
            result.output &&
            typeof result.output === 'object' &&
            '__workflow_outputs__' in result.output) {
          const outputObj = result.output as Record<string, unknown>;
          const outputs = outputObj['__workflow_outputs__'] as Record<string, unknown>;
          context.workflowOutputs = outputs;
        }

        if (result.status === StepStatus.FAILED) {
          let errorAction = 'stop';
          if ('errorHandling' in step && step.errorHandling?.action) {
            errorAction = step.errorHandling.action;
          }

          if (errorAction === 'stop' || errorAction === 'rollback') {
            if (errorAction === 'rollback' && this.rollbackRegistry) {
              await this.rollbackRegistry.rollbackAllAsync({
                context,
                inputs: context.inputs,
                variables: context.variables,
              });
            }
            context.status = WorkflowStatus.FAILED;
            const workflowError = result.error ? errorToString(result.error) : `Step ${step.id} failed`;
            const workflowResult = this.buildWorkflowResult(workflow, context, stepResults, startedAt, workflowError);
            this.events.onWorkflowComplete?.(workflow, workflowResult);
            return workflowResult;
          }
        }
      }

      context.status = WorkflowStatus.COMPLETED;
    } catch (error) {
      context.status = WorkflowStatus.FAILED;

      if (this.stateStore) {
        this.stateStore.updateExecution(runId, {
          status: WorkflowStatus.FAILED,
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const workflowResult = this.buildWorkflowResult(
        workflow, context, stepResults, startedAt,
        error instanceof Error ? error.message : String(error),
      );

      this.events.onWorkflowComplete?.(workflow, workflowResult);
      return workflowResult;
    }

    const workflowResult = this.buildWorkflowResult(workflow, context, stepResults, startedAt);

    if (this.stateStore) {
      this.stateStore.updateExecution(runId, {
        status: context.status,
        completedAt: new Date(),
        outputs: context.variables,
      });
    }

    this.events.onWorkflowComplete?.(workflow, workflowResult);
    return workflowResult;
  }

  /**
   * Execute a workflow from a file.
   */
  async executeFile(
    workflowPath: string,
    inputs: Record<string, unknown> = {},
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor,
  ): Promise<WorkflowResult> {
    const { workflow } = await parseFile(workflowPath);
    this.workflowPath = resolve(workflowPath);
    return this.execute(workflow, inputs, sdkRegistry, stepExecutor);
  }

  getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverEvents];
  }

  // ============================================================================
  // Step Execution with Retry & Failover
  // ============================================================================

  /**
   * Build the step executor context with effective model/agent/permissions.
   */
  private buildStepExecutorContext(step: WorkflowStep): StepExecutorContext {
    const effectivePermissions = mergePermissions(
      this.workflowPermissions,
      step.permissions,
    );

    return {
      model: step.model || this.config.defaultModel,
      agent: step.agent || this.config.defaultAgent,
      permissions: effectivePermissions,
      securityPolicy: toSecurityPolicy(effectivePermissions),
      basePath: this.workflowPath,
    };
  }

  /**
   * Load and resolve an external prompt file for a step.
   */
  private async loadAndResolvePrompt(
    step: ActionStep,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!step.prompt) {
      return step.inputs;
    }

    let loadedPrompt = this.promptCache.get(step.prompt);
    if (!loadedPrompt) {
      loadedPrompt = await loadPromptFile(step.prompt, this.workflowPath);
      this.promptCache.set(step.prompt, loadedPrompt);
    }

    const promptInputs = step.promptInputs
      ? (resolveTemplates(step.promptInputs, context) as Record<string, unknown>)
      : {};

    const validation = validatePromptInputs(loadedPrompt, promptInputs);
    if (!validation.valid) {
      throw new Error(`Invalid prompt inputs: ${validation.errors.join(', ')}`);
    }

    const resolved = resolvePromptTemplate(loadedPrompt, promptInputs, context);
    const resolvedInputs = { ...step.inputs };

    if (Array.isArray(resolvedInputs.messages)) {
      resolvedInputs.messages = resolvedInputs.messages.map((msg: unknown) => {
        if (typeof msg === 'object' && msg !== null) {
          const message = msg as Record<string, unknown>;
          if (message.role === 'user' && typeof message.content === 'string') {
            return {
              ...message,
              content: (message.content as string).replace(
                /\{\{\s*prompt\s*\}\}/g,
                resolved.content,
              ),
            };
          }
        }
        return msg;
      });
    } else {
      resolvedInputs.promptContent = resolved.content;
    }

    return resolvedInputs;
  }

  /**
   * Execute a step with retry logic.
   */
  private async executeStepWithRetry(
    step: WorkflowStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor,
  ): Promise<StepResult> {
    const startedAt = new Date();
    let lastError: Error | undefined;

    const executorContext = this.buildStepExecutorContext(step);

    // Handle sub-workflow execution
    if (isSubWorkflowStep(step)) {
      if (step.useSubagent) {
        try {
          this.events.onStepStart?.(step, context);
          const output = await this.executeWithTimeout(
            () => executeSubWorkflowWithAgent(
              step, context, sdkRegistry, stepExecutor,
              this.workflowPath, this.config.defaultModel, this.config.defaultAgent,
              (s) => this.buildStepExecutorContext(s),
            ),
            step.timeout ?? this.config.defaultTimeout,
          );
          const result = createStepResult(step.id, StepStatus.COMPLETED, output, startedAt, 0);
          this.events.onStepComplete?.(step, result);
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const result = createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, lastError);
          this.events.onStepComplete?.(step, result);
          return result;
        }
      }

      // Standard sub-workflow execution
      try {
        this.events.onStepStart?.(step, context);
        const createSubEngine = (cfg: EngineConfig) => {
          const subEngine = new WorkflowEngine(cfg, this.events, this.stateStore);
          return subEngine;
        };
        const output = await this.executeWithTimeout(
          () => executeSubWorkflow(
            step, context, sdkRegistry, stepExecutor,
            this.workflowPath, createSubEngine,
            {
              defaultTimeout: this.config.defaultTimeout,
              maxRetries: this.config.maxRetries,
              retryBaseDelay: this.config.retryBaseDelay,
              retryMaxDelay: this.config.retryMaxDelay,
              failoverConfig: this.failoverConfig,
              healthTracker: this.healthTracker,
              ...(this.rollbackRegistry ? { rollbackRegistry: this.rollbackRegistry } : {}),
            },
          ),
          step.timeout ?? this.config.defaultTimeout,
        );
        const result = createStepResult(step.id, StepStatus.COMPLETED, output, startedAt, 0);
        this.events.onStepComplete?.(step, result);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const result = createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, lastError);
        this.events.onStepComplete?.(step, result);
        return result;
      }
    }

    // Regular action step
    if (!isActionStep(step)) {
      return createStepResult(
        step.id, StepStatus.FAILED, null, startedAt, 0,
        'Step is neither an action nor a workflow',
      );
    }

    const maxRetries = step.errorHandling?.maxRetries ?? this.config.maxRetries;

    const [serviceName] = step.action.split('.');
    let circuitBreaker = this.circuitBreakers.get(serviceName);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker();
      this.circuitBreakers.set(serviceName, circuitBreaker);
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (!circuitBreaker.canExecute()) {
        return createStepResult(
          step.id, StepStatus.FAILED, null, startedAt, attempt,
          `Circuit breaker open for service: ${serviceName}`,
        );
      }

      this.events.onStepStart?.(step, context);

      try {
        let resolvedInputs: Record<string, unknown>;
        if (step.prompt) {
          resolvedInputs = await this.loadAndResolvePrompt(step, context);
          resolvedInputs = resolveTemplates(resolvedInputs, context) as Record<string, unknown>;
        } else {
          resolvedInputs = resolveTemplates(step.inputs, context) as Record<string, unknown>;
        }

        const stepWithResolvedInputs = { ...step, inputs: resolvedInputs };

        let output: unknown;
        if (isParallelOperation(step.action)) {
          output = await executeParallelOperation(
            step.action, resolvedInputs, context, sdkRegistry, stepExecutor,
          );
        } else if (isBuiltInOperation(step.action)) {
          output = await executeBuiltInOperation(step.action, step.inputs, resolvedInputs, context);
        } else {
          output = await this.executeWithTimeout(
            () => stepExecutor(stepWithResolvedInputs, context, sdkRegistry, executorContext),
            step.timeout ?? this.config.defaultTimeout,
          );
        }

        circuitBreaker.recordSuccess();

        const result = createStepResult(step.id, StepStatus.COMPLETED, output, startedAt, attempt);
        this.events.onStepComplete?.(step, result);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        circuitBreaker.recordFailure();
        this.events.onStepError?.(step, lastError, attempt);

        if (attempt < maxRetries) {
          const delay = this.retryPolicy.getDelay(attempt);
          await sleep(delay);
        }
      }
    }

    const result = createStepResult(step.id, StepStatus.FAILED, null, startedAt, maxRetries, lastError);
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
    stepExecutor: StepExecutor,
  ): Promise<StepResult> {
    const primaryResult = await this.executeStepWithRetry(step, context, sdkRegistry, stepExecutor);

    if (!isActionStep(step)) {
      return primaryResult;
    }

    const [primaryTool, ...methodParts] = step.action.split('.');
    const method = methodParts.join('.');

    if (primaryResult.status === StepStatus.COMPLETED) {
      this.healthTracker.markHealthy(primaryTool);
      return primaryResult;
    }

    const errorMessage = primaryResult.error ? errorToString(primaryResult.error) : '';
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

      const fallbackStep: WorkflowStep = { ...step, action: `${fallbackTool}.${method}`, type: 'action' as const };
      const result = await this.executeStepWithRetry(fallbackStep, context, sdkRegistry, stepExecutor);
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

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Execute a function with a timeout.
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Step timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  /**
   * Build the final workflow result.
   */
  private buildWorkflowResult(
    workflow: Workflow,
    context: ExecutionContext,
    stepResults: StepResult[],
    startedAt: Date,
    error?: string,
  ): WorkflowResult {
    const completedAt = new Date();
    const output = context.workflowOutputs || context.variables;

    return {
      workflowId: workflow.metadata.id,
      runId: context.runId,
      status: context.status,
      stepResults,
      output,
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

  /**
   * Clone execution context for parallel branches.
   */
  private cloneContext(context: ExecutionContext): ExecutionContext {
    return {
      ...context,
      variables: { ...context.variables },
      inputs: { ...context.inputs },
      stepMetadata: { ...context.stepMetadata },
    };
  }

  /**
   * Merge branch context back into main context.
   */
  private mergeContexts(
    mainContext: ExecutionContext,
    branchContext: ExecutionContext,
    branchId: string,
  ): void {
    for (const [key, value] of Object.entries(branchContext.variables)) {
      mainContext.variables[`${branchId}.${key}`] = value;
    }
  }

  /**
   * Execute promises with concurrency limit.
   */
  private async executeConcurrentlyWithLimit<T>(
    promises: Promise<T>[],
    limit: number,
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const promise of promises) {
      const p = promise.then((result) => {
        results.push(result);
      });

      executing.push(p);

      if (executing.length >= limit) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex((x) => x === p),
          1,
        );
      }
    }

    await Promise.all(executing);
    return results;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
