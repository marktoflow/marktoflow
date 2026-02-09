# AI Agent Setup Guide for marktoflow

This guide shows you how to configure marktoflow's AI agent adapters.

## Available Agents

| Agent | CLI Flag | Description |
|-------|----------|-------------|
| Claude Agent | `--agent claude-agent` or `--agent claude` | Anthropic Claude via Agent SDK |
| OpenAI | `--agent openai` | OpenAI GPT models (also VLLM, local endpoints) |
| VLLM | `--agent vllm` | Local VLLM inference (alias for openai) |
| GitHub Copilot | `--agent copilot` | GitHub Copilot SDK |
| OpenCode | `--agent opencode` | OpenCode AI agent |
| Ollama | `--agent ollama` | Local LLM via Ollama |
| Codex | `--agent codex` | OpenAI Codex SDK |

## Claude Agent Setup

### Prerequisites

```bash
# Option 1: Set API key
export ANTHROPIC_API_KEY="your-api-key-here"

# Option 2: Use Claude CLI OAuth (no API key needed)
claude login
```

### Usage

```bash
# Run a workflow with Claude
marktoflow run workflow.md --agent claude

# With specific model
marktoflow run workflow.md --agent claude-agent --model claude-sonnet-4-20250514
```

### Workflow Configuration

```yaml
tools:
  claude:
    sdk: claude-agent
    auth:
      api_key: '${ANTHROPIC_API_KEY}'
    options:
      model: claude-sonnet-4-20250514
      permissionMode: acceptEdits
      maxTurns: 50
```

## OpenAI Setup

### Prerequisites

```bash
# For OpenAI API
export OPENAI_API_KEY="your-api-key-here"

# For VLLM / local endpoints (no key needed)
export OPENAI_BASE_URL="http://localhost:8000/v1"
```

### Usage

```bash
# Run with OpenAI
marktoflow run workflow.md --agent openai

# Run with VLLM
marktoflow run workflow.md --agent vllm --model glm-4.7-flash

# With custom model
marktoflow run workflow.md --agent openai --model gpt-4o-mini
```

### Workflow Configuration

```yaml
# OpenAI API
tools:
  ai:
    sdk: openai
    auth:
      api_key: '${OPENAI_API_KEY}'
    options:
      model: gpt-4o

# VLLM / Local endpoint
tools:
  ai:
    sdk: vllm
    auth:
      base_url: 'http://localhost:8000/v1'
      api_key: 'dummy-key'
    options:
      model: glm-4.7-flash
```

## Ollama Setup

### Prerequisites

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2
```

### Usage

```bash
marktoflow run workflow.md --agent ollama --model llama3.2
```

## OpenCode Setup

### Prerequisites

```bash
# Install OpenCode
# https://opencode.ai

# Start the server (for SDK mode)
opencode server
```

### Usage

```bash
marktoflow run workflow.md --agent opencode
```

## Troubleshooting

### "Unknown agent provider"

Make sure you're using a supported provider name:
- `claude` or `claude-agent`
- `openai`, `vllm`, or `openai-compatible`
- `copilot` or `github-copilot`
- `opencode`
- `ollama`
- `codex`

### "API key not set"

Set the appropriate environment variable:
- Claude: `ANTHROPIC_API_KEY`
- OpenAI: `OPENAI_API_KEY`
- GitHub Copilot: `GITHUB_TOKEN`

### "Connection refused" (local endpoints)

Ensure your local server is running:
```bash
# VLLM
vllm serve model-name --port 8000

# Ollama
ollama serve

# OpenCode
opencode server
```
