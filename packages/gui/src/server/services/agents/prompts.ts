/**
 * Prompt Engineering Module for Workflow Modifications
 *
 * This module provides context-aware prompts for different workflow operations:
 * - Adding/removing steps
 * - Modifying step inputs
 * - Adding error handling
 * - Creating sub-workflows
 * - Adding conditions
 */

// Available service integrations with their SDK mappings
export const AVAILABLE_SERVICES = {
  slack: {
    sdk: '@slack/web-api',
    description: 'Slack messaging and workspace management',
    commonActions: [
      'chat.postMessage',
      'chat.update',
      'chat.delete',
      'conversations.list',
      'conversations.history',
      'users.list',
      'files.upload',
      'reactions.add',
    ],
  },
  github: {
    sdk: '@octokit/rest',
    description: 'GitHub repository, issues, and PR management',
    commonActions: [
      'pulls.get',
      'pulls.create',
      'pulls.list',
      'issues.create',
      'issues.update',
      'issues.list',
      'repos.getContent',
      'repos.createRelease',
    ],
  },
  jira: {
    sdk: 'jira.js',
    description: 'Jira issue and project tracking',
    commonActions: [
      'issues.createIssue',
      'issues.updateIssue',
      'issues.getIssue',
      'issues.searchJql',
      'projects.getProject',
      'transitions.transitionIssue',
    ],
  },
  gmail: {
    sdk: 'googleapis',
    description: 'Gmail email sending and management',
    commonActions: [
      'users.messages.send',
      'users.messages.list',
      'users.messages.get',
      'users.labels.list',
      'users.drafts.create',
    ],
  },
  outlook: {
    sdk: '@microsoft/microsoft-graph-client',
    description: 'Microsoft Outlook email and calendar',
    commonActions: [
      'mail.sendMail',
      'mail.listMessages',
      'calendar.createEvent',
      'calendar.listEvents',
    ],
  },
  linear: {
    sdk: '@linear/sdk',
    description: 'Linear issue tracking and project management',
    commonActions: [
      'issues.create',
      'issues.update',
      'issues.archive',
      'projects.list',
      'cycles.list',
    ],
  },
  notion: {
    sdk: '@notionhq/client',
    description: 'Notion pages and databases',
    commonActions: [
      'pages.create',
      'pages.update',
      'databases.query',
      'blocks.children.append',
    ],
  },
  discord: {
    sdk: 'discord.js',
    description: 'Discord messaging and server management',
    commonActions: [
      'channels.send',
      'channels.createWebhook',
      'guilds.members.fetch',
    ],
  },
  airtable: {
    sdk: 'airtable',
    description: 'Airtable database and records',
    commonActions: [
      'tables.list',
      'records.create',
      'records.update',
      'records.list',
    ],
  },
  confluence: {
    sdk: 'confluence.js',
    description: 'Atlassian Confluence wiki pages',
    commonActions: [
      'content.getContent',
      'content.createContent',
      'content.updateContent',
      'space.getSpaces',
    ],
  },
  http: {
    sdk: 'built-in',
    description: 'Generic HTTP requests to any API',
    commonActions: ['request', 'get', 'post', 'put', 'delete'],
  },
  claude: {
    sdk: '@anthropic-ai/sdk',
    description: 'Claude AI for text generation and analysis',
    commonActions: ['messages.create', 'completions.create'],
  },
  opencode: {
    sdk: '@anthropic-ai/claude-agent-sdk',
    description: 'OpenCode for code generation and analysis',
    commonActions: ['generate', 'analyze', 'refactor'],
  },
  ollama: {
    sdk: 'ollama',
    description: 'Local Ollama LLM for AI tasks',
    commonActions: ['generate', 'chat', 'embeddings'],
  },
  codex: {
    sdk: '@openai/codex-sdk',
    description: 'OpenAI Codex for AI-powered coding workflows',
    commonActions: [
      'chat',
      'codeModify',
      'codeAnalyze',
      'codeReview',
      'webSearch',
      'execute',
      'structured',
      'resume',
      'withImages',
    ],
  },
  copilot: {
    sdk: '@github/copilot-sdk',
    description: 'GitHub Copilot for AI code assistance',
    commonActions: [
      'chat',
      'codeReview',
      'codeModify',
      'withTools',
      'withAgents',
      'withMcp',
    ],
  },
} as const;

