# marktoflow Environment Variables Setup

This guide explains how marktoflow handles environment variables and configuration.

## How It Works

marktoflow **automatically loads** environment variables from `.env` files at startup. No manual sourcing required!

### Load Order

Environment variables are loaded from these locations (in order):

1. **`~/.marktoflow/.env`** - Global user configuration (recommended for credentials)
2. **Project root `.env`** - Project-specific configuration
3. **`.marktoflow/.env`** - Project marktoflow directory

Later files override earlier ones, and existing environment variables take precedence.

## Quick Start

### 1. Create Your .env File

Choose one location:

```bash
# Option A: Global (recommended for OAuth credentials)
mkdir -p ~/.marktoflow
nano ~/.marktoflow/.env

# Option B: Project-specific
nano .env

# Option C: Project marktoflow directory
mkdir -p .marktoflow
nano .marktoflow/.env
```

### 2. Add Your Credentials

```bash
# Google OAuth (for Gmail)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-xxx

# OpenAI API
OPENAI_API_KEY=sk-xxx

# Slack
SLACK_BOT_TOKEN=xoxb-xxx
SLACK_APP_TOKEN=xapp-xxx

# GitHub
GITHUB_TOKEN=ghp_xxx

# Jira
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
```

### 3. Run Commands

marktoflow automatically reads your .env file:

```bash
# OAuth flows read credentials automatically
./marktoflow connect gmail

# Workflows read credentials automatically
./marktoflow run workflow.md
```

## Gmail OAuth Example

### Step 1: Add OAuth Credentials to .env

Use the template from `.env.gmail`:

```bash
# Copy template to global config
cp .env.gmail ~/.marktoflow/.env

# Edit and fill in your credentials
nano ~/.marktoflow/.env
```

Add:
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8484/callback
```

### Step 2: Run OAuth Flow

```bash
./marktoflow connect gmail
```

marktoflow will:
1. ✅ Automatically read `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from your .env
2. ✅ Open your browser for OAuth
3. ✅ Save tokens to `.marktoflow/credentials/gmail.json`
4. ✅ Exit automatically when complete

### Step 3: Use in Workflows

Your workflows can now use Gmail:

```yaml
tools:
  gmail:
    sdk: 'google-gmail'
    auth:
      client_id: '${GOOGLE_CLIENT_ID}'
      client_secret: '${GOOGLE_CLIENT_SECRET}'
      redirect_uri: '${GOOGLE_REDIRECT_URI}'
      refresh_token: '${GOOGLE_REFRESH_TOKEN}'
```

## Environment Variable Precedence

Variables are loaded in this order (later overrides earlier):

1. `~/.marktoflow/.env` - Global user config
2. Project root `.env` - Project config
3. `.marktoflow/.env` - Project marktoflow config
4. `process.env` - Existing environment variables (highest priority)

## Command Line Options vs .env Files

You can use either:

```bash
# Option 1: Use .env file (recommended)
# Add to ~/.marktoflow/.env:
#   GOOGLE_CLIENT_ID=xxx
#   GOOGLE_CLIENT_SECRET=yyy
./marktoflow connect gmail

# Option 2: Use command line
./marktoflow connect gmail --client-id xxx --client-secret yyy

# Option 3: Export in shell
export GOOGLE_CLIENT_ID=xxx
export GOOGLE_CLIENT_SECRET=yyy
./marktoflow connect gmail
```

All three work! The .env approach is recommended because:
- ✅ Credentials persist across sessions
- ✅ No need to export variables
- ✅ Easy to manage multiple projects
- ✅ Secure (add `.env` to `.gitignore`)

## Security Best Practices

### 1. Use .gitignore

Ensure `.env` files are not committed:

```bash
# .gitignore
.env
.env.*
!.env.example
.marktoflow/.env
.marktoflow/credentials/
```

### 2. Use Global Config for Sensitive Credentials

Store OAuth credentials globally:

```bash
# Store in ~/.marktoflow/.env (not tracked by git)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
```

### 3. Use Project .env for Non-Sensitive Config

Store project-specific, non-sensitive config in project `.env`:

```bash
# Project .env (can be committed as .env.example)
MARKTOFLOW_LOG_LEVEL=DEBUG
MARKTOFLOW_WEBHOOK_PORT=8080
```

## Troubleshooting

### "OAuth requires client credentials" error

Make sure:
1. Your `.env` file has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
2. The file is in the correct location (run `pwd` to check)
3. Variable names are spelled correctly (no typos)

### Variables not loading

Check:
1. File is named `.env` (not `.env.gmail` or other names)
2. File has correct format (no spaces around `=`)
3. File is in one of the expected locations

### Verify loading

Create a test:

```bash
# Create test .env
echo "TEST_VAR=hello" > ~/.marktoflow/.env

# Check if marktoflow loads it
./marktoflow connect gmail
# Should read variables automatically
```

## Available Environment Variables

See `.env.gmail` for Gmail-specific variables.

Common variables:

### AI Providers
- `ANTHROPIC_API_KEY` - Claude API
- `OPENAI_API_KEY` - OpenAI API
- `GOOGLE_API_KEY` / `GEMINI_API_KEY` - Google Gemini
- `COHERE_API_KEY` - Cohere API
- `MISTRAL_API_KEY` - Mistral API

### Services
- `GITHUB_TOKEN` - GitHub API
- `SLACK_BOT_TOKEN` - Slack Bot
- `SLACK_APP_TOKEN` - Slack App (for Socket Mode)
- `JIRA_API_TOKEN` - Jira API
- `LINEAR_API_KEY` - Linear API
- `NOTION_API_KEY` - Notion API

### Google Services
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI
- `GOOGLE_REFRESH_TOKEN` - OAuth refresh token

See `packages/core/src/env.ts` for the complete list.

## Related Guides

For service-specific setup guides, see the examples directory (e.g., examples/gmail-notification/).
