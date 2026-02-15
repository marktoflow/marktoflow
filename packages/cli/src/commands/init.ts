/**
 * `marktoflow init` command — Initialize a new marktoflow project.
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectAgents } from '../utils/index.js';

export interface InitOptions {
  force?: boolean;
}

export async function executeInit(options: InitOptions): Promise<void> {
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

    spinner.succeed('Project initialized successfully!');

    // Auto-detect agents
    const agents = detectAgents();
    const available = agents.filter((a) => a.available);
    if (available.length > 0) {
      console.log('\n' + chalk.bold('Detected agents:'));
      for (const agent of available) {
        const methodLabel = agent.method === 'cli' ? 'CLI' : agent.method === 'env' ? 'env' : 'server';
        console.log(`  ${chalk.green('✓')} ${agent.name} (${methodLabel})`);
      }
    }

    console.log('\n' + chalk.bold('Next steps:'));
    console.log(`  1. Edit ${chalk.cyan('.marktoflow/workflows/hello-world.md')}`);
    console.log(`  2. Run ${chalk.cyan('marktoflow run hello-world.md')}`);
    console.log(`  3. Connect services: ${chalk.cyan('marktoflow connect slack')}`);
    if (available.length === 0) {
      console.log(`  4. Set up an AI agent: ${chalk.cyan('marktoflow agent list')}`);
    }
  } catch (error) {
    spinner.fail(`Initialization failed: ${error}`);
    process.exit(1);
  }
}
