# GitHub Copilot Native SDK Setup Guide

This guide shows you how to use the **native GitHub Copilot SDK integration** in marktoflow workflows.

> **Note:** This is for the native `@github/copilot-sdk` adapter. If you want to use GitHub Copilot as a backend with OpenCode, see [OPENCODE.md](./OPENCODE.md#using-github-copilot-as-opencode-backend).

## Overview

The GitHub Copilot adapter provides direct integration with the GitHub Copilot CLI via the official `@github/copilot-sdk`. This gives you access to:

- ✅ **Advanced AI capabilities** - GPT-4, GPT-5, Claude models
- ✅ **File attachments** - Attach files and directories for context
- ✅ **Streaming responses** - Real-time response streaming
- ✅ **Multi-turn sessions** - Persistent conversations
- ✅ **OAuth authentication** - No API keys needed
- ✅ **Built-in tools** - File system, Git operations via CLI

## Prerequisites

### 1. GitHub Copilot Subscription

You need an active GitHub Copilot subscription:

- **GitHub Copilot Individual** - Personal use
- **GitHub Copilot Business** - For organizations
- **GitHub Copilot Enterprise** - For large enterprises

Check your subscription at: https://github.com/settings/copilot

### 2. Install Copilot CLI

```bash
# Install via npm
npm install -g @githubnext/github-copilot-cli

# Verify installation
copilot --version
```

### 3. Authenticate via OAuth

```bash
# Authenticate with GitHub (one-time setup)
copilot auth login
```

This will:

1. Open your browser to GitHub's OAuth consent page
2. Prompt you to authorize GitHub Copilot CLI
3. Save the OAuth token locally in `~/.copilot/`

**Important:** No API keys are needed - the adapter automatically uses the CLI's stored OAuth token.

### 4. Verify Authentication

```bash
# Test CLI connectivity
copilot ping
```

If this succeeds, you're ready to use the adapter!

## Usage in Workflows

### Basic Example

```yaml
---
workflow:
  id: copilot-example
  name: 'GitHub Copilot Example'

tools:
  copilot:
    adapter: github-copilot
    config:
      model: gpt-4.1 # Optional, defaults to gpt-4.1

steps:
  - id: generate
    action: copilot.send
    inputs:
      prompt: 'Explain TypeScript generics'
    output_variable: explanation
---
```

### With File Attachments

```yaml
steps:
  - id: review_code
    action: copilot.send
    inputs:
      prompt: 'Review this code for security issues'
      attachments:
        - type: file
          path: ./src/app.ts
          displayName: app.ts
        - type: directory
          path: ./src/utils
          displayName: utils/
    output_variable: review
```

### Streaming Response

```yaml
steps:
  - id: stream_response
    action: copilot.stream
    inputs:
      prompt: 'Write a function to calculate fibonacci'
      onChunk: '${print_chunk}' # Callback for each chunk
    output_variable: code
```

### Custom System Message

```yaml
steps:
  - id: custom_analysis
    action: copilot.send
    inputs:
      prompt: 'Analyze this database schema'
      systemMessage: |
        You are a database optimization expert.
        Focus on:
        - Index usage
        - Query performance
        - Normalization issues
    output_variable: analysis
```

### Multi-Turn Conversations

```yaml
steps:
  - id: create_session
    action: copilot.createSession
    inputs:
      sessionId: 'code-review-session'
      model: gpt-4.1
    output_variable: session

  - id: first_question
    action: session.send
    inputs:
      prompt: 'What are the security issues in this code?'
    output_variable: answer1

  - id: follow_up
    action: session.send
    inputs:
      prompt: 'How would you fix the authentication issue?'
    output_variable: answer2
```

## Configuration Options

### Model Selection

Available models (as of January 2026):

- `gpt-4.1` (default) - Latest GPT-4 turbo
- `gpt-5` - Newest model
- `claude-sonnet-4.5` - Anthropic Claude
- `claude-opus-4` - Most capable Claude model

```yaml
tools:
  copilot:
    adapter: github-copilot
    config:
      model: gpt-5
```

### Custom CLI Path

If Copilot CLI is not in your PATH:

```yaml
tools:
  copilot:
    adapter: github-copilot
    auth:
      cli_path: /custom/path/to/copilot
```

### External CLI Server

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
      cli_url: localhost:4321
```

### Advanced Options

```yaml
tools:
  copilot:
    adapter: github-copilot
    config:
      model: gpt-4.1
      autoStart: true # Auto-start CLI (default)
      logLevel: info # info, debug, error, warning, none, all
      excludeFiles: # Files to exclude from automatic context loading
        - 'CLAUDE.md'
        - 'AGENTS.md'
        - '.env'
        - '*.log'
    auth:
      cli_path: copilot # Custom CLI path
      # OR
      cli_url: localhost:4321 # External server (mutually exclusive)
```

**Exclude Files**: Use `excludeFiles` to prevent certain files from being automatically loaded into the AI context. This is useful for:
- Filtering out large documentation files (CLAUDE.md, AGENTS.md)
- Excluding sensitive files (.env, credentials)
- Removing log files and build artifacts
- Improving context efficiency by focusing on relevant code

## Complete Example: AI Code Review

See the full example in [`examples/copilot-code-review/`](../examples/copilot-code-review/):

```yaml
---
workflow:
  id: pr-review
  name: 'AI Code Review with GitHub Copilot'

tools:
  copilot:
    adapter: github-copilot
  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'

triggers:
  - type: webhook
    path: /github-pr

steps:
  # 1. Fetch PR files
  - id: fetch_pr
    action: github.pulls.listFiles
    inputs:
      owner: '{{ webhook.repository.owner }}'
      repo: '{{ webhook.repository.name }}'
      pull_number: '{{ webhook.pull_request.number }}'
    output_variable: pr_files

  # 2. Review with Copilot
  - id: review_code
    action: copilot.send
    inputs:
      prompt: |
        Review these pull request files for:
        - Security vulnerabilities
        - Performance issues
        - Code quality concerns

        Categorize findings as: Critical, Warning, or Suggestion
      attachments: '{{ pr_files | map_files }}'
      systemMessage: |
        You are a senior code reviewer.
        Focus on security, performance, and maintainability.
    output_variable: review

  # 3. Post review comment
  - id: post_comment
    action: github.pulls.createReview
    inputs:
      owner: '{{ webhook.repository.owner }}'
      repo: '{{ webhook.repository.name }}'
      pull_number: '{{ webhook.pull_request.number }}'
      body: '{{ review }}'
      event: COMMENT
---
```

## Programmatic Usage

You can also use the adapter directly in TypeScript:

```typescript
import { GitHubCopilotClient } from '@marktoflow/integrations';

// Create client
const client = new GitHubCopilotClient({
  model: 'gpt-4.1',
  cliPath: 'copilot', // Optional
});

// Send a message
const response = await client.send({
  prompt: 'Explain async/await in JavaScript',
});

console.log(response);

// Stream a response
await client.stream({
  prompt: 'Write a REST API server',
  onChunk: (chunk) => process.stdout.write(chunk),
  onComplete: (full) => console.log('\n\nDone!'),
});

// Check authentication
const isAuthed = await client.checkAuth();
if (!isAuthed) {
  console.error('Please run: copilot auth login');
}

// Cleanup
await client.stop();
```

## Troubleshooting

### Authentication Issues

**Problem:** Copilot fails to authenticate

```bash
# Check authentication status
copilot ping

# Re-authenticate
copilot auth logout
copilot auth login

# Verify subscription
# Visit https://github.com/settings/copilot
```

**Important:** The adapter does **not** use API keys. All authentication is via OAuth through the CLI.

### CLI Not Found

**Problem:** `copilot: command not found`

```bash
# Check if CLI is in PATH
which copilot

# If not found, specify full path in workflow
tools:
  copilot:
    adapter: github-copilot
    auth:
      cli_path: /usr/local/bin/copilot
```

### Connection Issues

**Problem:** CLI fails to connect

```bash
# Run CLI in server mode separately
copilot --server --port 4321

# Connect workflow to external server
tools:
  copilot:
    adapter: github-copilot
    auth:
      cli_url: localhost:4321
```

### Rate Limiting

**Problem:** "Rate limit exceeded"

Copilot has request quotas. If you hit limits:

1. Wait a few minutes - Limits reset periodically
2. Check your subscription tier at https://github.com/settings/copilot
3. Add retry logic to your workflow:

```yaml
steps:
  - id: generate
    action: copilot.send
    inputs:
      prompt: 'Your prompt here'
    retry:
      max_attempts: 3
      backoff: exponential
      initial_delay: 5000
```

### Large File Handling

**Problem:** Timeout or errors with large files

```yaml
# Filter files by size
steps:
  - id: filter_files
    action: script.execute
    inputs:
      code: |
        // Skip files over 100KB
        const files = context.pr_files.filter(f => 
          f.size < 100000
        );
        return { files };
```

## Authentication Architecture

```
User → copilot auth login → GitHub OAuth → Token saved to ~/.copilot/

Workflow → GitHubCopilotClient → spawns CLI → uses saved token → GitHub Copilot API
```

**Key Points:**

1. **OAuth only** - No API keys supported
2. **CLI-managed** - Authentication handled by Copilot CLI
3. **One-time setup** - Run `copilot auth login` once per machine
4. **SDK transparent** - Adapter automatically uses CLI's credentials

## Comparison: Native SDK vs OpenCode

| Feature                 | Native SDK (`github-copilot`) | OpenCode with Copilot     |
| ----------------------- | ----------------------------- | ------------------------- |
| **Setup**               | `copilot auth login`          | `opencode /connect`       |
| **Authentication**      | OAuth (CLI-managed)           | OAuth (OpenCode-managed)  |
| **Models**              | Copilot models only           | 75+ providers             |
| **File attachments**    | ✅ Yes                        | ❌ No (string only)       |
| **Streaming**           | ✅ Yes                        | ✅ Yes (server mode)      |
| **Multi-turn sessions** | ✅ Yes                        | ✅ Yes (server mode)      |
| **Built-in tools**      | ✅ File/Git operations        | ❌ No                     |
| **Backend switching**   | ❌ No                         | ✅ Yes                    |
| **Use case**            | Copilot-specific features     | Multi-backend flexibility |

**Recommendation:**

- Use **native SDK** for GitHub Copilot-specific features (file attachments, sessions)
- Use **OpenCode** if you need to switch between multiple AI providers

## Next Steps

- ✅ [Complete SDK Analysis](./COPILOT_SDK_ANALYSIS.md) - Technical deep-dive
- ✅ [Example Workflow](../examples/copilot-code-review/) - Production-ready code review
- ✅ [Integrations README](../packages/integrations/README.md) - All adapters
- ✅ [OpenCode with Copilot](./OPENCODE.md#using-github-copilot-as-opencode-backend) - Alternative approach

## Support

- **GitHub Copilot Support**: https://support.github.com/
- **SDK Repository**: https://github.com/github/copilot-sdk
- **marktoflow Issues**: https://github.com/scottgl9/marktoflow/issues

---

**Last Updated:** January 2026
**Copilot CLI Version:** Latest
**SDK Version:** @github/copilot-sdk@0.1.18+
