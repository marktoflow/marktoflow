# AI Code Review with GitHub Copilot

> **Author:** Scott Glover <scottgl@gmail.com>

Automated code review workflow that uses GitHub Copilot to analyze pull requests for security vulnerabilities, performance issues, and code quality concerns.

## Features

- 🔍 **Comprehensive Analysis**: Reviews code for security, performance, and quality
- 🤖 **AI-Powered**: Uses GitHub Copilot's advanced language models
- 📊 **Issue Categorization**: Classifies issues by severity (Critical, Warning, Suggestion)
- 💬 **Automatic Comments**: Posts detailed review as PR comment
- 🏷️ **Smart Labeling**: Adds labels based on findings
- 🔔 **Team Notifications**: Alerts team on Slack for critical issues

## Prerequisites

1. **GitHub Copilot Subscription**
   - Individual, Business, or Enterprise plan
   - [Sign up here](https://github.com/features/copilot)

2. **Copilot CLI Installed**

   ```bash
   # Install via npm
   npm install -g @githubnext/github-copilot-cli

   # Or follow official guide
   # https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli
   ```

3. **Authenticate CLI via OAuth**

   The Copilot adapter uses **OAuth authentication** (not API keys). Run this one-time setup:

   ```bash
   copilot auth login
   ```

   This will:
   - Open your browser to GitHub's OAuth consent page
   - Prompt you to authorize GitHub Copilot CLI
   - Save the OAuth token locally in `~/.copilot/`

   **No API keys needed** - the workflow automatically uses the CLI's stored token.

4. **Verify Authentication**

   ```bash
   # Check CLI version
   copilot --version

   # Test connectivity
   copilot ping
   ```

## Setup

### 1. Install marktoflow

```bash
npm install -g @marktoflow/cli@alpha
```

### 2. Set Environment Variables

Create a `.env` file:

```bash
# GitHub Personal Access Token (for GitHub API access, NOT Copilot auth)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Optional: Slack webhook for notifications
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx
```

**Important**: The `GITHUB_TOKEN` is for accessing the GitHub API (fetching PRs, posting comments). Copilot authentication is handled separately via the CLI's OAuth flow (see Prerequisites above).

### 3. Configure GitHub Webhook

Set up a webhook in your GitHub repository to trigger on PR events:

**Webhook URL**: `https://your-domain.com/github-pr`

**Events**:

- Pull requests (opened, synchronize)

**Content type**: `application/json`

### 4. Run the Workflow

```bash
# Start workflow server
marktoflow run workflow.md --server --port 3000

# Or run manually for a specific PR
marktoflow run workflow.md --input repository=owner/repo --input pull_number=123
```

## How It Works

```
┌─────────────────┐
│  PR Opened/     │
│  Updated        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fetch PR Files │
│  & Contents     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Copilot        │
│  Analyzes Code  │
│  - Security     │
│  - Performance  │
│  - Quality      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Generate       │
│  Review Comment │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Post to PR &   │
│  Add Labels     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Notify Team    │
│  (if critical)  │
└─────────────────┘
```

## Example Review Output

````markdown
## 🤖 AI Code Review by GitHub Copilot

### Summary

Overall code quality is good with minor improvements needed. Found 2 security
concerns in authentication handling and 3 performance optimizations for database
queries. Recommend addressing critical issues before merging.

**Issues Found**: 8 total

- 🔴 Critical: 2
- 🟡 Warnings: 3
- 🟢 Suggestions: 3

---

### Detailed Analysis

#### 🔴 Security Issues

**src/auth.ts:45**

- Password comparison using `===` instead of timing-safe comparison
- **Suggestion**: Use `crypto.timingSafeEqual()` to prevent timing attacks

```typescript
// Current (vulnerable)
if (inputPassword === storedPassword) { ... }

// Recommended
if (crypto.timingSafeEqual(
  Buffer.from(inputPassword),
  Buffer.from(storedPassword)
)) { ... }
```
````

#### 🟡 Performance Issues

**src/database.ts:23**

- N+1 query problem in user lookup loop
- **Suggestion**: Use batch query with `WHERE IN` clause

...

````

## Configuration Options

### Focus Areas

Customize what Copilot reviews:

```yaml
inputs:
  focus_areas:
    - security          # Security vulnerabilities
    - performance       # Performance bottlenecks
    - code_quality      # Best practices, readability
    - testing           # Test coverage, quality
    - documentation     # Code comments, docs
````

### Model Selection

Choose different Copilot models:

```yaml
tools:
  copilot:
    adapter: github-copilot
    config:
      model: gpt-5 # Newest model
      # model: claude-sonnet-4.5  # Alternative model
      # model: gpt-4.1            # Default
```

### Custom System Message

Adjust reviewer persona:

```yaml
action: copilot.send
inputs:
  systemMessage: |
    You are a senior security engineer reviewing code for:
    - OWASP Top 10 vulnerabilities
    - Authentication/authorization issues
    - Sensitive data exposure
    - Cryptographic failures
```

## Advanced Usage

### Review Specific Files Only

Filter which files to review:

```yaml
action: script.execute
inputs:
  code: |
    // Only review TypeScript/JavaScript files
    const files = context.pr_files.data.filter(f => 
      f.filename.match(/\.(ts|js|tsx|jsx)$/)
    );
    return { files };
```

### Multi-Pass Review

Run multiple specialized reviews:

```yaml
# Security-focused review
- action: copilot.send
  inputs:
    prompt: '{{ code }}'
    systemMessage: 'Security expert focusing on OWASP Top 10'
  output_variable: security_review

# Performance-focused review
- action: copilot.send
  inputs:
    prompt: '{{ code }}'
    systemMessage: 'Performance engineer focusing on optimization'
  output_variable: performance_review
```

### Streaming for Large PRs

For PRs with many files, use streaming:

```yaml
action: copilot.stream
inputs:
  prompt: '{{ large_pr_content }}'
  onChunk: '{{ print_progress }}'
output_variable: review
```

## Troubleshooting

### Authentication Issues

If Copilot fails to authenticate:

```bash
# Check authentication status
copilot ping

# Re-authenticate
copilot auth logout
copilot auth login

# Verify subscription at https://github.com/settings/copilot
```

**Remember**: Copilot uses OAuth, not API keys. The `GITHUB_TOKEN` in `.env` is only for GitHub API access.

### CLI Not Found

```bash
# Check if CLI is in PATH
which copilot

# If not found, specify full path
tools:
  copilot:
    adapter: github-copilot
    auth:
      cli_path: /usr/local/bin/copilot
```

### Connection Issues

If Copilot CLI fails to connect:

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

Copilot has request quotas. If you hit limits:

```yaml
retry:
  max_attempts: 3
  backoff: exponential
  initial_delay: 5000
```

### Large File Handling

For PRs with huge files:

```yaml
action: script.execute
inputs:
  code: |
    // Skip files over 1000 lines
    const files = context.pr_files.data.filter(f => 
      f.changes < 1000
    );
    return { files };
```

## Best Practices

1. **Review in Chunks**: Break large PRs into smaller reviews
2. **Focus Areas**: Prioritize critical areas (security > performance > style)
3. **Human Oversight**: AI reviews should complement, not replace, human reviewers
4. **Iterate**: Refine prompts based on review quality
5. **Feedback Loop**: Use review comments to improve future reviews

## Limitations

- **Context Window**: Very large PRs may exceed model context limits
- **False Positives**: AI may flag non-issues; always verify
- **Language Support**: Best for popular languages (JS, TS, Python, Go, etc.)
- **Business Logic**: AI can't understand domain-specific requirements

## Related Examples

- [Daily Standup](../daily-standup/) - Team updates with AI summarization
- [Incident Response](../incident-response/) - Automated incident handling
- [Dependency Update](../dependency-update/) - Automated dependency updates

## Resources

- [GitHub Copilot Docs](https://docs.github.com/copilot)
- [Copilot CLI Guide](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli)
- [Copilot SDK Analysis](../../docs/COPILOT_SDK_ANALYSIS.md)
- [marktoflow Documentation](../../README.md)

## License

MIT
