# @marktoflow/integrations

> **Author:** Scott Glover <scottgl@gmail.com>

Standard integrations for marktoflow - connect to Slack, GitHub, Jira, Gmail, and more.

## Overview

`@marktoflow/integrations` provides ready-to-use service integrations and AI agent adapters for the marktoflow automation framework.

## Features

### Service Integrations (20)

- **Slack** - Send messages, manage channels, socket mode
- **GitHub** - Create PRs, issues, comments, manage repos
- **Jira** - Create/update issues, transitions, search
- **Gmail** - Send emails, read inbox, manage labels, webhook triggers
- **Outlook** - Send emails, read calendar/inbox, webhook triggers
- **Google Sheets** - Spreadsheet operations, read/write data
- **Google Calendar** - Calendar events, scheduling
- **Google Drive** - File storage and management
- **Google Docs** - Document creation and editing
- **Linear** - Issue tracking and project management
- **Notion** - Database operations, page management
- **Discord** - Bot interactions, message management
- **Airtable** - Spreadsheet database operations
- **Confluence** - Wiki page management
- **Telegram** - Bot messaging and interactions
- **WhatsApp** - Business messaging API
- **Supabase** - PostgreSQL database with real-time subscriptions
- **PostgreSQL** - Direct PostgreSQL database access
- **MySQL** - Direct MySQL database access
- **HTTP** - Generic HTTP requests with auth

### AI Agent Adapters (6)

- **Ollama** - Local LLM integration
- **Claude Agent** - Anthropic Claude Agent SDK integration
- **Claude Code** - Anthropic Claude Code CLI integration
- **OpenAI Codex** - OpenAI Codex SDK integration
- **OpenCode** - OpenCode AI integration (75+ backends)
- **GitHub Copilot** - GitHub Copilot SDK integration

## Installation

```bash
npm install @marktoflow/integrations
```

This package depends on `@marktoflow/core` which will be installed automatically.

## Quick Start

### Using in Workflows

Integrations are designed to work seamlessly in workflow YAML definitions:

```yaml
workflow:
  id: slack-notification
  name: Send Slack Notification

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

steps:
  - action: slack.chat.postMessage
    inputs:
      channel: '#general'
      text: 'Hello from marktoflow!'
```

### Programmatic Usage

You can also use integrations directly in TypeScript:

```typescript
import { SlackInitializer } from '@marktoflow/integrations';
import { SDKRegistry } from '@marktoflow/core';

// Register Slack integration
const registry = new SDKRegistry();
await registry.registerSDK(SlackInitializer);

// Load and use SDK
const slack = await registry.loadSDK('slack', {
  auth: { token: process.env.SLACK_BOT_TOKEN },
});

// Execute action
const result = await registry.executeAction('slack', 'chat.postMessage', slack, {
  channel: '#general',
  text: 'Hello World!',
});
```

## Available Integrations

### Slack

Send messages, manage channels, handle events.

**Setup**:

```bash
# Set environment variable
export SLACK_BOT_TOKEN=xoxb-your-token
```

**Actions**:

- `chat.postMessage` - Send a message
- `conversations.list` - List channels
- `conversations.create` - Create channel
- `users.list` - List workspace users

**Example**:

```yaml
action: slack.chat.postMessage
inputs:
  channel: '#general'
  text: 'Deployment complete!'
  blocks:
    - type: section
      text:
        type: mrkdwn
        text: '*Status:* ✅ Success'
```

### GitHub

Manage repositories, PRs, issues, and more.

**Setup**:

```bash
export GITHUB_TOKEN=ghp_your-token
```

**Actions**:

- `repos.get` - Get repository info
- `pulls.create` - Create pull request
- `issues.create` - Create issue
- `issues.createComment` - Comment on issue

**Example**:

```yaml
action: github.pulls.create
inputs:
  owner: scottgl9
  repo: marktoflow
  title: 'Add new feature'
  head: feature-branch
  base: main
  body: 'This PR adds...'
```

### Jira

Issue tracking and project management.

**Setup**:

```bash
export JIRA_HOST=your-domain.atlassian.net
export JIRA_EMAIL=your@email.com
export JIRA_API_TOKEN=your-token
```

**Actions**:

- `issues.createIssue` - Create issue
- `issues.updateIssue` - Update issue
- `issues.searchIssues` - Search issues
- `issues.getIssue` - Get issue details

**Example**:

```yaml
action: jira.issues.createIssue
inputs:
  fields:
    project:
      key: PROJ
    summary: 'Bug: Login fails'
    description: 'Users cannot log in'
    issuetype:
      name: Bug
```

### Gmail

Email operations with webhook support.

**Setup**:

```bash
export GMAIL_CLIENT_ID=your-client-id
export GMAIL_CLIENT_SECRET=your-secret
export GMAIL_REFRESH_TOKEN=your-refresh-token
```

