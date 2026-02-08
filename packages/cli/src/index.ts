#!/usr/bin/env node

/**
 * marktoflow CLI
 *
 * Agent automation framework with native MCP support.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  parseFile,
  WorkflowEngine,
  SDKRegistry,
  createSDKStepExecutor,
  StepStatus,
  WorkflowStatus,
  loadEnv,
  ToolRegistry,
  WorkflowBundle,
  Scheduler,
  TemplateRegistry,
  loadConfig,
  createCredentialManager,
  getAvailableBackends,
  EncryptionBackend,
  StateStore,
} from '@marktoflow/core';
import { registerIntegrations } from '@marktoflow/integrations';
import { initI18n, t } from './i18n.js';
import { workerCommand } from './worker.js';
import { triggerCommand } from './trigger.js';
import { serveCommand } from './serve.js';
import { runWorkflowWizard, listTemplates } from './commands/new.js';
import { runUpdateWizard, listAgents } from './commands/update.js';
import { parse as parseYaml } from 'yaml';
import { executeDryRun, displayDryRunSummary } from './commands/dry-run.js';
import { WorkflowDebugger, parseBreakpoints } from './commands/debug.js';
import { executeTestConnection } from './commands/test-connection.js';
import { executeHistory, executeHistoryDetail, executeReplay } from './commands/history.js';
import {
  parseInputPairs,
  debugLogInputs,
  validateAndApplyDefaults,
  printMissingInputsError,
  overrideAgentInWorkflow,
  debugLogAgentOverride,
  overrideModelInWorkflow,
} from './utils/index.js';

// Read version from package.json
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
const VERSION = packageJson.version;

// Load environment variables from .env files on CLI startup
loadEnv();

function getConfig() {
  return loadConfig(process.cwd());
}

function isBundle(path: string): boolean {
  try {
    const stat = existsSync(path) ? statSync(path) : null;
    if (!stat || !stat.isDirectory()) return false;
    const entries = readdirSync(path);
    return entries.some((name) => name.endsWith('.md') && name !== 'README.md');
  } catch {
    return false;
  }
}

/**
 * Map agent provider aliases to SDK names
 */
function getAgentSDKName(provider: string): string {
  const providerMap: Record<string, string> = {
    'claude': 'claude-code',
    'claude-code': 'claude-code',
    'claude-agent': 'claude-agent',
    'copilot': 'github-copilot',
    'github-copilot': 'github-copilot',
    'opencode': 'opencode',
    'ollama': 'ollama',
    'codex': 'codex',
  };

  const normalized = provider.toLowerCase();
  const sdkName = providerMap[normalized];

  if (!sdkName) {
    throw new Error(`Unknown agent provider: ${provider}. Available: ${Object.keys(providerMap).join(', ')}`);
  }

  return sdkName;
}

/**
 * Get default auth configuration for an agent provider
 */
function getAgentAuthConfig(sdkName: string): Record<string, string> {
  const authConfigs: Record<string, Record<string, string>> = {
    'claude-code': {
      api_key: '${ANTHROPIC_API_KEY}',
    },
    'claude-agent': {
      api_key: '${ANTHROPIC_API_KEY}',
    },
    'github-copilot': {
      token: '${GITHUB_TOKEN}',
    },
    'opencode': {},
    'ollama': {
      base_url: '${OLLAMA_BASE_URL:-http://localhost:11434}',
    },
    'codex': {
      api_key: '${OPENAI_API_KEY}',
    },
  };

  return authConfigs[sdkName] || {};
}

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name('marktoflow')
  .description(t('cli:program.description'))
  .version(VERSION)
  .option('--locale <locale>', t('cli:program.localeOption'));

program.addCommand(workerCommand);
program.addCommand(triggerCommand);
program.addCommand(serveCommand);

// ============================================================================
// Commands
// ============================================================================

// --- init ---
program
  .command('init')
  .description(t('cli:commands.init.description'))
  .option('-f, --force', t('cli:commands.init.forceOption'))
  .action(async (options) => {
    const spinner = ora(t('cli:commands.init.spinning')).start();

    try {
      const configDir = '.marktoflow';
      const workflowsDir = join(configDir, 'workflows');
      const credentialsDir = join(configDir, 'credentials');

      if (existsSync(configDir) && !options.force) {
        spinner.fail(t('cli:commands.init.alreadyInitialized'));
        return;
      }

      // Create directories
      mkdirSync(workflowsDir, { recursive: true });
      mkdirSync(credentialsDir, { recursive: true });

      // Create example workflow
      const exampleWorkflow = `---
workflow:
  id: hello-world
  name: "Hello World"
  version: "1.0.0"
  description: "A simple example workflow"

# Uncomment and configure to use Slack:
# tools:
#   slack:
#     sdk: "@slack/web-api"
#     auth:
#       token: "\${SLACK_BOT_TOKEN}"

steps:
  - id: greet
    action: core.log
    inputs:
      message: "Hello from marktoflow!"
---

# Hello World Workflow

This is a simple example workflow.

## Step 1: Greet

Outputs a greeting message.
`;

      writeFileSync(join(workflowsDir, 'hello-world.md'), exampleWorkflow);

      // Create .gitignore for credentials
      writeFileSync(
        join(credentialsDir, '.gitignore'),
        '# Ignore all credentials\n*\n!.gitignore\n'
      );

      spinner.succeed(t('cli:commands.init.success'));

      console.log('\n' + chalk.bold(t('cli:commands.init.nextSteps')));
      console.log(`  1. ${t('cli:commands.init.nextStep1', { path: chalk.cyan('.marktoflow/workflows/hello-world.md') })}`);
      console.log(`  2. ${t('cli:commands.init.nextStep2', { cmd: chalk.cyan('marktoflow run hello-world.md') })}`);
      console.log(`  3. ${t('cli:commands.init.nextStep3', { cmd: chalk.cyan('marktoflow connect slack') })}`);
    } catch (error) {
      spinner.fail(t('cli:commands.init.failed', { error: String(error) }));
      process.exit(1);
    }
  });

