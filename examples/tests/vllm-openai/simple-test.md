---
workflow:
  id: vllm-simple-test
  name: 'Simple VLLM Test'

tools:
  vllm:
    sdk: 'openai'
    auth:
      api_key: 'dummy-key'
      base_url: 'http://localhost:8000/v1'
    options:
      model: 'glm-4.7-flash'
---

# Simple VLLM Test

## Step 1: Test Generate

```yaml
action: vllm.generate
inputs:
  prompt: 'What is 2+2? Answer in one word.'
output_variable: result
```

## Step 2: Display

```yaml
action: core.log
inputs:
  message: 'Result: {{ result }}'
```
