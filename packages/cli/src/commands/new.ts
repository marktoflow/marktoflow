/**
 * marktoflow new - Interactive workflow wizard
 *
 * Creates new workflows from templates or from scratch with guided prompts.
 */

import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ============================================================================
// Workflow Templates
// ============================================================================

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'communication' | 'development' | 'operations' | 'custom';
  services: string[];
  generate: (answers: Record<string, unknown>) => string;
}

const templates: WorkflowTemplate[] = [
  {
    id: 'slack-notification',
    name: 'Slack Notification',
    description: 'Send notifications to Slack channels',
    category: 'communication',
    services: ['slack'],
    generate: (answers) => `---
workflow:
  id: ${answers.id}
  name: "${answers.name}"
  version: "1.0.0"
  description: "${answers.description}"

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '\${SLACK_BOT_TOKEN}'

inputs:
  channel:
    type: string
    required: true
    description: 'Target Slack channel'
  message:
    type: string
    required: true
    description: 'Message to send'

outputs:
  message_ts:
    type: string
    description: 'Message timestamp'
---

# ${answers.name}

${answers.description}

## Step 1: Send Message

\`\`\`yaml
action: slack.chat.postMessage
inputs:
  channel: "{{ inputs.channel }}"
  text: "{{ inputs.message }}"
output_variable: result
\`\`\`

## Step 2: Set Output

\`\`\`yaml
action: workflow.set_outputs
inputs:
  message_ts: "{{ result.ts }}"
\`\`\`
`,
  },
  {
    id: 'github-pr-notification',
    name: 'GitHub PR to Slack',
    description: 'Notify Slack when PR is opened/updated',
    category: 'development',
    services: ['github', 'slack'],
    generate: (answers) => `---
workflow:
  id: ${answers.id}
  name: "${answers.name}"
  version: "1.0.0"
  description: "${answers.description}"

tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: '\${GITHUB_TOKEN}'
  
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '\${SLACK_BOT_TOKEN}'

triggers:
  - type: webhook
    path: /github/pr
    methods: [POST]

inputs:
  repo_owner:
    type: string
    required: true
  repo_name:
    type: string
    required: true
  pr_number:
    type: integer
    required: true
  slack_channel:
    type: string
    default: '#dev'

outputs:
  notification_sent:
    type: boolean
---

# ${answers.name}

${answers.description}

## Step 1: Get PR Details

\`\`\`yaml
action: github.pulls.get
inputs:
  owner: "{{ inputs.repo_owner }}"
  repo: "{{ inputs.repo_name }}"
  pull_number: {{ inputs.pr_number }}
output_variable: pr
\`\`\`

## Step 2: Notify Slack

\`\`\`yaml
action: slack.chat.postMessage
inputs:
  channel: "{{ inputs.slack_channel }}"
  text: "New PR: {{ pr.title }}"
  blocks:
    - type: section
      text:
        type: mrkdwn
        text: "*<{{ pr.html_url }}|PR #{{ pr.number }}>*: {{ pr.title }}"
    - type: context
      elements:
        - type: mrkdwn
          text: "By {{ pr.user.login }} • {{ pr.additions }} additions, {{ pr.deletions }} deletions"
output_variable: notification
\`\`\`

## Step 3: Set Output

\`\`\`yaml
action: workflow.set_outputs
inputs:
  notification_sent: true
\`\`\`
`,
  },
  {
    id: 'jira-issue-tracker',
    name: 'Jira Issue Tracker',
    description: 'Create and track Jira issues from various sources',
    category: 'operations',
    services: ['jira', 'slack'],
    generate: (answers) => `---
workflow:
  id: ${answers.id}
  name: "${answers.name}"
  version: "1.0.0"
  description: "${answers.description}"

tools:
  jira:
    sdk: 'jira.js'
    auth:
      host: '\${JIRA_HOST}'
      email: '\${JIRA_EMAIL}'
      apiToken: '\${JIRA_API_TOKEN}'
  
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '\${SLACK_BOT_TOKEN}'

inputs:
  project_key:
    type: string
    required: true
    description: 'Jira project key'
  issue_summary:
    type: string
    required: true
    description: 'Issue summary'
  issue_description:
    type: string
    required: true
    description: 'Issue description'
  issue_type:
    type: string
    default: 'Task'
    description: 'Issue type'
  notify_channel:
    type: string
    default: '#ops'

outputs:
  issue_key:
    type: string
  issue_url:
    type: string
---

# ${answers.name}

${answers.description}

## Step 1: Create Jira Issue

\`\`\`yaml
action: jira.issues.createIssue
inputs:
  fields:
    project:
      key: "{{ inputs.project_key }}"
    summary: "{{ inputs.issue_summary }}"
    description: "{{ inputs.issue_description }}"
    issuetype:
      name: "{{ inputs.issue_type }}"
output_variable: jira_issue
\`\`\`

## Step 2: Notify Team

\`\`\`yaml
action: slack.chat.postMessage
inputs:
  channel: "{{ inputs.notify_channel }}"
  text: "New Jira issue created: {{ jira_issue.key }}"
  blocks:
    - type: section
      text:
        type: mrkdwn
        text: "*Jira Issue Created*\\n<{{ jira_issue.self }}|{{ jira_issue.key }}>: {{ inputs.issue_summary }}"
output_variable: notification
\`\`\`

## Step 3: Set Outputs

\`\`\`yaml
action: workflow.set_outputs
inputs:
  issue_key: "{{ jira_issue.key }}"
  issue_url: "{{ jira_issue.self }}"
\`\`\`
`,
  },
  {
    id: 'custom',
    name: 'Custom Workflow (from scratch)',
    description: 'Build a workflow from scratch with step-by-step guidance',
    category: 'custom',
    services: [],
    generate: (answers) => `---
workflow:
  id: ${answers.id}
  name: "${answers.name}"
  version: "1.0.0"
  description: "${answers.description}"

# Add your tools configuration here
tools: {}

# Define inputs your workflow accepts
inputs: {}

# Define outputs your workflow produces
outputs: {}
---

# ${answers.name}

${answers.description}

## Step 1: Add Your First Step

Replace this with your workflow steps.

\`\`\`yaml
action: your.service.method
inputs:
  # Add inputs here
output_variable: step1_result
\`\`\`
`,
  },
];

