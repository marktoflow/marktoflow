# OpenAI Configuration Examples

> **Author:** Scott Glover <scottgl@gmail.com>

This directory demonstrates how to configure the OpenAI adapter for OpenAI, VLLM, and other OpenAI-compatible endpoints.

## Overview

The OpenAI adapter integrates with any OpenAI-compatible API, including OpenAI's API, VLLM, and local inference servers. This provides a generic interface for AI-powered automation workflows.

## Features

- **OpenAI API** - Full support for GPT-4o, GPT-4o-mini, and other models
- **VLLM Support** - Connect to local VLLM inference servers
- **OpenAI-Compatible** - Works with any endpoint implementing the OpenAI API spec
- **Chat Completions** - Standard chat interface for all models
- **Embeddings** - Text embedding generation
- **Streaming** - Real-time streaming responses
- **Model Listing** - Discover available models

## Prerequisites

### For OpenAI API

```bash
# Set your API key
export OPENAI_API_KEY="your-api-key-here"
```

Get your API key from: https://platform.openai.com/api-keys

### For VLLM / Local Endpoints

```bash
# Start VLLM server
vllm serve glm-4.7-flash --port 8000

# Set base URL (optional - can be configured in workflow)
export OPENAI_BASE_URL="http://localhost:8000/v1"
```

## Configuration Examples

### Basic OpenAI

```yaml
tools:
  ai:
    sdk: openai
    auth:
      api_key: '${OPENAI_API_KEY}'
    options:
      model: gpt-4o
```

### VLLM / Local Endpoint

```yaml
tools:
  ai:
    sdk: vllm
    auth:
      base_url: 'http://localhost:8000/v1'
      api_key: 'dummy-key'   # Required by SDK but not validated
    options:
      model: glm-4.7-flash
```

### With Organization

```yaml
tools:
  ai:
    sdk: openai
    auth:
      api_key: '${OPENAI_API_KEY}'
    options:
      model: gpt-4o
      organization: org-abc123
      timeout: 120000  # 2 minutes
```

## Usage

### Run the Example Workflow

```bash
# With OpenAI
marktoflow run examples/tests/openai-config/workflow.md --agent openai

# With VLLM
marktoflow run examples/tests/openai-config/workflow.md --agent vllm

# With custom model
marktoflow run examples/tests/openai-config/workflow.md --agent openai --model gpt-4o-mini
```

### Available SDK Keys

| Key | Description |
|-----|-------------|
| `openai` | Standard OpenAI API |
| `openai-compatible` | Generic OpenAI-compatible endpoint |
| `vllm` | VLLM inference server |

All three keys use the same adapter, configured via `auth.base_url`.

## Cost Optimization

### Model Pricing (OpenAI)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| GPT-4o | $2.50 | $10 |
| GPT-4o-mini | $0.15 | $0.60 |

### Tips

1. **Use GPT-4o-mini for simple tasks** - Much cheaper, still capable
2. **Use focused prompts** - Be specific to reduce token usage
3. **Use VLLM for local inference** - No API costs, full control

## Next Steps

- [Example Workflow](./workflow.md)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [VLLM Documentation](https://docs.vllm.ai)

---

**Status:** Ready
