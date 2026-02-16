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

  // Collaboration
  PRESENCE_JOIN: 'presence:join',
  PRESENCE_LEAVE: 'presence:leave',
  PRESENCE_UPDATE: 'presence:update',
  COMMENT_ADDED: 'comment:added',
  COMMENT_RESOLVED: 'comment:resolved',
  LOCK_ACQUIRED: 'lock:acquired',
  LOCK_RELEASED: 'lock:released',
  VERSION_CREATED: 'version:created',

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
    description: 'Team messaging, channels, and file sharing',
    keywords: ['chat', 'message', 'channel', 'team', 'notification'],
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
    description: 'Source code, pull requests, issues, and repositories',
    keywords: ['git', 'code', 'pr', 'pull request', 'issue', 'repository', 'review'],
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
    description: 'Project management, issue tracking, and agile boards',
    keywords: ['ticket', 'issue', 'project', 'sprint', 'agile', 'task', 'board'],
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
    description: 'Send, receive, and manage email via Google Gmail',
    keywords: ['email', 'mail', 'send', 'inbox', 'google', 'draft'],
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
    description: 'Microsoft email and calendar integration',
    keywords: ['email', 'mail', 'calendar', 'microsoft', 'office', 'meeting'],
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
    description: 'Modern issue tracking and project management',
    keywords: ['issue', 'project', 'task', 'bug', 'feature', 'sprint'],
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
    description: 'Workspace for docs, databases, and knowledge management',
    keywords: ['wiki', 'document', 'database', 'page', 'knowledge', 'notes'],
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
    description: 'Community messaging, bots, and webhooks',
    keywords: ['chat', 'message', 'bot', 'webhook', 'community', 'server'],
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
    description: 'Spreadsheet-database hybrid for structured data',
    keywords: ['database', 'spreadsheet', 'table', 'record', 'data'],
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
    description: 'Team documentation and knowledge base',
    keywords: ['wiki', 'document', 'page', 'knowledge', 'atlassian', 'docs'],
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
    description: 'Make HTTP requests to any REST API endpoint',
    keywords: ['api', 'rest', 'request', 'fetch', 'webhook', 'url', 'endpoint'],
    methods: ['request', 'get', 'post', 'put', 'patch', 'delete'],
  },
  rss: {
    name: 'RSS',
    icon: 'rss',
    description: 'Subscribe to and fetch RSS/Atom feed updates',
    keywords: ['feed', 'news', 'subscribe', 'atom', 'blog'],
    methods: ['fetch', 'getItems'],
  },
  claude: {
    name: 'Claude',
    icon: 'claude',
    description: 'Anthropic Claude AI for analysis, generation, and chat',
    keywords: ['ai', 'llm', 'anthropic', 'analyze', 'generate', 'summarize'],
    methods: ['analyze', 'generate', 'summarize', 'chat'],
  },
  opencode: {
    name: 'OpenCode',
    icon: 'opencode',
    description: 'AI coding assistant for code generation and analysis',
    keywords: ['ai', 'code', 'programming', 'assistant', 'complete'],
    methods: ['chat', 'complete', 'analyze'],
  },
  ollama: {
    name: 'Ollama',
    icon: 'ollama',
    description: 'Run local LLMs for private AI inference',
    keywords: ['ai', 'llm', 'local', 'private', 'model', 'embed'],
    methods: ['generate', 'chat', 'embeddings'],
  },
  parallel: {
    name: 'Parallel',
    icon: 'parallel',
    description: 'Run multiple AI agents concurrently',
    keywords: ['concurrent', 'multi-agent', 'spawn', 'batch', 'map'],
    methods: ['spawn', 'map'],
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
