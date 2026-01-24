---
workflow:
  id: copilot-simple-test
  name: 'GitHub Copilot Simple Test'
  version: '1.0.0'
  description: 'Basic test of GitHub Copilot SDK adapter'

tools:
  copilot:
    sdk: github-copilot
    auth:
      cli_path: /opt/homebrew/bin/copilot
    options:
      model: gpt-4.1
      logLevel: info

outputs:
  answer:
    type: string
    description: 'Copilot response to first question'
  code_example:
    type: string
    description: 'Generated code example'
---

# GitHub Copilot Simple Test

Test GitHub Copilot SDK adapter with two simple prompts.

## Step 1: Ask a Simple Question

Send a basic question to test connectivity.

```yaml
action: copilot.send
inputs:
  prompt: 'Explain what TypeScript is in one sentence.'
  systemMessage: 'You are a helpful assistant. Be concise.'
output_variable: answer
```

## Step 2: Generate Code

Ask Copilot to generate a simple code example.

```yaml
action: copilot.send
inputs:
  prompt: |
    Write a TypeScript function called `isPrime` that:
    - Takes a number n as input
    - Returns true if n is prime, false otherwise
    - Includes JSDoc comment

    Just return the code, no explanation.
  systemMessage: 'You are an expert TypeScript developer.'
output_variable: code_example
```
