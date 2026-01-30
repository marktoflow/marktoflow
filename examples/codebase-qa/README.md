# Codebase Q&A Workflows

Answer questions about a codebase via Slack or Telegram messages using an AI agent.

## Overview

These workflows:
1. Receive a message via webhook containing a question about a codebase
2. Use an AI agent to analyze the codebase and find the answer
3. Respond with a concise paragraph answering the question

## Available Workflows

| Workflow | File | Description |
|----------|------|-------------|
| Slack | `workflow-slack.md` | Receive questions from Slack, respond in Slack |
| Telegram | `workflow-telegram.md` | Receive questions from Telegram, respond in Telegram |

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
     - `channels:history` - Read message history
     - `app_mentions:read` - Respond to @mentions

3. **Enable Event Subscriptions**
   - Go to "Event Subscriptions"
   - Enable events and set Request URL to your webhook endpoint
   - Subscribe to bot events: `message.channels`, `app_mention`

4. **Install and Get Token**
   - Go to "Install App" and install to your workspace
   - Copy the "Bot User OAuth Token"

### For Telegram

1. **Create a Telegram Bot**
   - Open Telegram and search for `@BotFather`
   - Send `/newbot` and follow the prompts to create your bot
   - Copy the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

2. **Get Your Chat ID**
   - Start a conversation with your bot in Telegram
   - Send a message to the bot
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Look for `"chat":{"id":YOUR_CHAT_ID}` in the response

3. **Set Webhook**
   ```bash
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://your-server.com/webhooks/telegram/codebase-qa",
       "allowed_updates": ["message"]
     }'
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
marktoflow run examples/codebase-qa/workflow-slack.md \
  --agent claude-code \
  --input codebase_path="/path/to/your/project" \
  --input channel="C0123456789" \
  --input question="How does the authentication system work?"
```

### Telegram

```bash
# Run the Telegram workflow manually
marktoflow run examples/codebase-qa/workflow-telegram.md \
  --agent claude-code \
  --input codebase_path="/path/to/your/project" \
  --input chat_id=123456789 \
  --input question="What is this project about?"
```

### With Different Agents

```bash
# Use GitHub Copilot
marktoflow run examples/codebase-qa/workflow-slack.md --agent copilot ...

# Use OpenCode
marktoflow run examples/codebase-qa/workflow-slack.md --agent opencode ...

# Use Ollama (local)
marktoflow run examples/codebase-qa/workflow-slack.md --agent ollama ...
```

## Example Questions

- "What is this project about?"
- "How does the authentication system work?"
- "Where are database queries handled?"
- "What testing framework does this project use?"
- "How is error handling implemented?"
- "What are the main dependencies?"
- "Where are the API routes defined?"
- "How is the project structured?"

## Agent Permissions

The AI agent has read-only permissions:

| Permission | Allowed | Description |
|------------|---------|-------------|
| `read` | Yes | Read any file in the codebase |
| `glob` | Yes | Search for files by pattern |
| `grep` | Yes | Search file contents |
| `bash` | Read-only | Run non-destructive shell commands (ls, cat, etc.) |
| `write` | **No** | Cannot create files |
| `edit` | **No** | Cannot modify files |

## Running the Webhook Server

### Start the Server

```bash
# Start the webhook server (scans for all workflows)
marktoflow serve --port 3000

# Or serve a specific workflow
marktoflow serve -w examples/codebase-qa/workflow-slack.md --port 3000
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

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`) and use it as your webhook URL in Slack/Telegram.

### Setting the Codebase Path

The `codebase_path` input needs to be set. You can either:

1. **Set a default in the workflow** - Edit the workflow's `inputs` section:
   ```yaml
   inputs:
     codebase_path:
       type: string
       required: true
       default: '/path/to/your/codebase'
   ```

2. **Use environment variable** - Reference an env var in the default:
   ```yaml
   inputs:
     codebase_path:
       type: string
       required: true
       default: '${CODEBASE_PATH}'
   ```

## Security Considerations

1. **Codebase Access**: The agent can read all files in the specified codebase path. Ensure you don't point it at directories containing secrets (`.env`, credentials, etc.).

2. **Bot Security**: Keep your bot tokens secure. Consider using private bots/channels for sensitive codebases.

3. **Access Restrictions**: Consider restricting which users/channels can trigger the workflow:
   - Slack: Use channel restrictions in app settings
   - Telegram: Implement chat ID whitelisting

## Customization

### Change the AI Model

Edit the `agent_config` section in the workflow:

```yaml
agent_config:
  model: opus  # Use more powerful model for complex questions
  max_turns: 15  # Allow more exploration
```

### Add Custom Instructions

Modify the agent prompt to include project-specific context:

```yaml
prompt: |
  You are an expert on the MyProject codebase.
  Key technologies: React, Node.js, PostgreSQL

  Known structure:
  - src/components/ - React components
  - src/api/ - Backend API routes
  - src/db/ - Database models

  Answer the following question about this codebase:
  {{ inputs.question }}
```

## Troubleshooting

### Bot Not Responding

**Slack:**
1. Verify Event Subscriptions are enabled
2. Check the Request URL is correct and verified
3. Ensure the bot has been invited to the channel
4. Check Slack app logs for errors

**Telegram:**
1. Verify webhook is set: `curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"`
2. Ensure server is publicly accessible via HTTPS
3. Check for pending updates: `curl "https://api.telegram.org/bot$TOKEN/getUpdates"`

### Analysis Fails

1. Ensure the `codebase_path` is an absolute path
2. Verify the path exists and is readable
3. Check that the agent has the necessary dependencies installed
4. Try a simpler question to isolate the issue

### Response Too Long

- Slack blocks have a 3000 character limit per text field
- Telegram messages are limited to 4096 characters
- Both workflows automatically truncate long responses
