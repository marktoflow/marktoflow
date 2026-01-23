# Claude Code Configuration Examples

This directory demonstrates how to configure the Claude Code agent adapter.

## Overview

The Claude Code adapter integrates Anthropic's official CLI tool with marktoflow, bringing Claude's advanced capabilities to your automation workflows.

## Features

✅ **Native Tool Calling** - Built-in tool support with Claude's function calling
✅ **Extended Thinking** - Access to Claude's extended reasoning mode
✅ **File-Based Context** - Works with files in your project directory
✅ **MCP Support** - Native MCP server integration
✅ **Model Selection** - Choose between Sonnet, Opus, and Haiku
✅ **High Quality** - Anthropic's Claude 3.5 Sonnet (200K context)

## Prerequisites

### 1. Claude Code CLI Installed

```bash
# Install Claude Code CLI
# Follow instructions at: https://github.com/anthropics/claude-code

# Verify installation
claude --version
```

### 2. Anthropic API Key

```bash
# Set your API key
export ANTHROPIC_API_KEY="your-api-key-here"

# Or configure via Claude Code
claude config set api_key YOUR_API_KEY
```

Get your API key from: https://console.anthropic.com/

## Configuration Examples

### Basic Configuration

**File: `config-basic.yaml`**

```yaml
agent:
  name: claude-code
  provider: anthropic
  extra:
    claude_code_mode: cli
    claude_code_model: sonnet  # sonnet, opus, or haiku
```

### With Model Selection

**File: `config-models.yaml`**

```yaml
# Use Claude 3.5 Sonnet (best balance)
agent:
  name: claude-code
  provider: anthropic
  extra:
    claude_code_model: sonnet

# Use Claude 3 Opus (highest quality)
agent:
  name: claude-code
  provider: anthropic
  extra:
    claude_code_model: opus

# Use Claude 3 Haiku (fastest, cheapest)
agent:
  name: claude-code
  provider: anthropic
  extra:
    claude_code_model: haiku
```

### With Working Directory

**File: `config-workdir.yaml`**

```yaml
agent:
  name: claude-code
  provider: anthropic
  extra:
    claude_code_mode: cli
    claude_code_model: sonnet
    working_directory: /path/to/your/project  # For file context
```

### With Custom Timeout

**File: `config-timeout.yaml`**

```yaml
agent:
  name: claude-code
  provider: anthropic
  extra:
    claude_code_mode: cli
    claude_code_model: sonnet
    claude_code_timeout: 600  # 10 minutes for long tasks
```

## Model Selection Guide

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| **Sonnet 3.5** | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | $$ | General use (recommended) |
| **Opus 3** | ⚡⚡ | ⭐⭐⭐⭐⭐ | $$$ | Complex tasks, highest quality |
| **Haiku 3** | ⚡⚡⚡⚡ | ⭐⭐⭐ | $ | Simple tasks, speed matters |

**Recommendation:** Start with Sonnet 3.5 for best balance of quality and speed.

## Usage Example

### Create a Workflow

```markdown
---
name: Code Review with Claude
description: Use Claude Code for intelligent code review
agent: claude-code
version: 1.0.0
---

# Code Review Workflow

## Step 1: Analyze Code Quality

```yaml
id: analyze_code
action: agent.analyze
inputs:
  context: |
    Review the following Python file for:
    - Code quality and style
    - Potential bugs
    - Security issues
    - Performance optimizations

    File: {{ file_path }}

  categories:
    quality: Code quality issues
    bugs: Potential bugs or errors
    security: Security concerns
    performance: Performance optimizations

output: code_analysis
```

## Step 2: Generate Improvements

```yaml
id: generate_improvements
action: agent.generate_response
inputs:
  context: |
    Based on the analysis:
    {{ code_analysis }}

    Generate improved code that addresses these issues.

  requirements:
    - Maintain functionality
    - Add type hints
    - Include docstrings
    - Follow PEP 8

output: improved_code
```
```

### Run the Workflow

```bash
# Run with Claude Code
marktoflow run code-review.md --var file_path=src/mycode.py
```

## Advanced Features

