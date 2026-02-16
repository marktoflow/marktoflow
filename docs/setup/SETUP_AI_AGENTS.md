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

## Local LLM Setup (llama.cpp, VLLM, LM Studio, etc.)

Any server that implements the OpenAI-compatible API works with marktoflow, including **llama.cpp**, **VLLM**, **LM Studio**, **text-generation-webui**, and **LocalAI**.

### llama.cpp

```bash
# Start llama.cpp with OpenAI-compatible API and tool calling support
llama-server -m model.gguf --port 8000 --jinja
```

The `--jinja` flag enables tool calling support via chat templates.

### Workflow Configuration

```yaml
tools:
  ai:
    sdk: openai
    auth:
      base_url: http://localhost:8000/v1
      api_key: dummy              # Required by SDK, not validated locally
    options:
      model: auto                 # Auto-detect model from server
```

When `model: auto` is set (or model is omitted) with a custom `base_url`, marktoflow queries the `/v1/models` endpoint and auto-selects the first available model.

### Tool Calling (Agentic Workflows)

The OpenAI adapter supports full tool calling / function calling, enabling agentic workflows where the model decides which tools to call:

```yaml
steps:
  - id: research
    action: ai.chatWithTools
    inputs:
      messages:
        - role: system
          content: "Use tools to answer questions."
        - role: user
          content: "{{ inputs.query }}"
      tools:
        - type: function
          function:
            name: search
            description: Search for information
            parameters:
              type: object
              properties:
                query: { type: string }
              required: [query]
      tool_choice: auto
      maxTurns: 5
    output_variable: result
```

The agentic loop works as follows:
1. Send messages + tool definitions to the model
2. If the model returns `tool_calls`, execute each tool
3. Append tool results and re-send to the model
4. Repeat until the model returns a text response or `maxTurns` is reached

### Structured Output (JSON Mode)

Force valid JSON responses using `generateJSON` or `generateStructured`:

```yaml
# JSON mode — returns parsed JSON object
- id: extract
  action: ai.generateJSON
  inputs:
    messages:
      - role: user
        content: "Extract entities from: {{ inputs.text }}"

# Schema-validated output
- id: classify
  action: ai.generateStructured
  inputs:
    messages:
      - role: user
        content: "Classify: {{ inputs.text }}"
    schema:
      name: classification
      schema:
        type: object
        properties:
          label: { type: string, enum: [spam, ham] }
          score: { type: number }
        required: [label, score]
```

### Available Methods

| Method | Description |
|--------|-------------|
| `ai.generate` | Simple text generation from a prompt |
| `ai.chatCompletion` | Full chat completion with all parameters |
| `ai.chatWithTools` | Agentic tool-calling loop |
| `ai.generateJSON` | Chat completion with JSON mode enforced |
| `ai.generateStructured` | Chat completion with JSON Schema validation |
| `ai.chatStream` | Streaming chat completion |
| `ai.embeddings` | Generate text embeddings |
| `ai.listModels` | List available models |
| `ai.autoDetectModel` | Auto-detect and set default model from server |

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

For local endpoints, use `api_key: dummy` in the workflow config — the SDK requires a non-empty string but local servers don't validate it.

### "Connection refused" (local endpoints)

Ensure your local server is running:
```bash
# llama.cpp (with tool calling)
llama-server -m model.gguf --port 8000 --jinja

# VLLM
vllm serve model-name --port 8000

# Ollama
ollama serve

# OpenCode
opencode server
```

### Tool calling not working with local model

- Ensure your server supports the OpenAI tool calling API
- For llama.cpp, the `--jinja` flag is required for tool calling support
- The model must have a chat template that supports tools (most modern models do)
- Check that `tool_choice` is set to `auto` or `required`
