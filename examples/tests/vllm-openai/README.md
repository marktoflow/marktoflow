# VLLM + OpenAI API Integration Test

This test validates the **OpenAI-compatible adapter** integration with **VLLM** serving the **glm-4.7-flash** model.

## ✅ Test Results

All integration tests passed successfully:

- ✅ **Model Discovery**: Lists available models via OpenAI `/v1/models` endpoint
- ✅ **Simple Generation**: Basic text generation works correctly
- ✅ **Complex Reasoning**: Handles sophisticated prompts with detailed responses
- ✅ **Chat Completions**: OpenAI-compatible chat interface works
- ✅ **Multi-turn Conversations**: Maintains conversation context across multiple turns
- ✅ **Long Context Handling**: Utilizes the 175K token context window

**Performance**: ~40 seconds for full test suite completion

## Configuration

### VLLM Setup

The test connects to a local VLLM server with the following configuration:

```yaml
Provider: VLLM (local inference)
Base URL: http://localhost:8000/v1
Model: glm-4.7-flash (cyankiwi/GLM-4.7-Flash-AWQ-4bit)
Context Limit: 175,440 tokens
Output Limit: 12,288 tokens
Features: Reasoning ✅ | Tools ✅
```

### Workflow Configuration

```yaml
tools:
  vllm:
    sdk: 'openai'              # Use OpenAI-compatible adapter
    auth:
      api_key: 'dummy-key'     # VLLM doesn't require real API key
      base_url: 'http://localhost:8000/v1'
    options:
      model: 'glm-4.7-flash'
```

## Prerequisites

### 1. Install VLLM

```bash
pip install vllm
```

### 2. Start VLLM Server

Start VLLM serving the glm-4.7-flash model:

```bash
# Example startup command
python -m vllm.entrypoints.openai.api_server \
  --model cyankiwi/GLM-4.7-Flash-AWQ-4bit \
  --served-model-name glm-4.7-flash \
  --port 8000 \
  --host 0.0.0.0 \
  --max-model-len 175440
```

Verify it's running:
```bash
curl http://localhost:8000/v1/models | jq
```

Expected output should include:
```json
{
  "data": [{
    "id": "glm-4.7-flash",
    "object": "model",
    "owned_by": "vllm",
    "max_model_len": 175440
  }]
}
```

## Running the Tests

### Simple Test (2 steps, ~2 seconds)

```bash
./marktoflow run examples/tests/vllm-openai/simple-test.md
```

### Full Test Suite (7 steps, ~40 seconds)

```bash
./marktoflow run examples/tests/vllm-openai/workflow.md
```

### Custom Prompts

```bash
./marktoflow run examples/tests/vllm-openai/workflow.md \
  --input user_prompt="Explain quantum computing in 5 bullet points"
```

## What Gets Tested

### 1. Model Listing (`listModels`)

Verifies that marktoflow can query VLLM for available models via the OpenAI-compatible API.

### 2. Simple Generation

Tests basic text generation with a trivial prompt:
```
Q: What is 2+2? Answer in one word.
A: Four
```

### 3. Complex Reasoning

Tests sophisticated reasoning with prompts like:
```
Explain the difference between a compiler and an interpreter
in 3 bullet points. Be concise and clear.
```

Validates that the model can:
- Understand complex instructions
- Provide structured output
- Maintain coherent reasoning

### 4. Chat Completions

Tests the OpenAI-compatible `chat.completions` interface:
- System messages for role setting
- User messages for requests
- Proper response formatting

Example: Generate a Python factorial function with error handling.

### 5. Multi-turn Conversations

Validates conversation context maintenance:
1. User asks about code review best practices
2. Assistant responds with guidelines
3. User requests review of specific code
4. Assistant reviews using established context

### 6. Long Context Processing

Tests the 175K token context window with a complex architectural design prompt requiring:
- Multi-paragraph input
- Structured reasoning
- Detailed multi-section output

## Architecture

The integration flow:

