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
  type IfStep,
  type SwitchStep,
  type ForEachStep,
  type WhileStep,
  type MapStep,
  type FilterStep,
  type ReduceStep,
  type ParallelStep,
  type TryStep,
  type ScriptStep,
  type ActionStep,
  type SubWorkflowStep,
  type Permissions,
} from './models.js';
import {
  mergePermissions,
  toSecurityPolicy,
  type EffectivePermissions,
  type SecurityPolicy,
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
import { resolve, dirname } from 'node:path';
import { executeBuiltInOperation, isBuiltInOperation } from './built-in-operations.js';
import { renderTemplate } from './template-engine.js';
import { executeScriptAsync } from './script-executor.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert error to string for display/logging
 */
function errorToString(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

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
  /** Default agent for AI steps */
  defaultAgent?: string;
  /** Default model for AI steps */
  defaultModel?: string;
}

export interface SDKRegistryLike {
  /** Load an SDK by name */
  load(sdkName: string): Promise<unknown>;
  /** Check if SDK is available */
  has(sdkName: string): boolean;
}

export interface StepExecutorContext {
  /** Effective model for this step (from step override or workflow default) */
  model: string | undefined;
  /** Effective agent for this step (from step override or workflow default) */
  agent: string | undefined;
  /** Effective permissions for this step */
  permissions: EffectivePermissions | undefined;
  /** Security policy derived from permissions */
  securityPolicy: SecurityPolicy | undefined;
  /** Base path for resolving relative paths */
  basePath: string | undefined;
}

export type StepExecutor = (
  step: WorkflowStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  executorContext?: StepExecutorContext
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
 * Supports {{variable}}, {{inputs.name}}, and Nunjucks filters.
 *
 * Uses Nunjucks as the template engine with:
 * - Legacy regex operator support (=~, !~, //) converted to filters
 * - Custom filters for string, array, object, date operations
 * - Jinja2-style control flow ({% for %}, {% if %}, etc.)
 */
export function resolveTemplates(value: unknown, context: ExecutionContext): unknown {
  if (typeof value === 'string') {
    // Build the template context with all available variables
    // Spread inputs first, then variables (variables override inputs if same key)
    // Also keep inputs accessible via inputs.* for explicit access
    const templateContext: Record<string, unknown> = {
      ...context.inputs, // Spread inputs at root level for direct access ({{ path }})
      ...context.variables, // Variables override inputs if same key
      inputs: context.inputs, // Also keep inputs accessible as inputs.*
    };

    // Use the new Nunjucks-based template engine with legacy syntax support
    return renderTemplate(value, templateContext);
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

  // Check inputs (for bare variable names like "value" instead of "inputs.value")
  const fromInputs = getNestedValue(context.inputs, path);
  if (fromInputs !== undefined) {
    return fromInputs;
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
 * Get a nested value from an object using dot notation and array indexing.
 * Supports paths like: "user.name", "items[0].name", "data.users[1].email"
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  // Parse path into parts, handling both dot notation and array indexing
  // Convert "a.b[0].c[1]" into ["a", "b", "0", "c", "1"]
  const parts: string[] = [];
  let current = '';

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (char === '.') {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else if (char === '[') {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else if (char === ']') {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  // Traverse the object using the parsed parts
  let result: unknown = obj;

  for (const part of parts) {
    if (result === null || result === undefined) {
      return undefined;
    }

    // Check if part is a number (array index)
    const index = Number(part);
    if (!isNaN(index) && Array.isArray(result)) {
      result = result[index];
    } else if (typeof result === 'object') {
      result = (result as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return result;
}

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
  private workflowPath?: string; // Base path for resolving sub-workflows
  private workflowPermissions?: Permissions; // Workflow-level permissions
  private promptCache: Map<string, LoadedPrompt> = new Map(); // Cache for loaded prompts

  constructor(config: EngineConfig = {}, events: EngineEvents = {}, stateStore?: StateStore) {
    this.config = {
      defaultTimeout: config.defaultTimeout ?? 60000,
      maxRetries: config.maxRetries ?? 3,
      retryBaseDelay: config.retryBaseDelay ?? 1000,
      retryMaxDelay: config.retryMaxDelay ?? 30000,
      defaultAgent: config.defaultAgent,
      defaultModel: config.defaultModel,
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
   * Execute a single step - dispatcher to specialized execution methods.
   */
  private async executeStep(
    step: WorkflowStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<StepResult> {
    // Check conditions first (applies to all step types)
    if (step.conditions && !this.evaluateConditions(step.conditions, context)) {
      return createStepResult(step.id, StepStatus.SKIPPED, null, new Date());
    }

    // Dispatch to specialized execution method based on step type
    if (isIfStep(step)) {
      return this.executeIfStep(step, context, sdkRegistry, stepExecutor);
    }

    if (isSwitchStep(step)) {
      return this.executeSwitchStep(step, context, sdkRegistry, stepExecutor);
    }

    if (isForEachStep(step)) {
      return this.executeForEachStep(step, context, sdkRegistry, stepExecutor);
    }

    if (isWhileStep(step)) {
      return this.executeWhileStep(step, context, sdkRegistry, stepExecutor);
    }

    if (isMapStep(step)) {
      return this.executeMapStep(step, context, sdkRegistry, stepExecutor);
    }

    if (isFilterStep(step)) {
      return this.executeFilterStep(step, context, sdkRegistry, stepExecutor);
    }

    if (isReduceStep(step)) {
      return this.executeReduceStep(step, context, sdkRegistry, stepExecutor);
    }

    if (isParallelStep(step)) {
      return this.executeParallelStep(step, context, sdkRegistry, stepExecutor);
    }

    if (isTryStep(step)) {
      return this.executeTryStep(step, context, sdkRegistry, stepExecutor);
    }

    if (isScriptStep(step)) {
      return this.executeScriptStep(step, context);
    }

    // Default: action or workflow step
    return this.executeStepWithFailover(step, context, sdkRegistry, stepExecutor);
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

        // Execute step using dispatcher
        const result = await this.executeStep(step, context, sdkRegistry, stepExecutor);
        stepResults.push(result);

        // Store step metadata (status, error, etc.) in separate field for condition evaluation
        // This allows conditions like: step_id.status == 'failed'
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
          // Get error action from step if it has error handling
          let errorAction = 'stop';
          if ('errorHandling' in step && step.errorHandling?.action) {
            errorAction = step.errorHandling.action;
          }

          if (errorAction === 'stop') {
            context.status = WorkflowStatus.FAILED;
            const workflowError = result.error ? errorToString(result.error) : `Step ${step.id} failed`;
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
            const workflowError = result.error ? errorToString(result.error) : `Step ${step.id} failed`;
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

  /**
   * Execute a workflow from a file.
   * This method automatically sets the workflow path for resolving sub-workflows.
   */
  async executeFile(
    workflowPath: string,
    inputs: Record<string, unknown> = {},
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<WorkflowResult> {
    // Parse the workflow file
    const { workflow } = await parseFile(workflowPath);

    // Set the workflow path for sub-workflow resolution
    this.workflowPath = resolve(workflowPath);

    // Execute the workflow
    return this.execute(workflow, inputs, sdkRegistry, stepExecutor);
  }

  getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverEvents];
  }

  /**
   * Execute a sub-workflow.
   */
  private async executeSubWorkflow(
    step: WorkflowStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<unknown> {
    if (!isSubWorkflowStep(step)) {
      throw new Error(`Step ${step.id} is not a workflow step`);
    }

    // Resolve the sub-workflow path relative to the parent workflow
    const subWorkflowPath = this.workflowPath
      ? resolve(dirname(this.workflowPath), step.workflow)
      : resolve(step.workflow);

    // Parse the sub-workflow
    const { workflow: subWorkflow } = await parseFile(subWorkflowPath);

    // Resolve inputs for the sub-workflow
    const resolvedInputs = resolveTemplates(step.inputs, context) as Record<string, unknown>;

    // Create a new engine instance for the sub-workflow with the same configuration
    const subEngineConfig: EngineConfig = {
      defaultTimeout: this.config.defaultTimeout,
      maxRetries: this.config.maxRetries,
      retryBaseDelay: this.config.retryBaseDelay,
      retryMaxDelay: this.config.retryMaxDelay,
      failoverConfig: this.failoverConfig,
      healthTracker: this.healthTracker,
    };

    if (this.rollbackRegistry) {
      subEngineConfig.rollbackRegistry = this.rollbackRegistry;
    }

    const subEngine = new WorkflowEngine(subEngineConfig, this.events, this.stateStore);

    // Set the base path for the sub-workflow
    subEngine.workflowPath = subWorkflowPath;

    // Execute the sub-workflow
    const result = await subEngine.execute(subWorkflow, resolvedInputs, sdkRegistry, stepExecutor);

    // Check if sub-workflow failed
    if (result.status === WorkflowStatus.FAILED) {
      throw new Error(result.error || 'Sub-workflow execution failed');
    }

    // Return the sub-workflow output
    return result.output;
  }

  /**
   * Execute a sub-workflow using an AI sub-agent.
   * The agent interprets the workflow and executes it autonomously.
   */
  private async executeSubWorkflowWithAgent(
    step: SubWorkflowStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<unknown> {
    // Resolve the sub-workflow path
    const subWorkflowPath = this.workflowPath
      ? resolve(dirname(this.workflowPath), step.workflow)
      : resolve(step.workflow);

    // Read the workflow file content
    const { readFile } = await import('node:fs/promises');
    const workflowContent = await readFile(subWorkflowPath, 'utf-8');

    // Resolve inputs for the sub-workflow
    const resolvedInputs = resolveTemplates(step.inputs, context) as Record<string, unknown>;

    // Get subagent configuration
    const subagentConfig = step.subagentConfig || {};
    const model = subagentConfig.model || step.model || this.config.defaultModel;
    const maxTurns = subagentConfig.maxTurns || 10;
    const systemPrompt = subagentConfig.systemPrompt || this.buildDefaultSubagentSystemPrompt();
    const tools = subagentConfig.tools || ['Read', 'Write', 'Bash', 'Glob', 'Grep'];

    // Build the prompt for the agent
    const agentPrompt = this.buildSubagentPrompt(workflowContent, resolvedInputs, tools);

    // Determine the agent action to use
    const agentName = step.agent || this.config.defaultAgent || 'agent';
    const agentAction = `${agentName}.chat.completions`;

    // Build the messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: agentPrompt },
    ];

    // Create a virtual action step to execute via the agent
    const agentStep: WorkflowStep = {
      id: `${step.id}-subagent`,
      type: 'action',
      action: agentAction,
      inputs: {
        model,
        messages,
        max_tokens: 8192,
      },
      model,
      agent: agentName,
    };

    // Build executor context
    const executorContext = this.buildStepExecutorContext(agentStep);

    // Execute the agent call
    let response: unknown;
    let turns = 0;
    let conversationMessages = [...messages];
    let finalOutput: Record<string, unknown> = {};

    while (turns < maxTurns) {
      turns++;

      try {
        response = await stepExecutor(
          { ...agentStep, inputs: { ...agentStep.inputs, messages: conversationMessages } },
          context,
          sdkRegistry,
          executorContext
        );

        // Parse the response
        const parsedResponse = this.parseSubagentResponse(response);

        if (parsedResponse.completed) {
          finalOutput = parsedResponse.output || {};
          break;
        }

        // If agent needs to continue, add its response and continue
        if (parsedResponse.message) {
          conversationMessages.push({ role: 'assistant', content: parsedResponse.message });
          // Agent might request a tool call - for now, we'll prompt it to continue
          conversationMessages.push({ role: 'user', content: 'Continue with the workflow execution.' });
        } else {
          // No clear continuation, assume completed
          finalOutput = parsedResponse.output || {};
          break;
        }
      } catch (error) {
        throw new Error(
          `Sub-agent execution failed at turn ${turns}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (turns >= maxTurns) {
      throw new Error(`Sub-agent exceeded maximum turns (${maxTurns})`);
    }

    return finalOutput;
  }

  /**
   * Build the default system prompt for sub-agent execution.
   */
  private buildDefaultSubagentSystemPrompt(): string {
    return `You are an AI agent executing a workflow. Your task is to interpret the workflow definition and execute each step in order.

For each step:
1. Understand what the step requires
2. Execute the action described
3. Store any outputs as specified

When you complete all steps, respond with a JSON object containing the workflow outputs.

Format your final response as:
\`\`\`json
{
  "completed": true,
  "output": { /* workflow outputs here */ }
}
\`\`\`

If you encounter an error, respond with:
\`\`\`json
{
  "completed": false,
  "error": "description of the error"
}
\`\`\``;
  }

  /**
   * Build the prompt for sub-agent workflow execution.
   */
  private buildSubagentPrompt(
    workflowContent: string,
    inputs: Record<string, unknown>,
    tools: string[]
  ): string {
    return `Execute the following workflow:

## Workflow Definition
\`\`\`markdown
${workflowContent}
\`\`\`

## Inputs
\`\`\`json
${JSON.stringify(inputs, null, 2)}
\`\`\`

## Available Tools
${tools.join(', ')}

Execute the workflow steps in order and return the final outputs as JSON.`;
  }

  /**
   * Parse the sub-agent's response to extract completion status and output.
   */
  private parseSubagentResponse(response: unknown): {
    completed: boolean;
    output?: Record<string, unknown>;
    message?: string;
    error?: string;
  } {
    // Try to extract content from various response formats
    let content: string | undefined;

    if (typeof response === 'string') {
      content = response;
    } else if (response && typeof response === 'object') {
      const resp = response as Record<string, unknown>;

      // OpenAI-style response
      if (resp.choices && Array.isArray(resp.choices)) {
        const choice = resp.choices[0] as Record<string, unknown>;
        if (choice.message && typeof choice.message === 'object') {
          const message = choice.message as Record<string, unknown>;
          content = message.content as string;
        }
      }
      // Anthropic-style response
      else if (resp.content && Array.isArray(resp.content)) {
        const textBlock = resp.content.find(
          (c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text'
        ) as Record<string, unknown> | undefined;
        content = textBlock?.text as string;
      }
      // Direct content field
      else if (typeof resp.content === 'string') {
        content = resp.content;
      }
      // Direct message field
      else if (typeof resp.message === 'string') {
        content = resp.message;
      }
    }

    if (!content) {
      return { completed: false, message: 'No content in response' };
    }

    // Try to parse JSON from the response
    const jsonMatch = content.match(/```json\n?([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
        const output = parsed.output as Record<string, unknown> | undefined;
        const error = parsed.error as string | undefined;
        return {
          completed: parsed.completed === true,
          ...(output !== undefined ? { output } : {}),
          ...(error !== undefined ? { error } : {}),
        };
      } catch {
        // JSON parse failed, treat as message
      }
    }

    // Try to parse raw JSON
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (typeof parsed.completed === 'boolean') {
        const output = parsed.output as Record<string, unknown> | undefined;
        const error = parsed.error as string | undefined;
        return {
          completed: parsed.completed,
          ...(output !== undefined ? { output } : {}),
          ...(error !== undefined ? { error } : {}),
        };
      }
    } catch {
      // Not JSON
    }

    // Return the content as a message
    return { completed: false, message: content };
  }

  /**
   * Build the step executor context with effective model/agent/permissions.
   */
  private buildStepExecutorContext(step: WorkflowStep): StepExecutorContext {
    // Merge workflow and step permissions
    const effectivePermissions = mergePermissions(
      this.workflowPermissions,
      step.permissions
    );

    // Resolve effective model/agent (step overrides workflow defaults)
    const effectiveModel = step.model || this.config.defaultModel;
    const effectiveAgent = step.agent || this.config.defaultAgent;

    return {
      model: effectiveModel,
      agent: effectiveAgent,
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
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    if (!step.prompt) {
      return step.inputs;
    }

    // Check cache
    let loadedPrompt = this.promptCache.get(step.prompt);
    if (!loadedPrompt) {
      loadedPrompt = await loadPromptFile(step.prompt, this.workflowPath);
      this.promptCache.set(step.prompt, loadedPrompt);
    }

    // Resolve prompt inputs (from step.promptInputs, with template resolution)
    const promptInputs = step.promptInputs
      ? (resolveTemplates(step.promptInputs, context) as Record<string, unknown>)
      : {};

    // Validate prompt inputs
    const validation = validatePromptInputs(loadedPrompt, promptInputs);
    if (!validation.valid) {
      throw new Error(`Invalid prompt inputs: ${validation.errors.join(', ')}`);
    }

    // Resolve the prompt template
    const resolved = resolvePromptTemplate(loadedPrompt, promptInputs, context);

    // Merge resolved prompt content into inputs
    // The resolved content typically goes into a 'messages' or 'prompt' field
    const resolvedInputs = { ...step.inputs };

    // If inputs has a 'messages' array with a user message, inject prompt content
    if (Array.isArray(resolvedInputs.messages)) {
      resolvedInputs.messages = resolvedInputs.messages.map((msg: unknown) => {
        if (typeof msg === 'object' && msg !== null) {
          const message = msg as Record<string, unknown>;
          if (message.role === 'user' && typeof message.content === 'string') {
            // Replace {{ prompt }} placeholder with resolved content
            return {
              ...message,
              content: (message.content as string).replace(
                /\{\{\s*prompt\s*\}\}/g,
                resolved.content
              ),
            };
          }
        }
        return msg;
      });
    } else {
      // Add resolved prompt as 'promptContent' for the executor to use
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
    stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const startedAt = new Date();
    let lastError: Error | undefined;

    // Build executor context with model/agent/permissions
    const executorContext = this.buildStepExecutorContext(step);

    // Handle sub-workflow execution
    if (isSubWorkflowStep(step)) {
      // Check if we should use subagent execution
      if (step.useSubagent) {
        try {
          this.events.onStepStart?.(step, context);
          const output = await this.executeWithTimeout(
            () => this.executeSubWorkflowWithAgent(step, context, sdkRegistry, stepExecutor),
            step.timeout ?? this.config.defaultTimeout
          );
          const result = createStepResult(step.id, StepStatus.COMPLETED, output, startedAt, 0);
          this.events.onStepComplete?.(step, result);
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const result = createStepResult(
            step.id,
            StepStatus.FAILED,
            null,
            startedAt,
            0,
            lastError
          );
          this.events.onStepComplete?.(step, result);
          return result;
        }
      }

      // Standard sub-workflow execution
      try{
        this.events.onStepStart?.(step, context);
        const output = await this.executeWithTimeout(
          () => this.executeSubWorkflow(step, context, sdkRegistry, stepExecutor),
          step.timeout ?? this.config.defaultTimeout
        );
        const result = createStepResult(step.id, StepStatus.COMPLETED, output, startedAt, 0);
        this.events.onStepComplete?.(step, result);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const result = createStepResult(
          step.id,
          StepStatus.FAILED,
          null,
          startedAt,
          0,
          lastError // Pass full error object
        );
        this.events.onStepComplete?.(step, result);
        return result;
      }
    }

    // Regular action step - ensure action is defined
    if (!isActionStep(step)) {
      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        'Step is neither an action nor a workflow'
      );
    }

    const maxRetries = step.errorHandling?.maxRetries ?? this.config.maxRetries;

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
        // Load and resolve external prompt if specified
        let resolvedInputs: Record<string, unknown>;
        if (step.prompt) {
          resolvedInputs = await this.loadAndResolvePrompt(step, context);
          resolvedInputs = resolveTemplates(resolvedInputs, context) as Record<string, unknown>;
        } else {
          // Resolve templates in inputs
          resolvedInputs = resolveTemplates(step.inputs, context) as Record<string, unknown>;
        }

        const stepWithResolvedInputs = { ...step, inputs: resolvedInputs };

        // Check if this is a built-in operation
        let output: unknown;
        if (isBuiltInOperation(step.action)) {
          // Execute built-in operation directly (no timeout, no SDK executor needed)
          // For built-in operations, pass both resolved and unresolved inputs
          // to allow selective resolution of template expressions
          output = executeBuiltInOperation(step.action, step.inputs, resolvedInputs, context);
        } else {
          // Execute step with executor context
          output = await this.executeWithTimeout(
            () => stepExecutor(stepWithResolvedInputs, context, sdkRegistry, executorContext),
            step.timeout ?? this.config.defaultTimeout
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
      lastError // Pass full error object to preserve HTTP details, stack traces, etc.
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

    // Sub-workflows and non-action steps don't support failover
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
   * Uses Nunjucks for template expressions with filters/regex.
   */
  private resolveConditionValue(path: string, context: ExecutionContext): unknown {
    // If it looks like a template expression, resolve it
    if (path.includes('|') || path.includes('=~') || path.includes('!~')) {
      // Build template context
      const templateContext: Record<string, unknown> = {
        inputs: context.inputs,
        ...context.variables,
      };
      return renderTemplate(`{{ ${path} }}`, templateContext);
    }

    // First try to parse as a literal value (true, false, numbers, etc.)
    const parsedValue = this.parseValue(path);

    // If parseValue returned the same string, try to resolve as a variable
    if (parsedValue === path) {
      const resolved = resolveVariablePath(path, context);
      return resolved;
    }

    // Return the parsed literal value
    return parsedValue;
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

    // Use workflowOutputs if set by workflow.set_outputs, otherwise use all variables
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

  // ============================================================================
  // Control Flow Execution Methods
  // ============================================================================

  /**
   * Execute an if/else conditional step.
   */
  private async executeIfStep(
    step: IfStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const startedAt = new Date();

    try {
      // Evaluate condition
      const conditionResult = this.evaluateCondition(step.condition, context);

      // Determine which branch to execute
      const branchSteps = conditionResult
        ? step.then || step.steps // 'steps' is alias for 'then'
        : step.else;

      if (!branchSteps || branchSteps.length === 0) {
        return createStepResult(step.id, StepStatus.SKIPPED, null, startedAt);
      }

      // Execute the branch steps
      const branchResults: unknown[] = [];
      for (const branchStep of branchSteps) {
        const result = await this.executeStep(branchStep, context, sdkRegistry, stepExecutor);

        if (result.status === StepStatus.COMPLETED && branchStep.outputVariable) {
          context.variables[branchStep.outputVariable] = result.output;
          branchResults.push(result.output);
        }

        if (result.status === StepStatus.FAILED) {
          return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, result.error);
        }
      }

      return createStepResult(step.id, StepStatus.COMPLETED, branchResults, startedAt);
    } catch (error) {
      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Execute a switch/case step.
   */
  private async executeSwitchStep(
    step: SwitchStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const startedAt = new Date();

    try {
      // Resolve the switch expression
      const expressionValue = String(
        resolveTemplates(step.expression, context)
      );

      // Find matching case
      const caseSteps = step.cases[expressionValue] || step.default;

      if (!caseSteps || caseSteps.length === 0) {
        return createStepResult(step.id, StepStatus.SKIPPED, null, startedAt);
      }

      // Execute case steps
      const caseResults: unknown[] = [];
      for (const caseStep of caseSteps) {
        const result = await this.executeStep(caseStep, context, sdkRegistry, stepExecutor);

        if (result.status === StepStatus.COMPLETED && caseStep.outputVariable) {
          context.variables[caseStep.outputVariable] = result.output;
          caseResults.push(result.output);
        }

        if (result.status === StepStatus.FAILED) {
          return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, result.error);
        }
      }

      return createStepResult(step.id, StepStatus.COMPLETED, caseResults, startedAt);
    } catch (error) {
      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Execute a for-each loop step.
   */
  private async executeForEachStep(
    step: ForEachStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const startedAt = new Date();

    try {
      // Resolve items array
      const items = resolveTemplates(step.items, context);

      if (!Array.isArray(items)) {
        return createStepResult(
          step.id,
          StepStatus.FAILED,
          null,
          startedAt,
          0,
          'Items must be an array'
        );
      }

      if (items.length === 0) {
        return createStepResult(step.id, StepStatus.SKIPPED, [], startedAt);
      }

      // Execute steps for each item
      const results: unknown[] = [];
      for (let i = 0; i < items.length; i++) {
        // Inject loop variables
        context.variables[step.itemVariable] = items[i];
        context.variables['loop'] = {
          index: i,
          first: i === 0,
          last: i === items.length - 1,
          length: items.length,
        };

        if (step.indexVariable) {
          context.variables[step.indexVariable] = i;
        }

        // Execute iteration steps
        for (const iterStep of step.steps) {
          const result = await this.executeStep(iterStep, context, sdkRegistry, stepExecutor);

          if (result.status === StepStatus.COMPLETED && iterStep.outputVariable) {
            context.variables[iterStep.outputVariable] = result.output;
          }

          if (result.status === StepStatus.FAILED) {
            const errorAction = step.errorHandling?.action ?? 'stop';
            if (errorAction === 'stop') {
              // Clean up loop variables
              delete context.variables[step.itemVariable];
              delete context.variables['loop'];
              if (step.indexVariable) delete context.variables[step.indexVariable];
              return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, result.error);
            }
            // 'continue' - skip to next iteration
            break;
          }
        }

        results.push(context.variables[step.itemVariable]);
      }

      // Clean up loop variables
      delete context.variables[step.itemVariable];
      delete context.variables['loop'];
      if (step.indexVariable) delete context.variables[step.indexVariable];

      return createStepResult(step.id, StepStatus.COMPLETED, results, startedAt);
    } catch (error) {
      // Clean up loop variables on error
      delete context.variables[step.itemVariable];
      delete context.variables['loop'];
      if (step.indexVariable) delete context.variables[step.indexVariable];

      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Execute a while loop step.
   */
  private async executeWhileStep(
    step: WhileStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const startedAt = new Date();
    let iterations = 0;

    try {
      while (this.evaluateCondition(step.condition, context)) {
        if (iterations >= step.maxIterations) {
          return createStepResult(
            step.id,
            StepStatus.FAILED,
            null,
            startedAt,
            0,
            `Max iterations (${step.maxIterations}) exceeded`
          );
        }

        // Execute iteration steps
        for (const iterStep of step.steps) {
          const result = await this.executeStep(iterStep, context, sdkRegistry, stepExecutor);

          if (result.status === StepStatus.COMPLETED && iterStep.outputVariable) {
            context.variables[iterStep.outputVariable] = result.output;
          }

          if (result.status === StepStatus.FAILED) {
            const errorAction = step.errorHandling?.action ?? 'stop';
            if (errorAction === 'stop') {
              return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, result.error);
            }
            // 'continue' - skip to next iteration
            break;
          }
        }

        iterations++;
      }

      return createStepResult(step.id, StepStatus.COMPLETED, { iterations }, startedAt);
    } catch (error) {
      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Execute a map transformation step.
   */
  private async executeMapStep(
    step: MapStep,
    context: ExecutionContext,
    _sdkRegistry: SDKRegistryLike,
    _stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const startedAt = new Date();

    try {
      // Resolve items array
      const items = resolveTemplates(step.items, context);

      if (!Array.isArray(items)) {
        return createStepResult(
          step.id,
          StepStatus.FAILED,
          null,
          startedAt,
          0,
          'Items must be an array'
        );
      }

      // Map each item using the expression
      const mapped = items.map((item) => {
        context.variables[step.itemVariable] = item;
        const result = resolveTemplates(step.expression, context);
        delete context.variables[step.itemVariable];
        return result;
      });

      return createStepResult(step.id, StepStatus.COMPLETED, mapped, startedAt);
    } catch (error) {
      delete context.variables[step.itemVariable];
      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Execute a filter step.
   */
  private async executeFilterStep(
    step: FilterStep,
    context: ExecutionContext,
    _sdkRegistry: SDKRegistryLike,
    _stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const startedAt = new Date();

    try {
      // Resolve items array
      const items = resolveTemplates(step.items, context);

      if (!Array.isArray(items)) {
        return createStepResult(
          step.id,
          StepStatus.FAILED,
          null,
          startedAt,
          0,
          'Items must be an array'
        );
      }

      // Filter items using the condition
      const filtered = items.filter((item) => {
        context.variables[step.itemVariable] = item;
        const result = this.evaluateCondition(step.condition, context);
        delete context.variables[step.itemVariable];
        return result;
      });

      return createStepResult(step.id, StepStatus.COMPLETED, filtered, startedAt);
    } catch (error) {
      delete context.variables[step.itemVariable];
      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Execute a reduce/aggregate step.
   */
  private async executeReduceStep(
    step: ReduceStep,
    context: ExecutionContext,
    _sdkRegistry: SDKRegistryLike,
    _stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const startedAt = new Date();

    try {
      // Resolve items array
      const items = resolveTemplates(step.items, context);

      if (!Array.isArray(items)) {
        return createStepResult(
          step.id,
          StepStatus.FAILED,
          null,
          startedAt,
          0,
          'Items must be an array'
        );
      }

      // Reduce items using the expression
      let accumulator: unknown = step.initialValue ?? null;

      for (const item of items) {
        context.variables[step.itemVariable] = item;
        context.variables[step.accumulatorVariable] = accumulator;
        accumulator = resolveTemplates(step.expression, context);
        delete context.variables[step.itemVariable];
        delete context.variables[step.accumulatorVariable];
      }

      return createStepResult(step.id, StepStatus.COMPLETED, accumulator, startedAt);
    } catch (error) {
      delete context.variables[step.itemVariable];
      delete context.variables[step.accumulatorVariable];
      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Execute parallel branches.
   */
  private async executeParallelStep(
    step: ParallelStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const startedAt = new Date();

    try {
      // Execute branches in parallel
      const branchPromises = step.branches.map(async (branch) => {
        // Clone context for isolation
        const branchContext = this.cloneContext(context);

        // Execute branch steps
        const branchResults: unknown[] = [];
        for (const branchStep of branch.steps) {
          const result = await this.executeStep(branchStep, branchContext, sdkRegistry, stepExecutor);

          if (result.status === StepStatus.COMPLETED && branchStep.outputVariable) {
            branchContext.variables[branchStep.outputVariable] = result.output;
            branchResults.push(result.output);
          }

          if (result.status === StepStatus.FAILED) {
            throw new Error(`Branch ${branch.id} failed: ${errorToString(result.error)}`);
          }
        }

        return { branchId: branch.id, context: branchContext, results: branchResults };
      });

      // Wait for all branches (or limited concurrency)
      const branchResults = step.maxConcurrent
        ? await this.executeConcurrentlyWithLimit(branchPromises, step.maxConcurrent)
        : await Promise.all(branchPromises);

      // Merge branch contexts back into main context
      for (const { branchId, context: branchContext } of branchResults) {
        this.mergeContexts(context, branchContext, branchId);
      }

      const outputs = branchResults.map((br) => br.results);
      return createStepResult(step.id, StepStatus.COMPLETED, outputs, startedAt);
    } catch (error) {
      if (step.onError === 'continue') {
        return createStepResult(step.id, StepStatus.COMPLETED, null, startedAt);
      }
      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Execute try/catch/finally step.
   */
  private async executeTryStep(
    step: TryStep,
    context: ExecutionContext,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor
  ): Promise<StepResult> {
    const startedAt = new Date();
    let tryError: Error | undefined;

    try {
      // Execute try block
      for (const tryStep of step.try) {
        const result = await this.executeStep(tryStep, context, sdkRegistry, stepExecutor);

        if (result.status === StepStatus.COMPLETED && tryStep.outputVariable) {
          context.variables[tryStep.outputVariable] = result.output;
        }

        if (result.status === StepStatus.FAILED) {
          tryError = new Error(result.error ? errorToString(result.error) : 'Step failed');
          break;
        }
      }

      // If error occurred and catch block exists, execute catch
      let catchError: Error | undefined;
      if (tryError && step.catch) {
        // Inject error object into context
        context.variables['error'] = {
          message: tryError.message,
          step: tryError,
        };

        for (const catchStep of step.catch) {
          const result = await this.executeStep(catchStep, context, sdkRegistry, stepExecutor);

          if (result.status === StepStatus.COMPLETED && catchStep.outputVariable) {
            context.variables[catchStep.outputVariable] = result.output;
          }

          if (result.status === StepStatus.FAILED) {
            catchError = new Error(result.error ? errorToString(result.error) : 'Catch block failed');
            break;
          }
        }

        delete context.variables['error'];
      }

      // Execute finally block (always runs)
      if (step.finally) {
        for (const finallyStep of step.finally) {
          const result = await this.executeStep(finallyStep, context, sdkRegistry, stepExecutor);

          if (result.status === StepStatus.COMPLETED && finallyStep.outputVariable) {
            context.variables[finallyStep.outputVariable] = result.output;
          }
        }
      }

      // Return success if catch handled the error, or error if not
      if (tryError && !step.catch) {
        // No catch block to handle error
        return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, tryError.message);
      }

      if (catchError) {
        // Catch block also failed
        return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, catchError.message);
      }

      return createStepResult(step.id, StepStatus.COMPLETED, null, startedAt);
    } catch (error) {
      // Execute finally even on unexpected error
      if (step.finally) {
        try {
          for (const finallyStep of step.finally) {
            const result = await this.executeStep(finallyStep, context, sdkRegistry, stepExecutor);

            if (result.status === StepStatus.COMPLETED && finallyStep.outputVariable) {
              context.variables[finallyStep.outputVariable] = result.output;
            }
          }
        } catch {
          // Ignore finally errors
        }
      }

      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Execute a script step (inline JavaScript).
   */
  private async executeScriptStep(
    step: ScriptStep,
    context: ExecutionContext
  ): Promise<StepResult> {
    const startedAt = new Date();

    try {
      // Resolve any templates in the code
      const resolvedInputs = resolveTemplates(step.inputs, context) as {
        code: string;
        timeout?: number;
      };

      // Execute the script with the workflow context
      const result = await executeScriptAsync(
        resolvedInputs.code,
        {
          variables: context.variables,
          inputs: context.inputs,
          steps: context.stepMetadata,
        },
        {
          timeout: resolvedInputs.timeout ?? 5000,
        }
      );

      if (!result.success) {
        return createStepResult(
          step.id,
          StepStatus.FAILED,
          null,
          startedAt,
          0,
          result.error ?? 'Script execution failed'
        );
      }

      return createStepResult(step.id, StepStatus.COMPLETED, result.value, startedAt);
    } catch (error) {
      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ============================================================================
  // Helper Methods for Control Flow
  // ============================================================================

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
    branchId: string
  ): void {
    // Merge variables with branch prefix
    for (const [key, value] of Object.entries(branchContext.variables)) {
      mainContext.variables[`${branchId}.${key}`] = value;
    }
  }

  /**
   * Execute promises with concurrency limit.
   */
  private async executeConcurrentlyWithLimit<T>(
    promises: Promise<T>[],
    limit: number
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
          1
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
