# Claude Code Setup Guide for marktoflow

This guide shows you how to configure marktoflow's Claude Code adapter to use Anthropic's Claude via the official CLI.

## Why Claude Code?

✅ **Highest Quality** - Anthropic's Claude 3.5 Sonnet, state-of-the-art AI
✅ **Native Tool Calling** - Built-in function calling and tool use
✅ **Extended Thinking** - Access to Claude's advanced reasoning mode
✅ **File Context** - Automatically understands your project files
✅ **MCP Support** - Native Model Context Protocol integration
✅ **200K Context** - Massive context window for large codebases

## Prerequisites

### 1. Claude Code CLI

Install the Claude Code CLI:

```bash
# Installation instructions from:
# https://github.com/anthropics/claude-code

# Verify installation
claude --version
```

### 2. Anthropic API Key

You need an Anthropic API key:

1. Sign up at: https://console.anthropic.com/
2. Generate an API key
3. Set it as an environment variable:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."

# Or configure via Claude Code
claude config set api_key YOUR_API_KEY
```

## Setup Steps

### Step 1: Verify Claude Code Works

Test Claude Code independently:

```bash
claude -p "Say hello"
```

You should see a response from Claude. If this works, you're ready to use it with marktoflow!

### Step 2: Configure marktoflow

Create a workflow configuration:

**Basic Configuration:**

```yaml
# config.yaml
agent:
  name: claude-code
  provider: anthropic
  extra:
    claude_code_mode: cli
    claude_code_model: sonnet  # sonnet, opus, or haiku
```

**Advanced Configuration:**

```yaml
# config-advanced.yaml
agent:
  name: claude-code
  provider: anthropic
  extra:
    # Execution mode
    claude_code_mode: cli

    # Model selection
    claude_code_model: sonnet  # Best balance

    # Working directory for file context
    working_directory: .

    # Timeout for long operations (seconds)
    claude_code_timeout: 600

timeout: 600
max_retries: 2
```

### Step 3: Create a Workflow

Create a test workflow:

```markdown
---
name: Claude Code Test
description: Test Claude Code integration
agent: claude-code
version: 1.0.0
---

# Test Workflow

## Generate Code

```yaml
id: generate_code
action: agent.generate_response
inputs:
  context: "Write a Python function to calculate factorial"
output: code
```

## Analyze Code

```yaml
id: analyze_code
action: agent.analyze
inputs:
  prompt_template: "Analyze this code: {{ code }}"
  categories:
    quality: "Code quality"
    improvements: "Improvements"
output: analysis
```
```

### Step 4: Run the Workflow

```bash
# Run with default config
marktoflow run test-workflow.md

# Run with custom config
marktoflow run test-workflow.md --config config-advanced.yaml
```

## Model Selection

Choose the right model for your use case:

| Model | Speed | Quality | Cost | Context | Best For |
|-------|-------|---------|------|---------|----------|
| **Sonnet 3.5** | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | $$ | 200K | General use (recommended) |
| **Opus 3** | ⚡⚡ | ⭐⭐⭐⭐⭐ | $$$ | 200K | Complex tasks, highest quality |
| **Haiku 3** | ⚡⚡⚡⚡ | ⭐⭐⭐ | $ | 200K | Simple tasks, speed matters |

### Configure Model

```yaml
# In config.yaml
extra:
  claude_code_model: sonnet  # Change to opus or haiku
```

Or via CLI:

```bash
claude config set model claude-3-5-sonnet-20241022
```

## Features

### File-Based Context

Claude Code automatically has access to files in your working directory:

```yaml
# Configure working directory
extra:
  working_directory: ./src
```

Now Claude can:
- Read any file in `./src`
- Understand project structure
- Reference code across files
- Make contextual suggestions

**Example workflow:**

```yaml
inputs:
  context: "Review the authentication.py file for security issues"
```

Claude will automatically find and analyze `./src/authentication.py`!

### Extended Thinking

Claude Code supports extended thinking for complex reasoning:

```yaml
# Future feature
inputs:
  enable_extended_thinking: true
