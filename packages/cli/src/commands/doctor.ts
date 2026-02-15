/**
 * `marktoflow doctor` command — Check environment and configuration.
 */

import chalk from 'chalk';
import { existsSync, readdirSync } from 'node:fs';

export async function executeDoctor(): Promise<void> {
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
      const workflows = readdirSync(workflowsDir).filter((f) => f.endsWith('.md'));
      console.log(chalk.green('✓') + ` ${workflows.length} workflow(s) found`);
    }
  } else {
    console.log(chalk.yellow('○') + ' Project not initialized');
  }

  // Check for common environment variables
  const envChecks: [string, string][] = [
    ['SLACK_BOT_TOKEN', 'Slack'],
    ['DISCORD_BOT_TOKEN', 'Discord'],
    ['GOOGLE_CLIENT_ID', 'Gmail'],
    ['MICROSOFT_CLIENT_ID', 'Outlook'],
    ['JIRA_API_TOKEN', 'Jira'],
    ['LINEAR_API_KEY', 'Linear'],
    ['NOTION_TOKEN', 'Notion'],
    ['CONFLUENCE_API_TOKEN', 'Confluence'],
    ['GITHUB_TOKEN', 'GitHub'],
    ['AIRTABLE_TOKEN', 'Airtable'],
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
}