// --- new ---
program
  .command('new')
  .description(t('cli:commands.new.description'))
  .option('-o, --output <path>', t('cli:commands.new.outputOption'))
  .option('-t, --template <id>', t('cli:commands.new.templateOption'))
  .option('--list-templates', t('cli:commands.new.listTemplatesOption'))
  .action(async (options) => {
    if (options.listTemplates) {
      listTemplates();
      return;
    }
    await runWorkflowWizard(options);
  });

// --- update ---
program
  .command('update [workflow]')
  .description(t('cli:commands.update.description'))
  .option('-a, --agent <id>', t('cli:commands.update.agentOption'))
  .option('-p, --prompt <text>', t('cli:commands.update.promptOption'))
  .option('--list-agents', t('cli:commands.update.listAgentsOption'))
  .action(async (workflow, options) => {
    if (options.listAgents) {
      await listAgents();
      return;
    }
    if (!workflow) {
      console.log(chalk.red('\n' + t('cli:commands.update.workflowRequired') + '\n'));
      console.log(t('cli:commands.update.usage'));
      console.log('\n' + t('cli:common.options') + ':');
      console.log('  -a, --agent <id>     ' + t('cli:commands.update.agentOption'));
      console.log('  -p, --prompt <text>  ' + t('cli:commands.update.promptOption'));
      console.log('  --list-agents        ' + t('cli:commands.update.listAgentsOption'));
      process.exit(1);
    }
    await runUpdateWizard({ workflow, ...options });
  });