// Base system prompt with comprehensive context
export const BASE_SYSTEM_PROMPT = `You are an expert workflow automation assistant for Marktoflow, a markdown-based workflow automation framework.

## Your Role
Help users modify their workflows based on natural language requests. You must:
1. Understand the current workflow structure
2. Make precise modifications based on user requests
3. Explain what changes you made and why
4. Return valid YAML that can be parsed

## Workflow Structure

A workflow consists of:
- **metadata**: name, description, version, author, tags
- **inputs**: declared input variables with types and defaults
- **tools**: service SDK configurations with authentication
- **steps**: array of actions to execute

### Step Structure
\`\`\`yaml
- id: unique-step-id         # Required: kebab-case identifier
  name: "Human Readable Name" # Optional: display name
  action: service.method      # Required: SDK method to call
  inputs:                     # Required: method parameters
    param1: value
    param2: "{{ variable }}"  # Template variables
  output_variable: result_name # Optional: store output
  conditions:                 # Optional: when to run
    - "{{ previous_step.success }}"
  errorHandling:              # Optional: error handling
    action: retry             # stop | continue | retry
    maxRetries: 3
\`\`\`

### Template Variables
- Access inputs: \`{{ inputs.variable_name }}\`
- Access step outputs: \`{{ step_id.field }}\` or \`{{ output_variable.field }}\`
- JavaScript expressions: \`{{ inputs.count > 10 ? "many" : "few" }}\`

### Available Services
${Object.entries(AVAILABLE_SERVICES)
  .map(([name, info]) => `- **${name}**: ${info.description} (SDK: ${info.sdk})`)
  .join('\n')}

## Response Format

Always respond with:
1. A brief explanation (1-3 sentences) of what you changed
2. The complete modified workflow in a YAML code block

\`\`\`yaml
# Your modified workflow here
\`\`\`

## Important Guidelines
- Only make the changes requested - don't "improve" other parts
- Preserve existing step IDs unless explicitly asked to rename
- Generate unique IDs for new steps (use kebab-case)
- Ensure all YAML is valid and properly indented
- Keep the same workflow structure (don't remove required sections)
`;

// Operation-specific prompts for different modification types
export const OPERATION_PROMPTS = {
  addStep: `
## Adding Steps
When adding a new step:
1. Generate a unique, descriptive kebab-case ID (e.g., "send-slack-notification")
2. Add a human-readable name
3. Use the correct action format: service.method
4. Include all required inputs for the action
5. Consider adding an output_variable if the result will be used later
6. Place the step at a logical position in the workflow

Common step patterns:
- Notifications: slack.chat.postMessage, gmail.users.messages.send
- API calls: http.request, github.pulls.get
- Data processing: Transform data between steps
`,

  removeStep: `
## Removing Steps
When removing a step:
1. Remove the entire step block from the steps array
2. Check if other steps reference this step's output_variable
3. If references exist, either:
   - Update those references to use a different source
   - Warn the user about broken references
4. Preserve the workflow structure and other steps
`,

  modifyInputs: `
## Modifying Step Inputs
When modifying inputs:
1. Only change the specified inputs
2. Preserve other inputs unless asked to remove them
3. Use template variables for dynamic values: {{ variable }}
4. Ensure the value type matches what the action expects
5. Consider adding validation or error handling if needed
`,

  addErrorHandling: `
## Adding Error Handling
Error handling options:
- **stop**: Halt workflow execution on error (default)
- **continue**: Log error and continue to next step
- **retry**: Retry the step with backoff

Example:
\`\`\`yaml
errorHandling:
  action: retry
  maxRetries: 3
  retryDelay: 1000  # milliseconds
  fallback:
    action: slack.chat.postMessage
    inputs:
      channel: "#alerts"
      text: "Step {{ step.name }} failed: {{ error.message }}"
\`\`\`
`,

  addConditions: `
## Adding Conditions
Conditions control when a step executes. They are JavaScript-like expressions.

Examples:
\`\`\`yaml
conditions:
  - "{{ previous_step.success === true }}"
  - "{{ inputs.environment === 'production' }}"
  - "{{ pr_details.state === 'open' && pr_details.draft === false }}"
\`\`\`

Common patterns:
- Check previous step success: \`{{ step_id.success }}\`
- Check variable values: \`{{ output_var.field === 'value' }}\`
- Check input values: \`{{ inputs.flag === true }}\`
- Combine conditions: \`{{ condition1 && condition2 }}\`
`,

  createSubWorkflow: `
## Creating Sub-Workflows
A sub-workflow is referenced by path instead of an action:

\`\`\`yaml
- id: run-notification-workflow
  name: "Run Notification Workflow"
  workflowPath: "./workflows/notify.md"
  inputs:
    message: "{{ previous_step.summary }}"
    channel: "{{ inputs.notification_channel }}"
  output_variable: notification_result
\`\`\`

When creating sub-workflows:
1. Use workflowPath instead of action
2. Pass inputs that the sub-workflow expects
3. The sub-workflow's outputs are available via output_variable
`,

  addTool: `
## Adding Tool Configurations
Tools are configured with their SDK and authentication:

\`\`\`yaml
tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '\${SLACK_BOT_TOKEN}'
  github:
    sdk: '@octokit/rest'
    auth:
      token: '\${GITHUB_TOKEN}'
\`\`\`

Authentication patterns:
- Environment variables: \${ENV_VAR_NAME}
- OAuth tokens: Stored and retrieved automatically
- API keys: Configured per-tool
`,
};