// ============================================================================
// Wizard Functions
// ============================================================================

export async function runWorkflowWizard(options: { output?: string; template?: string }) {
  console.log(chalk.bold.cyan('\n📝 marktoflow Workflow Wizard\n'));

  try {
    // Step 1: Choose template or custom
    let selectedTemplate: WorkflowTemplate;

    if (options.template) {
      const template = templates.find((t) => t.id === options.template);
      if (!template) {
        console.error(chalk.red(`Template "${options.template}" not found`));
        process.exit(1);
      }
      selectedTemplate = template;
    } else {
      const templateChoice = await select({
        message: 'Choose a workflow template:',
        choices: [
          {
            name: `${chalk.blue('Communication')}`,
            value: 'category-communication',
            disabled: true,
          },
          ...templates
            .filter((t) => t.category === 'communication')
            .map((t) => ({
              name: `  ${t.name} - ${chalk.gray(t.description)}`,
              value: t.id,
            })),
          {
            name: `${chalk.green('Development')}`,
            value: 'category-development',
            disabled: true,
          },
          ...templates
            .filter((t) => t.category === 'development')
            .map((t) => ({
              name: `  ${t.name} - ${chalk.gray(t.description)}`,
              value: t.id,
            })),
          {
            name: `${chalk.yellow('Operations')}`,
            value: 'category-operations',
            disabled: true,
          },
          ...templates
            .filter((t) => t.category === 'operations')
            .map((t) => ({
              name: `  ${t.name} - ${chalk.gray(t.description)}`,
              value: t.id,
            })),
          {
            name: `${chalk.magenta('Custom')}`,
            value: 'category-custom',
            disabled: true,
          },
          ...templates
            .filter((t) => t.category === 'custom')
            .map((t) => ({
              name: `  ${t.name} - ${chalk.gray(t.description)}`,
              value: t.id,
            })),
        ],
      });

      selectedTemplate = templates.find((t) => t.id === templateChoice)!;
    }

    console.log(chalk.cyan(`\n✨ Selected: ${selectedTemplate.name}\n`));

    // Step 2: Gather workflow information
    const workflowId = await input({
      message: 'Workflow ID (lowercase, hyphens):',
      default: selectedTemplate.id,
      validate: (value) => {
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'ID must be lowercase letters, numbers, and hyphens only';
        }
        return true;
      },
    });

    const workflowName = await input({
      message: 'Workflow name:',
      default: selectedTemplate.name,
    });

    const workflowDescription = await input({
      message: 'Description:',
      default: selectedTemplate.description,
    });

    // Step 3: Generate workflow content
    const spinner = ora('Generating workflow...').start();

    const workflowContent = selectedTemplate.generate({
      id: workflowId,
      name: workflowName,
      description: workflowDescription,
    });

    spinner.succeed('Workflow generated');

    // Step 4: Determine output path
    let outputPath: string;
    if (options.output) {
      outputPath = resolve(options.output);
    } else {
      const defaultPath = `.marktoflow/workflows/${workflowId}.md`;
      const customPath = await input({
        message: 'Output path:',
        default: defaultPath,
      });
      outputPath = resolve(customPath);
    }

    // Step 5: Create directories and write file
    const dir = join(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(outputPath)) {
      const overwrite = await confirm({
        message: `File ${outputPath} already exists. Overwrite?`,
        default: false,
      });
      if (!overwrite) {
        console.log(chalk.yellow('\nWorkflow creation cancelled'));
        return;
      }
    }

    writeFileSync(outputPath, workflowContent, 'utf-8');

    // Step 6: Show success message
    console.log(chalk.green.bold('\n✅ Workflow created successfully!\n'));
    console.log(chalk.gray(`   Path: ${outputPath}`));

    if (selectedTemplate.services.length > 0) {
      console.log(chalk.gray(`\n   Required services: ${selectedTemplate.services.join(', ')}`));
      console.log(chalk.gray(`   Make sure to set up the required environment variables\n`));
    }

    // Step 7: Show next steps
    console.log(chalk.cyan('\n📋 Next steps:\n'));
    console.log(chalk.white(`   1. Configure environment variables for required services`));
    console.log(
      chalk.white(`   2. Validate: ${chalk.cyan(`marktoflow workflow validate ${outputPath}`)}`)
    );
    console.log(chalk.white(`   3. Run: ${chalk.cyan(`marktoflow run ${outputPath}`)}\n`));
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      console.log(chalk.yellow('\nWorkflow creation cancelled'));
      return;
    }
    throw error;
  }
}

/**
 * List available workflow templates
 */
export function listTemplates() {
  console.log(chalk.bold.cyan('\n📚 Available Workflow Templates\n'));

  const byCategory = templates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, WorkflowTemplate[]>
  );

  const categoryColors = {
    communication: chalk.blue,
    development: chalk.green,
    operations: chalk.yellow,
    custom: chalk.magenta,
  };

  const categoryNames = {
    communication: 'Communication',
    development: 'Development',
    operations: 'Operations',
    custom: 'Custom',
  };

  for (const [category, templates] of Object.entries(byCategory)) {
    const color = categoryColors[category as keyof typeof categoryColors];
    const name = categoryNames[category as keyof typeof categoryNames];

    console.log(color.bold(`${name}:`));
    for (const template of templates) {
      console.log(`  ${chalk.cyan(template.id.padEnd(25))} ${chalk.gray(template.description)}`);
      if (template.services.length > 0) {
        console.log(`    ${chalk.dim('Services:')} ${template.services.join(', ')}`);
      }
    }
    console.log();
  }

  console.log(chalk.gray('Use: marktoflow new --template <id>\n'));
}
