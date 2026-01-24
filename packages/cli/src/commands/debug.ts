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
    console.log(chalk.bold.cyan('\n🐛 Debug Mode\n'));
    console.log(`Workflow: ${chalk.cyan(this.workflow.metadata.name)}`);
    console.log(`Steps: ${this.workflow.steps.length}`);
    console.log(
      `Breakpoints: ${this.state.breakpoints.size ? Array.from(this.state.breakpoints).join(', ') : 'none'}\n`
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
            `\n⏸  Paused at step ${this.state.currentStepIndex + 1}/${this.workflow.steps.length}`
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
            console.log(chalk.dim(`Skipped: ${currentStep.id}`));
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
            console.log(chalk.yellow('\n🛑 Debug session terminated by user'));
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
    console.log(chalk.cyan(`\n▶ Executing: ${step.id}`));

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

      console.log(chalk.green(`✓ ${step.id} completed in ${result.duration}ms`));

      if (step.outputVariable) {
        console.log(chalk.dim(`  → ${step.outputVariable} = ${JSON.stringify(output, null, 2)}`));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`✗ ${step.id} failed: ${errorMsg}`));

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
        message: 'Step failed. What would you like to do?',
        choices: [
          { name: 'Retry this step', value: 'retry' },
          { name: 'Skip and continue', value: 'skip' },
          { name: 'Abort debugging', value: 'abort' },
        ],
      });

      if (retryAction === 'retry') {
        // Retry - don't advance step index
        this.state.currentStepIndex--;
      } else if (retryAction === 'abort') {
        throw new Error('Debug session aborted due to step failure');
      }
      // Skip - step index will advance naturally
    }
  }

  /**
   * Prompt user for next action
   */
  private async promptAction(): Promise<DebugAction> {
    const action = await select({
      message: 'Debug action:',
      choices: [
        { name: 'Next - Execute current step', value: 'next' },
        { name: 'Continue - Run until next breakpoint', value: 'continue' },
        { name: 'Skip - Skip current step', value: 'skip' },
        { name: 'Inspect - View variables', value: 'inspect' },
        { name: 'Modify - Change input variables', value: 'modify' },
        { name: 'Breakpoint - Manage breakpoints', value: 'breakpoint' },
        { name: 'Quit - Stop debugging', value: 'quit' },
      ],
    });

    return action as DebugAction;
  }

  /**
   * Display current debugger state
   */
  private displayState(): void {
    console.log(chalk.bold('Current State:'));
    console.log(`  Step: ${this.state.currentStepIndex + 1}/${this.workflow.steps.length}`);
    console.log(`  Variables: ${Object.keys(this.state.context.variables).length}`);
    console.log(
      `  Completed: ${this.state.stepResults.filter((r) => r.status === StepStatus.COMPLETED).length}`
    );
    console.log(
      `  Failed: ${this.state.stepResults.filter((r) => r.status === StepStatus.FAILED).length}`
    );
  }

  /**
   * Display current step details
   */
  private displayStep(step: WorkflowStep): void {
    console.log(chalk.bold('\nCurrent Step:'));
    console.log(`  ID: ${chalk.cyan(step.id)}`);
    console.log(`  Action: ${chalk.cyan(step.action)}`);
    if (step.name) {
      console.log(`  Name: ${step.name}`);
    }
    if (Object.keys(step.inputs).length > 0) {
      console.log(`  Inputs: ${JSON.stringify(step.inputs, null, 2)}`);
    }
    if (step.outputVariable) {
      console.log(`  Output Variable: ${chalk.cyan(step.outputVariable)}`);
    }
    if (step.conditions && step.conditions.length > 0) {
      console.log(`  Conditions: ${step.conditions.join(' && ')}`);
    }
  }

  /**
   * Inspect current variables
   */
  private async inspectVariables(): Promise<void> {
    console.log(chalk.bold('\n📊 Variables:\n'));

    console.log(chalk.bold('Inputs:'));
    if (Object.keys(this.state.context.inputs).length === 0) {
      console.log(chalk.dim('  (none)'));
    } else {
      for (const [key, value] of Object.entries(this.state.context.inputs)) {
        console.log(`  ${chalk.cyan(key)}: ${JSON.stringify(value, null, 2)}`);
      }
    }

    console.log(chalk.bold('\nVariables:'));
    if (Object.keys(this.state.context.variables).length === 0) {
      console.log(chalk.dim('  (none)'));
    } else {
      for (const [key, value] of Object.entries(this.state.context.variables)) {
        console.log(`  ${chalk.cyan(key)}: ${JSON.stringify(value, null, 2)}`);
      }
    }

    console.log(chalk.bold('\nStep Metadata:'));
    if (Object.keys(this.state.context.stepMetadata).length === 0) {
      console.log(chalk.dim('  (none)'));
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

    await input({ message: '\nPress Enter to continue...' });
  }

  /**
   * Modify input variables
   */
  private async modifyVariables(): Promise<void> {
    console.log(chalk.bold('\n✏️  Modify Variables\n'));

    const variableType = await select({
      message: 'Which variable type to modify?',
      choices: [
        { name: 'Input variables', value: 'inputs' },
        { name: 'Workflow variables', value: 'variables' },
        { name: 'Cancel', value: 'cancel' },
      ],
    });

    if (variableType === 'cancel') return;

    const targetObject =
      variableType === 'inputs' ? this.state.context.inputs : this.state.context.variables;
    const keys = Object.keys(targetObject);

    if (keys.length === 0) {
      console.log(chalk.yellow('No variables to modify'));
      return;
    }

    const key = await select({
      message: 'Select variable to modify:',
      choices: keys.map((k) => ({
        name: `${k} = ${JSON.stringify(targetObject[k])}`,
        value: k,
      })),
    });

    const currentValue = targetObject[key];
    const newValue = await input({
      message: `New value for ${key}:`,
      default: JSON.stringify(currentValue),
    });

    try {
      targetObject[key] = JSON.parse(newValue);
      console.log(chalk.green(`✓ Updated ${key}`));
    } catch (error) {
      console.log(chalk.red('Invalid JSON. Treating as string.'));
      targetObject[key] = newValue;
    }
  }

  /**
   * Manage breakpoints
   */
  private async manageBreakpoints(): Promise<void> {
    console.log(chalk.bold('\n🔴 Manage Breakpoints\n'));

    const action = await select({
      message: 'Breakpoint action:',
      choices: [
        { name: 'Add breakpoint', value: 'add' },
        { name: 'Remove breakpoint', value: 'remove' },
        { name: 'List breakpoints', value: 'list' },
        { name: 'Cancel', value: 'cancel' },
      ],
    });

    if (action === 'cancel') return;

    if (action === 'list') {
      if (this.state.breakpoints.size === 0) {
        console.log(chalk.yellow('No breakpoints set'));
      } else {
        console.log(chalk.bold('Breakpoints:'));
        for (const bp of this.state.breakpoints) {
          console.log(`  • ${chalk.cyan(bp)}`);
        }
      }
      await input({ message: '\nPress Enter to continue...' });
      return;
    }

    if (action === 'add') {
      const stepId = await select({
        message: 'Add breakpoint at step:',
        choices: this.workflow.steps.map((s) => ({
          name: `${s.id} (${s.action})`,
          value: s.id,
        })),
      });
      this.state.breakpoints.add(stepId);
      console.log(chalk.green(`✓ Breakpoint added at ${stepId}`));
    } else if (action === 'remove') {
      if (this.state.breakpoints.size === 0) {
        console.log(chalk.yellow('No breakpoints to remove'));
        return;
      }
      const stepId = await select({
        message: 'Remove breakpoint:',
        choices: Array.from(this.state.breakpoints).map((bp) => ({
          name: bp,
          value: bp,
        })),
      });
      this.state.breakpoints.delete(stepId);
      console.log(chalk.green(`✓ Breakpoint removed from ${stepId}`));
    }
  }

  /**
   * Display final summary
   */
  private displaySummary(): void {
    console.log(chalk.bold.green('\n✓ Debug session complete\n'));

    const completed = this.state.stepResults.filter(
      (r) => r.status === StepStatus.COMPLETED
    ).length;
    const failed = this.state.stepResults.filter((r) => r.status === StepStatus.FAILED).length;
    const skipped = this.state.stepResults.filter((r) => r.status === StepStatus.SKIPPED).length;

    console.log(chalk.bold('Summary:'));
    console.log(`  Total steps: ${this.workflow.steps.length}`);
    console.log(`  ${chalk.green('✓')} Completed: ${completed}`);
    console.log(`  ${chalk.red('✗')} Failed: ${failed}`);
    console.log(`  ${chalk.yellow('⊘')} Skipped: ${skipped}`);

    console.log(chalk.bold('\nFinal Variables:'));
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