```

This gives Claude more time to think through complex problems.

### MCP Integration

Claude Code has native MCP (Model Context Protocol) support.

Configure MCP servers in your Claude Code config:

```json
// ~/.config/claude/config.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    }
  }
}
```

See: https://docs.anthropic.com/claude/docs/mcp

## Cost Management

### Pricing

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Sonnet 3.5 | $3 | $15 |
| Opus 3 | $15 | $75 |
| Haiku 3 | $0.25 | $1.25 |

### Cost Optimization Tips

1. **Use Haiku for simple tasks**
   ```yaml
   claude_code_model: haiku
   ```

2. **Limit context**
   ```yaml
   working_directory: ./specific-folder  # Not entire project
   ```

3. **Focused prompts**
   - Be specific about what you need
   - Avoid open-ended questions
   - Request minimal necessary output

4. **Monitor usage**
   ```bash
   # Check usage at
   # https://console.anthropic.com/settings/usage
   ```

### Estimated Costs

| Workflow Type | Tokens | Model | Cost |
|---------------|--------|-------|------|
| Simple code gen | ~5K | Haiku | $0.006 |
| Code review | ~20K | Sonnet | $0.36 |
| Complex analysis | ~50K | Opus | $2.25 |

## Comparison with Other Agents

| Feature | Claude Code | OpenCode |
|---------|-------------|----------|
| **Quality** | ⭐⭐⭐⭐⭐ Highest | ⭐⭐⭐⭐ Varies |
| **Cost** | $$ API usage | $ - Free with Copilot |
| **Setup** | API key | Multiple options |
| **Context** | 200K tokens | Varies (up to 200K) |
| **Tool Calling** | Native ✅ | Via provider |
| **Extended Thinking** | Yes ✅ | Model dependent |
| **MCP Support** | Native ✅ | Native ✅ |
| **File Context** | Excellent ✅ | Good |

**When to use Claude Code:**
- Highest quality AI needed
- Complex reasoning required
- Code analysis and generation
- Budget for API costs
- Want Anthropic's latest models

**When to use OpenCode:**
- Free backend preferred (Copilot/Ollama)
- Flexible provider choice
- No API costs
- Want to try different models

## Troubleshooting

### "Claude Code CLI not found"

**Check installation:**
```bash
which claude
```

**If not found:**
```bash
# Install from
# https://github.com/anthropics/claude-code
```

### "API key not set"

**Set environment variable:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Or configure globally:**
```bash
claude config set api_key YOUR_KEY

# Verify
claude config show
```

### "Rate limit exceeded"

Anthropic API has rate limits:
- **Free tier**: Limited requests
- **Paid tier**: Higher limits based on plan

**Solutions:**
1. Wait for rate limit reset
2. Upgrade to higher tier
3. Reduce request frequency
4. Use Haiku model (higher limits)

### "Timeout errors"

For long-running tasks:

```yaml
extra:
  claude_code_timeout: 900  # 15 minutes
```

### "Permission denied"

If Claude Code can't access files:

```yaml
extra:
  working_directory: .  # Use current directory
```

Make sure the workflow is run from the correct directory.

## Advanced Features

### Custom CLI Path

If Claude is not in your PATH:

```yaml
extra:
  claude_code_cli_path: /usr/local/bin/claude
```

### Environment Variables

Pass environment variables to Claude:

```bash
export ANTHROPIC_API_KEY="..."
export CLAUDE_MODEL="claude-3-5-sonnet-20241022"

marktoflow run workflow.md
```

### Integration with Other Tools

Claude Code works well with:
- **Git**: Automatically understands git context
- **MCP Servers**: Add custom tools and data sources
- **IDEs**: Can reference code from your editor

## SDK Mode (Python)

SDK integration is supported via `claude-agent-sdk`:

```yaml
agent:
  name: claude-code
  provider: anthropic
  extra:
    claude_code_mode: sdk  # Use Python SDK

# Optional SDK settings
#   claude_code_sdk_system_prompt: "You are a helpful assistant."
#   claude_code_sdk_max_turns: 1
#   claude_code_sdk_allowed_tools: ["Read", "Write"]
#   claude_code_sdk_disallowed_tools: ["Shell"]
#   claude_code_sdk_permission_mode: "bypassPermissions"
#   claude_code_sdk_setting_sources: ["local", "project"]
```

**Benefits:**
- Better streaming support
- More control over parameters
- Direct Python integration
- Lower latency
- Session management

Install: `pip install claude-agent-sdk`

See: https://github.com/anthropics/claude-agent-sdk-python

## Examples

See the [examples/claude-code-config/](../examples/claude-code-config/) directory for:
- Configuration examples
- Sample workflows
- Best practices
- Advanced use cases

## Resources

- **Claude Code**: https://github.com/anthropics/claude-code
- **Anthropic Console**: https://console.anthropic.com/
- **Claude API Docs**: https://docs.anthropic.com/
- **MCP Documentation**: https://docs.anthropic.com/claude/docs/mcp
- **Claude SDK** (future): https://github.com/anthropics/claude-agent-sdk-python

---

**Status:** ✅ CLI Mode Ready | ✅ SDK Mode Ready
**Last Updated:** January 2026