### File-Based Context

Claude Code automatically has access to files in the working directory:

```yaml
agent:
  name: claude-code
  provider: anthropic
  extra:
    working_directory: ./src  # Claude can read files here
```

Claude will have context about:
- All files in the directory
- Git status (if in a git repo)
- File structure and relationships

### MCP Server Integration

Claude Code has native MCP support. Configure MCP servers:

```yaml
agent:
  name: claude-code
  provider: anthropic
  extra:
    mcp_servers:
      filesystem:
        command: npx
        args:
          - -y
          - "@modelcontextprotocol/server-filesystem"
          - /path/to/directory
```

See: https://docs.anthropic.com/claude/docs/mcp for MCP documentation

## Cost Optimization

### Token Usage

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Sonnet 3.5 | $3 | $15 |
| Opus 3 | $15 | $75 |
| Haiku 3 | $0.25 | $1.25 |

### Tips for Cost Savings

1. **Use Haiku for simple tasks**
   ```yaml
   claude_code_model: haiku  # For basic operations
   ```

2. **Limit file context**
   ```yaml
   working_directory: ./specific-dir  # Not entire project
   ```

3. **Use focused prompts**
   - Be specific about what you need
   - Avoid asking for general reviews
   - Request only necessary outputs

## Troubleshooting

### "Claude Code CLI not found"

```bash
# Check installation
which claude

# If not found, install:
# Follow: https://github.com/anthropics/claude-code
```

### "API key not set"

```bash
# Set API key
export ANTHROPIC_API_KEY="your-key"

# Or configure globally
claude config set api_key YOUR_KEY

# Verify
claude config show
```

### "Rate limit exceeded"

Claude API has rate limits:
- **Free tier**: Limited requests per day
- **Paid tier**: Higher limits based on plan

**Solutions:**
1. Wait for rate limit to reset
2. Upgrade to paid tier
3. Reduce request frequency

### "Timeout errors"

For long-running tasks:

```yaml
extra:
  claude_code_timeout: 900  # 15 minutes
```

## Comparison: Claude Code vs OpenCode

| Feature | Claude Code | OpenCode |
|---------|-------------|----------|
| **Backend** | Anthropic Claude only | 75+ providers |
| **Quality** | Highest (Claude 3.5) | Varies by backend |
| **Cost** | API usage ($) | Free (Copilot) or $ |
| **MCP Support** | Native ✅ | Native ✅ |
| **Tool Calling** | Native ✅ | Via provider |
| **File Context** | Excellent ✅ | Good |
| **Extended Thinking** | Yes ✅ | Model dependent |
| **Setup** | API key needed | Various options |

**When to use Claude Code:**
- Highest quality AI needed
- Complex reasoning tasks
- Code analysis and generation
- You have Anthropic API access

**When to use OpenCode:**
- Free backend (GitHub Copilot, Ollama)
- Flexible provider choice
- No API costs preferred
- Already using GitHub Copilot

## Future: SDK Mode

Coming soon - integration with `claude-agent-sdk-python`:

```yaml
# Future configuration
agent:
  name: claude-code
  provider: anthropic
  extra:
    claude_code_mode: sdk  # Use Python SDK instead of CLI
```

**Benefits of SDK mode:**
- Better streaming support
- More control over parameters
- Direct Python integration
- Lower latency

See: https://github.com/anthropics/claude-agent-sdk-python

## Next Steps

- ✅ [Example Workflow](./workflow.md)
- ✅ [Claude API Documentation](https://docs.anthropic.com)
- ✅ [MCP Documentation](https://docs.anthropic.com/claude/docs/mcp)
- 🚧 Testing suite (coming soon)
- 🚧 Advanced examples (coming soon)

## Resources

- **Claude Code**: https://github.com/anthropics/claude-code
- **Claude API**: https://console.anthropic.com/
- **MCP Servers**: https://github.com/modelcontextprotocol/servers
- **Claude SDK**: https://github.com/anthropics/claude-agent-sdk-python

---

**Status:** ✅ CLI Mode Ready | 🚧 SDK Mode Coming Soon
