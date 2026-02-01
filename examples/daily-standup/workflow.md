---
workflow:
  id: daily-standup-summary
  name: 'Daily Standup Summary Generator'
  description: 'Automatically generates team standup summaries from Jira and Slack activity'
  version: '1.0.0'

tools:
  jira:
    sdk: 'jira.js'
    auth:
      host: '${JIRA_HOST}'
      email: '${JIRA_EMAIL}'
      api_token: '${JIRA_API_TOKEN}'

  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

  core:
    sdk: 'core'

triggers:
  - type: schedule
    cron: '0 9 * * 1-5'  # 9 AM weekdays
    timezone: 'America/Los_Angeles'

inputs:
  jira_project:
    type: string
    description: 'Jira project key (e.g., PROJ)'
    required: true
    default: 'PROJ'

  slack_channel:
    type: string
    description: 'Slack channel ID to post summary'
    required: true

  lookback_hours:
    type: number
    description: 'Hours to look back for activity'
    required: false
    default: 24

outputs:
  summary:
    type: string
    description: 'Generated standup summary'

  slack_message_ts:
    type: string
    description: 'Timestamp of posted Slack message'
---

# Daily Standup Summary Generator

This workflow automatically generates a comprehensive daily standup summary by:
1. Fetching recent Jira updates (completed, in-progress, blocked)
2. Retrieving recent Slack activity from the team channel
3. Using AI to generate a formatted standup summary
4. Posting the summary to Slack

## Step 1: Fetch Recently Completed Issues

```yaml
action: jira.issueSearch.searchForIssuesUsingJql
inputs:
  jql: "project = {{ inputs.jira_project }} AND status changed to Done after -{{ inputs.lookback_hours }}h"
  fields:
    - summary
    - status
    - assignee
    - updated
  maxResults: 50
output_variable: completed_issues
```

## Step 2: Fetch In-Progress Issues

```yaml
action: jira.issueSearch.searchForIssuesUsingJql
inputs:
  jql: "project = {{ inputs.jira_project }} AND status in ('In Progress', 'In Review', 'Testing') ORDER BY updated DESC"
  fields:
    - summary
    - status
    - assignee
    - priority
  maxResults: 50
output_variable: in_progress_issues
```

## Step 3: Fetch Blocked Issues

```yaml
action: jira.issueSearch.searchForIssuesUsingJql
inputs:
  jql: "project = {{ inputs.jira_project }} AND status = Blocked ORDER BY priority DESC"
  fields:
    - summary
    - status
    - assignee
    - priority
    - description
  maxResults: 20
output_variable: blocked_issues
```

## Step 4: Fetch Recent Slack Activity

```yaml
action: slack.conversations.history
inputs:
  channel: "{{ inputs.slack_channel }}"
  oldest: "{{ timestamp_subtract(now(), inputs.lookback_hours, 'hours') }}"
  limit: 100
output_variable: slack_messages
```

## Step 5: Generate Standup Summary with AI

```yaml
action: agent.chat.completions
inputs:
  messages:
    - role: system
      content: |
        You are a helpful assistant that generates concise daily standup summaries for engineering teams.

        Format the summary using Slack markdown with these sections:

        1. **✅ Completed Yesterday** - Issues moved to Done status
        2. **🚀 In Progress Today** - Active work items with assignees
        3. **🚧 Blockers & Impediments** - Issues that need immediate attention
        4. **💬 Team Highlights** - Notable updates or discussions from Slack

        Guidelines:
        - Use bullet points for clarity
        - Mention team members as @username (extract from assignee data)
        - Keep it concise and actionable
        - Highlight blockers prominently
        - Include issue keys as links when possible
        - Summarize Slack activity thematically (don't list every message)
        - Maximum 15 lines total

    - role: user
      content: |
        Generate a daily standup summary based on this team data:

        **Completed Issues (last {{ inputs.lookback_hours }}h):**
        {{ completed_issues }}

        **In Progress Issues:**
        {{ in_progress_issues }}

        **Blocked Issues:**
        {{ blocked_issues }}

        **Recent Slack Activity:**
        {{ slack_messages.messages.length }} messages in channel {{ inputs.slack_channel }}

output_variable: ai_response
```

## Step 6: Post Summary to Slack

```yaml
action: slack.chat.postMessage
inputs:
  channel: "{{ inputs.slack_channel }}"
  text: "Daily Standup Summary - {{ format_date(now(), 'MMMM DD, YYYY') }}"
  blocks:
    - type: header
      text:
        type: plain_text
        text: "📊 Daily Standup Summary - {{ format_date(now(), 'MMMM DD, YYYY') }}"

    - type: section
      text:
        type: mrkdwn
        text: "{{ ai_response.choices | first | path('message.content') }}"

    - type: divider

    - type: context
      elements:
        - type: mrkdwn
          text: "Generated automatically by marktoflow • {{ format_date(now(), 'h:mm A') }}"
output_variable: slack_result
```

## Step 7: Store Summary for Records

```yaml
action: core.log
inputs:
  level: info
  message: "Daily standup summary posted successfully"
  metadata:
    slack_ts: "{{ slack_result.ts }}"
    completed_count: "{{ completed_issues.total }}"
    in_progress_count: "{{ in_progress_issues.total }}"
    blocked_count: "{{ blocked_issues.total }}"
    slack_messages_count: "{{ slack_messages.messages.length }}"
```

