---
workflow:
  id: gemini-oauth-summarizer
  name: 'Gemini OAuth Text Summarizer'
  version: '1.0.0'
  description: 'Summarize text using Gemini via OAuth credentials from an installed gemini-cli binary — no API key required'
  author: 'marktoflow'
  tags:
    - gemini
    - oauth
    - summarization
    - ai

tools:
  gemini:
    sdk: gemini-cli
    # No api_key — uses OAuth credentials from ~/.gemini/oauth_creds.json
    # Run `marktoflow connect gemini-cli` first to authenticate
    options:
      model: gemini-2.5-flash

inputs:
  text:
    type: string
    required: true
    description: 'Text to summarize'
  style:
    type: string
    default: 'concise'
    description: 'Summary style: concise, detailed, or bullet-points'
  max_words:
    type: number
    default: 100
    description: 'Approximate maximum word count for the summary'

outputs:
  summary:
    type: string
    description: 'Generated summary'
  word_count:
    type: number
    description: 'Approximate word count of the summary'
---

# Gemini OAuth Text Summarizer

Summarizes arbitrary text using Gemini via OAuth credentials extracted automatically
from an installed `gemini-cli` binary. No API key or manual credential management needed.

## Prerequisites

Run once to authenticate:

```bash
marktoflow connect gemini-cli
```

This extracts OAuth credentials from your locally installed `gemini-cli` and saves them
to `~/.gemini/oauth_creds.json`.

---

## Step 1: Generate Summary

Call the Gemini generate action with a prompt that incorporates the user's input style
and length preferences.

```yaml
action: gemini.generate
inputs:
  prompt: |
    Summarize the following text in a {{ inputs.style }} style.
    Keep the summary to approximately {{ inputs.max_words }} words.

    Text to summarize:
    {{ inputs.text }}
  temperature: 0.3
output_variable: generation_result
```

## Step 2: Extract Summary Text

Pull the text content out of the generation result.

```yaml
action: core.set
inputs:
  summary: '{{ generation_result.text }}'
output_variable: extracted
```

## Step 3: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  summary: '{{ extracted.summary }}'
  word_count: '{{ extracted.summary | split(" ") | count }}'
```
