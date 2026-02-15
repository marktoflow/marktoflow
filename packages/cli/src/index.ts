#!/usr/bin/env node

/**
 * marktoflow CLI
 *
 * Agent automation framework with native MCP support.
 * This file is the thin routing layer — all command logic lives in ./commands/.
 */

import { Command } from 'commander';
import { join } from 'node:path';
import { loadEnv } from '@marktoflow/core';
import { workerCommand } from './worker.js';
import { triggerCommand } from './trigger.js';
import { serveCommand } from './serve.js';

// Commands
import { executeInit } from './commands/init.js';
import { runWorkflowWizard, listTemplates } from './commands/new.js';
import { runUpdateWizard, listAgents } from './commands/update.js';
import { executeRun } from './commands/run.js';
import { executeWorkflowList } from './commands/workflow.js';
import { executeAgentList, executeAgentInfo } from './commands/agent.js';
import { executeToolsList } from './commands/tools.js';
import { executeCredentialsList, executeCredentialsVerify } from './commands/credentials.js';
import { executeScheduleList } from './commands/schedule.js';
import { executeBundleList, executeBundleInfo, executeBundleValidate, executeBundleRun } from './commands/bundle.js';
import { executeTemplateList } from './commands/template.js';
import { executeConnect } from './commands/connect.js';
import { executeDoctor } from './commands/doctor.js';
import { executeGui } from './commands/gui.js';
import { WorkflowDebugger, parseBreakpoints } from './commands/debug.js';
import { executeTestConnection } from './commands/test-connection.js';
import { executeHistory, executeHistoryDetail, executeReplay } from './commands/history.js';

// Utils used by debug command
import {
  parseInputPairs,
  validateAndApplyDefaults,
  printMissingInputsError,
  overrideAgentInWorkflow,
  overrideModelInWorkflow,
  getAgentSDKName,
  getAgentAuthConfig,
} from './utils/index.js';

import {
  parseFile,
  SDKRegistry,
  createSDKStepExecutor,
  loadConfig,
} from '@marktoflow/core';
import { registerIntegrations } from '@marktoflow/integrations';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import ora from 'ora';

const VERSION = '2.0.2';

// Load environment variables from .env files on CLI startup
loadEnv();

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name('marktoflow')
  .description('Agent automation framework with native MCP support')
  .version(VERSION);

program.addCommand(workerCommand);
program.addCommand(triggerCommand);
program.addCommand(serveCommand);

// ============================================================================
// Commands
// ============================================================================

// --- init ---
program
  .command('init')
  .description('Initialize a new marktoflow project')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => executeInit(options));

// --- new ---
program
  .command('new')
  .description('Create a new workflow from template')
  .option('-o, --output <path>', 'Output file path')
  .option('-t, --template <id>', 'Template ID to use')
  .option('--list-templates', 'List available templates')
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
  .description('Update a workflow using AI coding agents')
  .option('-a, --agent <id>', 'Coding agent to use (opencode, claude-agent, openai, ollama)')
  .option('-p, --prompt <text>', 'Update description')
  .option('--list-agents', 'List available coding agents')
  .action(async (workflow, options) => {
    if (options.listAgents) {
      await listAgents();
      return;
    }
    if (!workflow) {
      console.log(chalk.red('\n❌ Error: workflow argument is required\n'));
      console.log('Usage: marktoflow update <workflow> [options]');
      console.log('\nOptions:');
      console.log('  -a, --agent <id>     Coding agent to use');
      console.log('  -p, --prompt <text>  Update description');
      console.log('  --list-agents        List available coding agents');
      process.exit(1);
    }
    await runUpdateWizard({ workflow, ...options });
  });

// --- run ---
program
  .command('run <workflow>')
  .description('Run a workflow')
  .option('-i, --input <key=value...>', 'Input parameters')
  .option('-v, --verbose', 'Verbose output')
  .option('-d, --debug', 'Debug mode with detailed output (includes stack traces)')
  .option('-a, --agent <provider>', 'AI agent provider (claude-agent, openai, github-copilot, opencode, ollama, codex)')
  .option('-m, --model <name>', 'Model name to use (e.g., claude-sonnet-4, gpt-4, etc.)')
  .option('--dry-run', 'Parse workflow without executing')
  .action(async (workflowPath, options) => executeRun(workflowPath, options));