**Actions**:

- `users.messages.send` - Send email
- `users.messages.list` - List messages
- `users.labels.list` - List labels
- `users.messages.get` - Get message details

**Example**:

```yaml
action: gmail.users.messages.send
inputs:
  to: user@example.com
  subject: 'Daily Report'
  body: 'Here is your daily report...'
```

### Outlook

Microsoft 365 email and calendar.

**Setup**:

```bash
export OUTLOOK_CLIENT_ID=your-client-id
export OUTLOOK_CLIENT_SECRET=your-secret
export OUTLOOK_TENANT_ID=your-tenant-id
export OUTLOOK_REFRESH_TOKEN=your-refresh-token
```

**Actions**:

- `sendMail` - Send email
- `listMessages` - List inbox messages
- `listCalendarEvents` - List calendar events
- `createCalendarEvent` - Create calendar event

**Example**:

```yaml
action: outlook.sendMail
inputs:
  to: [user@example.com]
  subject: 'Meeting Reminder'
  body: 'Don't forget our meeting at 2pm'
```

### Linear

Modern issue tracking.

**Setup**:

```bash
export LINEAR_API_KEY=your-api-key
```

**Actions**:

- `createIssue` - Create issue
- `updateIssue` - Update issue
- `listIssues` - List issues

### Notion

Database and page management.

**Setup**:

```bash
export NOTION_TOKEN=secret_your-token
```

**Actions**:

- `databases.query` - Query database
- `pages.create` - Create page
- `blocks.children.append` - Add content blocks

### Discord

Bot interactions and messaging.

**Setup**:

```bash
export DISCORD_BOT_TOKEN=your-bot-token
```

**Actions**:

- `sendMessage` - Send message to channel
- `editMessage` - Edit message
- `deleteMessage` - Delete message

### Airtable

Spreadsheet database operations.

**Setup**:

```bash
export AIRTABLE_API_KEY=your-api-key
```

**Actions**:

- `select` - Query records
- `create` - Create records
- `update` - Update records
- `delete` - Delete records

### Confluence

Wiki page management.

**Setup**:

```bash
export CONFLUENCE_HOST=your-domain.atlassian.net
export CONFLUENCE_EMAIL=your@email.com
export CONFLUENCE_API_TOKEN=your-token
```

**Actions**:

- `getPage` - Get page content
- `createPage` - Create page
- `updatePage` - Update page
- `deletePage` - Delete page

### Google Sheets

Spreadsheet operations for Google Sheets.

**Setup**:

```bash
export GOOGLE_SHEETS_CLIENT_ID=your-client-id
export GOOGLE_SHEETS_CLIENT_SECRET=your-secret
export GOOGLE_SHEETS_REFRESH_TOKEN=your-refresh-token
```

**Actions**:

- `getSpreadsheet` - Get spreadsheet metadata
- `getValues` - Read cell values
- `updateValues` - Update cell values
- `appendValues` - Append rows to sheet

**Example**:

```yaml
action: google-sheets.updateValues
inputs:
  spreadsheetId: '1BxiMVs0XRA5...'
  range: 'Sheet1!A1:B2'
  values:
    - [Name, Email]
    - [John Doe, john@example.com]
```

### Google Calendar

Calendar event management.

**Setup**:

```bash
export GOOGLE_CALENDAR_CLIENT_ID=your-client-id
export GOOGLE_CALENDAR_CLIENT_SECRET=your-secret
export GOOGLE_CALENDAR_REFRESH_TOKEN=your-refresh-token
```

**Actions**:

- `listEvents` - List calendar events
- `createEvent` - Create calendar event
- `updateEvent` - Update event
- `deleteEvent` - Delete event

**Example**:

```yaml
action: google-calendar.createEvent
inputs:
  calendarId: primary
  summary: 'Team Meeting'
  start:
    dateTime: '2024-01-25T14:00:00-07:00'
  end:
    dateTime: '2024-01-25T15:00:00-07:00'
```

### Google Drive

File storage and management.

**Setup**:

```bash
export GOOGLE_DRIVE_CLIENT_ID=your-client-id
export GOOGLE_DRIVE_CLIENT_SECRET=your-secret
export GOOGLE_DRIVE_REFRESH_TOKEN=your-refresh-token
```

**Actions**:

- `listFiles` - List files in Drive
- `getFile` - Get file metadata
- `uploadFile` - Upload file
- `downloadFile` - Download file
- `deleteFile` - Delete file

### Google Docs

Document creation and editing.

**Setup**:

```bash
export GOOGLE_DOCS_CLIENT_ID=your-client-id
export GOOGLE_DOCS_CLIENT_SECRET=your-secret
export GOOGLE_DOCS_REFRESH_TOKEN=your-refresh-token
```

