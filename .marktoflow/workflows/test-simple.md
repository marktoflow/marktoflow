---
workflow:
  id: test-simple
  version: "1.0.0"
  name: "Simple Test Workflow"
  description: "A simple test workflow to verify framework functionality"
  author: "marktoflow"

compatibility:
  agents:
    - opencode: supported
    - claude-code: supported

requirements:
  tools: []
  features:
    - tool_calling: optional

execution:
  timeout: 60s
  max_retries: 1
  error_handling: stop
---

# Simple Test Workflow

This is a minimal workflow to test if the marktoflow framework can execute steps correctly.

## Step 1: Generate a greeting

Generate a friendly greeting message for a user named "Alex".

```yaml
action: agent.generate_response
inputs:
  prompt: "Generate a friendly greeting message for a user named Alex. Keep it short (1-2 sentences)."
output_variable: greeting
```

## Step 2: Analyze the greeting

Analyze the sentiment of the greeting message.

```yaml
action: agent.analyze
inputs:
  text: "{{greeting}}"
  prompt: "Analyze the sentiment of this greeting. Reply with just one word: positive, negative, or neutral."
output_variable: sentiment
```

## Step 3: Create summary

Create a summary of what happened in this workflow.

```yaml
action: agent.generate_response
inputs:
  prompt: "Summarize this workflow in one sentence: We generated a greeting '{{greeting}}' with sentiment '{{sentiment}}'."
output_variable: summary
```
