/**
 * Control flow step execution for marktoflow workflow engine.
 *
 * Handles all control flow step types: if, switch, for-each, while,
 * map, filter, reduce, parallel, try, script, wait, and merge.
 */

import {
  type ExecutionContext,
  type StepResult,
  StepStatus,
  createStepResult,
  type WorkflowStep,
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
  type WaitStep,
  type MergeStep,
} from '../models.js';
import { resolveTemplates } from './variable-resolution.js';
import { evaluateCondition } from './conditions.js';
import { parseDuration } from '../utils/duration.js';
import { errorToString } from '../utils/errors.js';
import { executeScriptAsync } from '../script-executor.js';
import { StateStore } from '../state.js';
import type { SDKRegistryLike, StepExecutor } from './types.js';

/**
 * Callback type for dispatching step execution back to the engine.
 * This allows control flow methods to recursively execute sub-steps.
 */
export type StepDispatcher = (
  step: WorkflowStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: StepExecutor,
) => Promise<StepResult>;

/**
 * Context cloning function type.
 */
export type ContextCloner = (context: ExecutionContext) => ExecutionContext;

/**
 * Context merging function type.
 */
export type ContextMerger = (
  mainContext: ExecutionContext,
  branchContext: ExecutionContext,
  branchId: string,
) => void;

// ============================================================================
// If Step
// ============================================================================

