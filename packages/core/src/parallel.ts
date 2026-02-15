/**
 * Parallel Agent Orchestration for marktoflow
 *
 * Provides parallel execution of multiple AI agents with various wait strategies.
 * - parallel.spawn: Execute multiple AI agents concurrently
 * - parallel.map: Map a function over a collection with parallel agent execution
 */

import { ExecutionContext, WorkflowStep } from './models.js';
import { resolveTemplates } from './engine/variable-resolution.js';
import type { StepExecutorContext, SDKRegistryLike } from './engine/types.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentConfig {
  id: string;
  provider: string;
  model?: string;
  prompt: string;
  inputs?: Record<string, unknown>;
}

export interface ParallelSpawnInputs {
  agents: AgentConfig[];
  wait?: 'all' | 'any' | 'majority' | number;
  timeout?: string;
  onError?: 'fail' | 'continue' | 'partial';
}

export interface ParallelMapInputs {
  items: unknown[];
  agent: {
    provider: string;
    model?: string;
    prompt: string;
  };
  concurrency?: number;
  timeout?: string;
  onError?: 'fail' | 'continue' | 'partial';
}

export interface AgentResult {
  id: string;
  success: boolean;
  output?: unknown;
  error?: string;
  timing: {
    started: string;
    completed: string;
    duration: number;
  };
  cost?: number;
}