```
marktoflow workflow
  ↓
OpenAI Adapter (openai.ts)
  ↓
HTTP POST to http://localhost:8000/v1/chat/completions
  ↓
VLLM Server
  ↓
glm-4.7-flash Model (AWQ 4-bit quantized)
  ↓
JSON response (OpenAI-compatible format)
  ↓
Parsed and returned to workflow
```

### Key Components

1. **OpenAI Adapter** (`packages/integrations/src/adapters/openai.ts`)
   - Implements OpenAI SDK wrapper
   - Handles both string and object inputs
   - Supports model override per request
   - Provides `generate()`, `chatCompletion()`, `listModels()` methods

2. **VLLM Server**
   - Exposes OpenAI-compatible `/v1/*` endpoints
   - Handles local inference with quantized model
   - Supports streaming and non-streaming modes

3. **Workflow Engine**
   - Invokes SDK methods from YAML workflow
   - Passes inputs as objects
   - Handles template rendering for results

## Troubleshooting

### Error: "Connection refused"

VLLM server isn't running.

**Fix:**
```bash
# Check if port 8000 is listening
netstat -tlnp | grep 8000

# Start VLLM if not running
python -m vllm.entrypoints.openai.api_server \
  --model cyankiwi/GLM-4.7-Flash-AWQ-4bit \
  --served-model-name glm-4.7-flash \
  --port 8000
```

### Error: "Model not found: glm-4.7-flash"

VLLM is serving a different model name.

**Fix:**
```bash
# Check what models are available
curl http://localhost:8000/v1/models | jq '.data[].id'

# Update workflow to use the correct model name
```

### Error: "400 validation errors"

This was the original bug - the `generate` method only accepted strings, not objects.

**Fix:** Already fixed in `openai.ts` by updating the method signature:
```typescript
async generate(inputs: { prompt: string; model?: string } | string, model?: string)
```

### Slow Performance

First request may be slow (~5-10s) as the model loads into GPU memory. Subsequent requests should be fast (<1s).

**Optimization:**
- Use GPU with sufficient VRAM
- Enable KV cache
- Use quantized model (AWQ/GPTQ) for lower memory usage
- Adjust `--max-model-len` based on your use case

## Production Considerations

### 1. Authentication

For production VLLM deployments, add proper authentication:

```yaml
tools:
  vllm:
    sdk: 'openai'
    auth:
      api_key: '${VLLM_API_KEY}'  # Real API key from environment
      base_url: 'https://vllm.example.com/v1'
```

### 2. Load Balancing

For high-traffic scenarios:
- Run multiple VLLM instances
- Use a load balancer (NGINX, HAProxy)
- Configure health checks on `/health` endpoint

### 3. Model Management

Use different models for different use cases:
```yaml
tools:
  vllm_fast:
    sdk: 'openai'
    options:
      model: 'glm-4.7-flash'  # Fast, smaller model

  vllm_powerful:
    sdk: 'openai'
    options:
      model: 'glm-4-9b-chat'  # Larger, more capable model
```

### 4. Monitoring

Monitor VLLM performance:
```bash
# Check VLLM metrics
curl http://localhost:8000/metrics

# Monitor GPU usage
nvidia-smi -l 1
```

### 5. Error Handling

Add retry logic for transient failures:
```yaml
tools:
  vllm:
    sdk: 'openai'
    options:
      timeout: 120000  # 2 minutes for long generations
```

## Related Documentation

- [OpenAI API Specification](https://platform.openai.com/docs/api-reference)
- [VLLM Documentation](https://docs.vllm.ai/)
- [GLM-4 Model Card](https://huggingface.co/THUDM/glm-4-9b-chat)
- [marktoflow AI Agents Guide](../../../docs/SETUP_AI_AGENTS.md)
- [marktoflow OpenAI Adapter](../../../packages/integrations/src/adapters/openai.ts)

## Next Steps

1. **Production Deployment**: Deploy VLLM to cloud with proper auth and TLS
2. **Model Fine-tuning**: Fine-tune GLM-4 for domain-specific tasks
3. **Workflow Integration**: Use VLLM in production workflows for code generation, analysis, etc.
4. **Streaming Responses**: Implement streaming for real-time output
5. **Multi-model Routing**: Route different tasks to different model sizes
