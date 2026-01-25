#!/usr/bin/env node

/**
 * marktoflow CLI
 *
 * Universal automation framework with native MCP support.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
} from '@marktoflow/core';
import { registerIntegrations } from '@marktoflow/integrations';
import { workerCommand } from './worker.js';
import { triggerCommand } from './trigger.js';
import { runWorkflowWizard, listTemplates } from './commands/new.js';
import { runUpdateWizard, listAgents } from './commands/update.js';
import { parse as parseYaml } from 'yaml';
import { executeDryRun, displayDryRunSummary } from './commands/dry-run.js';
import { WorkflowDebugger, parseBreakpoints } from './commands/debug.js';

const VERSION = '2.0.0-alpha.7';

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

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name('marktoflow')
  .description('Universal automation framework with native MCP support')
  .version(VERSION);

program.addCommand(workerCommand);
program.addCommand(triggerCommand);

// ============================================================================
// Commands
// ============================================================================

// --- init ---
program
  .command('init')
  .description('Initialize a new marktoflow project')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    const spinner = ora('Initializing marktoflow project...').start();

    try {
      const configDir = '.marktoflow';
      const workflowsDir = join(configDir, 'workflows');
      const credentialsDir = join(configDir, 'credentials');

      if (existsSync(configDir) && !options.force) {
        spinner.fail('Project already initialized. Use --force to reinitialize.');
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
    action: console.log
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

      spinner.succeed('Project initialized successfully!');

      console.log('\n' + chalk.bold('Next steps:'));
      console.log(`  1. Edit ${chalk.cyan('.marktoflow/workflows/hello-world.md')}`);
      console.log(`  2. Run ${chalk.cyan('marktoflow run hello-world.md')}`);
      console.log(`  3. Connect services: ${chalk.cyan('marktoflow connect slack')}`);
    } catch (error) {
      spinner.fail(`Initialization failed: ${error}`);
      process.exit(1);
    }
  });

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
  .option('-a, --agent <id>', 'Coding agent to use (opencode, claude-code, cursor, aider)')
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
  .option('--dry-run', 'Parse workflow without executing')
  .action(async (workflowPath, options) => {
    const spinner = ora('Loading workflow...').start();

    try {
      const config = getConfig();
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

      // Parse inputs
      const inputs: Record<string, unknown> = {};
      if (options.input) {
        for (const pair of options.input) {
          const [key, value] = pair.split('=');
          inputs[key] = value;
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

      const engine = new WorkflowEngine(
        {},
        {
          onStepStart: (step) => {
            if (options.verbose) {
              spinner.text = `Executing: ${step.id}`;
            }
          },
          onStepComplete: (step, result) => {
            if (options.verbose) {
              const icon = result.status === StepStatus.COMPLETED ? '✓' : '✗';
              console.log(`  ${icon} ${step.id}: ${result.status}`);
            }
          },
        }
      );

      const registry = new SDKRegistry();
      registerIntegrations(registry);
      registry.registerTools(workflow.tools);

      const result = await engine.execute(workflow, inputs, registry, createSDKStepExecutor());

      if (result.status === WorkflowStatus.COMPLETED) {
        spinner.succeed(`Workflow completed in ${result.duration}ms`);
      } else {
        spinner.fail(`Workflow failed: ${result.error}`);
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
    } catch (error) {
      spinner.fail(`Execution failed: ${error}`);
      process.exit(1);
    }
  });

// --- debug ---
program
  .command('debug <workflow>')
  .description('Debug a workflow with step-by-step execution')
  .option('-i, --input <key=value...>', 'Input parameters')
  .option('-b, --breakpoint <stepId...>', 'Set breakpoints at step IDs')
  .option('--auto-start', 'Start without initial prompt')
  .action(async (workflowPath, options) => {
    const spinner = ora('Loading workflow for debugging...').start();

    try {
      const config = getConfig();
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

      // Parse inputs
      const inputs: Record<string, unknown> = {};
      if (options.input) {
        for (const pair of options.input) {
          const [key, value] = pair.split('=');
          inputs[key] = value;
        }
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
  .action(async () => {
    const workflowsDir = getConfig().workflows?.path ?? '.marktoflow/workflows';

    if (!existsSync(workflowsDir)) {
      console.log(chalk.yellow('No workflows found. Run `marktoflow init` first.'));
      return;
    }

    const { readdirSync } = await import('node:fs');
    const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.md'));

    if (files.length === 0) {
      console.log(chalk.yellow('No workflows found.'));
      return;
    }

    console.log(chalk.bold('Available Workflows:'));
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
const agentCmd = program.command('agent').description('Agent management');

agentCmd
  .command('list')
  .description('List available agents')
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

    console.log(chalk.bold('Available Agents:'));
    for (const agent of allAgents) {
      const status = agentsFromFile.includes(agent)
        ? chalk.green('Registered')
        : chalk.yellow('Not configured');
      console.log(`  ${chalk.cyan(agent)}: ${status}`);
    }
  });

agentCmd
  .command('info <agent>')
  .description('Show agent information')
  .action((agent) => {
    const capabilitiesPath = join('.marktoflow', 'agents', 'capabilities.yaml');
    if (!existsSync(capabilitiesPath)) {
      console.log(chalk.yellow('No capabilities file found. Run `marktoflow init` first.'));
      process.exit(1);
    }
    const content = readFileSync(capabilitiesPath, 'utf8');
    const data = parseYaml(content) as { agents?: Record<string, any> };
    const info = data?.agents?.[agent];
    if (!info) {
      console.log(chalk.red(`Agent not found: ${agent}`));
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
const toolsCmd = program.command('tools').description('Tool management');
toolsCmd
  .command('list')
  .description('List available tools')
  .action(() => {
    const registryPath =
      getConfig().tools?.registryPath ?? join('.marktoflow', 'tools', 'registry.yaml');
    if (!existsSync(registryPath)) {
      console.log(chalk.yellow("No tool registry found. Run 'marktoflow init' first."));
      return;
    }
    const registry = new ToolRegistry(registryPath);
    const tools = registry.listTools();
    if (tools.length === 0) {
      console.log(chalk.yellow('No tools registered.'));
      return;
    }
    console.log(chalk.bold('Registered Tools:'));
    for (const toolName of tools) {
      const definition = registry.getDefinition(toolName);
      const types = definition?.implementations.map((impl) => impl.type).join(', ') ?? '';
      console.log(`  ${chalk.cyan(toolName)} ${types ? `(${types})` : ''}`);
    }
  });

// --- schedule ---
const scheduleCmd = program.command('schedule').description('Scheduler management');
scheduleCmd
  .command('list')
  .description('List scheduled workflows')
  .action(() => {
    const scheduler = new Scheduler();
    const jobs = scheduler.listJobs();
    if (jobs.length === 0) {
      console.log(chalk.yellow('No scheduled workflows found.'));
      console.log('Add schedule triggers to your workflows to enable scheduling.');
      return;
    }
    console.log(chalk.bold('Scheduled Workflows:'));
    for (const job of jobs) {
      console.log(`  ${chalk.cyan(job.id)} ${job.workflowPath} (${job.schedule})`);
    }
  });

// --- bundle ---
const bundleCmd = program.command('bundle').description('Workflow bundle commands');
bundleCmd
  .command('list [path]')
  .description('List workflow bundles in a directory')
  .action((path = '.') => {
    if (!existsSync(path)) {
      console.log(chalk.red(`Path not found: ${path}`));
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
      console.log(chalk.yellow(`No bundles found in ${path}`));
      return;
    }
    console.log(chalk.bold('Bundles:'));
    for (const bundlePath of bundles) {
      console.log(`  ${chalk.cyan(bundlePath)}`);
    }
  });

bundleCmd
  .command('info <path>')
  .description('Show information about a workflow bundle')
  .action(async (path) => {
    if (!isBundle(path)) {
      console.log(chalk.red(`Not a valid bundle: ${path}`));
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
  .description('Validate a workflow bundle')
  .action(async (path) => {
    if (!isBundle(path)) {
      console.log(chalk.red(`Not a valid bundle: ${path}`));
      process.exit(1);
    }
    try {
      const bundle = new WorkflowBundle(path);
      await bundle.loadWorkflow();
      console.log(chalk.green(`Bundle '${bundle.name}' is valid.`));
    } catch (error) {
      console.log(chalk.red(`Bundle validation failed: ${error}`));
      process.exit(1);
    }
  });

bundleCmd
  .command('run <path>')
  .description('Run a workflow bundle')
  .option('-i, --input <key=value...>', 'Input parameters')
  .action(async (path, options) => {
    if (!isBundle(path)) {
      console.log(chalk.red(`Not a valid bundle: ${path}`));
      process.exit(1);
    }
    const bundle = new WorkflowBundle(path);
    const workflow = await bundle.loadWorkflowWithBundleTools();
    const inputs: Record<string, unknown> = {};
    if (options.input) {
      for (const pair of options.input) {
        const [key, value] = pair.split('=');
        inputs[key] = value;
      }
    }

    const engine = new WorkflowEngine();
    const registry = new SDKRegistry();
    registerIntegrations(registry);
    registry.registerTools(workflow.tools);

    const result = await engine.execute(workflow, inputs, registry, createSDKStepExecutor());
    console.log(chalk.bold(`Bundle completed: ${result.status}`));
  });

// --- template ---
const templateCmd = program.command('template').description('Workflow template commands');
templateCmd
  .command('list')
  .description('List workflow templates')
  .action(() => {
    const registry = new TemplateRegistry();
    const templates = registry.list();
    if (!templates.length) {
      console.log(chalk.yellow('No templates found.'));
      return;
    }
    console.log(chalk.bold('Templates:'));
    for (const template of templates) {
      console.log(`  ${chalk.cyan(template.id)}: ${template.name}`);
    }
  });

// --- connect ---
program
  .command('connect <service>')
  .description('Connect a service (OAuth flow)')
  .option('--client-id <id>', 'OAuth client ID')
  .option('--client-secret <secret>', 'OAuth client secret')
  .option('--tenant-id <tenant>', 'Microsoft tenant ID (for Outlook)')
  .action(async (service, options) => {
    const serviceLower = service.toLowerCase();
    console.log(chalk.bold(`Connecting ${service}...`));

    // Services that support OAuth flow
    if (serviceLower === 'gmail') {
      const clientId = options.clientId ?? process.env.GOOGLE_CLIENT_ID;
      const clientSecret = options.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET;

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
        const tokens = await runGmailOAuth({ clientId, clientSecret });
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
        redirect_uri: "http://localhost:8484/callback"
        refresh_token: "\${GMAIL_REFRESH_TOKEN}"`)
        );
      } catch (error) {
        console.log(chalk.red(`\nOAuth failed: ${error}`));
        process.exit(1);
      }
      return;
    }

    if (serviceLower === 'outlook' || serviceLower === 'microsoft') {
      const clientId = options.clientId ?? process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = options.clientSecret ?? process.env.MICROSOFT_CLIENT_SECRET;
      const tenantId = options.tenantId ?? process.env.MICROSOFT_TENANT_ID;

      if (!clientId) {
        console.log(chalk.yellow('\nOutlook OAuth requires a client ID.'));
        console.log('\nTo connect Outlook/Microsoft Graph:');
        console.log('  1. Go to https://portal.azure.com/');
        console.log('  2. Register an application in Azure AD');
        console.log('  3. Add redirect URI: http://localhost:8484/callback');
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
        const tokens = await runOutlookOAuth({ clientId, clientSecret, tenantId });
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
      } catch (error) {
        console.log(chalk.red(`\nOAuth failed: ${error}`));
        process.exit(1);
      }
      return;
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
      try {
        guiModule = await import('@marktoflow/gui');
      } catch {
        spinner.fail('@marktoflow/gui package not found');
        console.log(chalk.yellow('\nTo use the GUI, install the gui package:'));
        console.log(chalk.cyan('  pnpm add @marktoflow/gui'));
        console.log('\nOr run from the monorepo:');
        console.log(chalk.cyan('  pnpm --filter @marktoflow/gui dev'));
        process.exit(1);
      }

      // Set environment variables for the server
      process.env.PORT = options.port;
      process.env.WORKFLOW_DIR = options.dir;
      if (options.workflow) {
        process.env.INITIAL_WORKFLOW = options.workflow;
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

      // The GUI package will handle the server
      if (guiModule.startServer) {
        await guiModule.startServer();
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

program.parse();
