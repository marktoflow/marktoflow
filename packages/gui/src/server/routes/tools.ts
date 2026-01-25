import { Router, type Router as RouterType } from 'express';

const router: RouterType = Router();

// Tool definitions with SDK information and available actions
export interface ToolDefinition {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  sdk?: string;
  actions: ActionDefinition[];
  authType?: 'token' | 'oauth' | 'api_key' | 'basic';
  docsUrl?: string;
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  inputs?: InputSchema[];
  output?: OutputSchema;
}

export interface InputSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: unknown;
}

export interface OutputSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
}

// Built-in tools with their schemas
const tools: ToolDefinition[] = [
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    category: 'Communication',
    description: 'Send messages and manage Slack workspaces',
    sdk: '@slack/web-api',
    authType: 'token',
    docsUrl: 'https://api.slack.com/methods',
    actions: [
      {
        id: 'chat.postMessage',
        name: 'Post Message',
        description: 'Send a message to a channel',
        inputs: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID or name (e.g., #general)' },
          { name: 'text', type: 'string', required: true, description: 'Message text' },
          { name: 'blocks', type: 'array', required: false, description: 'Block Kit message blocks' },
          { name: 'thread_ts', type: 'string', required: false, description: 'Thread timestamp for replies' },
        ],
        output: { type: 'object', description: 'Message response with ts (timestamp)' },
      },
      {
        id: 'conversations.list',
        name: 'List Channels',
        description: 'Get a list of channels in the workspace',
        inputs: [
          { name: 'types', type: 'string', required: false, description: 'Channel types (public_channel, private_channel)', default: 'public_channel' },
          { name: 'limit', type: 'number', required: false, description: 'Number of channels to return', default: 100 },
        ],
        output: { type: 'array', description: 'List of channel objects' },
      },
      {
        id: 'conversations.history',
        name: 'Get Messages',
        description: 'Get messages from a channel',
        inputs: [
          { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
          { name: 'limit', type: 'number', required: false, description: 'Number of messages', default: 100 },
        ],
        output: { type: 'array', description: 'List of messages' },
      },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    category: 'Development',
    description: 'Manage repositories, issues, and pull requests',
    sdk: '@octokit/rest',
    authType: 'token',
    docsUrl: 'https://docs.github.com/en/rest',
    actions: [
      {
        id: 'pulls.get',
        name: 'Get Pull Request',
        description: 'Get details of a pull request',
        inputs: [
          { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
          { name: 'repo', type: 'string', required: true, description: 'Repository name' },
          { name: 'pull_number', type: 'number', required: true, description: 'PR number' },
        ],
        output: { type: 'object', description: 'Pull request details' },
      },
      {
        id: 'pulls.listFiles',
        name: 'List PR Files',
        description: 'List files changed in a pull request',
        inputs: [
          { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
          { name: 'repo', type: 'string', required: true, description: 'Repository name' },
          { name: 'pull_number', type: 'number', required: true, description: 'PR number' },
        ],
        output: { type: 'array', description: 'List of changed files' },
      },
      {
        id: 'pulls.createReview',
        name: 'Create Review',
        description: 'Create a review on a pull request',
        inputs: [
          { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
          { name: 'repo', type: 'string', required: true, description: 'Repository name' },
          { name: 'pull_number', type: 'number', required: true, description: 'PR number' },
          { name: 'body', type: 'string', required: false, description: 'Review comment' },
          { name: 'event', type: 'string', required: true, description: 'Review action (APPROVE, REQUEST_CHANGES, COMMENT)' },
        ],
        output: { type: 'object', description: 'Review details' },
      },
      {
        id: 'issues.create',
        name: 'Create Issue',
        description: 'Create a new issue',
        inputs: [
          { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
          { name: 'repo', type: 'string', required: true, description: 'Repository name' },
          { name: 'title', type: 'string', required: true, description: 'Issue title' },
          { name: 'body', type: 'string', required: false, description: 'Issue body' },
          { name: 'labels', type: 'array', required: false, description: 'Labels to add' },
        ],
        output: { type: 'object', description: 'Created issue' },
      },
    ],
  },
  {
    id: 'jira',
    name: 'Jira',
    icon: '📋',
    category: 'Project Management',
    description: 'Manage Jira issues and projects',
    sdk: 'jira.js',
    authType: 'basic',
    docsUrl: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
    actions: [
      {
        id: 'issues.search',
        name: 'Search Issues',
        description: 'Search for issues using JQL',
        inputs: [
          { name: 'jql', type: 'string', required: true, description: 'JQL query string' },
          { name: 'maxResults', type: 'number', required: false, description: 'Maximum results', default: 50 },
        ],
        output: { type: 'array', description: 'List of issues' },
      },
      {
        id: 'issues.create',
        name: 'Create Issue',
        description: 'Create a new Jira issue',
        inputs: [
          { name: 'project', type: 'string', required: true, description: 'Project key' },
          { name: 'summary', type: 'string', required: true, description: 'Issue summary' },
          { name: 'issueType', type: 'string', required: true, description: 'Issue type (Bug, Task, Story)' },
          { name: 'description', type: 'string', required: false, description: 'Issue description' },
        ],
        output: { type: 'object', description: 'Created issue' },
      },
      {
        id: 'issues.transition',
        name: 'Transition Issue',
        description: 'Move issue to a different status',
        inputs: [
          { name: 'issueKey', type: 'string', required: true, description: 'Issue key (e.g., PROJ-123)' },
          { name: 'transition', type: 'string', required: true, description: 'Transition name or ID' },
        ],
        output: { type: 'object', description: 'Transition result' },
      },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    category: 'Communication',
    description: 'Send and manage emails via Gmail',
    sdk: 'googleapis',
    authType: 'oauth',
    docsUrl: 'https://developers.google.com/gmail/api',
    actions: [
      {
        id: 'messages.send',
        name: 'Send Email',
        description: 'Send an email',
        inputs: [
          { name: 'to', type: 'string', required: true, description: 'Recipient email' },
          { name: 'subject', type: 'string', required: true, description: 'Email subject' },
          { name: 'body', type: 'string', required: true, description: 'Email body (HTML or plain text)' },
          { name: 'cc', type: 'string', required: false, description: 'CC recipients' },
        ],
        output: { type: 'object', description: 'Sent message details' },
      },
      {
        id: 'messages.list',
        name: 'List Emails',
        description: 'List emails matching a query',
        inputs: [
          { name: 'query', type: 'string', required: false, description: 'Gmail search query' },
          { name: 'maxResults', type: 'number', required: false, description: 'Maximum results', default: 10 },
        ],
        output: { type: 'array', description: 'List of message IDs' },
      },
    ],
  },
  {
    id: 'linear',
    name: 'Linear',
    icon: '📐',
    category: 'Project Management',
    description: 'Manage Linear issues and projects',
    sdk: '@linear/sdk',
    authType: 'api_key',
    docsUrl: 'https://developers.linear.app/docs',
    actions: [
      {
        id: 'issues.create',
        name: 'Create Issue',
        description: 'Create a new Linear issue',
        inputs: [
          { name: 'teamId', type: 'string', required: true, description: 'Team ID' },
          { name: 'title', type: 'string', required: true, description: 'Issue title' },
          { name: 'description', type: 'string', required: false, description: 'Issue description' },
          { name: 'priority', type: 'number', required: false, description: 'Priority (0-4)' },
        ],
        output: { type: 'object', description: 'Created issue' },
      },
      {
        id: 'issues.list',
        name: 'List Issues',
        description: 'List issues with filters',
        inputs: [
          { name: 'teamId', type: 'string', required: false, description: 'Filter by team' },
          { name: 'state', type: 'string', required: false, description: 'Filter by state' },
        ],
        output: { type: 'array', description: 'List of issues' },
      },
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: '📝',
    category: 'Documentation',
    description: 'Manage Notion pages and databases',
    sdk: '@notionhq/client',
    authType: 'token',
    docsUrl: 'https://developers.notion.com/',
    actions: [
      {
        id: 'pages.create',
        name: 'Create Page',
        description: 'Create a new Notion page',
        inputs: [
          { name: 'parent', type: 'object', required: true, description: 'Parent page or database' },
          { name: 'properties', type: 'object', required: true, description: 'Page properties' },
          { name: 'children', type: 'array', required: false, description: 'Page content blocks' },
        ],
        output: { type: 'object', description: 'Created page' },
      },
      {
        id: 'databases.query',
        name: 'Query Database',
        description: 'Query a Notion database',
        inputs: [
          { name: 'database_id', type: 'string', required: true, description: 'Database ID' },
          { name: 'filter', type: 'object', required: false, description: 'Filter conditions' },
          { name: 'sorts', type: 'array', required: false, description: 'Sort conditions' },
        ],
        output: { type: 'array', description: 'Query results' },
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    category: 'Communication',
    description: 'Send messages and manage Discord servers',
    sdk: 'discord.js',
    authType: 'token',
    docsUrl: 'https://discord.com/developers/docs',
    actions: [
      {
        id: 'messages.create',
        name: 'Send Message',
        description: 'Send a message to a channel',
        inputs: [
          { name: 'channelId', type: 'string', required: true, description: 'Channel ID' },
          { name: 'content', type: 'string', required: true, description: 'Message content' },
          { name: 'embeds', type: 'array', required: false, description: 'Rich embeds' },
        ],
        output: { type: 'object', description: 'Sent message' },
      },
      {
        id: 'channels.list',
        name: 'List Channels',
        description: 'List channels in a server',
        inputs: [
          { name: 'guildId', type: 'string', required: true, description: 'Server/Guild ID' },
        ],
        output: { type: 'array', description: 'List of channels' },
      },
    ],
  },
  {
    id: 'airtable',
    name: 'Airtable',
    icon: '📊',
    category: 'Database',
    description: 'Manage Airtable bases and records',
    sdk: 'airtable',
    authType: 'api_key',
    docsUrl: 'https://airtable.com/developers/web/api',
    actions: [
      {
        id: 'records.create',
        name: 'Create Record',
        description: 'Create a new record in a table',
        inputs: [
          { name: 'baseId', type: 'string', required: true, description: 'Base ID' },
          { name: 'tableId', type: 'string', required: true, description: 'Table ID or name' },
          { name: 'fields', type: 'object', required: true, description: 'Record fields' },
        ],
        output: { type: 'object', description: 'Created record' },
      },
      {
        id: 'records.list',
        name: 'List Records',
        description: 'List records from a table',
        inputs: [
          { name: 'baseId', type: 'string', required: true, description: 'Base ID' },
          { name: 'tableId', type: 'string', required: true, description: 'Table ID or name' },
          { name: 'maxRecords', type: 'number', required: false, description: 'Maximum records', default: 100 },
          { name: 'filterByFormula', type: 'string', required: false, description: 'Airtable formula filter' },
        ],
        output: { type: 'array', description: 'List of records' },
      },
    ],
  },
  {
    id: 'http',
    name: 'HTTP',
    icon: '🌐',
    category: 'Network',
    description: 'Make HTTP requests to any API',
    authType: 'token',
    actions: [
      {
        id: 'request',
        name: 'HTTP Request',
        description: 'Make a custom HTTP request',
        inputs: [
          { name: 'url', type: 'string', required: true, description: 'Request URL' },
          { name: 'method', type: 'string', required: true, description: 'HTTP method (GET, POST, PUT, DELETE)' },
          { name: 'headers', type: 'object', required: false, description: 'Request headers' },
          { name: 'body', type: 'object', required: false, description: 'Request body (for POST/PUT)' },
        ],
        output: { type: 'object', description: 'Response with status, headers, and body' },
      },
      {
        id: 'get',
        name: 'GET Request',
        description: 'Make a GET request',
        inputs: [
          { name: 'url', type: 'string', required: true, description: 'Request URL' },
          { name: 'headers', type: 'object', required: false, description: 'Request headers' },
        ],
        output: { type: 'object', description: 'Response data' },
      },
      {
        id: 'post',
        name: 'POST Request',
        description: 'Make a POST request',
        inputs: [
          { name: 'url', type: 'string', required: true, description: 'Request URL' },
          { name: 'body', type: 'object', required: true, description: 'Request body' },
          { name: 'headers', type: 'object', required: false, description: 'Request headers' },
        ],
        output: { type: 'object', description: 'Response data' },
      },
    ],
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: '🤖',
    category: 'AI',
    description: 'Use Claude AI for analysis and generation',
    sdk: '@anthropic-ai/sdk',
    authType: 'api_key',
    docsUrl: 'https://docs.anthropic.com/',
    actions: [
      {
        id: 'analyze',
        name: 'Analyze',
        description: 'Analyze text or data with Claude',
        inputs: [
          { name: 'prompt', type: 'string', required: true, description: 'Analysis prompt' },
          { name: 'content', type: 'string', required: true, description: 'Content to analyze' },
          { name: 'model', type: 'string', required: false, description: 'Model to use', default: 'claude-sonnet-4-20250514' },
        ],
        output: { type: 'string', description: 'Analysis result' },
      },
      {
        id: 'generate',
        name: 'Generate',
        description: 'Generate text with Claude',
        inputs: [
          { name: 'prompt', type: 'string', required: true, description: 'Generation prompt' },
          { name: 'maxTokens', type: 'number', required: false, description: 'Maximum tokens', default: 1024 },
          { name: 'model', type: 'string', required: false, description: 'Model to use', default: 'claude-sonnet-4-20250514' },
        ],
        output: { type: 'string', description: 'Generated text' },
      },
      {
        id: 'summarize',
        name: 'Summarize',
        description: 'Summarize text with Claude',
        inputs: [
          { name: 'content', type: 'string', required: true, description: 'Content to summarize' },
          { name: 'length', type: 'string', required: false, description: 'Summary length (short, medium, long)', default: 'medium' },
        ],
        output: { type: 'string', description: 'Summary' },
      },
    ],
  },
  {
    id: 'confluence',
    name: 'Confluence',
    icon: '📚',
    category: 'Documentation',
    description: 'Manage Confluence pages and spaces',
    sdk: 'confluence.js',
    authType: 'basic',
    docsUrl: 'https://developer.atlassian.com/cloud/confluence/rest/',
    actions: [
      {
        id: 'pages.create',
        name: 'Create Page',
        description: 'Create a new Confluence page',
        inputs: [
          { name: 'spaceKey', type: 'string', required: true, description: 'Space key' },
          { name: 'title', type: 'string', required: true, description: 'Page title' },
          { name: 'content', type: 'string', required: true, description: 'Page content (HTML or storage format)' },
          { name: 'parentId', type: 'string', required: false, description: 'Parent page ID' },
        ],
        output: { type: 'object', description: 'Created page' },
      },
      {
        id: 'pages.search',
        name: 'Search Pages',
        description: 'Search Confluence pages',
        inputs: [
          { name: 'cql', type: 'string', required: true, description: 'CQL query' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum results', default: 25 },
        ],
        output: { type: 'array', description: 'Search results' },
      },
    ],
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '📬',
    category: 'Communication',
    description: 'Manage emails and calendar via Microsoft Graph',
    sdk: '@microsoft/microsoft-graph-client',
    authType: 'oauth',
    docsUrl: 'https://learn.microsoft.com/en-us/graph/',
    actions: [
      {
        id: 'messages.send',
        name: 'Send Email',
        description: 'Send an email via Outlook',
        inputs: [
          { name: 'to', type: 'string', required: true, description: 'Recipient email' },
          { name: 'subject', type: 'string', required: true, description: 'Email subject' },
          { name: 'body', type: 'string', required: true, description: 'Email body' },
          { name: 'contentType', type: 'string', required: false, description: 'Body type (text or html)', default: 'text' },
        ],
        output: { type: 'object', description: 'Sent message' },
      },
      {
        id: 'calendar.createEvent',
        name: 'Create Event',
        description: 'Create a calendar event',
        inputs: [
          { name: 'subject', type: 'string', required: true, description: 'Event subject' },
          { name: 'start', type: 'string', required: true, description: 'Start time (ISO 8601)' },
          { name: 'end', type: 'string', required: true, description: 'End time (ISO 8601)' },
          { name: 'attendees', type: 'array', required: false, description: 'Attendee emails' },
        ],
        output: { type: 'object', description: 'Created event' },
      },
    ],
  },
];

// List all available tools
router.get('/', (_req, res) => {
  // Return simplified tool list
  const toolList = tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    icon: tool.icon,
    category: tool.category,
    description: tool.description,
    sdk: tool.sdk,
    authType: tool.authType,
    actionCount: tool.actions.length,
  }));

  res.json({ tools: toolList });
});

// Get detailed tool schema
router.get('/:toolId', (req, res) => {
  const { toolId } = req.params;
  const tool = tools.find((t) => t.id === toolId);

  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  res.json({ tool });
});

// Get action schema for a specific action
router.get('/:toolId/actions/:actionId', (req, res) => {
  const { toolId, actionId } = req.params;
  const tool = tools.find((t) => t.id === toolId);

  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  const action = tool.actions.find((a) => a.id === actionId);

  if (!action) {
    return res.status(404).json({ error: 'Action not found' });
  }

  res.json({ action, tool: { id: tool.id, name: tool.name, sdk: tool.sdk } });
});

export { router as toolsRoutes };
