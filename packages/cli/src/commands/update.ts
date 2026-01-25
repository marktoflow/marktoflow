/**
 * marktoflow update - AI-powered workflow updater
 *
 * Allows users to describe how they want to update a workflow,
 * and uses a coding agent to automatically update the workflow markdown file.
 */

import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// ============================================================================
// Available Coding Agents
// ============================================================================

interface CodingAgent {
  id: string;
  name: string;
  command: string;
  available: boolean;
}

/**
 * Check if a command is available in PATH
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn('which', [command], { stdio: 'ignore' });
    process.on('close', (code) => resolve(code === 0));
    process.on('error', () => resolve(false));
  });
}

/**
 * Detect available coding agents on the system
 */
async function detectAvailableAgents(): Promise<CodingAgent[]> {
  const agents: CodingAgent[] = [
    {
      id: 'opencode',
      name: 'OpenCode',
      command: 'opencode',
      available: false,
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      command: 'claude-code',
      available: false,
    },
    {
      id: 'cursor',
      name: 'Cursor',
      command: 'cursor',
      available: false,
    },
    {
      id: 'aider',
      name: 'Aider',
      command: 'aider',
      available: false,
    },
  ];

  // Check availability of each agent
  await Promise.all(
    agents.map(async (agent) => {
      agent.available = await isCommandAvailable(agent.command);
    })
  );

  return agents;
}

// ============================================================================
// Workflow Update Logic
// ============================================================================

interface UpdateOptions {
  workflow: string;
  agent?: string;
  prompt?: string;
}

/**
 * Execute the workflow update with a coding agent
 */
async function executeUpdate(
  workflowPath: string,
  updatePrompt: string,
  agent: CodingAgent
): Promise<boolean> {
  return new Promise((resolve) => {
    const spinner = ora(`Running ${agent.name} to update workflow...`).start();

    // Build the command based on the agent
    let args: string[];
    switch (agent.id) {
      case 'opencode':
        // OpenCode: Pass the prompt and file
        args = [
          'Update the following workflow file based on this request:',
          updatePrompt,
          '--files',
          workflowPath,
        ];
        break;

      case 'claude-code':
        // Claude Code: Pass prompt with file context
        args = ['--file', workflowPath, '--prompt', `Update this workflow: ${updatePrompt}`];
        break;

      case 'cursor':
        // Cursor: Open file with instruction
        args = [workflowPath, '--instruction', updatePrompt];
        break;

      case 'aider':
        // Aider: Add file and send message
        args = ['--file', workflowPath, '--message', `Update workflow: ${updatePrompt}`];
        break;

      default:
        spinner.fail(`Unknown agent: ${agent.id}`);
        resolve(false);
        return;
    }

    // Execute the agent
    const process = spawn(agent.command, args, {
      stdio: 'inherit',
      shell: true,
    });

    process.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(`${agent.name} completed successfully`);
        resolve(true);
      } else {
        spinner.fail(`${agent.name} failed with code ${code}`);
        resolve(false);
      }
    });

    process.on('error', (error) => {
      spinner.fail(`Failed to run ${agent.name}: ${error.message}`);
      resolve(false);
    });
  });
}

/**
 * Main workflow update wizard
 */
