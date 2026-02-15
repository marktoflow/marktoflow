/**
 * `marktoflow run` command — Execute a workflow.
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseFile,
  WorkflowEngine,
  SDKRegistry,
  createSDKStepExecutor,
  StepStatus,
  WorkflowStatus,
  loadConfig,
  StateStore,
} from '@marktoflow/core';
import { registerIntegrations } from '@marktoflow/integrations';
import {
  parseInputPairs,
  debugLogInputs,
  validateAndApplyDefaults,
  printMissingInputsError,
  overrideAgentInWorkflow,
  debugLogAgentOverride,
  overrideModelInWorkflow,
} from '../utils/index.js';
import { getAgentSDKName, getAgentAuthConfig } from '../utils/agent-config.js';
import { executeDryRun, displayDryRunSummary } from './dry-run.js';

export interface RunOptions {
  input?: string[];
  verbose?: boolean;
  debug?: boolean;
  agent?: string;
  model?: string;
  dryRun?: boolean;
}

export async function executeRun(workflowPath: string, options: RunOptions): Promise<void> {
  const spinner = ora('Loading workflow...').start();
  let stateStore: StateStore | undefined;

  try {
    const config = loadConfig(process.cwd());
    const workflowsDir = config.workflows?.path ?? '.marktoflow/workflows';

    // Resolve workflow path
    let resolvedPath = workflowPath;
    if (!existsSync(resolvedPath)) {
      resolvedPath = join(workflowsDir, workflowPath);
    }
    if (!existsSync(resolvedPath)) {
      spinner.fail(`Workflow not found: ${workflowPath}`);
      process.exit(1);
    }

    // Parse workflow
    const { workflow, warnings } = await parseFile(resolvedPath);

    if (warnings.length > 0) {
      spinner.warn('Workflow parsed with warnings:');
      warnings.forEach((w) => console.log(chalk.yellow(`  - ${w}`)));
    } else {
      spinner.succeed(`Loaded: ${workflow.metadata.name}`);
    }

    // Debug: Show workflow details
    if (options.debug) {
      console.log(chalk.gray('\n🐛 Debug: Workflow Details'));
      console.log(chalk.gray(`  ID: ${workflow.metadata.id}`));
      console.log(chalk.gray(`  Version: ${workflow.metadata.version}`));
      console.log(chalk.gray(`  Steps: ${workflow.steps.length}`));
      console.log(chalk.gray(`  Tools: ${Object.keys(workflow.tools).join(', ') || 'none'}`));
      console.log(chalk.gray(`  Inputs Required: ${Object.keys(workflow.inputs || {}).join(', ') || 'none'}`));
    }

    // Parse inputs
    const parsedInputs = parseInputPairs(options.input);

    // Debug: Show parsed inputs
    if (options.debug) {
      debugLogInputs(parsedInputs);
    }

    // Validate required inputs and apply defaults
    const validation = validateAndApplyDefaults(workflow, parsedInputs, { debug: options.debug });
    if (!validation.valid) {
      spinner.fail('Missing required inputs');
      printMissingInputsError(workflow, validation.missingInputs, 'run', workflowPath);
      process.exit(1);
    }
    const inputs = validation.inputs;

    // Override AI agent if specified
    if (options.agent) {
      const sdkName = getAgentSDKName(options.agent);
      const authConfig = getAgentAuthConfig(sdkName);
      const result = overrideAgentInWorkflow(workflow, sdkName, authConfig, {
        verbose: options.verbose,
        debug: options.debug,
      });

      if (options.debug) {
        debugLogAgentOverride(options.agent, sdkName, result.replacedCount, authConfig);
      }
    }

    // Override model if specified
    if (options.model) {
      const result = overrideModelInWorkflow(workflow, options.model);

      if (options.verbose || options.debug) {
        if (result.overrideCount > 0) {
          console.log(chalk.cyan(`  Set model '${options.model}' for ${result.overrideCount} AI tool(s)`));
        }
      }

      if (options.debug) {
        console.log(chalk.gray('\n🐛 Debug: Model Override'));
        console.log(chalk.gray(`  Model: ${options.model}`));
        console.log(chalk.gray(`  Applied to ${result.overrideCount} AI tool(s)`));
      }

      if (result.overrideCount === 0 && (options.verbose || options.debug)) {
        console.log(chalk.yellow(`  Warning: --model specified but no AI tools found in workflow`));
      }
    }

    // Handle dry-run mode
    if (options.dryRun) {
      const dryRunResult = await executeDryRun(workflow, inputs, {
        verbose: options.verbose,
        showMockData: true,
        showVariables: true,
      });
      displayDryRunSummary(dryRunResult, {
        verbose: options.verbose,
        showMockData: true,
        showVariables: true,
      });
      return;
    }

    // Execute workflow
    spinner.start('Executing workflow...');

    if (options.debug) {
      console.log(chalk.gray('\n🐛 Debug: Starting Workflow Execution'));
      console.log(chalk.gray(`  Workflow: ${workflow.metadata.name}`));
      console.log(chalk.gray(`  Steps to execute: ${workflow.steps.length}`));
    }

    const loggedSteps = new Set<string>();

    // Create StateStore for execution history
    const stateDir = join(process.cwd(), '.marktoflow');
    mkdirSync(stateDir, { recursive: true });
    stateStore = new StateStore(join(stateDir, 'state.db'));

    const engine = new WorkflowEngine(
      {},
      {
        onStepStart: (step) => {
          if (options.verbose || options.debug) {
            spinner.text = `Executing: ${step.id}`;
          }
          if (options.debug && !loggedSteps.has(step.id)) {
            console.log(chalk.gray(`\n🐛 Debug: Step Start - ${step.id}`));
            console.log(chalk.gray(`  Action: ${step.action || 'N/A'}`));
            if (step.inputs) {
              console.log(chalk.gray(`  Inputs: ${JSON.stringify(step.inputs, null, 2).split('\n').join('\n  ')}`));
            }
            loggedSteps.add(step.id);
          }
        },
        onStepComplete: (step, result) => {
          if (options.verbose || options.debug) {
            const icon = result.status === StepStatus.COMPLETED ? '✓' : '✗';
            console.log(`  ${icon} ${step.id}: ${result.status}`);
          }
          if (options.debug) {
            logStepComplete(step, result);
          }
        },
      },
      stateStore
    );

    engine.workflowPath = resolvedPath;

    const registry = new SDKRegistry();
    registerIntegrations(registry);
    registry.registerTools(workflow.tools);

    if (options.debug) {
      console.log(chalk.gray('\n🐛 Debug: SDK Registry'));
      console.log(chalk.gray(`  Registered tools: ${Object.keys(workflow.tools).join(', ')}`));
    }

    const result = await engine.execute(workflow, inputs, registry, createSDKStepExecutor());

    if (result.status === WorkflowStatus.COMPLETED) {
      spinner.succeed(`Workflow completed in ${result.duration}ms`);
    } else {
      spinner.fail(`Workflow failed: ${result.error}`);

      if (options.debug) {
        logFailureDetails(result);
      }

      process.exit(1);
    }

    // Show summary
    console.log('\n' + chalk.bold('Summary:'));
    console.log(`  Status: ${result.status}`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Steps: ${result.stepResults.length}`);

    const completed = result.stepResults.filter((s) => s.status === StepStatus.COMPLETED).length;
    const failed = result.stepResults.filter((s) => s.status === StepStatus.FAILED).length;
    const skipped = result.stepResults.filter((s) => s.status === StepStatus.SKIPPED).length;

    console.log(`  Completed: ${completed}, Failed: ${failed}, Skipped: ${skipped}`);

    stateStore.close();
    process.exit(0);
  } catch (error) {
    spinner.fail(`Execution failed: ${error}`);

    if (options.debug) {
      logUnhandledError(error);
    }

    stateStore?.close();
    process.exit(1);
  }
}

// --- Debug logging helpers ---

function logStepComplete(step: any, result: any): void {
  console.log(chalk.gray(`\n🐛 Debug: Step Complete - ${step.id}`));
  console.log(chalk.gray(`  Status: ${result.status}`));
  console.log(chalk.gray(`  Duration: ${result.duration}ms`));

  if (step.outputVariable) {
    console.log(chalk.gray(`  Output Variable: ${step.outputVariable}`));
  }

  if (result.output !== undefined) {
    let outputStr: string;
    if (typeof result.output === 'string') {
      outputStr = result.output;
    } else {
      outputStr = JSON.stringify(result.output, null, 2);
    }

    const lines = outputStr.split('\n');
    if (lines.length > 50) {
      console.log(chalk.gray(`  Output (${lines.length} lines):`));
      lines.slice(0, 40).forEach(line => console.log(chalk.gray(`    ${line}`)));
      console.log(chalk.gray(`    ... (${lines.length - 45} lines omitted) ...`));
      lines.slice(-5).forEach(line => console.log(chalk.gray(`    ${line}`)));
    } else {
      console.log(chalk.gray(`  Output:`));
      lines.forEach(line => console.log(chalk.gray(`    ${line}`)));
    }
  }

  if (result.error) {
    console.log(chalk.red(`  Error: ${result.error}`));
  }
}

function logFailureDetails(result: any): void {
  console.log(chalk.red('\n🐛 Debug: Failure Details'));
  console.log(chalk.red(`  Error: ${result.error}`));

  const failedStep = result.stepResults.find((s: any) => s.status === StepStatus.FAILED);
  if (failedStep) {
    console.log(chalk.red(`  Failed Step: ${failedStep.stepId}`));
    console.log(chalk.red(`  Step Duration: ${failedStep.duration}ms`));
    if (failedStep.error) {
      console.log(chalk.red(`  Step Error: ${failedStep.error}`));

      const errorObj = typeof failedStep.error === 'object' ? failedStep.error as any : null;
      if (errorObj) {
        if (errorObj.response) {
          console.log(chalk.red('\n  HTTP Error Details:'));
          console.log(chalk.red(`    Status: ${errorObj.response.status} ${errorObj.response.statusText || ''}`));
          if (errorObj.config?.url) {
            console.log(chalk.red(`    URL: ${errorObj.config.method?.toUpperCase() || 'GET'} ${errorObj.config.url}`));
          }
          if (errorObj.response.data) {
            console.log(chalk.red(`    Response Body:`));
            try {
              const responseStr = typeof errorObj.response.data === 'string'
                ? errorObj.response.data
                : JSON.stringify(errorObj.response.data, null, 2);
              const lines = responseStr.split('\n').slice(0, 20);
              lines.forEach((line: string) => console.log(chalk.red(`      ${line}`)));
              if (responseStr.split('\n').length > 20) {
                console.log(chalk.red(`      ... (truncated)`));
              }
            } catch {
              console.log(chalk.red(`      [Unable to serialize response]`));
            }
          }
          if (errorObj.response.headers) {
            console.log(chalk.red(`    Response Headers:`));
            const headers = errorObj.response.headers;
            Object.keys(headers).slice(0, 10).forEach((key: string) => {
              console.log(chalk.red(`      ${key}: ${headers[key]}`));
            });
          }
        }

        if (errorObj.config && !errorObj.response) {
          console.log(chalk.red('\n  Request Details:'));
          if (errorObj.config.url) {
            console.log(chalk.red(`    URL: ${errorObj.config.method?.toUpperCase() || 'GET'} ${errorObj.config.url}`));
          }
          if (errorObj.config.baseURL) {
            console.log(chalk.red(`    Base URL: ${errorObj.config.baseURL}`));
          }
          if (errorObj.code) {
            console.log(chalk.red(`    Error Code: ${errorObj.code}`));
          }
        }

        if (errorObj.stack) {
          console.log(chalk.red('\n  Stack Trace:'));
          const stack = errorObj.stack.split('\n').slice(0, 15);
          stack.forEach((line: string) => console.log(chalk.red(`    ${line}`)));
          if (errorObj.stack.split('\n').length > 15) {
            console.log(chalk.red(`    ... (truncated)`));
          }
        }
      }
    }
    if (failedStep.output) {
      console.log(chalk.red(`  Output: ${JSON.stringify(failedStep.output, null, 2)}`));
    }
  }

  console.log(chalk.yellow('\n🐛 Debug: Execution Context'));
  console.log(chalk.yellow(`  Total steps executed: ${result.stepResults.length}`));
  console.log(chalk.yellow(`  Steps before failure:`));
  result.stepResults.slice(0, -1).forEach((stepResult: any) => {
    console.log(chalk.yellow(`    - ${stepResult.stepId}: ${stepResult.status}`));
  });
}

function logUnhandledError(error: unknown): void {
  console.log(chalk.red('\n🐛 Debug: Unhandled Error Details'));
  console.log(chalk.red(`  Error Type: ${error instanceof Error ? error.constructor.name : typeof error}`));
  console.log(chalk.red(`  Error Message: ${error instanceof Error ? error.message : String(error)}`));

  if (error instanceof Error && error.stack) {
    console.log(chalk.red('\n  Stack Trace:'));
    error.stack.split('\n').forEach(line => {
      console.log(chalk.red(`    ${line}`));
    });
  }

  if (error && typeof error === 'object') {
    const errorObj = error as any;
    const keys = Object.keys(errorObj).filter(k => k !== 'stack' && k !== 'message');
    if (keys.length > 0) {
      console.log(chalk.red('\n  Additional Error Properties:'));
      keys.forEach(key => {
        try {
          console.log(chalk.red(`    ${key}: ${JSON.stringify(errorObj[key], null, 2)}`));
        } catch {
          console.log(chalk.red(`    ${key}: [Unable to serialize]`));
        }
      });
    }
  }
}
