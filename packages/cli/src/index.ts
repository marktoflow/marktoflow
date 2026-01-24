#!/usr/bin/env node

/**
 * marktoflow CLI
 *
 * Universal automation framework with native MCP support.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseFile,
  WorkflowEngine,
  SDKRegistry,
  createSDKStepExecutor,
  StepStatus,
  WorkflowStatus,
} from '@marktoflow/core';
import { registerIntegrations } from '@marktoflow/integrations';
import { workerCommand } from './worker.js';
import { triggerCommand } from './trigger.js';

const VERSION = '2.0.0-alpha.1';

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
      // Resolve workflow path
      let resolvedPath = workflowPath;
      if (!existsSync(resolvedPath)) {
        resolvedPath = join('.marktoflow', 'workflows', workflowPath);
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

      if (options.dryRun) {
        console.log('\n' + chalk.bold('Workflow Structure:'));
        console.log(`  ID: ${workflow.metadata.id}`);
        console.log(`  Steps: ${workflow.steps.length}`);
        console.log(`  Tools: ${Object.keys(workflow.tools).join(', ') || 'none'}`);
        console.log('\n' + chalk.bold('Steps:'));
        workflow.steps.forEach((step, i) => {
          console.log(`  ${i + 1}. ${step.id}: ${step.action}`);
        });
        return;
      }

      // Parse inputs
      const inputs: Record<string, unknown> = {};
      if (options.input) {
        for (const pair of options.input) {
          const [key, value] = pair.split('=');
          inputs[key] = value;
        }
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

      const result = await engine.execute(
        workflow,
        inputs,
        registry,
        createSDKStepExecutor()
      );

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

// --- workflow list ---
program
  .command('workflow')
  .description('Workflow management')
  .command('list')
  .description('List available workflows')
  .action(async () => {
    const workflowsDir = '.marktoflow/workflows';

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

// --- connect ---
program
  .command('connect <service>')
  .description('Connect a service (OAuth flow)')
  .action(async (service) => {
    console.log(chalk.bold(`Connecting ${service}...`));
    console.log(chalk.yellow('\nOAuth flow not yet implemented.'));
    console.log('\nFor now, manually set environment variables:');

    switch (service.toLowerCase()) {
      case 'slack':
        console.log(`  export SLACK_BOT_TOKEN="xoxb-your-token"`);
        console.log(`  export SLACK_APP_TOKEN="xapp-your-token"`);
        break;
      case 'github':
        console.log(`  export GITHUB_TOKEN="ghp_your-token"`);
        break;
      case 'jira':
        console.log(`  export JIRA_HOST="https://your-domain.atlassian.net"`);
        console.log(`  export JIRA_EMAIL="your-email@example.com"`);
        console.log(`  export JIRA_API_TOKEN="your-api-token"`);
        break;
      case 'anthropic':
        console.log(`  export ANTHROPIC_API_KEY="sk-ant-your-key"`);
        break;
      case 'openai':
        console.log(`  export OPENAI_API_KEY="sk-your-key"`);
        break;
      default:
        console.log(`  See documentation for ${service} configuration.`);
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
    const envChecks = [
      ['SLACK_BOT_TOKEN', 'Slack'],
      ['GITHUB_TOKEN', 'GitHub'],
      ['ANTHROPIC_API_KEY', 'Anthropic'],
      ['OPENAI_API_KEY', 'OpenAI'],
    ];

    console.log('\n' + chalk.bold('Services:'));
    for (const [envVar, name] of envChecks) {
      if (process.env[envVar]) {
        console.log(chalk.green('✓') + ` ${name} configured`);
      } else {
        console.log(chalk.dim('○') + ` ${name} not configured`);
      }
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