export async function runUpdateWizard(options: UpdateOptions) {
  console.log(chalk.bold.cyan('\n🔄 marktoflow Workflow Updater\n'));

  try {
    // Step 1: Validate workflow path
    const workflowPath = resolve(options.workflow);
    if (!existsSync(workflowPath)) {
      console.error(chalk.red(`\n❌ Workflow not found: ${workflowPath}\n`));
      process.exit(1);
    }

    console.log(chalk.gray(`   Workflow: ${workflowPath}\n`));

    // Step 2: Read current workflow content
    const currentContent = readFileSync(workflowPath, 'utf-8');
    const lines = currentContent.split('\n');
    const previewLines = Math.min(10, lines.length);

    console.log(chalk.cyan('Current workflow preview:'));
    console.log(chalk.gray('─'.repeat(60)));
    for (let i = 0; i < previewLines; i++) {
      console.log(chalk.gray(`${String(i + 1).padStart(3)}│ ${lines[i]}`));
    }
    if (lines.length > previewLines) {
      console.log(chalk.gray(`   │ ... (${lines.length - previewLines} more lines)`));
    }
    console.log(chalk.gray('─'.repeat(60) + '\n'));

    // Step 3: Get update description from user
    let updatePrompt: string;
    if (options.prompt) {
      updatePrompt = options.prompt;
      console.log(chalk.cyan('Update request:'));
      console.log(chalk.white(`   ${updatePrompt}\n`));
    } else {
      updatePrompt = await input({
        message: 'Describe how you want to update this workflow:',
        validate: (value) => {
          if (!value || value.trim().length < 10) {
            return 'Please provide a more detailed description (at least 10 characters)';
          }
          return true;
        },
      });
    }

    // Step 4: Detect available coding agents
    const spinner = ora('Detecting available coding agents...').start();
    const availableAgents = await detectAvailableAgents();
    const usableAgents = availableAgents.filter((a) => a.available);

    if (usableAgents.length === 0) {
      spinner.fail('No coding agents found');
      console.log(chalk.yellow('\n⚠️  No supported coding agents detected on your system.\n'));
      console.log(chalk.white('Supported agents:'));
      console.log(chalk.gray('  • OpenCode  (https://opencode.ai)'));
      console.log(chalk.gray('  • Claude Code'));
      console.log(chalk.gray('  • Cursor    (https://cursor.sh)'));
      console.log(chalk.gray('  • Aider     (https://aider.chat)\n'));
      console.log(chalk.white('Please install one of these agents and try again.\n'));
      process.exit(1);
    }

    spinner.succeed(
      `Found ${usableAgents.length} available agent${usableAgents.length > 1 ? 's' : ''}`
    );

    // Step 5: Select coding agent
    let selectedAgent: CodingAgent;
    if (options.agent) {
      const agent = usableAgents.find((a) => a.id === options.agent);
      if (!agent) {
        console.error(chalk.red(`\n❌ Agent "${options.agent}" not found or not available\n`));
        console.log(chalk.white('Available agents:'));
        usableAgents.forEach((a) => console.log(chalk.gray(`  • ${a.id} (${a.name})`)));
        console.log();
        process.exit(1);
      }
      selectedAgent = agent;
      console.log(chalk.cyan(`\n✨ Using agent: ${selectedAgent.name}\n`));
    } else {
      const agentChoice = await select({
        message: 'Select a coding agent to perform the update:',
        choices: usableAgents.map((agent) => ({
          name: `${agent.name} (${agent.command})`,
          value: agent.id,
        })),
      });
      selectedAgent = usableAgents.find((a) => a.id === agentChoice)!;
    }

    // Step 6: Confirm before execution
    const confirmed = await confirm({
      message: `Proceed with updating ${workflowPath} using ${selectedAgent.name}?`,
      default: true,
    });

    if (!confirmed) {
      console.log(chalk.yellow('\n❌ Update cancelled\n'));
      return;
    }

    // Step 7: Backup the original file
    const backupPath = `${workflowPath}.backup`;
    writeFileSync(backupPath, currentContent, 'utf-8');
    console.log(chalk.gray(`\n   Backup created: ${backupPath}`));

    // Step 8: Execute the update
    console.log();
    const success = await executeUpdate(workflowPath, updatePrompt, selectedAgent);

    if (success) {
      console.log(chalk.green.bold('\n✅ Workflow updated successfully!\n'));
      console.log(chalk.gray(`   Updated: ${workflowPath}`));
      console.log(chalk.gray(`   Backup:  ${backupPath}\n`));

      // Show next steps
      console.log(chalk.cyan('📋 Next steps:\n'));
      console.log(
        chalk.white(`   1. Review changes: ${chalk.cyan(`diff ${backupPath} ${workflowPath}`)}`)
      );
      console.log(
        chalk.white(`   2. Test workflow: ${chalk.cyan(`marktoflow run ${workflowPath}`)}`)
      );
      console.log(chalk.white(`   3. Remove backup: ${chalk.cyan(`rm ${backupPath}`)}\n`));
    } else {
      console.log(chalk.red.bold('\n❌ Workflow update failed\n'));
      console.log(chalk.white(`   Original preserved at: ${backupPath}\n`));
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      console.log(chalk.yellow('\n❌ Update cancelled\n'));
      return;
    }
    throw error;
  }
}

/**
 * List available coding agents
 */
export async function listAgents() {
  console.log(chalk.bold.cyan('\n🤖 Coding Agents\n'));

  const spinner = ora('Detecting agents...').start();
  const agents = await detectAvailableAgents();
  spinner.stop();

  const available = agents.filter((a) => a.available);
  const unavailable = agents.filter((a) => !a.available);

  if (available.length > 0) {
    console.log(chalk.green.bold('Available:\n'));
    available.forEach((agent) => {
      console.log(
        `  ${chalk.green('✓')} ${chalk.cyan(agent.id.padEnd(15))} ${chalk.gray(agent.name)}`
      );
      console.log(`    ${chalk.dim('Command:')} ${agent.command}`);
    });
    console.log();
  }

  if (unavailable.length > 0) {
    console.log(chalk.gray.bold('Not Available:\n'));
    unavailable.forEach((agent) => {
      console.log(
        `  ${chalk.gray('○')} ${chalk.gray(agent.id.padEnd(15))} ${chalk.gray(agent.name)}`
      );
      console.log(`    ${chalk.dim('Command:')} ${agent.command}`);
    });
    console.log();
  }

  console.log(chalk.gray('Use: marktoflow update <workflow> [--agent <id>]\n'));
}
