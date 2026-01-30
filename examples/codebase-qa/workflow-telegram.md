---
workflow:
  id: telegram-codebase-qa
  name: 'Telegram Codebase Q&A'
  version: '1.0.0'
  description: 'Answer questions about a codebase via Telegram using an AI agent'
  author: 'marktoflow'
  tags:
    - telegram
    - ai
    - code-analysis
    - qa

tools:
  telegram:
    sdk: 'telegram'
    auth:
      token: '${TELEGRAM_BOT_TOKEN}'

  agent:
    sdk: 'claude-agent'
    options:
      model: sonnet

  script:
    sdk: 'script'
    options:
      path: 'inline'

triggers:
  - type: webhook
    path: /telegram/codebase-qa
    config:
      provider: telegram
    events:
      - message

inputs:
  codebase_path:
    type: string
    required: false
    default: '${CODEBASE_PATH}'
    description: 'Absolute path to the codebase to analyze (defaults to CODEBASE_PATH env var)'
  chat_id:
    type: number
    required: true
    description: 'Telegram chat ID to respond to (from webhook payload)'
  question:
    type: string
    required: true
    description: 'Question about the codebase (from webhook message)'
  message_id:
    type: number
    required: false
    description: 'Original message ID for reply threading'

outputs:
  answer:
    type: string
    description: 'AI-generated answer to the question'
  telegram_response:
    type: object
    description: 'Telegram API response'
---

# Telegram Codebase Q&A

This workflow receives questions about a codebase via Telegram webhook and uses an AI agent to analyze the code and respond with helpful answers.

## Step 1: Send Typing Indicator

Let the user know we're processing their request.

```yaml
action: telegram.sendChatAction
inputs:
  chatId: '{{ inputs.chat_id }}'
  action: 'typing'
output_variable: typing_indicator
```

## Step 2: Analyze Codebase and Answer Question

Use an AI agent to analyze the codebase and generate an answer.

```yaml
action: agent.run
inputs:
  prompt: |
    You are a code analysis expert. Analyze the codebase at the following path and answer the user's question.

    **Codebase Path**: {{ inputs.codebase_path }}

    **User's Question**: {{ inputs.question }}

    Instructions:
    1. Explore the codebase structure to understand the project
    2. Read relevant files that would help answer the question
    3. Provide a clear, concise paragraph (2-4 sentences) answering the question
    4. Focus on being accurate and helpful
    5. If you cannot find the answer, explain what you looked for and why

    Important: Keep your response to a single paragraph that directly answers the question.
output_variable: agent_analysis
```

## Step 3: Format Response

Extract and format the agent's answer for Telegram.

```yaml
action: script.execute
inputs:
  code: |
    const answer = context.agent_analysis?.response || context.agent_analysis || 'Unable to analyze the codebase. Please try again.';

    // Ensure the response is a single paragraph and not too long for Telegram
    let formatted = String(answer).trim();

    // Telegram message limit is 4096 characters
    if (formatted.length > 4000) {
      formatted = formatted.substring(0, 3997) + '...';
    }

    return { formatted_answer: formatted };
output_variable: formatted_response
```

## Step 4: Send Response to Telegram

Reply to the user's message with the answer.

```yaml
action: telegram.sendMessage
inputs:
  chatId: '{{ inputs.chat_id }}'
  text: '{{ formatted_response.formatted_answer }}'
  parseMode: 'Markdown'
  replyToMessageId: '{{ inputs.message_id }}'
output_variable: telegram_response
retry:
  max_attempts: 3
  delay: 1000
  on_failure: continue
```
