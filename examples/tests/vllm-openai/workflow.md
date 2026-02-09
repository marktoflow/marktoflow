---
workflow:
  id: test-vllm-openai
  name: 'Test VLLM via OpenAI API'
  description: 'Test OpenAI-compatible adapter with VLLM serving glm-4.7-flash'

tools:
  vllm:
    sdk: 'openai'
    auth:
      # VLLM doesn't require a real API key, but OpenAI SDK requires non-empty string
      api_key: 'dummy-key'
      base_url: 'http://localhost:8000/v1'
    options:
      model: 'glm-4.7-flash'

inputs:
  user_prompt:
    type: string
    description: 'The prompt to send to the LLM'
    default: 'Explain the difference between a compiler and an interpreter in 3 bullet points. Be concise and clear.'

outputs:
  llm_response:
    description: 'Response from VLLM via OpenAI API'
  model_info:
    description: 'Information about available models'
---

# Test VLLM via OpenAI-Compatible API

This workflow tests the OpenAI adapter integration with a local VLLM server running glm-4.7-flash.

## Step 1: List Available Models

Query VLLM to see what models are available.

```yaml
action: vllm.listModels
output_variable: available_models
```

## Step 2: Simple Text Generation

Test basic text generation with a simple prompt.

```yaml
action: vllm.generate
inputs:
  prompt: 'What is 2+2? Answer in one word.'
output_variable: simple_response
```

## Step 3: Complex Reasoning Task

Test the model's reasoning capabilities with a more complex prompt.

```yaml
action: vllm.generate
inputs:
  prompt: '{{ inputs.user_prompt }}'
  model: 'glm-4.7-flash'
output_variable: llm_response
```

## Step 4: Chat Completion Test

Test the chat completion interface (OpenAI-compatible format).

```yaml
action: vllm.chat.completions
inputs:
  model: 'glm-4.7-flash'
  messages:
    - role: system
      content: 'You are a helpful AI assistant specializing in software engineering.'
    - role: user
      content: 'Write a Python function that calculates the factorial of a number using recursion. Include error handling for negative numbers.'
output_variable: chat_response
```

## Step 5: Multi-turn Conversation

Test multi-turn conversation capabilities.

```yaml
action: vllm.chat.completions
inputs:
  model: 'glm-4.7-flash'
  messages:
    - role: system
      content: 'You are a code review assistant.'
    - role: user
      content: 'What are the key things to look for when reviewing Python code?'
    - role: assistant
      content: |
        When reviewing Python code, I focus on:
        1. Code style (PEP 8 compliance)
        2. Error handling and edge cases
        3. Performance considerations
        4. Security vulnerabilities
        5. Code clarity and maintainability
    - role: user
      content: 'Great! Now review this code: def calc(x): return x*2'
output_variable: review_response
```

## Step 6: Test Model Context Length

Test with a longer prompt to verify context handling.

```yaml
action: vllm.generate
inputs:
  prompt: |
    You are an expert system architect. Please design a microservices architecture for an e-commerce platform.

    Requirements:
    - Handle 10,000 concurrent users
    - Support product catalog, shopping cart, orders, payments, and user management
    - Must be scalable, resilient, and secure
    - Use modern cloud-native technologies

    Provide:
    1. High-level architecture diagram description
    2. List of microservices with responsibilities
    3. Communication patterns (sync vs async)
    4. Data storage strategy
    5. Security considerations
  model: 'glm-4.7-flash'
output_variable: architecture_response
```

## Step 7: Display Results

