---
workflow:
  id: agent-task-executor-slack
  name: 'Slack Agent Task Executor'
  version: '1.0.0'
  description: 'Execute agent tasks from Slack messages and report results'
  author: 'marktoflow'
  tags:
    - slack
    - ai
    - automation
    - tasks

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

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
    path: /slack/task-executor
    config:
      provider: slack
    events:
      - message
      - app_mention

inputs:
  channel:
    type: string
    required: true
    description: 'Slack channel ID where the message was sent'
  instructions:
    type: string
    required: true
    description: 'Task instructions from the Slack message'
  thread_ts:
    type: string
    required: false
    description: 'Thread timestamp for threaded replies'

outputs:
  task_results:
    type: string
    description: 'Summary of tasks with pass/fail status'
---

# Slack Agent Task Executor

This workflow receives task instructions from Slack, executes them using an AI agent with controlled permissions, and reports back with pass/fail results for each task.

## Step 1: Acknowledge Request

Send an acknowledgment message to let the user know we're working on it.

```yaml
action: slack.chat.postMessage
inputs:
  channel: '{{ inputs.channel }}'
  thread_ts: '{{ inputs.thread_ts }}'
  text: ':hourglass_flowing_sand: Processing your request...'
  blocks:
    - type: section
      text:
        type: mrkdwn
        text: ':hourglass_flowing_sand: *Processing your request...*'
    - type: context
      elements:
        - type: mrkdwn
          text: 'Analyzing instructions and executing tasks'
output_variable: ack_message
```

## Step 2: Parse and Execute Tasks

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

## Step 3: Parse Agent Results

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

## Step 4: Format Results for Slack

Create a formatted Slack message with task results.

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
      const emoji = t.status === 'passed' ? ':white_check_mark:' : ':x:';
      const statusText = t.status === 'passed' ? 'PASSED' : 'FAILED';
      return `${emoji} *${t.name}* - ${statusText}\n    _${(t.details || '').substring(0, 150)}_`;
    }).join('\n\n');

    // Determine overall status
    const overallEmoji = failed === 0 ? ':tada:' : (passed > failed ? ':warning:' : ':rotating_light:');

    return {
      header: `${overallEmoji} Task Execution Complete`,
      stats: `*Results:* ${passed}/${total} tasks passed`,
      task_list: taskLines || '_No tasks identified_',
      summary: summary
    };
output_variable: formatted_message
```

## Step 5: Update Slack with Results

Replace the acknowledgment message with final results.

```yaml
action: slack.chat.update
inputs:
  channel: '{{ inputs.channel }}'
  ts: '{{ ack_message.ts }}'
  text: '{{ formatted_message.header }}'
  blocks:
    - type: header
      text:
        type: plain_text
        text: '{{ formatted_message.header }}'
    - type: section
      text:
        type: mrkdwn
        text: '{{ formatted_message.stats }}'
    - type: divider
    - type: section
      text:
        type: mrkdwn
        text: '*Tasks:*'
    - type: section
      text:
        type: mrkdwn
        text: '{{ formatted_message.task_list }}'
    - type: divider
    - type: context
      elements:
        - type: mrkdwn
          text: '*Summary:* {{ formatted_message.summary }}'
output_variable: final_message
retry:
  max_attempts: 3
  delay: 1000
```
