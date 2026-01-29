---
workflow:
  id: parallel-dashboard
  name: 'Multi-Source Dashboard Generator'
  description: 'Fetches data from multiple sources in parallel and generates a combined dashboard'
  version: '1.0.0'

tools:
  jira:
    sdk: 'jira-client'
    auth:
      host: '${JIRA_HOST}'
      username: '${JIRA_USERNAME}'
      password: '${JIRA_API_TOKEN}'
  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  jira_project:
    type: string
    required: true
    default: 'PROJ'
  github_repo:
    type: string
    required: true
    default: 'owner/repo'

triggers:
  - type: schedule
    config:
      cron: '0 */4 * * *'  # Every 4 hours
---

# Multi-Source Dashboard Generator

This workflow demonstrates parallel execution to fetch data from multiple sources simultaneously, improving performance.

## Step 1: Fetch from All Sources in Parallel

Execute all data fetches concurrently with a concurrency limit to respect API rate limits.

```yaml
type: parallel
max_concurrent: 3
on_error: continue
timeout: 30
branches:
  - id: fetch_jira
    name: 'Fetch Jira Issues'
    steps:
      - action: jira.searchJira
        inputs:
          jql: "project = {{ inputs.jira_project }} AND status != Done ORDER BY priority DESC"
          maxResults: 50
        output_variable: jira_issues

      - type: map
        items: "{{ jira_issues.issues }}"
        item_variable: issue
        expression: "{{ issue.key }}: {{ issue.fields.summary }}"
        output_variable: jira_summaries

  - id: fetch_github
    name: 'Fetch GitHub Issues & PRs'
    steps:
      - action: github.issues.listForRepo
        inputs:
          owner: "{{ inputs.github_repo.split('/')[0] }}"
          repo: "{{ inputs.github_repo.split('/')[1] }}"
          state: open
          per_page: 50
        output_variable: github_issues

      - action: github.pulls.list
        inputs:
          owner: "{{ inputs.github_repo.split('/')[0] }}"
          repo: "{{ inputs.github_repo.split('/')[1] }}"
          state: open
          per_page: 50
        output_variable: github_prs

  - id: fetch_slack
    name: 'Fetch Slack Metrics'
    steps:
      - action: slack.conversations.history
        inputs:
          channel: 'C12345678'
          limit: 100
        output_variable: slack_messages

      - type: filter
        items: "{{ slack_messages.messages }}"
        item_variable: msg
        condition: "msg.text != ''"
        output_variable: valid_messages

output_variable: parallel_results
```

## Step 2: Process Results

Access results from each branch using branch ID prefix.

```yaml
type: action
action: console.log
inputs:
  message: |
    📊 Dashboard Data Fetched Successfully

    Jira: {{ fetch_jira.jira_summaries.length }} issues
    GitHub: {{ fetch_github.github_issues.length }} issues, {{ fetch_github.github_prs.length }} PRs
    Slack: {{ fetch_slack.valid_messages.length }} messages
output_variable: stats
```

## Step 3: Generate Combined Report

```yaml
type: for_each
items: "{{ fetch_jira.jira_summaries }}"
item_variable: jira_issue
steps:
  - action: console.log
    inputs:
      message: "[{{ loop.index + 1 }}] {{ jira_issue }}"
```

## Step 4: Post to Slack

```yaml
action: slack.chat.postMessage
inputs:
  channel: "#engineering"
  blocks:
    - type: header
      text:
        type: plain_text
        text: "🎯 Engineering Dashboard"
    - type: section
      fields:
        - type: mrkdwn
          text: "*Jira Issues*\n{{ fetch_jira.jira_summaries.length }}"
        - type: mrkdwn
          text: "*GitHub Issues*\n{{ fetch_github.github_issues.length }}"
        - type: mrkdwn
          text: "*GitHub PRs*\n{{ fetch_github.github_prs.length }}"
        - type: mrkdwn
          text: "*Slack Activity*\n{{ fetch_slack.valid_messages.length }} messages"
output_variable: dashboard_post
```

## Benefits

- **Performance**: 3x faster than sequential fetching
- **Resilience**: `on_error: continue` ensures one failure doesn't block others
- **Rate Limiting**: `max_concurrent: 3` prevents overwhelming APIs
- **Isolation**: Each branch has its own context, preventing race conditions
- **Timeout Protection**: 30-second timeout prevents hanging

## Performance Comparison

| Approach | Time (avg) | Failure Impact |
|----------|------------|----------------|
| Sequential | ~90s | Blocks all subsequent steps |
| Parallel (unlimited) | ~30s | May hit rate limits |
| Parallel (limited) | ~30s | Graceful degradation |