/**
 * Build a context-aware prompt based on the user's request
 */
export function buildPrompt(
  userRequest: string,
  workflow: { metadata?: Record<string, unknown>; steps: unknown[]; tools?: Record<string, unknown> },
  context?: {
    selectedStepId?: string;
    recentHistory?: string[];
  }
): { systemPrompt: string; userPrompt: string } {
  // Detect the type of operation requested
  const operations = detectOperations(userRequest);

  // Build system prompt with relevant operation guides
  let systemPrompt = BASE_SYSTEM_PROMPT;
  for (const op of operations) {
    if (OPERATION_PROMPTS[op as keyof typeof OPERATION_PROMPTS]) {
      systemPrompt += '\n' + OPERATION_PROMPTS[op as keyof typeof OPERATION_PROMPTS];
    }
  }

  // Build user prompt with context
  let userPrompt = `Current workflow:\n\`\`\`yaml\n${formatWorkflow(workflow)}\n\`\`\`\n\n`;

  if (context?.selectedStepId) {
    const selectedStep = workflow.steps?.find(
      (s: any) => s.id === context.selectedStepId
    );
    if (selectedStep) {
      userPrompt += `Currently selected step: "${context.selectedStepId}"\n\n`;
    }
  }

  if (context?.recentHistory && context.recentHistory.length > 0) {
    userPrompt += `Recent changes:\n${context.recentHistory.map((h) => `- ${h}`).join('\n')}\n\n`;
  }

  userPrompt += `User request: ${userRequest}`;

  return { systemPrompt, userPrompt };
}

/**
 * Detect what type of operations the user is requesting
 */
function detectOperations(request: string): string[] {
  const lower = request.toLowerCase();
  const operations: string[] = [];

  if (lower.includes('add') && (lower.includes('step') || lower.includes('action'))) {
    operations.push('addStep');
  }
  if (lower.includes('remove') || lower.includes('delete')) {
    operations.push('removeStep');
  }
  if (lower.includes('change') || lower.includes('modify') || lower.includes('update')) {
    operations.push('modifyInputs');
  }
  if (lower.includes('error') || lower.includes('retry') || lower.includes('fallback')) {
    operations.push('addErrorHandling');
  }
  if (lower.includes('condition') || lower.includes('if') || lower.includes('when')) {
    operations.push('addConditions');
  }
  if (lower.includes('sub-workflow') || lower.includes('subworkflow') || lower.includes('nested')) {
    operations.push('createSubWorkflow');
  }
  if (lower.includes('tool') || lower.includes('sdk') || lower.includes('connect')) {
    operations.push('addTool');
  }

  // Default to addStep if no specific operation detected
  if (operations.length === 0) {
    operations.push('addStep');
  }

  return operations;
}

/**
 * Format workflow for prompt (simplified YAML)
 */
function formatWorkflow(workflow: {
  metadata?: Record<string, unknown>;
  steps: unknown[];
  tools?: Record<string, unknown>;
}): string {
  const { stringify } = require('yaml');
  return stringify(workflow, { indent: 2, lineWidth: 0 });
}

/**
 * Generate contextual suggestions based on workflow state
 */
export function generateSuggestions(
  workflow: { metadata?: Record<string, unknown>; steps: unknown[]; tools?: Record<string, unknown> },
  selectedStepId?: string
): string[] {
  const suggestions: string[] = [];
  const steps = workflow.steps || [];

  // No steps - suggest getting started
  if (steps.length === 0) {
    return [
      'Add a step to send a Slack message',
      'Add a step to fetch data from GitHub',
      'Add an HTTP request step',
      'Create a workflow that monitors a webhook',
    ];
  }

  // Check for missing error handling
  const stepsWithoutErrorHandling = steps.filter((s: any) => !s.errorHandling);
  if (stepsWithoutErrorHandling.length > 0) {
    suggestions.push('Add error handling with retries to all steps');
  }

  // Check for missing notifications
  const hasNotification = steps.some(
    (s: any) =>
      s.action?.includes('slack') ||
      s.action?.includes('gmail') ||
      s.action?.includes('discord')
  );
  if (!hasNotification) {
    suggestions.push('Add a Slack notification at the end');
  }

  // Step-specific suggestions
  if (selectedStepId) {
    const step = steps.find((s: any) => s.id === selectedStepId) as any;
    if (step) {
      if (!step.errorHandling) {
        suggestions.push(`Add retry logic to "${step.name || step.id}"`);
      }
      if (!step.conditions || step.conditions.length === 0) {
        suggestions.push(`Add a condition to "${step.name || step.id}"`);
      }
      suggestions.push(`Duplicate "${step.name || step.id}" with modifications`);
    }
  }

  // General suggestions
  if (steps.length >= 3) {
    suggestions.push('Convert these steps into a reusable sub-workflow');
  }
  suggestions.push('Add a step to log results to a database');
  suggestions.push('Add parallel execution for independent steps');

  return suggestions.slice(0, 5);
}
