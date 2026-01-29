# OpenAI Codex Code Review Example

This example demonstrates how to use the OpenAI Codex SDK integration for automated code review workflows.

## Features

- **Deep Code Analysis**: Uses Codex's high reasoning effort for thorough code review
- **Structured Output**: Extracts issues in a parseable JSON format
- **Multi-Focus Review**: Analyzes security, performance, code quality, and TypeScript
- **Web Search**: Can research best practices for critical issues
- **Thread Persistence**: Maintains context for follow-up queries

## Prerequisites

1. **OpenAI API Key**: Set `OPENAI_API_KEY` environment variable
2. **GitHub Token**: Set `GITHUB_TOKEN` for repository access
3. **Codex CLI** (optional): Install for local execution

## Configuration

```yaml
tools:
  codex:
    sdk: '@openai/codex-sdk'
    auth:
      api_key: '${OPENAI_API_KEY}'
    options:
      model: 'codex-1'           # or 'o3', 'o3-mini', 'o4-mini'
      sandboxMode: 'read-only'   # 'read-only' | 'workspace-write' | 'danger-full-access'
      reasoningEffort: 'high'    # 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
      skipGitRepoCheck: true
      excludeFiles:              # Files to exclude from automatic context loading
        - 'CLAUDE.md'
        - 'AGENTS.md'
        - '.env'
        - '*.log'
```

## Available Actions

| Action | Description |
|--------|-------------|
| `codex.chat` | General chat with optional web search |
| `codex.codeModify` | Modify code with workspace write access |
| `codex.codeAnalyze` | Analyze code (read-only) |
| `codex.codeReview` | Comprehensive code review |
| `codex.webSearch` | Web research capability |
| `codex.execute` | Execute shell commands |
| `codex.structured` | Get structured JSON output |
| `codex.resume` | Resume a previous thread |
| `codex.withImages` | Process with image inputs |

## Sandbox Modes

- **read-only**: Safe for analysis, no file modifications
- **workspace-write**: Can modify files in working directory
- **danger-full-access**: Full system access (use with caution)

## Reasoning Effort

Higher reasoning effort provides deeper analysis but takes longer:

- **minimal**: Quick responses, basic analysis
- **low**: Faster responses, light analysis
- **medium**: Balanced speed and depth (default)
- **high**: Thorough analysis, recommended for code review
- **xhigh**: Maximum depth, for complex problems

## Usage

```bash
# Run the workflow
marktoflow run examples/codex-config/workflow.md \
  --input repository=owner/repo \
  --input pull_number=123

# With custom focus areas
marktoflow run examples/codex-config/workflow.md \
  --input repository=owner/repo \
  --input pull_number=123 \
  --input focus_areas='["security","performance"]'
```

## Thread Resumption

Codex supports resuming conversations for follow-up queries:

```yaml
# Initial review
action: codex.codeReview
inputs:
  prompt: "Review this PR"
output_variable: initial_review

# Follow-up using same thread
action: codex.resume
inputs:
  threadId: '{{ initial_review.threadId }}'
  prompt: "Now suggest specific tests for the issues found"
output_variable: test_suggestions
```

## Example Output

```json
{
  "summary": "The PR introduces a new authentication module with moderate security concerns.",
  "issues": [
    {
      "severity": "critical",
      "category": "security",
      "file": "src/auth.ts",
      "line": 45,
      "description": "Password stored without hashing",
      "fix": "Use bcrypt.hash() before storing"
    }
  ],
  "stats": {
    "total": 5,
    "critical": 1,
    "warnings": 2,
    "suggestions": 2
  }
}
```

## Related Examples

- [GitHub Copilot Code Review](../copilot-code-review/) - Similar workflow using GitHub Copilot
- [Claude Agent SDK](../claude-agent-sdk/) - Workflow using Claude Agent SDK
- [Code Review](../code-review/) - Basic code review workflow
