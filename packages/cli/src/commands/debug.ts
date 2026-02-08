/**
 * Interactive debugging command for marktoflow workflows
 *
 * Features:
 * - Breakpoints on specific steps
 * - Step-through execution (next, continue, skip)
 * - Variable inspection and modification
 * - Replay failed steps
 */

import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import {
  Workflow,
  WorkflowStep,
  ExecutionContext,
  StepResult,
  StepStatus,
  WorkflowStatus,
  createExecutionContext,
  createStepResult,
} from '@marktoflow/core';
import { t } from '../i18n.js';

// Re-export SDKRegistryLike type from engine
export interface SDKRegistryLike {
  load(sdkName: string): Promise<unknown>;
  has(sdkName: string): boolean;
}

// ============================================================================
// Types
// ============================================================================

export type DebugAction =
  | 'next' // Execute next step
  | 'continue' // Continue until next breakpoint or end
  | 'skip' // Skip current step
  | 'inspect' // Inspect variables
  | 'modify' // Modify input variables
  | 'breakpoint' // Set/remove breakpoints
  | 'quit'; // Stop debugging

export interface DebuggerState {
  currentStepIndex: number;
  breakpoints: Set<string>; // Step IDs
  isPaused: boolean;
  stepResults: StepResult[];
  context: ExecutionContext;
}

export interface DebugOptions {
  breakpoints?: string[]; // Initial breakpoints
  verbose?: boolean;
  autoStart?: boolean; // Start without prompting
}

// ============================================================================
// Debugger Class
// ============================================================================

export class WorkflowDebugger {
  private state: DebuggerState;
  private workflow: Workflow;
  private sdkRegistry: SDKRegistryLike;
  private stepExecutor: (
    step: WorkflowStep,
    context: ExecutionContext,
    registry: SDKRegistryLike
  ) => Promise<unknown>;

  constructor(
    workflow: Workflow,
    inputs: Record<string, unknown>,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: (
      step: WorkflowStep,
      context: ExecutionContext,
      registry: SDKRegistryLike
    ) => Promise<unknown>,
    options: DebugOptions = {}
  ) {
    this.workflow = workflow;
    this.sdkRegistry = sdkRegistry;
    this.stepExecutor = stepExecutor;

    this.state = {
      currentStepIndex: 0,
      breakpoints: new Set(options.breakpoints ?? []),
      isPaused: true,
      stepResults: [],
      context: createExecutionContext(workflow, inputs),
    };
  }

