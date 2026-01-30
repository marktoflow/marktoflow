---
workflow:
  id: slack-codebase-qa
  name: 'Slack Codebase Q&A'
  version: '1.0.0'
  description: 'Answer questions about a codebase via Slack using an AI agent'
  author: 'marktoflow'
  tags:
    - slack
    - ai
    - code-analysis
    - qa

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

  agent:
    sdk: 'github-copilot'
    options:
      cwd: '${CODEBASE_PATH}'

  script:
    sdk: 'script'
    options:
      path: 'inline'

triggers:
  - type: webhook
    path: /slack/codebase-qa
    config:
      provider: slack
    events:
      - message
      - app_mention

inputs:
  codebase_path:
    type: string
    required: false
    default: '${CODEBASE_PATH}'
    description: 'Absolute path to the codebase to analyze (defaults to CODEBASE_PATH env var)'
  channel:
    type: string
    required: true
    description: 'Slack channel ID to respond to'
  question:
    type: string
    required: true
    description: 'Question about the codebase (from Slack message)'
  thread_ts:
    type: string
    required: false
    description: 'Thread timestamp for threaded replies'

outputs:
  answer:
    type: string
    description: 'AI-generated answer to the question'
  slack_response:
    type: object
    description: 'Slack API response'
---

# Slack Codebase Q&A

This workflow receives questions about a codebase via Slack webhook and uses an AI agent to analyze the code and respond with helpful answers.

## Step 1: Send Processing Indicator

Let the user know we're processing their request.

```yaml
action: slack.chat.postMessage
inputs:
  channel: '{{ inputs.channel }}'
  thread_ts: '{{ inputs.thread_ts }}'
  text: ':mag: Analyzing codebase...'
  blocks:
    - type: context
      elements:
        - type: mrkdwn
          text: ':hourglass_flowing_sand: *Analyzing codebase to answer your question...*'
output_variable: processing_message
```

## Step 2: Analyze Codebase and Answer Question

Use an AI agent to analyze the codebase and generate an answer.

```yaml
action: agent.send
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

Extract and format the agent's answer for Slack.

```yaml
action: script.execute
inputs:
  code: |
    const answer = context.agent_analysis?.response || context.agent_analysis || 'Unable to analyze the codebase. Please try again.';

    // Ensure the response is a string and clean it up
    let formatted = String(answer).trim();

    // Slack message blocks have a 3000 character limit per text field
    if (formatted.length > 2900) {
      formatted = formatted.substring(0, 2897) + '...';
    }

    return { formatted_answer: formatted };
output_variable: formatted_response
```

## Step 4: Update Message with Answer

Replace the processing message with the answer.

```yaml
action: slack.chat.update
inputs:
  channel: '{{ inputs.channel }}'
  ts: '{{ processing_message.ts }}'
  text: '{{ formatted_response.formatted_answer }}'
  blocks:
    - type: section
      text:
        type: mrkdwn
        text: '{{ formatted_response.formatted_answer }}'
    - type: context
      elements:
        - type: mrkdwn
          text: ':robot_face: _Analyzed codebase at `{{ inputs.codebase_path }}`_'
output_variable: slack_response
retry:
  max_attempts: 3
  delay: 1000
  on_failure: continue
```