// --- debug ---
program
  .command('debug <workflow>')
  .description('Debug a workflow with step-by-step execution')
  .option('-i, --input <key=value...>', 'Input parameters')
  .option('-b, --breakpoint <stepId...>', 'Set breakpoints at step IDs')
  .option('-a, --agent <provider>', 'AI agent provider (claude-agent, openai, github-copilot, opencode, ollama, codex)')
  .option('-m, --model <name>', 'Model name to use (e.g., claude-sonnet-4, gpt-4, etc.)')
  .option('--auto-start', 'Start without initial prompt')
  .action(async (workflowPath, options) => {
    const spinner = ora('Loading workflow for debugging...').start();

    try {
      const config = loadConfig(process.cwd());
      const workflowsDir = config.workflows?.path ?? '.marktoflow/workflows';

      let resolvedPath = workflowPath;
      if (!existsSync(resolvedPath)) {
        resolvedPath = join(workflowsDir, workflowPath);
      }
      if (!existsSync(resolvedPath)) {
        spinner.fail(`Workflow not found: ${workflowPath}`);
        process.exit(1);
      }

      const { workflow, warnings } = await parseFile(resolvedPath);

      if (warnings.length > 0) {
        spinner.warn('Workflow parsed with warnings:');
        warnings.forEach((w) => console.log(chalk.yellow(`  - ${w}`)));
      } else {
        spinner.succeed(`Loaded: ${workflow.metadata.name}`);
      }

      const parsedInputs = parseInputPairs(options.input);
      const validation = validateAndApplyDefaults(workflow, parsedInputs);
      if (!validation.valid) {
        spinner.fail('Missing required inputs');
        printMissingInputsError(workflow, validation.missingInputs, 'debug', workflowPath);
        process.exit(1);
      }
      const inputs = validation.inputs;

      if (options.agent) {
        const sdkName = getAgentSDKName(options.agent);
        const authConfig = getAgentAuthConfig(sdkName);
        overrideAgentInWorkflow(workflow, sdkName, authConfig);
      }

      if (options.model) {
        overrideModelInWorkflow(workflow, options.model);
      }

      const breakpoints = options.breakpoint ? parseBreakpoints(options.breakpoint) : [];

      const registry = new SDKRegistry();
      registerIntegrations(registry);
      registry.registerTools(workflow.tools);

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

      await workflowDebugger.debug();
    } catch (error) {
      spinner.fail(`Debug session failed: ${error}`);
      process.exit(1);
    }
  });

// --- workflow list ---
program
  .command('workflow')
  .description('Workflow management')
  .command('list')
  .description('List available workflows')
  .action(async () => executeWorkflowList());

// --- agent ---
const agentCmd = program.command('agent').description('Agent management');

agentCmd
  .command('list')
  .description('List available agents')
  .action(() => executeAgentList());

agentCmd
  .command('info <agent>')
  .description('Show agent information')
  .action((agentId) => executeAgentInfo(agentId));

// --- tools ---
const toolsCmd = program.command('tools').description('Tool management');
toolsCmd
  .command('list')
  .description('List available tools')
  .action(() => executeToolsList());

// --- credentials ---
const credentialsCmd = program.command('credentials').description('Credential management');

credentialsCmd
  .command('list')
  .description('List stored credentials')
  .option('--state-dir <path>', 'State directory', join('.marktoflow', 'credentials'))
  .option('--backend <backend>', 'Encryption backend (aes-256-gcm, fernet, age, gpg)')
  .option('--tag <tag>', 'Filter by tag')
  .option('--show-expired', 'Include expired credentials')
  .action((options) => executeCredentialsList(options));

credentialsCmd
  .command('verify')
  .description('Verify credential encryption is working')
  .option('--state-dir <path>', 'State directory', join('.marktoflow', 'credentials'))
  .option('--backend <backend>', 'Encryption backend (aes-256-gcm, fernet, age, gpg)')
  .action((options) => executeCredentialsVerify(options));

// --- schedule ---
const scheduleCmd = program.command('schedule').description('Scheduler management');
scheduleCmd
  .command('list')
  .description('List scheduled workflows')
  .action(() => executeScheduleList());

// --- bundle ---
const bundleCmd = program.command('bundle').description('Workflow bundle commands');
bundleCmd
  .command('list [path]')
  .description('List workflow bundles in a directory')
  .action((path) => executeBundleList(path));

bundleCmd
  .command('info <path>')
  .description('Show information about a workflow bundle')
  .action(async (path) => executeBundleInfo(path));

bundleCmd
  .command('validate <path>')
  .description('Validate a workflow bundle')
  .action(async (path) => executeBundleValidate(path));

bundleCmd
  .command('run <path>')
  .description('Run a workflow bundle')
  .option('-i, --input <key=value...>', 'Input parameters')
  .action(async (path, options) => executeBundleRun(path, options));

// --- template ---
const templateCmd = program.command('template').description('Workflow template commands');
templateCmd
  .command('list')
  .description('List workflow templates')
  .action(() => executeTemplateList());

// --- connect ---
program
  .command('connect <service>')
  .description('Connect a service (OAuth flow)')
  .option('--client-id <id>', 'OAuth client ID')
  .option('--client-secret <secret>', 'OAuth client secret')
  .option('--tenant-id <tenant>', 'Microsoft tenant ID (for Outlook)')
  .option('--port <port>', 'Port for OAuth callback server (default: 8484)', '8484')
  .action(async (service, options) => executeConnect(service, options));

// --- doctor ---
program
  .command('doctor')
  .description('Check environment and configuration')
  .action(async () => executeDoctor());

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
  .action(async (options) => executeGui(options));

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

program.parse();
