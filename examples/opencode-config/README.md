# OpenCode Configuration Examples

This directory demonstrates different ways to configure the OpenCode agent adapter.

## Overview

The OpenCode adapter supports two execution modes:

1. **CLI Mode**: Uses `opencode run` subprocess calls (simple, no server needed)
2. **Server Mode**: REST API calls to `opencode serve` (better performance, more features)
3. **Auto Mode**: Tries server first, falls back to CLI (default)

## Prerequisites

Install OpenCode CLI:
```bash
# Follow instructions at https://github.com/opencode-ai/opencode
```

Configure OpenCode with your preferred backend:
```bash
# For GitHub Copilot (recommended - no API key needed)
opencode /connect
# Select "GitHub Copilot" and complete authentication

# OR for local models
# Edit ~/.config/opencode/opencode.json
```

## Configuration Examples

### 1. Auto Mode (Recommended)

**File: `config-auto.yaml`**

Uses server if available, falls back to CLI automatically.

```yaml
agent:
  name: opencode
  extra:
    opencode_mode: auto  # Try server, fallback to CLI
```

### 2. CLI Mode Only

**File: `config-cli.yaml`**

Always uses subprocess calls, never requires server.

```yaml
agent:
  name: opencode
  extra:
    opencode_mode: cli
    opencode_cli_path: opencode  # Or full path: /usr/local/bin/opencode
```

### 3. Server Mode with Auto-Start

**File: `config-server-autostart.yaml`**

Automatically starts `opencode serve` if not running.

```yaml
agent:
  name: opencode
  extra:
    opencode_mode: server
    opencode_server_url: http://localhost:4096
    opencode_server_autostart: true
```

### 4. Server Mode (Manual)

**File: `config-server.yaml`**

Requires you to manually start the server first.

```bash
# Terminal 1: Start server
opencode serve --port 4096

# Terminal 2: Run workflow
marktoflow run workflow.md
```

```yaml
agent:
  name: opencode
  extra:
    opencode_mode: server
    opencode_server_url: http://localhost:4096
    opencode_server_autostart: false
```

## Backend Configuration

OpenCode backend (LLM provider) is configured in your OpenCode config file, not in marktoflow.

### GitHub Copilot (No API Key Needed)

Official support as of Jan 2026. Works with Pro, Pro+, Business, or Enterprise subscriptions.

```bash
opencode /connect
# Select: GitHub Copilot
```

### Local Models (Ollama)

Free and private. Edit `~/.config/opencode/opencode.json`:

```json
{
  "providers": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "baseURL": "http://localhost:11434/v1"
    }
  },
  "model": "ollama/qwen3:8b",
  "small_model": "ollama/llama3.2:1b"
}
```

### Other Providers

OpenCode supports 75+ providers including:
- OpenAI (gpt-4, gpt-4o)
- Anthropic (claude-3.5-sonnet)
- Google (gemini-pro)
- Local: vLLM, LM Studio, Jan.ai
- And many more

See: https://opencode.ai/docs/providers/

## Performance Comparison

| Mode | Startup | Request Latency | Features | Use Case |
|------|---------|-----------------|----------|----------|
| CLI | Fast | ~500ms overhead | Basic | Simple workflows, one-off tasks |
| Server | Slow (initial) | ~50ms overhead | Full (streaming, sessions) | Complex workflows, multiple requests |
| Auto | Medium | Mixed | Full | General purpose (recommended) |

## Troubleshooting

### "OpenCode CLI not found"
```bash
# Check installation
which opencode

# If not installed, follow: https://github.com/opencode-ai/opencode
```

### "OpenCode server not running"
```bash
# Check if server is up
curl http://localhost:4096/health

# Start manually
opencode serve --port 4096

# OR enable auto-start in config
opencode_server_autostart: true
```

### "Authentication failed"
```bash
# Check OpenCode configuration
cat ~/.config/opencode/opencode.json

# Reconfigure provider
opencode /connect
```

## Example Workflow

See `workflow.md` for a complete example using OpenCode.
