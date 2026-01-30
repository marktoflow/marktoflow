---
workflow:
  id: agent-task-executor-telegram
  name: 'Telegram Agent Task Executor'
  version: '1.0.0'
  description: 'Execute agent tasks from Telegram messages and report results'
  author: 'marktoflow'
  tags:
    - telegram
    - ai
    - automation
    - tasks

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
    path: /telegram/task-executor
    config:
      provider: telegram
    events:
      - message

inputs:
  chat_id:
    type: number
    required: true
    description: 'Telegram chat ID to respond to'
  instructions:
    type: string
    required: true
    description: 'Task instructions from the Telegram message'
  message_id:
    type: number
    required: false
    description: 'Original message ID for reply threading'

outputs:
  task_results:
    type: string
    description: 'Summary of tasks with pass/fail status'
---

# Telegram Agent Task Executor

This workflow receives task instructions from Telegram, executes them using an AI agent with controlled permissions, and reports back with pass/fail results for each task.

## Step 1: Acknowledge Request

Send a typing indicator and acknowledgment message.

```yaml
action: telegram.sendChatAction
inputs:
  chatId: '{{ inputs.chat_id }}'
  action: 'typing'
output_variable: typing_indicator
```

## Step 2: Send Processing Message

Let the user know we're working on their request.

```yaml
action: telegram.sendMessage
inputs:
  chatId: '{{ inputs.chat_id }}'
  text: |
    ⏳ *Processing your request...*

    Analyzing instructions and executing tasks.
  parseMode: 'Markdown'
  replyToMessageId: '{{ inputs.message_id }}'
output_variable: ack_message
```

## Step 3: Parse and Execute Tasks

Use an AI agent to interpret instructions and execute tasks.

````yaml
action: agent.run
inputs:
  prompt: |
    You are a task execution agent. Parse the following instructions and execute each task.

    **Instructions from user:**
    {{ inputs.instructions }}

    **Guidelines:**
    1. Break down the instructions into discrete, actionable tasks
    2. Execute each task one at a time
    3. For each task, clearly indicate:
       - What you attempted to do
       - Whether it succeeded or failed
       - Any relevant output or error messages
    4. You have read/write access but NO destructive operations:
       - You CAN: read files, write new files, edit files, run tests, install dependencies
       - You CANNOT: delete files, drop databases, force push, reset repos, rm -rf
    5. Be thorough but safe - when in doubt, skip potentially destructive actions

    **Output Format:**
    After completing all tasks, provide a summary in this exact JSON format:
    ```json
    {
      "tasks": [
        {"name": "Task description", "status": "passed", "details": "What was done"},
        {"name": "Another task", "status": "failed", "details": "Why it failed"}
      ],
      "summary": "Brief overall summary"
    }
    ```
output_variable: agent_execution
````

## Step 4: Parse Agent Results

Extract structured task results from agent output.

```yaml
action: script.execute
inputs:
  code: |
    const response = context.agent_execution?.response || context.agent_execution || '';
    const responseStr = String(response);

    // Try to extract JSON from the response
    let results = { tasks: [], summary: 'Task execution completed' };

    try {
      // Look for JSON block in the response
      const jsonMatch = responseStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[1]);
      } else {
        // Try parsing the whole response as JSON
        const parsed = JSON.parse(responseStr);
        if (parsed.tasks) {
          results = parsed;
        }
      }
    } catch (e) {
      // If no JSON found, create a single task entry from the response
      results = {
        tasks: [{
          name: 'Execute instructions',
          status: responseStr.toLowerCase().includes('error') || responseStr.toLowerCase().includes('failed') ? 'failed' : 'passed',
          details: responseStr.substring(0, 500)
        }],
        summary: responseStr.substring(0, 200)
      };
    }

    // Ensure tasks is an array
    if (!Array.isArray(results.tasks)) {
      results.tasks = [];
    }

    return results;
output_variable: parsed_results
```

## Step 5: Format Results for Telegram

Create a formatted Telegram message with task results.

```yaml
action: script.execute
inputs:
  code: |
    const tasks = context.parsed_results.tasks || [];
    const summary = context.parsed_results.summary || 'Completed';

    // Count results
    const passed = tasks.filter(t => t.status === 'passed').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const total = tasks.length;

    // Build task list
    const taskLines = tasks.map(t => {
      const emoji = t.status === 'passed' ? '✅' : '❌';
      const statusText = t.status === 'passed' ? 'PASSED' : 'FAILED';
      const details = (t.details || '').substring(0, 100);
      return `${emoji} *${t.name}*\n   └ ${statusText}: _${details}_`;
    }).join('\n\n');

    // Determine overall status
    const overallEmoji = failed === 0 ? '🎉' : (passed > failed ? '⚠️' : '🚨');

    // Telegram message (max 4096 chars)
    let message = `${overallEmoji} *Task Execution Complete*\n\n`;
    message += `📊 *Results:* ${passed}/${total} tasks passed\n\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    message += taskLines || '_No tasks identified_';
    message += `\n\n━━━━━━━━━━━━━━━━\n\n`;
    message += `📝 *Summary:* ${summary}`;

    // Truncate if too long
    if (message.length > 4000) {
      message = message.substring(0, 3997) + '...';
    }

    return { formatted_message: message };
output_variable: formatted_output
```

## Step 6: Edit Original Message with Results

Update the processing message with final results.

```yaml
action: telegram.editMessageText
inputs:
  chatId: '{{ inputs.chat_id }}'
  messageId: '{{ ack_message.messageId }}'
  text: '{{ formatted_output.formatted_message }}'
  parseMode: 'Markdown'
output_variable: final_message
retry:
  max_attempts: 3
  delay: 1000
```