**Actions**:

- `getDocument` - Get document content
- `createDocument` - Create new document
- `updateDocument` - Batch update document
- `appendText` - Append text to document

### Telegram

Telegram bot messaging.

**Setup**:

```bash
export TELEGRAM_BOT_TOKEN=your-bot-token
```

**Actions**:

- `sendMessage` - Send message to chat
- `sendPhoto` - Send photo
- `sendDocument` - Send document
- `getUpdates` - Get bot updates

**Example**:

```yaml
action: telegram.sendMessage
inputs:
  chatId: '123456789'
  text: 'Hello from marktoflow!'
```

### WhatsApp

WhatsApp Business API messaging.

**Setup**:

```bash
export WHATSAPP_PHONE_NUMBER_ID=your-phone-id
export WHATSAPP_ACCESS_TOKEN=your-access-token
```

**Actions**:

- `sendMessage` - Send text message
- `sendTemplate` - Send message template
- `sendMedia` - Send media (image, video, document)

**Example**:

```yaml
action: whatsapp.sendMessage
inputs:
  to: '+1234567890'
  text: 'Hello from marktoflow!'
```

### Supabase

PostgreSQL database with real-time capabilities.

**Setup**:

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_KEY=your-anon-key
```

**Actions**:

- `select` - Query records
- `insert` - Insert records
- `update` - Update records
- `delete` - Delete records
- `rpc` - Call stored procedure

**Example**:

```yaml
action: supabase.select
inputs:
  table: users
  filters:
    email: 'eq.user@example.com'
```

### PostgreSQL

Direct PostgreSQL database access.

**Setup**:

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=your-password
export POSTGRES_DATABASE=mydb
```

**Actions**:

- `query` - Execute SQL query
- `insert` - Insert records
- `update` - Update records
- `delete` - Delete records

### MySQL

Direct MySQL database access.

**Setup**:

```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your-password
export MYSQL_DATABASE=mydb
```

**Actions**:

- `query` - Execute SQL query
- `insert` - Insert records
- `update` - Update records
- `delete` - Delete records

### HTTP

Generic HTTP requests with authentication.

**Actions**:

- `request` - Make HTTP request

**Example**:

```yaml
action: http.request
inputs:
  method: POST
  url: https://api.example.com/endpoint
  headers:
    Authorization: 'Bearer ${API_TOKEN}'
  body:
    key: value
```

## AI Agent Adapters

### Ollama

Run local LLMs via Ollama.

**Setup**:

```bash
export OLLAMA_BASE_URL=http://localhost:11434
```

**Example**:

```yaml
tools:
  ollama:
    adapter: ollama

steps:
  - action: ollama.generate
    inputs:
      model: llama2
      prompt: 'Explain quantum computing'
```

### Claude Agent

Anthropic Claude Agent SDK integration with agentic workflows.

**Setup**:

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key
```

**Features**:

- Multi-turn conversations with memory
- Tool calling and custom tools
- Streaming responses
- Extended thinking mode

**Example**:

```yaml
tools:
  claude:
    adapter: claude-agent
    config:
      model: claude-3-5-sonnet-20241022

steps:
  - action: claude.send
    inputs:
      prompt: 'Analyze this codebase'
      tools:
        - name: read_file
          description: Read file contents
    output_variable: analysis
```

### Claude Code

Anthropic Claude Code CLI integration.

**Setup**:

```bash
# Install Claude Code CLI
# Follow: https://github.com/anthropics/claude-code

export ANTHROPIC_API_KEY=sk-ant-your-key
```

**Features**:

- File-based context awareness
- Native MCP server integration
- Extended reasoning capabilities

### OpenAI Codex

OpenAI Codex SDK integration with workflow execution capabilities.

**Setup**:

```bash
# Authenticate via Codex CLI
# Follow OpenAI Codex documentation for setup
```

**Features**:

- Code generation and analysis
- Function calling support
- Streaming responses
- Sandboxed execution environment

**Example**:

```yaml
tools:
  codex:
    adapter: openai-codex
    config:
      model: codex-latest

steps:
  - action: codex.complete
    inputs:
      prompt: 'Write a function to sort an array'
    output_variable: code
```

### OpenCode

OpenCode AI integration supporting 75+ backends.

**Setup**:

```bash
# Configure OpenCode
opencode /connect
```

**Features**:

- GitHub Copilot backend (free with subscription)
- Ollama for local models
- Multiple cloud providers (GPT-4, Claude, Gemini)
- CLI and server modes

**Example**:

```yaml
tools:
  opencode:
    adapter: opencode
    config:
      backend: copilot # or ollama, claude, gpt-4, etc.

steps:
  - action: opencode.complete
    inputs:
      prompt: 'Explain async/await in JavaScript'
    output_variable: explanation