  /**
   * Start interactive debugging session
   */
  async debug(): Promise<void> {
    console.log(chalk.bold.cyan(`\n${t('cli:commands.debug.title')}\n`));
    console.log(`${t('cli:commands.debug.workflowLabel')} ${chalk.cyan(this.workflow.metadata.name)}`);
    console.log(`${t('cli:commands.debug.stepsLabel')} ${this.workflow.steps.length}`);
    console.log(
      `${t('cli:commands.debug.breakpointsLabel')} ${this.state.breakpoints.size ? Array.from(this.state.breakpoints).join(', ') : t('cli:commands.debug.none')}\n`
    );

    // Show initial state
    this.displayState();

    while (this.state.currentStepIndex < this.workflow.steps.length) {
      const currentStep = this.workflow.steps[this.state.currentStepIndex];

      // Check if we should pause (breakpoint or manual pause)
      const shouldPause = this.state.isPaused || this.state.breakpoints.has(currentStep.id);

      if (shouldPause) {
        console.log(
          chalk.yellow(
            `\n${t('cli:commands.debug.pausedAtStep', { current: this.state.currentStepIndex + 1, total: this.workflow.steps.length })}`
          )
        );
        this.displayStep(currentStep);

        // Get user action
        const action = await this.promptAction();

        switch (action) {
          case 'next':
            await this.executeStep(currentStep);
            this.state.currentStepIndex++;
            break;

          case 'continue':
            this.state.isPaused = false;
            await this.executeStep(currentStep);
            this.state.currentStepIndex++;
            break;

          case 'skip':
            console.log(chalk.dim(`${t('cli:commands.debug.skipped', { stepId: currentStep.id })}`));
            const skipResult = createStepResult(
              currentStep.id,
              StepStatus.SKIPPED,
              undefined,
              new Date(),
              0
            );
            this.state.stepResults.push(skipResult);
            this.state.currentStepIndex++;
            break;

          case 'inspect':
            await this.inspectVariables();
            // Don't advance step
            break;

          case 'modify':
            await this.modifyVariables();
            // Don't advance step
            break;

          case 'breakpoint':
            await this.manageBreakpoints();
            // Don't advance step
            break;

          case 'quit':
            console.log(chalk.yellow(`\n${t('cli:commands.debug.terminated')}`));
            return;
        }
      } else {
        // Continue mode - execute without pausing
        await this.executeStep(currentStep);
        this.state.currentStepIndex++;
      }
    }

    // Debug session complete
    this.displaySummary();
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: WorkflowStep): Promise<void> {
    const startTime = Date.now();
    console.log(chalk.cyan(`\n${t('cli:commands.debug.executing', { stepId: step.id })}`));

    try {
      // Update context
      this.state.context.currentStepIndex = this.state.currentStepIndex;
      this.state.context.status = WorkflowStatus.RUNNING;

      // Execute step
      const output = await this.stepExecutor(step, this.state.context, this.sdkRegistry);

      // Update variables
      if (step.outputVariable) {
        this.state.context.variables[step.outputVariable] = output;
      }

      // Create result
      const stepStartedAt = new Date(startTime);
      const result = createStepResult(step.id, StepStatus.COMPLETED, output, stepStartedAt, 0);
      result.completedAt = new Date();
      result.duration = Date.now() - startTime;
      this.state.stepResults.push(result);

      // Update step metadata
      this.state.context.stepMetadata[step.id] = {
        status: StepStatus.COMPLETED,
        retryCount: 0,
      };

      console.log(chalk.green(`${t('cli:commands.debug.stepCompleted', { stepId: step.id, duration: result.duration })}`));

      if (step.outputVariable) {
        console.log(chalk.dim(`  → ${step.outputVariable} = ${JSON.stringify(output, null, 2)}`));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`${t('cli:commands.debug.stepFailed', { stepId: step.id, error: errorMsg })}`));

      const failedStepStartedAt = new Date(startTime);
      const result = createStepResult(
        step.id,
        StepStatus.FAILED,
        undefined,
        failedStepStartedAt,
        0,
        errorMsg
      );
      result.completedAt = new Date();
      result.duration = Date.now() - startTime;
      this.state.stepResults.push(result);

      // Update step metadata
      this.state.context.stepMetadata[step.id] = {
        status: StepStatus.FAILED,
        error: errorMsg,
        retryCount: 0,
      };

      // Ask if user wants to retry, skip, or abort
      const retryAction = await select({
        message: t('cli:commands.debug.stepFailedPrompt'),
        choices: [
          { name: t('cli:commands.debug.action.retry'), value: 'retry' },
          { name: t('cli:commands.debug.action.skipAndContinue'), value: 'skip' },
          { name: t('cli:commands.debug.action.abortDebugging'), value: 'abort' },
        ],
      });

      if (retryAction === 'retry') {
        // Retry - don't advance step index
        this.state.currentStepIndex--;
      } else if (retryAction === 'abort') {
        throw new Error(t('cli:commands.debug.abortedDueToFailure'));
      }
      // Skip - step index will advance naturally
    }
  }

  /**
   * Prompt user for next action
   */
  private async promptAction(): Promise<DebugAction> {
    const action = await select({
      message: t('cli:commands.debug.action.prompt'),
      choices: [
        { name: t('cli:commands.debug.action.next'), value: 'next' },
        { name: t('cli:commands.debug.action.continue'), value: 'continue' },
        { name: t('cli:commands.debug.action.skip'), value: 'skip' },
        { name: t('cli:commands.debug.action.inspect'), value: 'inspect' },
        { name: t('cli:commands.debug.action.modify'), value: 'modify' },
        { name: t('cli:commands.debug.action.breakpoint'), value: 'breakpoint' },
        { name: t('cli:commands.debug.action.quit'), value: 'quit' },
      ],
    });

    return action as DebugAction;
  }

  /**
   * Display current debugger state
   */
  private displayState(): void {
    console.log(chalk.bold(t('cli:commands.debug.currentState')));
    console.log(`  ${t('cli:commands.debug.stateStep', { current: this.state.currentStepIndex + 1, total: this.workflow.steps.length })}`);
    console.log(`  ${t('cli:commands.debug.stateVariables', { count: Object.keys(this.state.context.variables).length })}`);
    console.log(
      `  ${t('cli:commands.debug.stateCompleted', { count: this.state.stepResults.filter((r) => r.status === StepStatus.COMPLETED).length })}`
    );
    console.log(
      `  ${t('cli:commands.debug.stateFailed', { count: this.state.stepResults.filter((r) => r.status === StepStatus.FAILED).length })}`
    );
  }

  /**
   * Display current step details
   */
  private displayStep(step: WorkflowStep): void {
    console.log(chalk.bold(`\n${t('cli:commands.debug.currentStep')}`));
    console.log(`  ${t('cli:commands.debug.stepId')} ${chalk.cyan(step.id)}`);
    console.log(`  ${t('cli:commands.debug.stepAction')} ${chalk.cyan(step.action)}`);
    if (step.name) {
      console.log(`  ${t('cli:commands.debug.stepName')} ${step.name}`);
    }
    if (Object.keys(step.inputs).length > 0) {
      console.log(`  ${t('cli:commands.debug.stepInputs')} ${JSON.stringify(step.inputs, null, 2)}`);
    }
    if (step.outputVariable) {
      console.log(`  ${t('cli:commands.debug.stepOutputVariable')} ${chalk.cyan(step.outputVariable)}`);
    }
    if (step.conditions && step.conditions.length > 0) {
      console.log(`  ${t('cli:commands.debug.stepConditions')} ${step.conditions.join(' && ')}`);
    }
  }

  /**
   * Inspect current variables
   */
  private async inspectVariables(): Promise<void> {
    console.log(chalk.bold(`\n${t('cli:commands.debug.inspect.title')}\n`));

    console.log(chalk.bold(t('cli:commands.debug.inspect.inputs')));
    if (Object.keys(this.state.context.inputs).length === 0) {
      console.log(chalk.dim(`  ${t('cli:commands.debug.none')}`));
    } else {
      for (const [key, value] of Object.entries(this.state.context.inputs)) {
        console.log(`  ${chalk.cyan(key)}: ${JSON.stringify(value, null, 2)}`);
      }
    }

    console.log(chalk.bold(`\n${t('cli:commands.debug.inspect.variables')}`));
    if (Object.keys(this.state.context.variables).length === 0) {
      console.log(chalk.dim(`  ${t('cli:commands.debug.none')}`));
    } else {
      for (const [key, value] of Object.entries(this.state.context.variables)) {
        console.log(`  ${chalk.cyan(key)}: ${JSON.stringify(value, null, 2)}`);
      }
    }

    console.log(chalk.bold(`\n${t('cli:commands.debug.inspect.stepMetadata')}`));
    if (Object.keys(this.state.context.stepMetadata).length === 0) {
      console.log(chalk.dim(`  ${t('cli:commands.debug.none')}`));
    } else {
      for (const [stepId, metadata] of Object.entries(this.state.context.stepMetadata)) {
        const statusColor =
          metadata.status === StepStatus.COMPLETED
            ? chalk.green
            : metadata.status === StepStatus.FAILED
              ? chalk.red
              : chalk.yellow;
        console.log(
          `  ${chalk.cyan(stepId)}: ${statusColor(metadata.status)}${metadata.error ? ` - ${metadata.error}` : ''}`
        );
      }
    }

    await input({ message: `\n${t('cli:commands.debug.pressEnter')}` });
  }

  /**
   * Modify input variables
   */
  private async modifyVariables(): Promise<void> {
    console.log(chalk.bold(`\n${t('cli:commands.debug.modify.title')}\n`));

    const variableType = await select({
      message: t('cli:commands.debug.modify.whichType'),
      choices: [
        { name: t('cli:commands.debug.modify.inputVariables'), value: 'inputs' },
        { name: t('cli:commands.debug.modify.workflowVariables'), value: 'variables' },
        { name: t('cli:commands.debug.modify.cancel'), value: 'cancel' },
      ],
    });

    if (variableType === 'cancel') return;

    const targetObject =
      variableType === 'inputs' ? this.state.context.inputs : this.state.context.variables;
    const keys = Object.keys(targetObject);

    if (keys.length === 0) {
      console.log(chalk.yellow(t('cli:commands.debug.modify.noVariables')));
      return;
    }

    const key = await select({
      message: t('cli:commands.debug.modify.selectVariable'),
      choices: keys.map((k) => ({
        name: `${k} = ${JSON.stringify(targetObject[k])}`,
        value: k,
      })),
    });

    const currentValue = targetObject[key];
    const newValue = await input({
      message: t('cli:commands.debug.modify.newValue', { key }),
      default: JSON.stringify(currentValue),
    });

    try {
      targetObject[key] = JSON.parse(newValue);
      console.log(chalk.green(t('cli:commands.debug.modify.updated', { key })));
    } catch (error) {
      console.log(chalk.red(t('cli:commands.debug.modify.invalidJson')));
      targetObject[key] = newValue;
    }
  }

  /**
   * Manage breakpoints
   */
  private async manageBreakpoints(): Promise<void> {
    console.log(chalk.bold(`\n${t('cli:commands.debug.breakpoint.title')}\n`));

    const action = await select({
      message: t('cli:commands.debug.breakpoint.prompt'),
      choices: [
        { name: t('cli:commands.debug.breakpoint.add'), value: 'add' },
        { name: t('cli:commands.debug.breakpoint.remove'), value: 'remove' },
        { name: t('cli:commands.debug.breakpoint.list'), value: 'list' },
        { name: t('cli:commands.debug.breakpoint.cancel'), value: 'cancel' },
      ],
    });

    if (action === 'cancel') return;

    if (action === 'list') {
      if (this.state.breakpoints.size === 0) {
        console.log(chalk.yellow(t('cli:commands.debug.breakpoint.noneSet')));
      } else {
        console.log(chalk.bold(t('cli:commands.debug.breakpoint.listTitle')));
        for (const bp of this.state.breakpoints) {
          console.log(`  • ${chalk.cyan(bp)}`);
        }
      }
      await input({ message: `\n${t('cli:commands.debug.pressEnter')}` });
      return;
    }

    if (action === 'add') {
      const stepId = await select({
        message: t('cli:commands.debug.breakpoint.addAt'),
        choices: this.workflow.steps.map((s) => ({
          name: `${s.id} (${s.action})`,
          value: s.id,
        })),
      });
      this.state.breakpoints.add(stepId);
      console.log(chalk.green(t('cli:commands.debug.breakpoint.added', { stepId })));
    } else if (action === 'remove') {
      if (this.state.breakpoints.size === 0) {
        console.log(chalk.yellow(t('cli:commands.debug.breakpoint.noneToRemove')));
        return;
      }
      const stepId = await select({
        message: t('cli:commands.debug.breakpoint.removePrompt'),
        choices: Array.from(this.state.breakpoints).map((bp) => ({
          name: bp,
          value: bp,
        })),
      });
      this.state.breakpoints.delete(stepId);
      console.log(chalk.green(t('cli:commands.debug.breakpoint.removed', { stepId })));
    }
  }

  /**
   * Display final summary
   */
  private displaySummary(): void {
    console.log(chalk.bold.green(`\n${t('cli:commands.debug.summary.complete')}\n`));

    const completed = this.state.stepResults.filter(
      (r) => r.status === StepStatus.COMPLETED
    ).length;
    const failed = this.state.stepResults.filter((r) => r.status === StepStatus.FAILED).length;
    const skipped = this.state.stepResults.filter((r) => r.status === StepStatus.SKIPPED).length;

    console.log(chalk.bold(t('cli:commands.debug.summary.title')));
    console.log(`  ${t('cli:commands.debug.summary.totalSteps', { count: this.workflow.steps.length })}`);
    console.log(`  ${chalk.green('✓')} ${t('cli:commands.debug.summary.completed', { count: completed })}`);
    console.log(`  ${chalk.red('✗')} ${t('cli:commands.debug.summary.failed', { count: failed })}`);
    console.log(`  ${chalk.yellow('⊘')} ${t('cli:commands.debug.summary.skipped', { count: skipped })}`);

    console.log(chalk.bold(`\n${t('cli:commands.debug.summary.finalVariables')}`));
    for (const [key, value] of Object.entries(this.state.context.variables)) {
      console.log(`  ${chalk.cyan(key)}: ${JSON.stringify(value)}`);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse breakpoint specification
 */
export function parseBreakpoints(breakpointSpec: string[]): string[] {
  return breakpointSpec.flatMap((spec) => {
    // Support comma-separated lists
    return spec.split(',').map((s) => s.trim());
  });
}
