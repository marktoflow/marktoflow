// Shared constants between client and server

export const API_VERSION = 'v1';
export const API_BASE_PATH = '/api';

// WebSocket events
export const WS_EVENTS = {
  // Server -> Client
  WORKFLOW_UPDATED: 'workflow:updated',
  EXECUTION_STARTED: 'execution:started',
  EXECUTION_STEP: 'execution:step',
  EXECUTION_COMPLETED: 'execution:completed',
  AI_PROCESSING: 'ai:processing',
  AI_RESPONSE: 'ai:response',

  // Client -> Server
  WORKFLOW_SUBSCRIBE: 'workflow:subscribe',
  WORKFLOW_UNSUBSCRIBE: 'workflow:unsubscribe',
  EXECUTION_SUBSCRIBE: 'execution:subscribe',
  EXECUTION_UNSUBSCRIBE: 'execution:unsubscribe',
} as const;

// Available services and their methods
export const SERVICES = {
  slack: {
    name: 'Slack',
    icon: 'slack',
    methods: [
      'chat.postMessage',
      'chat.update',
      'chat.delete',
      'conversations.list',
      'conversations.create',
      'files.upload',
      'users.info',
    ],
  },
  github: {
    name: 'GitHub',
    icon: 'github',
    methods: [
      'pulls.get',
      'pulls.list',
      'pulls.create',
      'pulls.createReview',
      'pulls.listFiles',
      'issues.get',
      'issues.create',
      'issues.createComment',
      'repos.getContent',
      'search.code',
    ],
  },
  jira: {
    name: 'Jira',
    icon: 'jira',
    methods: [
      'issues.getIssue',
      'issues.createIssue',
      'issues.editIssue',
      'issues.search',
      'issues.addComment',
      'issues.transition',
    ],
  },
  gmail: {
    name: 'Gmail',
    icon: 'gmail',
    methods: [
      'messages.list',
      'messages.get',
      'messages.send',
      'drafts.create',
      'labels.list',
    ],
  },
  outlook: {
    name: 'Outlook',
    icon: 'outlook',
    methods: [
      'messages.list',
      'messages.get',
      'messages.send',
      'calendar.events.list',
      'calendar.events.create',
    ],
  },
  linear: {
    name: 'Linear',
    icon: 'linear',
    methods: [
      'issues.get',
      'issues.create',
      'issues.update',
      'issues.search',
      'projects.list',
    ],
  },
  notion: {
    name: 'Notion',
    icon: 'notion',
    methods: [
      'pages.get',
      'pages.create',
      'pages.update',
      'databases.query',
      'search',
    ],
  },
  discord: {
    name: 'Discord',
    icon: 'discord',
    methods: [
      'messages.send',
      'messages.edit',
      'messages.delete',
      'channels.get',
      'webhooks.execute',
    ],
  },
  airtable: {
    name: 'Airtable',
    icon: 'airtable',
    methods: [
      'records.list',
      'records.get',
      'records.create',
      'records.update',
      'records.delete',
    ],
  },
  confluence: {
    name: 'Confluence',
    icon: 'confluence',
    methods: [
      'pages.list',
      'pages.get',
      'pages.create',
      'pages.update',
      'search',
    ],
  },
  http: {
    name: 'HTTP',
    icon: 'http',
    methods: ['request', 'get', 'post', 'put', 'patch', 'delete'],
  },
  claude: {
    name: 'Claude',
    icon: 'claude',
    methods: ['analyze', 'generate', 'summarize', 'chat'],
  },
  opencode: {
    name: 'OpenCode',
    icon: 'opencode',
    methods: ['chat', 'complete', 'analyze'],
  },
  ollama: {
    name: 'Ollama',
    icon: 'ollama',
    methods: ['generate', 'chat', 'embeddings'],
  },
} as const;

// Default node positions
export const NODE_LAYOUT = {
  VERTICAL_SPACING: 120,
  HORIZONTAL_OFFSET: 250,
  GROUP_PADDING: 40,
} as const;

// Status colors
export const STATUS_COLORS = {
  pending: { bg: 'bg-gray-400/10', text: 'text-gray-400', border: 'border-gray-400' },
  running: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning' },
  completed: { bg: 'bg-success/10', text: 'text-success', border: 'border-success' },
  failed: { bg: 'bg-error/10', text: 'text-error', border: 'border-error' },
  skipped: { bg: 'bg-gray-500/10', text: 'text-gray-500', border: 'border-gray-500' },
  cancelled: { bg: 'bg-gray-500/10', text: 'text-gray-500', border: 'border-gray-500' },
} as const;