// --- run ---
program
  .command('run <workflow>')
  .description(t('cli:commands.run.description'))
  .option('-i, --input <key=value...>', t('cli:commands.run.inputOption'))
  .option('-v, --verbose', t('cli:commands.run.verboseOption'))
  .option('-d, --debug', t('cli:commands.run.debugOption'))
  .option('-a, --agent <provider>', t('cli:commands.run.agentOption'))
  .option('-m, --model <name>', t('cli:commands.run.modelOption'))
  .option('--dry-run', t('cli:commands.run.dryRunOption'))
  .action(async (workflowPath, options) => {
    const spinner = ora(t('cli:commands.run.loadingWorkflow')).start();
    let stateStore: StateStore | undefined;

    try {
      const config = getConfig();
      const workflowsDir = config.workflows?.path ?? '.marktoflow/workflows';
      // Resolve workflow path
      let resolvedPath = workflowPath;
      if (!existsSync(resolvedPath)) {
        resolvedPath = join(workflowsDir, workflowPath);
      }
      if (!existsSync(resolvedPath)) {
        spinner.fail(t('cli:commands.run.workflowNotFound', { path: workflowPath }));
        process.exit(1);
      }

      // Parse workflow
      const { workflow, warnings } = await parseFile(resolvedPath);

      if (warnings.length > 0) {
        spinner.warn(t('cli:commands.run.parsedWithWarnings'));
        warnings.forEach((w) => console.log(chalk.yellow(`  - ${w}`)));
      } else {
        spinner.succeed(t('cli:commands.run.loaded', { name: workflow.metadata.name }));
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
        spinner.fail(t('cli:commands.run.missingInputs'));
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
      spinner.start(t('cli:commands.run.executing'));

      // Debug: Show execution start
      if (options.debug) {
        console.log(chalk.gray('\n🐛 Debug: Starting Workflow Execution'));
        console.log(chalk.gray(`  Workflow: ${workflow.metadata.name}`));
        console.log(chalk.gray(`  Steps to execute: ${workflow.steps.length}`));
      }

      // Track which steps we've logged to avoid duplicate output on retries
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
            // Only log step start once (not on retries)
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
              console.log(chalk.gray(`\n🐛 Debug: Step Complete - ${step.id}`));
              console.log(chalk.gray(`  Status: ${result.status}`));
              console.log(chalk.gray(`  Duration: ${result.duration}ms`));

              // Show output variable name if set
              if (step.outputVariable) {
                console.log(chalk.gray(`  Output Variable: ${step.outputVariable}`));
              }

              // Show full output in debug mode (not truncated)
              if (result.output !== undefined) {
                let outputStr: string;
                if (typeof result.output === 'string') {
                  outputStr = result.output;
                } else {
                  outputStr = JSON.stringify(result.output, null, 2);
                }

                // Split into lines and indent each line
                const lines = outputStr.split('\n');
                if (lines.length > 50) {
                  // If output is very large (>50 lines), show first 40 and last 5 lines
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
          },
        },
        stateStore
      );

      // Set workflow path for execution history
      engine.workflowPath = resolvedPath;

      const registry = new SDKRegistry();
      registerIntegrations(registry);
      registry.registerTools(workflow.tools);

      // Debug: Show registered tools
      if (options.debug) {
        console.log(chalk.gray('\n🐛 Debug: SDK Registry'));
        console.log(chalk.gray(`  Registered tools: ${Object.keys(workflow.tools).join(', ')}`));
      }

      const result = await engine.execute(workflow, inputs, registry, createSDKStepExecutor());

      if (result.status === WorkflowStatus.COMPLETED) {
        spinner.succeed(t('cli:commands.run.completed', { duration: String(result.duration) }));
      } else {
        spinner.fail(t('cli:commands.run.failed', { error: String(result.error) }));

        // Debug: Show detailed error information
        if (options.debug) {
          console.log(chalk.red('\n🐛 Debug: Failure Details'));
          console.log(chalk.red(`  Error: ${result.error}`));

          // Find the failed step
          const failedStep = result.stepResults.find(s => s.status === StepStatus.FAILED);
          if (failedStep) {
            console.log(chalk.red(`  Failed Step: ${failedStep.stepId}`));
            console.log(chalk.red(`  Step Duration: ${failedStep.duration}ms`));
            if (failedStep.error) {
              console.log(chalk.red(`  Step Error: ${failedStep.error}`));

              // Extract detailed error information
              const errorObj = typeof failedStep.error === 'object' ? failedStep.error as any : null;

              if (errorObj) {
                // HTTP error details (Axios, fetch, etc.)
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
                      const lines = responseStr.split('\n').slice(0, 20); // First 20 lines
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

                // Request details
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

                // Stack trace
                if (errorObj.stack) {
                  console.log(chalk.red('\n  Stack Trace:'));
                  const stack = errorObj.stack.split('\n').slice(0, 15); // First 15 lines
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

          // Show context from previous steps
          console.log(chalk.yellow('\n🐛 Debug: Execution Context'));
          console.log(chalk.yellow(`  Total steps executed: ${result.stepResults.length}`));
          console.log(chalk.yellow(`  Steps before failure:`));
          result.stepResults.slice(0, -1).forEach(stepResult => {
            console.log(chalk.yellow(`    - ${stepResult.stepId}: ${stepResult.status}`));
          });
        }

        process.exit(1);
      }

      // Show summary
      console.log('\n' + chalk.bold(t('cli:commands.run.summary')));
      console.log(`  ${t('cli:common.status')}: ${result.status}`);
      console.log(`  ${t('cli:common.duration')}: ${result.duration}ms`);
      console.log(`  ${t('cli:common.steps')}: ${result.stepResults.length}`);

      const completed = result.stepResults.filter((s) => s.status === StepStatus.COMPLETED).length;
      const failed = result.stepResults.filter((s) => s.status === StepStatus.FAILED).length;
      const skipped = result.stepResults.filter((s) => s.status === StepStatus.SKIPPED).length;

      console.log(`  ${t('cli:common.completed')}: ${completed}, ${t('cli:common.failed')}: ${failed}, ${t('cli:common.skipped')}: ${skipped}`);

      // Close StateStore and exit successfully to avoid hanging due to open SDK connections
      stateStore.close();
      process.exit(0);
    } catch (error) {
      spinner.fail(t('cli:commands.run.executionFailed', { error: String(error) }));

      // Debug: Show full error details with stack trace
      if (options.debug) {
        console.log(chalk.red('\n🐛 Debug: Unhandled Error Details'));
        console.log(chalk.red(`  Error Type: ${error instanceof Error ? error.constructor.name : typeof error}`));
        console.log(chalk.red(`  Error Message: ${error instanceof Error ? error.message : String(error)}`));

        if (error instanceof Error && error.stack) {
          console.log(chalk.red('\n  Stack Trace:'));
          error.stack.split('\n').forEach(line => {
            console.log(chalk.red(`    ${line}`));
          });
        }

        // Show error properties if available
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

      // Close StateStore if it was created
      stateStore?.close();
      process.exit(1);
    }
  });

// --- debug ---
program
  .command('debug <workflow>')
  .description(t('cli:commands.debug.description'))
  .option('-i, --input <key=value...>', t('cli:commands.run.inputOption'))
  .option('-b, --breakpoint <stepId...>', t('cli:commands.debug.breakpointOption'))
  .option('-a, --agent <provider>', t('cli:commands.run.agentOption'))
  .option('-m, --model <name>', t('cli:commands.run.modelOption'))
  .option('--auto-start', t('cli:commands.debug.autoStartOption'))
  .action(async (workflowPath, options) => {
    const spinner = ora(t('cli:commands.debug.loading')).start();

    try {
      const config = getConfig();
      const workflowsDir = config.workflows?.path ?? '.marktoflow/workflows';

      // Resolve workflow path
      let resolvedPath = workflowPath;
      if (!existsSync(resolvedPath)) {
        resolvedPath = join(workflowsDir, workflowPath);
      }
      if (!existsSync(resolvedPath)) {
        spinner.fail(t('cli:commands.run.workflowNotFound', { path: workflowPath }));
        process.exit(1);
      }

      // Parse workflow
      const { workflow, warnings } = await parseFile(resolvedPath);

      if (warnings.length > 0) {
        spinner.warn(t('cli:commands.run.parsedWithWarnings'));
        warnings.forEach((w) => console.log(chalk.yellow(`  - ${w}`)));
      } else {
        spinner.succeed(t('cli:commands.run.loaded', { name: workflow.metadata.name }));
      }

      // Parse and validate inputs
      const parsedInputs = parseInputPairs(options.input);
      const validation = validateAndApplyDefaults(workflow, parsedInputs);
      if (!validation.valid) {
        spinner.fail(t('cli:commands.run.missingInputs'));
        printMissingInputsError(workflow, validation.missingInputs, 'debug', workflowPath);
        process.exit(1);
      }
      const inputs = validation.inputs;

      // Override AI agent if specified
      if (options.agent) {
        const sdkName = getAgentSDKName(options.agent);
        const authConfig = getAgentAuthConfig(sdkName);
        overrideAgentInWorkflow(workflow, sdkName, authConfig);
      }

      // Override model if specified
      if (options.model) {
        overrideModelInWorkflow(workflow, options.model);
      }

      // Parse breakpoints
      const breakpoints = options.breakpoint ? parseBreakpoints(options.breakpoint) : [];

      // Setup SDK registry and executor
      const registry = new SDKRegistry();
      registerIntegrations(registry);
      registry.registerTools(workflow.tools);

      // Create debugger
      const workflowDebugger = new WorkflowDebugger(
        workflow,
        inputs,
        registry,
        createSDKStepExecutor(),
        {
          breakpoints,
          autoStart: options.autoStart,
        }
      );

      // Start debugging session
      await workflowDebugger.debug();
    } catch (error) {
      spinner.fail(t('cli:commands.debug.failed', { error: String(error) }));
      process.exit(1);
    }
  });

// --- workflow list ---
program
  .command('workflow')
  .description(t('cli:commands.workflow.description'))
  .command('list')
  .description(t('cli:commands.workflow.listDescription'))
  .action(async () => {
    const workflowsDir = getConfig().workflows?.path ?? '.marktoflow/workflows';

    if (!existsSync(workflowsDir)) {
      console.log(chalk.yellow(t('cli:commands.workflow.noWorkflowsInit')));
      return;
    }

    const { readdirSync } = await import('node:fs');
    const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.md'));

    if (files.length === 0) {
      console.log(chalk.yellow(t('cli:commands.workflow.noWorkflows')));
      return;
    }

    console.log(chalk.bold(t('cli:commands.workflow.available')));
    for (const file of files) {
      try {
        const { workflow } = await parseFile(join(workflowsDir, file));
        console.log(`  ${chalk.cyan(file)}: ${workflow.metadata.name}`);
      } catch {
        console.log(`  ${chalk.red(file)}: (invalid)`);
      }
    }
  });

// --- agent ---
const agentCmd = program.command('agent').description(t('cli:commands.agent.description'));

agentCmd
  .command('list')
  .description(t('cli:commands.agent.listDescription'))
  .action(() => {
    const capabilitiesPath = join('.marktoflow', 'agents', 'capabilities.yaml');
    const agentsFromFile: string[] = [];
    if (existsSync(capabilitiesPath)) {
      const content = readFileSync(capabilitiesPath, 'utf8');
      const data = parseYaml(content) as { agents?: Record<string, unknown> };
      agentsFromFile.push(...Object.keys(data?.agents ?? {}));
    }

    const knownAgents = ['claude-code', 'opencode', 'ollama', 'codex', 'gemini-cli'];
    const allAgents = Array.from(new Set([...agentsFromFile, ...knownAgents]));

    console.log(chalk.bold(t('cli:commands.agent.available')));
    for (const agent of allAgents) {
      const status = agentsFromFile.includes(agent)
        ? chalk.green(t('cli:commands.agent.registered'))
        : chalk.yellow(t('cli:commands.agent.notConfigured'));
      console.log(`  ${chalk.cyan(agent)}: ${status}`);
    }
  });

agentCmd
  .command('info <agent>')
  .description(t('cli:commands.agent.infoDescription'))
  .action((agent) => {
    const capabilitiesPath = join('.marktoflow', 'agents', 'capabilities.yaml');
    if (!existsSync(capabilitiesPath)) {
      console.log(chalk.yellow(t('cli:commands.agent.noCapabilities')));
      process.exit(1);
    }
    const content = readFileSync(capabilitiesPath, 'utf8');
    const data = parseYaml(content) as { agents?: Record<string, any> };
    const info = data?.agents?.[agent];
    if (!info) {
      console.log(chalk.red(t('cli:commands.agent.notFound', { agent })));
      process.exit(1);
    }
    console.log(chalk.bold(agent));
    console.log(`  Version: ${info.version ?? 'unknown'}`);
    console.log(`  Provider: ${info.provider ?? 'unknown'}`);
    const capabilities = info.capabilities ?? {};
    for (const [key, value] of Object.entries(capabilities)) {
      if (typeof value === 'object' && value) {
        for (const [subKey, subValue] of Object.entries(value)) {
          console.log(`  ${key}.${subKey}: ${String(subValue)}`);
        }
      } else {
        console.log(`  ${key}: ${String(value)}`);
      }
    }
  });

// --- tools ---
const toolsCmd = program.command('tools').description(t('cli:commands.tools.description'));
toolsCmd
  .command('list')
  .description(t('cli:commands.tools.listDescription'))
  .action(() => {
    const registryPath =
      getConfig().tools?.registryPath ?? join('.marktoflow', 'tools', 'registry.yaml');
    if (!existsSync(registryPath)) {
      console.log(chalk.yellow(t('cli:commands.tools.noRegistry')));
      return;
    }
    const registry = new ToolRegistry(registryPath);
    const tools = registry.listTools();
    if (tools.length === 0) {
      console.log(chalk.yellow(t('cli:commands.tools.noTools')));
      return;
    }
    console.log(chalk.bold(t('cli:commands.tools.registered')));
    for (const toolName of tools) {
      const definition = registry.getDefinition(toolName);
      const types = definition?.implementations.map((impl) => impl.type).join(', ') ?? '';
      console.log(`  ${chalk.cyan(toolName)} ${types ? `(${types})` : ''}`);
    }
  });

// --- credentials ---
const credentialsCmd = program.command('credentials').description(t('cli:commands.credentials.description'));

credentialsCmd
  .command('list')
  .description(t('cli:commands.credentials.listDescription'))
  .option('--state-dir <path>', t('cli:commands.credentials.stateDirOption'), join('.marktoflow', 'credentials'))
  .option('--backend <backend>', t('cli:commands.credentials.backendOption'))
  .option('--tag <tag>', t('cli:commands.credentials.tagOption'))
  .option('--show-expired', t('cli:commands.credentials.showExpiredOption'))
  .action((options) => {
    try {
      const stateDir = options.stateDir;
      const backend = (options.backend as EncryptionBackend) ?? undefined;
      const manager = createCredentialManager({ stateDir, backend });
      const credentials = manager.list(options.tag, options.showExpired);

      if (credentials.length === 0) {
        console.log(chalk.yellow(t('cli:commands.credentials.noCredentials')));
        return;
      }

      console.log(chalk.bold(t('cli:commands.credentials.count', { count: credentials.length }) + '\n'));
      for (const cred of credentials) {
        const expired = cred.expiresAt && cred.expiresAt < new Date();
        const status = expired ? chalk.red(' [EXPIRED]') : '';
        console.log(`  ${chalk.cyan(cred.name)}${status}`);
        console.log(`    Type: ${cred.credentialType}`);
        if (cred.description) {
          console.log(`    Description: ${cred.description}`);
        }
        console.log(`    Created: ${cred.createdAt.toISOString()}`);
        console.log(`    Updated: ${cred.updatedAt.toISOString()}`);
        if (cred.expiresAt) {
          console.log(`    Expires: ${cred.expiresAt.toISOString()}`);
        }
        if (cred.tags.length > 0) {
          console.log(`    Tags: ${cred.tags.join(', ')}`);
        }
        console.log();
      }
    } catch (error) {
      console.log(chalk.red(t('cli:commands.credentials.listFailed', { error: String(error) })));
      process.exit(1);
    }
  });

credentialsCmd
  .command('verify')
  .description(t('cli:commands.credentials.verifyDescription'))
  .option('--state-dir <path>', t('cli:commands.credentials.stateDirOption'), join('.marktoflow', 'credentials'))
  .option('--backend <backend>', t('cli:commands.credentials.backendOption'))
  .action((options) => {
    try {
      const stateDir = options.stateDir;
      const backend = (options.backend as EncryptionBackend) ?? undefined;

      console.log(chalk.bold(t('cli:commands.credentials.verifyTitle') + '\n'));

      // Show available backends
      const backends = getAvailableBackends();
      console.log(chalk.bold(t('cli:commands.credentials.availableBackends')));
      for (const b of backends) {
        const isDefault = b === EncryptionBackend.AES_256_GCM;
        const marker = isDefault ? chalk.green(' (default)') : '';
        const selected = (backend ?? EncryptionBackend.AES_256_GCM) === b ? chalk.cyan(' <-- selected') : '';
        console.log(`  ${chalk.cyan(b)}${marker}${selected}`);
      }
      console.log();

      // Test encrypt/decrypt round-trip
      const manager = createCredentialManager({ stateDir, backend });
      const testValue = `verify-test-${Date.now()}`;
      const testName = `__verify_test_${Date.now()}`;

      console.log(t('cli:commands.credentials.testingRoundTrip'));
      manager.set({ name: testName, value: testValue, tags: ['__test'] });
      const decrypted = manager.get(testName);

      if (decrypted === testValue) {
        console.log(chalk.green('  ' + t('cli:commands.credentials.roundTripPass')));
      } else {
        console.log(chalk.red('  ' + t('cli:commands.credentials.roundTripFail')));
        console.log(chalk.red(`    Expected: ${testValue}`));
        console.log(chalk.red(`    Got: ${decrypted}`));
        process.exit(1);
      }

      // Verify stored value is encrypted (not plain text)
      const raw = manager.get(testName, false);
      if (raw !== testValue) {
        console.log(chalk.green('  ' + t('cli:commands.credentials.encryptionPass')));
      } else {
        console.log(chalk.red('  ' + t('cli:commands.credentials.encryptionFail')));
        process.exit(1);
      }

      // Cleanup test credential
      manager.delete(testName);
      console.log(chalk.green('\n  ' + t('cli:commands.credentials.allChecksPassed')));

      // Show credential count
      const credentials = manager.list();
      console.log(`\n  Stored credentials: ${credentials.length}`);
    } catch (error) {
      console.log(chalk.red(t('cli:commands.credentials.verifyFailed', { error: String(error) })));
      process.exit(1);
    }
  });

// --- schedule ---
const scheduleCmd = program.command('schedule').description(t('cli:commands.schedule.description'));
scheduleCmd
  .command('list')
  .description(t('cli:commands.schedule.listDescription'))
  .action(() => {
    const scheduler = new Scheduler();
    const jobs = scheduler.listJobs();
    if (jobs.length === 0) {
      console.log(chalk.yellow(t('cli:commands.schedule.noScheduled')));
      console.log(t('cli:commands.schedule.addTriggerHint'));
      return;
    }
    console.log(chalk.bold(t('cli:commands.schedule.scheduled')));
    for (const job of jobs) {
      console.log(`  ${chalk.cyan(job.id)} ${job.workflowPath} (${job.schedule})`);
    }
  });

// --- bundle ---
const bundleCmd = program.command('bundle').description(t('cli:commands.bundle.description'));
bundleCmd
  .command('list [path]')
  .description(t('cli:commands.bundle.listDescription'))
  .action((path = '.') => {
    if (!existsSync(path)) {
      console.log(chalk.red(t('cli:commands.bundle.pathNotFound', { path })));
      process.exit(1);
    }
    const entries = readdirSync(path, { withFileTypes: true });
    const bundles: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(path, entry.name);
      if (isBundle(fullPath)) bundles.push(fullPath);
    }
    if (bundles.length === 0) {
      console.log(chalk.yellow(t('cli:commands.bundle.noBundles', { path })));
      return;
    }
    console.log(chalk.bold(t('cli:commands.bundle.bundles')));
    for (const bundlePath of bundles) {
      console.log(`  ${chalk.cyan(bundlePath)}`);
    }
  });

bundleCmd
  .command('info <path>')
  .description(t('cli:commands.bundle.infoDescription'))
  .action(async (path) => {
    if (!isBundle(path)) {
      console.log(chalk.red(t('cli:commands.bundle.notValid', { path })));
      process.exit(1);
    }
    const bundle = new WorkflowBundle(path);
    const workflow = await bundle.loadWorkflow();
    const tools = bundle.loadTools().listTools();
    console.log(chalk.bold(`Bundle: ${bundle.name}`));
    console.log(`  Workflow: ${workflow.metadata.name} (${workflow.metadata.id})`);
    console.log(`  Steps: ${workflow.steps.length}`);
    console.log(`  Tools: ${tools.length ? tools.join(', ') : 'none'}`);
  });

bundleCmd
  .command('validate <path>')
  .description(t('cli:commands.bundle.validateDescription'))
  .action(async (path) => {
    if (!isBundle(path)) {
      console.log(chalk.red(t('cli:commands.bundle.notValid', { path })));
      process.exit(1);
    }
    try {
      const bundle = new WorkflowBundle(path);
      await bundle.loadWorkflow();
      console.log(chalk.green(t('cli:commands.bundle.valid', { name: bundle.name })));
    } catch (error) {
      console.log(chalk.red(t('cli:commands.bundle.validationFailed', { error: String(error) })));
      process.exit(1);
    }
  });

bundleCmd
  .command('run <path>')
  .description(t('cli:commands.bundle.runDescription'))
  .option('-i, --input <key=value...>', t('cli:commands.run.inputOption'))
  .action(async (path, options) => {
    if (!isBundle(path)) {
      console.log(chalk.red(t('cli:commands.bundle.notValid', { path })));
      process.exit(1);
    }
    const bundle = new WorkflowBundle(path);
    const workflow = await bundle.loadWorkflowWithBundleTools();

    // Parse and validate inputs
    const parsedInputs = parseInputPairs(options.input);
    const validation = validateAndApplyDefaults(workflow, parsedInputs);
    if (!validation.valid) {
      printMissingInputsError(workflow, validation.missingInputs, 'bundle run', path);
      process.exit(1);
    }
    const inputs = validation.inputs;

    const engine = new WorkflowEngine();
    const registry = new SDKRegistry();
    registerIntegrations(registry);
    registry.registerTools(workflow.tools);

    const result = await engine.execute(workflow, inputs, registry, createSDKStepExecutor());
    console.log(chalk.bold(t('cli:commands.bundle.completed', { status: result.status })));
  });

// --- template ---
const templateCmd = program.command('template').description(t('cli:commands.template.description'));
templateCmd
  .command('list')
  .description(t('cli:commands.template.listDescription'))
  .action(() => {
    const registry = new TemplateRegistry();
    const templates = registry.list();
    if (!templates.length) {
      console.log(chalk.yellow(t('cli:commands.template.noTemplates')));
      return;
    }
    console.log(chalk.bold(t('cli:commands.template.templates')));
    for (const template of templates) {
      console.log(`  ${chalk.cyan(template.id)}: ${template.name}`);
    }
  });

// --- connect ---
program
  .command('connect <service>')
  .description(t('cli:commands.connect.description'))
  .option('--client-id <id>', t('cli:commands.connect.clientIdOption'))
  .option('--client-secret <secret>', t('cli:commands.connect.clientSecretOption'))
  .option('--tenant-id <tenant>', t('cli:commands.connect.tenantIdOption'))
  .option('--port <port>', t('cli:commands.connect.portOption'), '8484')
  .action(async (service, options) => {
    const serviceLower = service.toLowerCase();
    console.log(chalk.bold(`Connecting ${service}...`));

    // Services that support OAuth flow
    if (serviceLower === 'gmail') {
      const clientId = options.clientId ?? process.env.GOOGLE_CLIENT_ID;
      const clientSecret = options.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET;
      const port = parseInt(options.port, 10);

      if (!clientId || !clientSecret) {
        console.log(chalk.yellow('\nGmail OAuth requires client credentials.'));
        console.log('\nTo connect Gmail:');
        console.log('  1. Go to https://console.cloud.google.com/');
        console.log('  2. Create OAuth 2.0 credentials (Desktop app type)');
        console.log(
          '  3. Run: marktoflow connect gmail --client-id YOUR_ID --client-secret YOUR_SECRET'
        );
        console.log('\nOr set environment variables:');
        console.log('  export GOOGLE_CLIENT_ID="your-client-id"');
        console.log('  export GOOGLE_CLIENT_SECRET="your-client-secret"');
        return;
      }

      try {
        const { runGmailOAuth } = await import('./oauth.js');
        const tokens = await runGmailOAuth({ clientId, clientSecret, port });
        console.log(chalk.green('\nGmail connected successfully!'));
        console.log(
          chalk.dim(
            `Access token expires: ${tokens.expires_at ? new Date(tokens.expires_at).toISOString() : 'unknown'}`
          )
        );
        console.log('\nYou can now use Gmail in your workflows:');
        console.log(
          chalk.cyan(`  tools:
    gmail:
      sdk: "googleapis"
      auth:
        client_id: "\${GOOGLE_CLIENT_ID}"
        client_secret: "\${GOOGLE_CLIENT_SECRET}"
        redirect_uri: "http://localhost:${port}/callback"
        refresh_token: "\${GMAIL_REFRESH_TOKEN}"`)
        );
        process.exit(0);
      } catch (error) {
        console.log(chalk.red(`\nOAuth failed: ${error}`));
        process.exit(1);
      }
    }

    // Handle other Google services (Drive, Sheets, Calendar, Docs, Workspace)
    if (
      serviceLower === 'google-drive' ||
      serviceLower === 'drive' ||
      serviceLower === 'google-sheets' ||
      serviceLower === 'sheets' ||
      serviceLower === 'google-calendar' ||
      serviceLower === 'calendar' ||
      serviceLower === 'google-docs' ||
      serviceLower === 'docs' ||
      serviceLower === 'google-workspace' ||
      serviceLower === 'workspace'
    ) {
      const clientId = options.clientId ?? process.env.GOOGLE_CLIENT_ID;
      const clientSecret = options.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET;
      const port = parseInt(options.port, 10);

      if (!clientId || !clientSecret) {
        console.log(chalk.yellow('\nGoogle OAuth requires client credentials.'));
        console.log('\nTo connect Google services:');
        console.log('  1. Go to https://console.cloud.google.com/');
        console.log('  2. Enable the API for your service (Drive, Sheets, etc.)');
        console.log('  3. Create OAuth 2.0 credentials (Desktop app type)');
        console.log(
          `  4. Run: marktoflow connect ${service} --client-id YOUR_ID --client-secret YOUR_SECRET`
        );
        console.log('\nOr set environment variables:');
        console.log('  export GOOGLE_CLIENT_ID="your-client-id"');
        console.log('  export GOOGLE_CLIENT_SECRET="your-client-secret"');
        return;
      }

      try {
        const { runGoogleOAuth } = await import('./oauth.js');
        const tokens = await runGoogleOAuth(serviceLower, { clientId, clientSecret, port });
        console.log(
          chalk.dim(
            `Access token expires: ${tokens.expires_at ? new Date(tokens.expires_at).toISOString() : 'unknown'}`
          )
        );

        // Normalize service name for display
        const normalizedService = serviceLower.startsWith('google-')
          ? serviceLower
          : `google-${serviceLower}`;

        console.log('\nYou can now use this service in your workflows:');
        console.log(
          chalk.cyan(`  tools:
    ${serviceLower.replace('google-', '')}:
      sdk: "${normalizedService}"
      auth:
        client_id: "\${GOOGLE_CLIENT_ID}"
        client_secret: "\${GOOGLE_CLIENT_SECRET}"
        redirect_uri: "http://localhost:${port}/callback"
        refresh_token: "\${GOOGLE_REFRESH_TOKEN}"
        access_token: "\${GOOGLE_ACCESS_TOKEN}"`)
        );
        process.exit(0);
      } catch (error) {
        console.log(chalk.red(`\nOAuth failed: ${error}`));
        process.exit(1);
      }
    }

    if (serviceLower === 'outlook' || serviceLower === 'microsoft') {
      const clientId = options.clientId ?? process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = options.clientSecret ?? process.env.MICROSOFT_CLIENT_SECRET;
      const tenantId = options.tenantId ?? process.env.MICROSOFT_TENANT_ID;
      const port = parseInt(options.port, 10);

      if (!clientId) {
        console.log(chalk.yellow('\nOutlook OAuth requires a client ID.'));
        console.log('\nTo connect Outlook/Microsoft Graph:');
        console.log('  1. Go to https://portal.azure.com/');
        console.log('  2. Register an application in Azure AD');
        console.log(`  3. Add redirect URI: http://localhost:${port}/callback`);
        console.log('  4. Grant Mail.Read, Mail.Send, Calendars.ReadWrite permissions');
        console.log('  5. Run: marktoflow connect outlook --client-id YOUR_ID');
        console.log('\nOr set environment variables:');
        console.log('  export MICROSOFT_CLIENT_ID="your-client-id"');
        console.log('  export MICROSOFT_CLIENT_SECRET="your-client-secret"  # optional');
        console.log('  export MICROSOFT_TENANT_ID="common"  # or your tenant ID');
        return;
      }

      try {
        const { runOutlookOAuth } = await import('./oauth.js');
        const tokens = await runOutlookOAuth({ clientId, clientSecret, tenantId, port });
        console.log(chalk.green('\nOutlook connected successfully!'));
        console.log(
          chalk.dim(
            `Access token expires: ${tokens.expires_at ? new Date(tokens.expires_at).toISOString() : 'unknown'}`
          )
        );
        console.log('\nYou can now use Outlook in your workflows:');
        console.log(
          chalk.cyan(`  tools:
    outlook:
      sdk: "@microsoft/microsoft-graph-client"
      auth:
        token: "\${OUTLOOK_ACCESS_TOKEN}"`)
        );
        process.exit(0);
      } catch (error) {
        console.log(chalk.red(`\nOAuth failed: ${error}`));
        process.exit(1);
      }
    }

    // Other services - show manual setup instructions
    console.log('\nManual setup required. Set environment variables:');

    switch (serviceLower) {
      case 'slack':
        console.log(`  export SLACK_BOT_TOKEN="xoxb-your-token"`);
        console.log(`  export SLACK_APP_TOKEN="xapp-your-token"`);
        console.log(chalk.dim('\n  Get tokens from https://api.slack.com/apps'));
        break;
      case 'github':
        console.log(`  export GITHUB_TOKEN="ghp_your-token"`);
        console.log(chalk.dim('\n  Create token at https://github.com/settings/tokens'));
        break;
      case 'jira':
        console.log(`  export JIRA_HOST="https://your-domain.atlassian.net"`);
        console.log(`  export JIRA_EMAIL="your-email@example.com"`);
        console.log(`  export JIRA_API_TOKEN="your-api-token"`);
        console.log(
          chalk.dim(
            '\n  Create token at https://id.atlassian.com/manage-profile/security/api-tokens'
          )
        );
        break;
      case 'confluence':
        console.log(`  export CONFLUENCE_HOST="https://your-domain.atlassian.net"`);
        console.log(`  export CONFLUENCE_EMAIL="your-email@example.com"`);
        console.log(`  export CONFLUENCE_API_TOKEN="your-api-token"`);
        console.log(
          chalk.dim(
            '\n  Create token at https://id.atlassian.com/manage-profile/security/api-tokens'
          )
        );
        break;
      case 'linear':
        console.log(`  export LINEAR_API_KEY="lin_api_your-key"`);
        console.log(chalk.dim('\n  Create key at https://linear.app/settings/api'));
        break;
      case 'notion':
        console.log(`  export NOTION_TOKEN="secret_your-token"`);
        console.log(chalk.dim('\n  Create integration at https://www.notion.so/my-integrations'));
        break;
      case 'discord':
        console.log(`  export DISCORD_BOT_TOKEN="your-bot-token"`);
        console.log(chalk.dim('\n  Create bot at https://discord.com/developers/applications'));
        break;
      case 'airtable':
        console.log(`  export AIRTABLE_TOKEN="pat_your-token"`);
        console.log(`  export AIRTABLE_BASE_ID="appXXXXX"  # optional default base`);
        console.log(chalk.dim('\n  Create token at https://airtable.com/create/tokens'));
        break;
      case 'anthropic':
        console.log(`  export ANTHROPIC_API_KEY="sk-ant-your-key"`);
        console.log(chalk.dim('\n  Get key at https://console.anthropic.com/'));
        break;
      case 'openai':
        console.log(`  export OPENAI_API_KEY="sk-your-key"`);
        console.log(chalk.dim('\n  Get key at https://platform.openai.com/api-keys'));
        break;
      default:
        console.log(`  See documentation for ${service} configuration.`);
        console.log('\n' + chalk.bold('Available services:'));
        console.log('  Communication: slack, discord');
        console.log('  Email: gmail, outlook');
        console.log('  Google Workspace: google-drive, google-sheets, google-calendar, google-docs, google-workspace');
        console.log('  Project management: jira, linear');
        console.log('  Documentation: notion, confluence');
        console.log('  Developer: github');
        console.log('  Data: airtable');
        console.log('  AI: anthropic, openai');
    }
  });

// --- doctor ---
program
  .command('doctor')
  .description('Check environment and configuration')
  .action(async () => {
    console.log(chalk.bold('marktoflow Doctor\n'));

    // Node version
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (nodeMajor >= 20) {
      console.log(chalk.green('✓') + ` Node.js ${nodeVersion}`);
    } else {
      console.log(chalk.red('✗') + ` Node.js ${nodeVersion} (requires >=20)`);
    }

    // Project initialized
    if (existsSync('.marktoflow')) {
      console.log(chalk.green('✓') + ' Project initialized');

      // Count workflows
      const workflowsDir = '.marktoflow/workflows';
      if (existsSync(workflowsDir)) {
        const { readdirSync } = await import('node:fs');
        const workflows = readdirSync(workflowsDir).filter((f) => f.endsWith('.md'));
        console.log(chalk.green('✓') + ` ${workflows.length} workflow(s) found`);
      }
    } else {
      console.log(chalk.yellow('○') + ' Project not initialized');
    }

    // Check for common environment variables
    const envChecks: [string, string][] = [
      // Communication
      ['SLACK_BOT_TOKEN', 'Slack'],
      ['DISCORD_BOT_TOKEN', 'Discord'],
      // Email
      ['GOOGLE_CLIENT_ID', 'Gmail'],
      ['MICROSOFT_CLIENT_ID', 'Outlook'],
      // Project Management
      ['JIRA_API_TOKEN', 'Jira'],
      ['LINEAR_API_KEY', 'Linear'],
      // Documentation
      ['NOTION_TOKEN', 'Notion'],
      ['CONFLUENCE_API_TOKEN', 'Confluence'],
      // Developer
      ['GITHUB_TOKEN', 'GitHub'],
      // Data
      ['AIRTABLE_TOKEN', 'Airtable'],
      // AI
      ['ANTHROPIC_API_KEY', 'Anthropic'],
      ['OPENAI_API_KEY', 'OpenAI'],
    ];

    console.log('\n' + chalk.bold('Services:'));
    let configuredCount = 0;
    for (const [envVar, name] of envChecks) {
      if (process.env[envVar]) {
        console.log(chalk.green('✓') + ` ${name} configured`);
        configuredCount++;
      } else {
        console.log(chalk.dim('○') + ` ${name} not configured`);
      }
    }

    if (configuredCount === 0) {
      console.log(chalk.yellow('\n  Run `marktoflow connect <service>` to set up integrations'));
    }
  });

// --- test-connection ---
program
  .command('test-connection [service]')
  .description('Test service connection(s)')
  .option('-a, --all', 'Test all configured services')
  .action(async (service: string | undefined, options: { all?: boolean }) => {
    await executeTestConnection(service, options);
  });

// --- history ---
program
  .command('history [runId]')
  .description('View execution history')
  .option('-n, --limit <count>', 'Number of executions to show', '20')
  .option('-s, --status <status>', 'Filter by status (completed, failed, running)')
  .option('-w, --workflow <id>', 'Filter by workflow ID')
  .option('--step <stepId>', 'Show specific step details (requires runId)')
  .action((runId: string | undefined, options: { limit?: string; status?: string; workflow?: string; step?: string }) => {
    if (runId) {
      executeHistoryDetail(runId, { step: options.step });
    } else {
      executeHistory({
        limit: options.limit ? parseInt(options.limit, 10) : 20,
        status: options.status,
        workflow: options.workflow,
      });
    }
  });

// --- replay ---
program
  .command('replay <runId>')
  .description('Replay a previous execution with the same inputs')
  .option('--from <stepId>', 'Resume from specific step')
  .option('--dry-run', 'Preview what would be executed')
  .action(async (runId: string, options: { from?: string; dryRun?: boolean }) => {
    await executeReplay(runId, options);
  });

// --- gui ---
program
  .command('gui')
  .description('Launch visual workflow designer')
  .option('-p, --port <port>', 'Server port', '3001')
  .option('-o, --open', 'Open browser automatically')
  .option('-w, --workflow <path>', 'Open specific workflow')
  .option('-d, --dir <path>', 'Workflow directory', '.')
  .action(async (options) => {
    const spinner = ora('Starting GUI server...').start();

    try {
      // Check if @marktoflow/gui is available
      let guiModule;
      let guiPackagePath;
      try {
        guiModule = await import('@marktoflow/gui');
        // Find the GUI package location
        const { createRequire } = await import('node:module');
        const require = createRequire(import.meta.url);
        guiPackagePath = require.resolve('@marktoflow/gui');
      } catch {
        spinner.fail('@marktoflow/gui package not found');
        console.log(chalk.yellow('\nTo use the GUI, install the gui package:'));
        console.log(chalk.cyan('  npm install @marktoflow/gui@alpha'));
        console.log('\nOr run from the monorepo:');
        console.log(chalk.cyan('  pnpm --filter @marktoflow/gui dev'));
        process.exit(1);
      }

      spinner.succeed(`GUI server starting on http://localhost:${options.port}`);

      // Open browser if requested
      if (options.open) {
        const url = `http://localhost:${options.port}`;
        const { exec } = await import('node:child_process');
        const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${openCmd} ${url}`);
      }

      console.log('\n' + chalk.bold('Marktoflow GUI'));
      console.log(`  Server:    ${chalk.cyan(`http://localhost:${options.port}`)}`);
      console.log(`  Workflows: ${chalk.cyan(options.dir)}`);
      console.log('\n  Press ' + chalk.bold('Ctrl+C') + ' to stop\n');

      // Find the static files directory
      // guiPackagePath is .../node_modules/@marktoflow/gui/dist/server/index.js
      // We need to go up to the package root: dist/server -> dist -> package root
      const { dirname, join } = await import('node:path');
      const guiPackageDir = dirname(dirname(dirname(guiPackagePath)));
      const staticDir = join(guiPackageDir, 'dist', 'client');

      // The GUI package will handle the server
      if (guiModule.startServer) {
        await guiModule.startServer({
          port: parseInt(options.port, 10),
          workflowDir: options.dir,
          staticDir: staticDir,
        });
      }
    } catch (error) {
      spinner.fail(`Failed to start GUI: ${error}`);
      process.exit(1);
    }
  });

// --- version ---
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(`marktoflow v${VERSION}`);
  });

// ============================================================================
// Parse and Execute
// ============================================================================

// Initialize i18n before parsing commands
(async () => {
  try {
    await initI18n();
  } catch (error) {
    // Silently continue if i18n initialization fails
    // The fallback translations will be used
  }
  program.parse();
})();
