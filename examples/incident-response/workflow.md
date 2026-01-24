---
workflow:
  id: incident-response
  name: 'Incident Response Automation'
  version: '2.0.0'
  description: 'Automated incident detection, triage, and response coordination using native integrations'
  author: 'marktoflow'
  tags:
    - incident
    - ops
    - critical

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'

  jira:
    sdk: 'jira.js'
    auth:
      host: '${JIRA_HOST}'
      email: '${JIRA_EMAIL}'
      apiToken: '${JIRA_API_TOKEN}'

  http:
    sdk: 'http'
    auth:
      type: 'bearer'
      token: '${PAGERDUTY_API_KEY}'

triggers:
  - type: webhook
    path: /webhooks/pagerduty/incident
    events:
      - incident.triggered
  - type: webhook
    path: /webhooks/alert
    events:
      - alert.triggered

inputs:
  incident_id:
    type: string
    required: true
    description: 'Incident or alert identifier'
  severity:
    type: string
    enum: ['critical', 'high', 'medium', 'low']
    required: true
    description: 'Incident severity level'
  service:
    type: string
    required: true
    description: 'Affected service name'
  description:
    type: string
    required: true
    description: 'Incident description'

outputs:
  incident_channel:
    type: string
    description: 'Created Slack incident channel'
  incident_issue:
    type: string
    description: 'Created Jira incident ticket'
  assigned_responders:
    type: array
    description: 'List of assigned responders'
---

# Incident Response Automation

This workflow automates the initial response to incidents, including creating communication channels, gathering context, and coordinating responders using native Slack, GitHub, and Jira integrations.

## Step 1: Create Incident Channel

Create a dedicated Slack channel for incident communication.

```yaml
action: slack.conversations.create
inputs:
  name: "inc-{{ Date.now().toString().slice(-6) }}-{{ inputs.service.toLowerCase().replace(/[^a-z0-9]/g, '-') }}"
  is_private: false
output_variable: incident_channel
```

## Step 2: Set Channel Topic

Set the channel topic with incident details.

```yaml
action: slack.conversations.setTopic
inputs:
  channel: '{{ incident_channel.channel.id }}'
  topic: '🚨 [{{ inputs.severity.toUpperCase() }}] {{ inputs.service }} - {{ inputs.description }}'
output_variable: topic_result
```

## Step 3: Post Initial Alert

Post the initial incident notification to the channel.

```yaml
action: slack.chat.postMessage
inputs:
  channel: '{{ incident_channel.channel.id }}'
  text: '🚨 Incident Alert'
  blocks:
    - type: header
      text:
        type: plain_text
        text: '🚨 Incident: {{ inputs.incident_id }}'
    - type: section
      fields:
        - type: mrkdwn
          text: "*Severity:*\n{{ inputs.severity.toUpperCase() }}"
        - type: mrkdwn
          text: "*Service:*\n{{ inputs.service }}"
        - type: mrkdwn
          text: "*Status:*\n🔴 Active"
        - type: mrkdwn
          text: "*Started:*\n{{ new Date().toISOString() }}"
    - type: section
      text:
        type: mrkdwn
        text: "*Description:*\n{{ inputs.description }}"
    - type: divider
    - type: context
      elements:
        - type: mrkdwn
          text: 'Incident ID: `{{ inputs.incident_id }}`'
output_variable: alert_message
```

## Step 4: Get On-Call Responders

Use PagerDuty API to get on-call responders (via HTTP integration).

```yaml
action: http.request
inputs:
  method: 'GET'
  url: 'https://api.pagerduty.com/oncalls'
  params:
    schedule_ids: ['${PAGERDUTY_SCHEDULE_ID}']
    include: ['users']
  headers:
    Authorization: 'Token token=${PAGERDUTY_API_KEY}'
    Accept: 'application/vnd.pagerduty+json;version=2'
output_variable: oncall_response
```

## Step 5: Invite Responders to Channel

Invite the on-call responders to the incident channel.

```yaml
action: slack.conversations.invite
inputs:
  channel: '{{ incident_channel.channel.id }}'
  users: "{{ oncall_response.data.oncalls.map(o => o.user.slack_user_id).join(',') }}"
output_variable: invite_result
```

## Step 6: Check for Related GitHub Issues

Search for related issues or recent deployments.

```yaml
action: github.search.issuesAndPullRequests
inputs:
  q: '{{ inputs.service }} in:title state:open repo:${GITHUB_ORG}/${GITHUB_REPO}'
  sort: 'updated'
  per_page: 5
output_variable: related_issues
```

## Step 7: Create Jira Incident Ticket

Create a Jira incident ticket for tracking.

```yaml
action: jira.issues.createIssue
inputs:
  fields:
    project:
      key: 'OPS'
    issuetype:
      name: 'Incident'
    summary: '[{{ inputs.severity.toUpperCase() }}] {{ inputs.service }} - {{ inputs.description }}'
    description: |
      h2. Incident Details

      *Incident ID:* {{ inputs.incident_id }}
      *Severity:* {{ inputs.severity.toUpperCase() }}
      *Service:* {{ inputs.service }}
      *Started:* {{ new Date().toISOString() }}

      h3. Description
      {{ inputs.description }}

      h3. Communication
      Slack Channel: #{{ incident_channel.channel.name }}

      h3. Related Issues
      {% for issue in related_issues.data.items %}
      - [{{ issue.title }}|{{ issue.html_url }}]
      {% endfor %}
    priority:
      name: "{{ inputs.severity === 'critical' ? 'Highest' : inputs.severity === 'high' ? 'High' : 'Medium' }}"
    labels:
      - 'incident'
      - '{{ inputs.service }}'
output_variable: jira_incident
```

## Step 8: Post Summary with Actions

Post a summary message with action items and links.

```yaml
action: slack.chat.postMessage
inputs:
  channel: '{{ incident_channel.channel.id }}'
  text: 'Incident Response Initiated'
  blocks:
    - type: section
      text:
        type: mrkdwn
        text: |
          *📋 Incident Response Initiated*

          *Jira Ticket:* <{{ jira_incident.self }}|{{ jira_incident.key }}>
          *On-Call:* {{ oncall_response.data.oncalls.map(o => '@' + o.user.name).join(', ') }}

          *Related Issues:*
          {% for issue in related_issues.data.items %}
          • <{{ issue.html_url }}|#{{ issue.number }}> - {{ issue.title }}
          {% endfor %}
    - type: actions
      elements:
        - type: button
          text:
            type: plain_text
            text: 'View Runbook'
          url: 'https://runbooks.example.com/{{ inputs.service }}'
          style: 'primary'
        - type: button
          text:
            type: plain_text
            text: 'View Jira'
          url: '{{ jira_incident.self }}'
        - type: button
          text:
            type: plain_text
            text: 'Escalate'
          style: 'danger'
          action_id: 'escalate_incident'
output_variable: summary_message
```

## Step 9: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  incident_channel: '#{{ incident_channel.channel.name }}'
  incident_issue: '{{ jira_incident.key }}'
  assigned_responders: '{{ oncall_response.data.oncalls.map(o => o.user.name) }}'
```