export interface ParallelResult {
  results: Record<string, AgentResult>;
  successful: string[];
  failed: string[];
  timing: {
    duration: number;
    started: string;
    completed: string;
  };
  costs: {
    total: number;
    byAgent: Record<string, number>;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse timeout string to milliseconds (e.g., "60s", "5m", "2h")
 */
import { parseDuration } from './utils/duration.js';

function parseTimeout(timeout?: string): number {
  if (!timeout) return 60000; // Default 60 seconds
  return parseDuration(timeout);
}

/**
 * Execute a single agent with timeout support
 */
async function executeAgent(
  agentConfig: AgentConfig,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: (step: WorkflowStep, context: ExecutionContext, sdkRegistry: SDKRegistryLike, executorContext?: StepExecutorContext) => Promise<unknown>,
  timeoutMs: number
): Promise<AgentResult> {
  const started = new Date().toISOString();
  const startTime = Date.now();

  try {
    // Resolve templates in agent inputs and prompt
    const resolvedInputs = agentConfig.inputs
      ? (resolveTemplates(agentConfig.inputs, context) as Record<string, unknown>)
      : {};

    const resolvedPrompt = resolveTemplates(agentConfig.prompt, context) as string;

    // Build the action step for the agent
    const action = agentConfig.model
      ? `${agentConfig.provider}.chat.completions`
      : `${agentConfig.provider}.chat.completions`;

    const agentStep: WorkflowStep = {
      id: agentConfig.id,
      type: 'action',
      action,
      inputs: {
        ...resolvedInputs,
        model: agentConfig.model,
        messages: [
          {
            role: 'user',
            content: resolvedPrompt,
          },
        ],
      },
    };

    // Execute with timeout
    const result = await Promise.race([
      stepExecutor(agentStep, context, sdkRegistry),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Agent ${agentConfig.id} timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    const completed = new Date().toISOString();
    const duration = Date.now() - startTime;

    return {
      id: agentConfig.id,
      success: true,
      output: result,
      timing: {
        started,
        completed,
        duration,
      },
      cost: 0, // TODO: Extract cost from result if available
    };
  } catch (error) {
    const completed = new Date().toISOString();
    const duration = Date.now() - startTime;

    return {
      id: agentConfig.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timing: {
        started,
        completed,
        duration,
      },
      cost: 0,
    };
  }
}

/**
 * Determine if enough agents have completed based on wait strategy
 */

/**
 * Handle parallel execution errors based on onError strategy
 */
function handleErrors(
  results: Record<string, AgentResult>,
  onError: 'fail' | 'continue' | 'partial'
): void {
  const failed = Object.values(results).filter((r) => !r.success);

  if (failed.length === 0) return;

  if (onError === 'fail') {
    const errorMessages = failed.map((r) => `${r.id}: ${r.error}`).join(', ');
    throw new Error(`Parallel execution failed: ${errorMessages}`);
  }

  // For 'continue' and 'partial', we just return the results as-is
  // 'partial' means we accept partial results if some agents succeeded
  if (onError === 'partial' && failed.length === Object.keys(results).length) {
    throw new Error('All agents failed in partial error mode');
  }
}

// ============================================================================
// parallel.spawn - Execute multiple AI agents concurrently
// ============================================================================

/**
 * Execute multiple AI agents in parallel with configurable wait strategies.
 *
 * Example:
 * ```yaml
 * action: parallel.spawn
 * inputs:
 *   agents:
 *     - id: security_review
 *       provider: claude
 *       model: sonnet
 *       prompt: "Review security of: {{ code }}"
 *     - id: performance_review
 *       provider: copilot
 *       prompt: "Review performance of: {{ code }}"
 *   wait: all
 *   timeout: 60s
 *   onError: continue
 * outputs:
 *   results: ${results}
 * ```
 */
export async function executeParallelSpawn(
  inputs: ParallelSpawnInputs,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: (step: WorkflowStep, context: ExecutionContext, sdkRegistry: SDKRegistryLike, executorContext?: StepExecutorContext) => Promise<unknown>
): Promise<ParallelResult> {
  const { agents, wait = 'all', timeout, onError = 'fail' } = inputs;

  if (!agents || agents.length === 0) {
    throw new Error('parallel.spawn requires at least one agent');
  }

  const timeoutMs = parseTimeout(timeout);
  const started = new Date().toISOString();
  const startTime = Date.now();

  // Execute all agents concurrently
  const agentPromises = agents.map((agent) =>
    executeAgent(agent, context, sdkRegistry, stepExecutor, timeoutMs)
  );

  // Wait based on strategy
  const results: Record<string, AgentResult> = {};
  const pendingResults = [...agentPromises];
  const agentIds = agents.map((a) => a.id);

  if (wait === 'all') {
    // Wait for all agents to complete
    const allResults = await Promise.all(agentPromises);
    allResults.forEach((result, idx) => {
      results[agentIds[idx]] = result;
    });
  } else {
    // Wait for partial completion
    let completedCount = 0;
    const targetCount =
      wait === 'any' ? 1 : wait === 'majority' ? Math.ceil(agents.length / 2) : (wait as number);

    while (completedCount < targetCount && pendingResults.length > 0) {
      const result = await Promise.race(
        pendingResults.map((p, idx) => p.then((r) => ({ result: r, index: idx })))
      );

      results[agentIds[result.index]] = result.result;
      pendingResults.splice(result.index, 1);
      completedCount++;
    }

    // Cancel remaining agents if needed (just don't await them)
    // They will complete in the background but we won't wait
  }

  const completed = new Date().toISOString();
  const duration = Date.now() - startTime;

  // Calculate successful/failed agents
  const successful = Object.keys(results).filter((id) => results[id].success);
  const failed = Object.keys(results).filter((id) => !results[id].success);

  // Calculate costs
  const costs = {
    total: Object.values(results).reduce((sum, r) => sum + (r.cost || 0), 0),
    byAgent: Object.fromEntries(Object.entries(results).map(([id, r]) => [id, r.cost || 0])),
  };

  const finalResult: ParallelResult = {
    results,
    successful,
    failed,
    timing: {
      duration,
      started,
      completed,
    },
    costs,
  };

  // Handle errors based on onError strategy
  handleErrors(results, onError);

  return finalResult;
}

// ============================================================================
// parallel.map - Map over collection with parallel agents
// ============================================================================

/**
 * Process an array of items in parallel using AI agents.
 *
 * Example:
 * ```yaml
 * action: parallel.map
 * inputs:
 *   items: ${pull_requests}
 *   agent:
 *     provider: claude
 *     model: haiku
 *     prompt: "Review PR: {{ item.url }}"
 *   concurrency: 5
 *   timeout: 30s
 * outputs:
 *   reviews: ${results}
 * ```
 */
export async function executeParallelMap(
  inputs: ParallelMapInputs,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: (step: WorkflowStep, context: ExecutionContext, sdkRegistry: SDKRegistryLike, executorContext?: StepExecutorContext) => Promise<unknown>
): Promise<unknown[]> {
  const { items, agent, concurrency = 5, timeout, onError = 'fail' } = inputs;

  if (!items || !Array.isArray(items)) {
    throw new Error('parallel.map requires items to be an array');
  }

  if (items.length === 0) {
    return [];
  }

  const timeoutMs = parseTimeout(timeout);
  const results: (unknown | Error)[] = new Array(items.length);
  const errors: Error[] = [];

  // Process items in batches based on concurrency limit
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, Math.min(i + concurrency, items.length));
    const batchPromises = batch.map(async (item, batchIndex) => {
      const itemIndex = i + batchIndex;

      // Create a context with the current item
      const itemContext: ExecutionContext = {
        ...context,
        variables: {
          ...context.variables,
          item,
          itemIndex,
        },
      };

      // Create agent config for this item
      const agentConfig: AgentConfig = {
        id: `item_${itemIndex}`,
        provider: agent.provider,
        ...(agent.model !== undefined && { model: agent.model }),
        prompt: agent.prompt,
        inputs: {},
      };

      try {
        const result = await executeAgent(agentConfig, itemContext, sdkRegistry, stepExecutor, timeoutMs);

        if (!result.success) {
          const error = new Error(result.error || 'Agent execution failed');
          errors.push(error);
          if (onError === 'fail') {
            throw error;
          }
          results[itemIndex] = error;
        } else {
          results[itemIndex] = result.output;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);
        if (onError === 'fail') {
          throw err;
        }
        results[itemIndex] = err;
      }
    });

    await Promise.all(batchPromises);
  }

  // Handle errors based on strategy
  if (errors.length > 0) {
    if (onError === 'fail') {
      throw new Error(`parallel.map failed: ${errors.length} items failed`);
    } else if (onError === 'partial' && errors.length === items.length) {
      throw new Error('All items failed in partial error mode');
    }
  }

  return results;
}

/**
 * Check if an action is a parallel operation
 */
export function isParallelOperation(action: string): boolean {
  return action === 'parallel.spawn' || action === 'parallel.map';
}

/**
 * Execute a parallel operation
 */
export async function executeParallelOperation(
  action: string,
  resolvedInputs: Record<string, unknown>,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: (step: WorkflowStep, context: ExecutionContext, sdkRegistry: SDKRegistryLike, executorContext?: StepExecutorContext) => Promise<unknown>
): Promise<unknown> {
  switch (action) {
    case 'parallel.spawn':
      return executeParallelSpawn(
        resolvedInputs as unknown as ParallelSpawnInputs,
        context,
        sdkRegistry,
        stepExecutor
      );

    case 'parallel.map':
      return executeParallelMap(
        resolvedInputs as unknown as ParallelMapInputs,
        context,
        sdkRegistry,
        stepExecutor
      );

    default:
      throw new Error(`Unknown parallel operation: ${action}`);
  }
}
