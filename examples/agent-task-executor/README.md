# Agent Task Executor Workflows

Execute agent tasks from Slack or Telegram messages and get pass/fail results.

## Overview

These workflows:
1. Receive task instructions via webhook from Slack or Telegram
2. Parse instructions and break them into discrete tasks
3. Execute each task using an AI agent with safe permissions
4. Report back with a list of tasks showing pass/fail status

## Available Workflows

| Workflow | File | Description |
|----------|------|-------------|
| Slack | `workflow-slack.md` | Receive instructions from Slack, respond in Slack |
| Telegram | `workflow-telegram.md` | Receive instructions from Telegram, respond in Telegram |

## Prerequisites

### For Slack

1. **Create a Slack App**
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" > "From scratch"
   - Name your app and select your workspace

2. **Configure Bot Permissions**
   - Go to "OAuth & Permissions"
   - Add these Bot Token Scopes:
     - `chat:write` - Send messages
     - `chat:write.public` - Send to channels the bot isn't in
     - `channels:history` - Read message history
     - `app_mentions:read` - Respond to @mentions

3. **Enable Event Subscriptions**
   - Go to "Event Subscriptions"
   - Enable events and set Request URL to your webhook endpoint
   - Subscribe to bot events: `message.channels`, `app_mention`

4. **Install the App**
   - Go to "Install App" and install to your workspace
   - Copy the "Bot User OAuth Token"

### For Telegram

1. **Create a Telegram Bot**
   - Open Telegram and search for `@BotFather`
   - Send `/newbot` and follow the prompts
   - Copy the bot token

2. **Set Webhook**
   ```bash
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-server.com/webhooks/telegram/task-executor"}'
   ```

## Environment Variables

```bash
# For Slack
export SLACK_BOT_TOKEN="xoxb-your-bot-token"

# For Telegram
export TELEGRAM_BOT_TOKEN="your-bot-token"
```

## Usage

### Slack

```bash
# Run the Slack workflow manually
marktoflow run examples/agent-task-executor/workflow-slack.md \
  --agent claude-code \
  --input channel="C0123456789" \
  --input instructions="Create a new file called hello.txt with 'Hello World' content" \
  --input working_directory="/path/to/project"
```

### Telegram

```bash
# Run the Telegram workflow manually
marktoflow run examples/agent-task-executor/workflow-telegram.md \
  --agent claude-code \
  --input chat_id=123456789 \
  --input instructions="List all Python files and check for syntax errors" \
  --input working_directory="/path/to/project"
```

### With Different Agents

```bash
# Use GitHub Copilot
marktoflow run examples/agent-task-executor/workflow-slack.md --agent copilot ...

# Use OpenCode
marktoflow run examples/agent-task-executor/workflow-slack.md --agent opencode ...

# Use Ollama (local)
marktoflow run examples/agent-task-executor/workflow-slack.md --agent ollama ...
```

## Example Instructions

Here are example messages you can send to the bot:

### Code Tasks
- "Create a new React component called UserProfile with name and email props"
- "Add unit tests for the auth module"
- "Refactor the database queries to use parameterized statements"
- "Add TypeScript types to the API handlers"

### Project Tasks
- "Set up ESLint and Prettier configuration"
- "Create a GitHub Actions workflow for CI/CD"
- "Add a Dockerfile for the application"
- "Update the README with installation instructions"

### Analysis Tasks
- "Find all TODO comments in the codebase"
- "Check which dependencies are outdated"
- "Identify potential security issues in the code"
- "Generate a summary of the project structure"

## Agent Permissions

The agent has these permissions (safe by default):

| Permission | Allowed | Description |
|------------|---------|-------------|
| `read` | Yes | Read any file |
| `write` | Yes | Create new files |
| `edit` | Yes | Modify existing files |
| `glob` | Yes | Search for files |
| `grep` | Yes | Search file contents |
| `bash` | Non-destructive | Run safe shell commands |
| `delete` | **No** | Cannot delete files |
| `dangerous_bash` | **No** | Cannot run destructive commands |

### Blocked Operations

The agent **cannot**:
- Delete files or directories (`rm`, `rmdir`)
- Force push to git (`git push --force`)
- Reset repositories (`git reset --hard`)
- Drop databases
- Run `rm -rf` or similar destructive commands
- Modify system files

## Response Format

### Slack Response

```
🎉 Task Execution Complete

Results: 3/3 tasks passed

━━━━━━━━━━━━━━━━

✅ Create UserProfile component - PASSED
   Created src/components/UserProfile.tsx

✅ Add TypeScript types - PASSED
   Added interface definitions

✅ Update exports - PASSED
   Added to index.ts

━━━━━━━━━━━━━━━━

Summary: Successfully created React component with types
```

### Telegram Response

Similar format with emoji indicators for pass (✅) and fail (❌) status.

## Running the Webhook Server

### Start the Server

```bash
# Start the webhook server (scans for all workflows)
marktoflow serve --port 3000

# Or serve a specific workflow
marktoflow serve -w examples/agent-task-executor/workflow-slack.md --port 3000
```

The server will automatically:
- Discover workflows with webhook triggers
- Register endpoints based on the `path` in each trigger
- Handle Slack URL verification
- Extract inputs from webhook payloads

### Expose to the Internet

Use ngrok to expose your local server:

```bash
# Terminal 1: Start marktoflow
marktoflow serve --port 3000

# Terminal 2: Expose with ngrok
ngrok http 3000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io/slack/task-executor`) and use it as your webhook URL in Slack/Telegram.

## Security Considerations

1. **Working Directory**: The agent operates within the specified working directory. Choose carefully to avoid exposing sensitive files.

2. **Bot Access**: Restrict which users/channels can send commands:
   - Slack: Use channel restrictions in your app settings
   - Telegram: Implement chat ID whitelisting

3. **Sensitive Data**: The agent can read files. Ensure `.env`, credentials, and secrets are excluded from the working directory or use `.gitignore` patterns.

4. **Rate Limiting**: Consider implementing rate limiting to prevent abuse.

## Customization

### Change Agent Model

Edit the `agent_config` section:

```yaml
agent_config:
  model: opus  # More capable for complex tasks
  max_turns: 30  # Allow more steps
```

### Add Custom Permissions

Modify the `permissions` section to allow/disallow specific actions:

```yaml
permissions:
  read: true
  write: true
  edit: true
  bash: full  # Allow all bash commands (use with caution)
```

### Add Project Context

Include project-specific context in the agent prompt:

```yaml
prompt: |
  You are working on a Next.js 14 project with:
  - TypeScript
  - Tailwind CSS
  - Prisma ORM
  - PostgreSQL database

  Project conventions:
  - Components in src/components/
  - API routes in src/app/api/
  - Use 2-space indentation

  {{ inputs.instructions }}
```

## Troubleshooting

### Slack: Bot Not Responding

1. Verify Event Subscriptions are enabled
2. Check the Request URL is correct
3. Ensure the bot has necessary permissions
4. Check Slack app logs for errors

### Telegram: Messages Not Received

1. Verify webhook is set: `curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"`
2. Ensure server is publicly accessible via HTTPS
3. Check for pending updates: `curl "https://api.telegram.org/bot$TOKEN/getUpdates"`

### Tasks Failing

1. Check the working directory exists and is accessible
2. Verify the agent has necessary tools installed
3. Review agent logs for specific errors
4. Try simpler instructions to isolate the issue

### Response Truncated

- Slack messages have a character limit; complex results may be truncated
- Telegram messages are limited to 4096 characters
- Consider splitting large responses into multiple messages