export async function executeIfStep(
  step: IfStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: StepExecutor,
  dispatch: StepDispatcher,
): Promise<StepResult> {
  const startedAt = new Date();

  try {
    // Evaluate condition
    const conditionResult = evaluateCondition(step.condition, context);

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
      const result = await dispatch(branchStep, context, sdkRegistry, stepExecutor);

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
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// Switch Step
// ============================================================================

export async function executeSwitchStep(
  step: SwitchStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: StepExecutor,
  dispatch: StepDispatcher,
): Promise<StepResult> {
  const startedAt = new Date();

  try {
    // Resolve the switch expression
    const expressionValue = String(
      resolveTemplates(step.expression, context),
    );

    // Find matching case
    const caseSteps = step.cases[expressionValue] || step.default;

    if (!caseSteps || caseSteps.length === 0) {
      return createStepResult(step.id, StepStatus.SKIPPED, null, startedAt);
    }

    // Execute case steps
    const caseResults: unknown[] = [];
    for (const caseStep of caseSteps) {
      const result = await dispatch(caseStep, context, sdkRegistry, stepExecutor);

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
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// For-Each Step
// ============================================================================

export async function executeForEachStep(
  step: ForEachStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: StepExecutor,
  dispatch: StepDispatcher,
): Promise<StepResult> {
  const startedAt = new Date();

  const cleanupLoopVars = () => {
    delete context.variables[step.itemVariable];
    delete context.variables['loop'];
    delete context.variables['batch'];
    if (step.indexVariable) delete context.variables[step.indexVariable];
  };

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
        'Items must be an array',
      );
    }

    if (items.length === 0) {
      return createStepResult(step.id, StepStatus.SKIPPED, [], startedAt);
    }

    const batchSize = step.batchSize;
    const pauseBetweenBatches = step.pauseBetweenBatches;

    // If batch mode, process items in batches
    if (batchSize && batchSize > 0) {
      return await executeForEachBatched(
        step, items, batchSize, pauseBetweenBatches ?? 0,
        context, sdkRegistry, stepExecutor, dispatch, startedAt,
      );
    }

    // Standard item-by-item execution
    const results: unknown[] = [];
    for (let i = 0; i < items.length; i++) {
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
        const result = await dispatch(iterStep, context, sdkRegistry, stepExecutor);

        if (result.status === StepStatus.COMPLETED && iterStep.outputVariable) {
          context.variables[iterStep.outputVariable] = result.output;
        }

        if (result.status === StepStatus.FAILED) {
          const errorAction = step.errorHandling?.action ?? 'stop';
          if (errorAction === 'stop') {
            cleanupLoopVars();
            return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, result.error);
          }
          break;
        }
      }

      results.push(context.variables[step.itemVariable]);
    }

    cleanupLoopVars();
    return createStepResult(step.id, StepStatus.COMPLETED, results, startedAt);
  } catch (error) {
    cleanupLoopVars();
    return createStepResult(
      step.id,
      StepStatus.FAILED,
      null,
      startedAt,
      0,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Execute for-each in batch mode.
 * Items are split into batches; {{ batch }} contains the current batch array.
 */
async function executeForEachBatched(
  step: ForEachStep,
  items: unknown[],
  batchSize: number,
  pauseBetweenBatches: number,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: StepExecutor,
  dispatch: StepDispatcher,
  startedAt: Date,
): Promise<StepResult> {
  const results: unknown[] = [];
  const totalBatches = Math.ceil(items.length / batchSize);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * batchSize;
    const batchItems = items.slice(batchStart, batchStart + batchSize);

    // Pause between batches (not before first batch)
    if (batchIndex > 0 && pauseBetweenBatches > 0) {
      await new Promise((resolve) => setTimeout(resolve, pauseBetweenBatches));
    }

    // Expose batch-level variables
    context.variables['batch'] = batchItems;
    context.variables['loop'] = {
      index: batchIndex,
      first: batchIndex === 0,
      last: batchIndex === totalBatches - 1,
      length: totalBatches,
      batchSize,
      batchStart,
      totalItems: items.length,
    };

    // Process each item in the batch
    for (let i = 0; i < batchItems.length; i++) {
      const globalIndex = batchStart + i;
      context.variables[step.itemVariable] = batchItems[i];

      if (step.indexVariable) {
        context.variables[step.indexVariable] = globalIndex;
      }

      for (const iterStep of step.steps) {
        const result = await dispatch(iterStep, context, sdkRegistry, stepExecutor);

        if (result.status === StepStatus.COMPLETED && iterStep.outputVariable) {
          context.variables[iterStep.outputVariable] = result.output;
        }

        if (result.status === StepStatus.FAILED) {
          const errorAction = step.errorHandling?.action ?? 'stop';
          if (errorAction === 'stop') {
            delete context.variables[step.itemVariable];
            delete context.variables['loop'];
            delete context.variables['batch'];
            if (step.indexVariable) delete context.variables[step.indexVariable];
            return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, result.error);
          }
          break;
        }
      }

      results.push(context.variables[step.itemVariable]);
    }
  }

  delete context.variables[step.itemVariable];
  delete context.variables['loop'];
  delete context.variables['batch'];
  if (step.indexVariable) delete context.variables[step.indexVariable];

  return createStepResult(step.id, StepStatus.COMPLETED, results, startedAt);
}

// ============================================================================
// While Step
// ============================================================================

export async function executeWhileStep(
  step: WhileStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: StepExecutor,
  dispatch: StepDispatcher,
): Promise<StepResult> {
  const startedAt = new Date();
  let iterations = 0;

  try {
    while (evaluateCondition(step.condition, context)) {
      if (iterations >= step.maxIterations) {
        return createStepResult(
          step.id,
          StepStatus.FAILED,
          null,
          startedAt,
          0,
          `Max iterations (${step.maxIterations}) exceeded`,
        );
      }

      // Execute iteration steps
      for (const iterStep of step.steps) {
        const result = await dispatch(iterStep, context, sdkRegistry, stepExecutor);

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
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// Map Step
// ============================================================================

export async function executeMapStep(
  step: MapStep,
  context: ExecutionContext,
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
        'Items must be an array',
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
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// Filter Step
// ============================================================================

export async function executeFilterStep(
  step: FilterStep,
  context: ExecutionContext,
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
        'Items must be an array',
      );
    }

    // Filter items using the condition
    const filtered = items.filter((item) => {
      context.variables[step.itemVariable] = item;
      const result = evaluateCondition(step.condition, context);
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
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// Reduce Step
// ============================================================================

export async function executeReduceStep(
  step: ReduceStep,
  context: ExecutionContext,
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
        'Items must be an array',
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
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// Parallel Step
// ============================================================================

export async function executeParallelStep(
  step: ParallelStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: StepExecutor,
  dispatch: StepDispatcher,
  cloneContext: ContextCloner,
  mergeContexts: ContextMerger,
  executeConcurrentlyWithLimit: <T>(promises: Promise<T>[], limit: number) => Promise<T[]>,
): Promise<StepResult> {
  const startedAt = new Date();

  try {
    // Execute branches in parallel
    const branchPromises = step.branches.map(async (branch) => {
      // Clone context for isolation
      const branchContext = cloneContext(context);

      // Execute branch steps
      const branchResults: unknown[] = [];
      for (const branchStep of branch.steps) {
        const result = await dispatch(branchStep, branchContext, sdkRegistry, stepExecutor);

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
      ? await executeConcurrentlyWithLimit(branchPromises, step.maxConcurrent)
      : await Promise.all(branchPromises);

    // Merge branch contexts back into main context
    for (const { branchId, context: branchContext } of branchResults) {
      mergeContexts(context, branchContext, branchId);
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
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// Try Step
// ============================================================================

export async function executeTryStep(
  step: TryStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: StepExecutor,
  dispatch: StepDispatcher,
): Promise<StepResult> {
  const startedAt = new Date();
  let tryError: Error | undefined;

  try {
    // Execute try block
    for (const tryStep of step.try) {
      const result = await dispatch(tryStep, context, sdkRegistry, stepExecutor);

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
        const result = await dispatch(catchStep, context, sdkRegistry, stepExecutor);

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
        const result = await dispatch(finallyStep, context, sdkRegistry, stepExecutor);

        if (result.status === StepStatus.COMPLETED && finallyStep.outputVariable) {
          context.variables[finallyStep.outputVariable] = result.output;
        }
      }
    }

    // Return success if catch handled the error, or error if not
    if (tryError && !step.catch) {
      return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, tryError.message);
    }

    if (catchError) {
      return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, catchError.message);
    }

    return createStepResult(step.id, StepStatus.COMPLETED, null, startedAt);
  } catch (error) {
    // Execute finally even on unexpected error
    if (step.finally) {
      try {
        for (const finallyStep of step.finally) {
          const result = await dispatch(finallyStep, context, sdkRegistry, stepExecutor);

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
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// Script Step
// ============================================================================

export async function executeScriptStep(
  step: ScriptStep,
  context: ExecutionContext,
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
      },
    );

    if (!result.success) {
      return createStepResult(
        step.id,
        StepStatus.FAILED,
        null,
        startedAt,
        0,
        result.error ?? 'Script execution failed',
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
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// Wait Step
// ============================================================================

export async function executeWaitStep(
  step: WaitStep,
  context: ExecutionContext,
  stateStore?: StateStore,
): Promise<StepResult> {
  const startedAt = new Date();

  try {
    switch (step.mode) {
      case 'duration': {
        if (!step.duration) {
          return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0,
            'Wait step with mode=duration requires a duration');
        }
        const resolvedDuration = resolveTemplates(step.duration, context) as string;
        const ms = parseDuration(resolvedDuration);

        // For short durations (under 5 minutes), do in-process wait
        if (ms <= 300000) {
          await new Promise((resolve) => setTimeout(resolve, ms));
          return createStepResult(step.id, StepStatus.COMPLETED, { waited: ms }, startedAt);
        }

        // For longer durations, checkpoint and schedule resume
        if (stateStore) {
          stateStore.saveCheckpoint({
            runId: context.runId,
            stepIndex: context.currentStepIndex,
            stepName: step.id,
            status: StepStatus.COMPLETED,
            startedAt: startedAt,
            completedAt: new Date(),
            inputs: { mode: 'duration', resumeAt: new Date(Date.now() + ms).toISOString() },
            outputs: { waiting: true },
            error: null,
            retryCount: 0,
          });
        }

        const resumeAt = new Date(Date.now() + ms).toISOString();
        return createStepResult(step.id, StepStatus.COMPLETED, {
          waiting: true,
          mode: 'duration',
          resumeAt,
          durationMs: ms,
        }, startedAt);
      }

      case 'webhook': {
        const resumeToken = crypto.randomUUID();
        const webhookPath = step.webhookPath
          ? (resolveTemplates(step.webhookPath, context) as string)
          : `/resume/${context.runId}/${step.id}/${resumeToken}`;

        if (stateStore) {
          stateStore.saveCheckpoint({
            runId: context.runId,
            stepIndex: context.currentStepIndex,
            stepName: step.id,
            status: StepStatus.COMPLETED,
            startedAt: startedAt,
            completedAt: new Date(),
            inputs: { mode: 'webhook', resumeToken, webhookPath },
            outputs: { waiting: true },
            error: null,
            retryCount: 0,
          });
        }

        return createStepResult(step.id, StepStatus.COMPLETED, {
          waiting: true,
          mode: 'webhook',
          resumeToken,
          webhookPath,
        }, startedAt);
      }

      case 'form': {
        if (!step.fields || Object.keys(step.fields).length === 0) {
          return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0,
            'Wait step with mode=form requires fields');
        }

        const resumeToken = crypto.randomUUID();

        if (stateStore) {
          stateStore.saveCheckpoint({
            runId: context.runId,
            stepIndex: context.currentStepIndex,
            stepName: step.id,
            status: StepStatus.COMPLETED,
            startedAt: startedAt,
            completedAt: new Date(),
            inputs: { mode: 'form', resumeToken, fields: step.fields },
            outputs: { waiting: true },
            error: null,
            retryCount: 0,
          });
        }

        return createStepResult(step.id, StepStatus.COMPLETED, {
          waiting: true,
          mode: 'form',
          resumeToken,
          fields: step.fields,
          formPath: `/form/${context.runId}/${step.id}/${resumeToken}`,
        }, startedAt);
      }

      default:
        return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0,
          `Unknown wait mode: ${(step as WaitStep).mode}`);
    }
  } catch (error) {
    return createStepResult(
      step.id,
      StepStatus.FAILED,
      null,
      startedAt,
      0,
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// Merge Step
// ============================================================================

export async function executeMergeStep(
  step: MergeStep,
  context: ExecutionContext,
): Promise<StepResult> {
  const startedAt = new Date();

  try {
    // Resolve all source expressions to arrays
    const resolvedSources: unknown[][] = [];
    for (const source of step.sources) {
      const resolved = resolveTemplates(source, context);
      if (!Array.isArray(resolved)) {
        return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0,
          `Merge source "${source}" did not resolve to an array`);
      }
      resolvedSources.push(resolved);
    }

    let result: unknown[];

    switch (step.mode) {
      case 'append':
        result = resolvedSources.flat();
        break;

      case 'match': {
        if (!step.matchField) {
          return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0,
            'Merge mode "match" requires matchField');
        }
        const fieldSets = resolvedSources.map((source) =>
          new Set(source.map((item) => getNestedValue(item, step.matchField!))),
        );
        const commonKeys = fieldSets.reduce((acc, set) =>
          new Set([...acc].filter((key) => set.has(key))),
        );
        result = resolvedSources[0].filter((item) =>
          commonKeys.has(getNestedValue(item, step.matchField!)),
        );
        break;
      }

      case 'diff': {
        if (!step.matchField) {
          return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0,
            'Merge mode "diff" requires matchField');
        }
        const otherKeys = new Set(
          resolvedSources.slice(1).flat().map((item) => getNestedValue(item, step.matchField!)),
        );
        result = resolvedSources[0].filter((item) =>
          !otherKeys.has(getNestedValue(item, step.matchField!)),
        );
        break;
      }

      case 'combine_by_field': {
        if (!step.matchField) {
          return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0,
            'Merge mode "combine_by_field" requires matchField');
        }
        const grouped = new Map<unknown, Record<string, unknown>>();
        const onConflict = step.onConflict ?? 'keep_last';

        for (const source of resolvedSources) {
          for (const item of source) {
            if (!item || typeof item !== 'object') continue;
            const key = getNestedValue(item, step.matchField!);
            const existing = grouped.get(key);
            if (existing) {
              if (onConflict === 'keep_first') {
                for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
                  if (!(k in existing)) existing[k] = v;
                }
              } else if (onConflict === 'keep_last') {
                Object.assign(existing, item as Record<string, unknown>);
              } else {
                Object.assign(existing, item as Record<string, unknown>);
              }
            } else {
              grouped.set(key, { ...(item as Record<string, unknown>) });
            }
          }
        }
        result = Array.from(grouped.values());
        break;
      }

      default:
        return createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0,
          `Unknown merge mode: ${(step as MergeStep).mode}`);
    }

    return createStepResult(step.id, StepStatus.COMPLETED, result, startedAt);
  } catch (error) {
    return createStepResult(
      step.id,
      StepStatus.FAILED,
      null,
      startedAt,
      0,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Get a nested value from an object using dot notation.
 * Used by merge step for field matching (replaces the old getField function).
 */
function getNestedValue(item: unknown, field: string): unknown {
  if (!item || typeof item !== 'object') return undefined;
  const parts = field.split('.');
  let current: unknown = item;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