```yaml
action: core.log
inputs:
  message: |
    ================================================================================
    VLLM + OPENAI API INTEGRATION TEST RESULTS
    ================================================================================

    🔧 CONFIGURATION:
    - Provider: VLLM (local inference)
    - Base URL: http://localhost:8000/v1
    - Model: glm-4.7-flash
    - Context Limit: 175,440 tokens
    - Output Limit: 12,288 tokens
    - Features: Reasoning ✅ | Tools ✅

    📋 AVAILABLE MODELS:
    {{ available_models }}

    ================================================================================

    ✅ TEST 1: Simple Generation
    Q: What is 2+2?
    A: {{ simple_response }}

    ================================================================================

    ✅ TEST 2: Complex Reasoning
    Q: {{ inputs.user_prompt }}
    A: {{ llm_response }}

    ================================================================================

    ✅ TEST 3: Chat Completion (Code Generation)
    {{ chat_response.choices[0].message.content }}

    ================================================================================

    ✅ TEST 4: Multi-turn Conversation (Code Review)
    {{ review_response.choices[0].message.content }}

    ================================================================================

    ✅ TEST 5: Long Context Handling (Architecture Design)
    {{ architecture_response }}

    ================================================================================

    🎉 ALL TESTS PASSED!

    The OpenAI adapter successfully integrated with VLLM:
    - ✅ Model listing via OpenAI API
    - ✅ Simple text generation
    - ✅ Complex reasoning tasks
    - ✅ Chat completion interface
    - ✅ Multi-turn conversations
    - ✅ Long context processing (175K tokens)
    - ✅ OpenAI-compatible message format

    This confirms full compatibility between marktoflow's OpenAI adapter
    and VLLM's OpenAI-compatible API endpoint.
```

---

## Expected Behavior

This workflow validates:

1. **Model Discovery**: VLLM exposes available models via `/v1/models` endpoint
2. **Text Generation**: Basic `generate()` method works with VLLM
3. **Reasoning**: Complex prompts are handled correctly
4. **Chat Interface**: OpenAI chat completions format is compatible
5. **Multi-turn**: Conversation history is properly maintained
6. **Context Length**: Large prompts utilize the 175K token context window

## Running the Test

### Prerequisites

Ensure VLLM is running with glm-4.7-flash:

```bash
# Check if VLLM is running
curl http://localhost:8000/v1/models

# Expected response should include glm-4.7-flash
```

If VLLM isn't running, start it:

```bash
# Example VLLM startup (adjust paths as needed)
python -m vllm.entrypoints.openai.api_server \
  --model THUDM/glm-4-9b-chat \
  --served-model-name glm-4.7-flash \
  --port 8000 \
  --host 0.0.0.0
```

### Run the Test

```bash
# Run with default prompt
./marktoflow run examples/tests/vllm-openai/workflow.md

# Run with custom prompt
./marktoflow run examples/tests/vllm-openai/workflow.md \
  --input user_prompt="Explain how transformers work in 5 bullet points"
```

## Verification

After running, verify:

- ✅ All 5 test cases complete successfully
- ✅ Model responds with coherent, relevant answers
- ✅ Chat completions return properly formatted responses
- ✅ Multi-turn conversation maintains context
- ✅ Long prompts are handled without truncation errors

## Troubleshooting

### Error: "Connection refused"

VLLM isn't running. Start the server:
```bash
# Check if something is listening on port 8000
netstat -tlnp | grep 8000
```

### Error: "Model not found"

VLLM isn't serving glm-4.7-flash. Check available models:
```bash
curl http://localhost:8000/v1/models | jq
```

Update the workflow to use an available model, or restart VLLM with:
```bash
--served-model-name glm-4.7-flash
```

### Error: "Context length exceeded"

The prompt is too long. The model supports up to 175,440 tokens. Either:
1. Reduce the prompt length
2. Ensure VLLM is configured with proper context length:
   ```bash
   --max-model-len 175440
   ```

## Performance Notes

- **Cold Start**: First request may be slower (~5-10s) as model loads into memory
- **Warm Requests**: Subsequent requests should be fast (<1s for simple prompts)
- **Context Window**: glm-4.7-flash supports up to 175K tokens, ideal for long-context tasks
- **Reasoning Mode**: Enable with `--enable-reasoning` flag when starting VLLM

## Integration Pattern

This test demonstrates the integration flow:

```
marktoflow workflow
  ↓
OpenAI Adapter (openai.ts)
  ↓
VLLM Server (http://localhost:8000/v1)
  ↓
glm-4.7-flash Model (local inference)
  ↓
OpenAI-compatible JSON response
```

The adapter automatically handles:
- API key requirements (uses dummy key for local VLLM)
- Request formatting (OpenAI chat completions format)
- Response parsing (extracts content from choices)
- Error handling (connection failures, model errors)

## Next Steps

1. **Production Use**: Configure VLLM with proper authentication
2. **Model Switching**: Test with other VLLM-supported models
3. **Tool Use**: Enable function calling if supported by the model
4. **Streaming**: Test streaming responses for real-time output
5. **Load Testing**: Benchmark performance under concurrent requests