```

### GitHub Copilot

GitHub Copilot CLI integration with advanced agentic capabilities.

**Requirements**:

- GitHub Copilot subscription (Individual, Business, or Enterprise)
- Copilot CLI installed: [Installation Guide](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli)

**Installation**:

```bash
# Install Copilot CLI
npm install -g @githubnext/github-copilot-cli

# Verify installation
copilot --version
```

**Authentication**:

The GitHub Copilot adapter uses **OAuth authentication** managed by the Copilot CLI, not API keys. Authentication is a one-time setup:

```bash
# Authenticate with GitHub via OAuth
copilot auth login
```

This command will:

1. Open your browser to GitHub's OAuth consent page
2. Prompt you to authorize GitHub Copilot CLI
3. Save the OAuth token locally in `~/.copilot/`

**No API keys are required** - the adapter automatically uses the CLI's stored OAuth token. Your GitHub Copilot subscription determines your access level.

**Verify Authentication**:

```bash
# Test CLI connectivity
copilot --version
copilot ping
```

**Basic Usage**:

```yaml
tools:
  copilot:
    adapter: github-copilot
    config:
      model: gpt-4.1 # Optional, defaults to gpt-4.1

steps:
  - action: copilot.send
    inputs:
      prompt: 'Explain TypeScript generics'
    output_variable: explanation
```

**Streaming Responses**:

```yaml
steps:
  - action: copilot.stream
    inputs:
      prompt: 'Write a function to calculate fibonacci'
      onChunk: '${print_chunk}' # Callback for each chunk
    output_variable: code
```

**With File Attachments**:

```yaml
steps:
  - action: copilot.send
    inputs:
      prompt: 'Review this code for security issues'
      attachments:
        - type: file
          path: ./src/app.ts
          displayName: app.ts
    output_variable: review
```

**System Message Customization**:

```yaml
steps:
  - action: copilot.send
    inputs:
      prompt: 'Help me optimize this function'
      systemMessage: |
        You are a performance optimization expert.
        Focus on time and space complexity.
    output_variable: suggestions
```

**External CLI Server**:

For development or shared CLI instances:

```bash
# Terminal 1: Start CLI in server mode
copilot --server --port 4321

# Terminal 2: Use in workflow
```

```yaml
tools:
  copilot:
    adapter: github-copilot
    auth:
      cli_url: localhost:4321 # Connect to external server
```

**Configuration Options**:

- `model`: Model to use (gpt-4.1, gpt-5, claude-sonnet-4.5, etc.)
- `cli_path`: Custom path to CLI binary (default: 'copilot')
- `cli_url`: External CLI server URL (mutually exclusive with cli_path)
- `autoStart`: Auto-start CLI (default: true)
- `logLevel`: Log verbosity (info, debug, error, warning, none, all)

**Troubleshooting Authentication**:

If you encounter authentication issues:

```bash
# Check if authenticated
copilot ping

# Re-authenticate if needed
copilot auth logout
copilot auth login

# Verify subscription status at https://github.com/settings/copilot
```

**Note**: The adapter does **not** require or use API keys. All authentication is handled through the CLI's OAuth flow.

**Advanced Features** (See [COPILOT_SDK_ANALYSIS.md](../../docs/COPILOT_SDK_ANALYSIS.md)):

- Custom tool definitions
- MCP server integration
- Session persistence
- Infinite sessions (automatic context compaction)
- Multi-turn conversations

## Advanced Usage

### Custom Integration

Create your own integration:

```typescript
import type { SDKInitializer } from '@marktoflow/core';

export const MyServiceInitializer: SDKInitializer = {
  name: 'myservice',
  async initialize(config) {
    return new MyServiceClient(config.auth.apiKey);
  },
  actions: {
    doSomething: async (sdk, inputs) => {
      return sdk.doSomething(inputs);
    },
  },
};
```

### Error Handling

All integrations support automatic retry and error handling:

```yaml
steps:
  - action: slack.chat.postMessage
    inputs:
      channel: '#general'
      text: 'Message'
    retry:
      max_attempts: 3
      backoff: exponential
      initial_delay: 1000
    on_error: continue # or 'fail', 'retry'
```

## OAuth Setup Guides

For Gmail and Outlook, use the CLI to set up OAuth:

```bash
# Gmail OAuth
npx @marktoflow/cli@alpha connect gmail

# Outlook OAuth
npx @marktoflow/cli@alpha connect outlook
```

## Testing

```bash
npm test
```

## Links

- [Main Repository](https://github.com/scottgl9/marktoflow)
- [Documentation](https://github.com/scottgl9/marktoflow#readme)
- [Core Package](@marktoflow/core)
- [CLI Package](@marktoflow/cli)

## License

Apache-2.0
