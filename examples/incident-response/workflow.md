---
workflow:
  id: incident-response
  name: "Incident Response Automation"
  version: "1.0.0"
  description: "Automated incident detection, triage, and response coordination"
  author: "aiworkflow"
  tags:
    - incident
    - ops
    - critical

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported

requirements:
  tools:
    - pagerduty
    - slack
    - datadog
    - github
  features:
    - tool_calling: required
    - parallel_execution: optional

triggers:
  - type: webhook
    path: /webhooks/pagerduty/incident
    events:
      - incident.triggered
  - type: webhook
    path: /webhooks/datadog/alert
    events:
      - alert.triggered

inputs:
  incident_id:
    type: string
    required: true
    description: "Incident or alert identifier"
  severity:
    type: string
    enum: ["critical", "high", "medium", "low"]
    required: true
    description: "Incident severity level"
  service:
    type: string
    required: true
    description: "Affected service name"
  description:
    type: string
    required: true
    description: "Incident description"

outputs:
  incident_channel:
    type: string
    description: "Created Slack incident channel"
  runbook_url:
    type: string
    description: "Link to relevant runbook"
  assigned_responders:
    type: array
    description: "List of assigned responders"
---

# Incident Response Automation

This workflow automates the initial response to incidents, including creating
communication channels, gathering context, and coordinating responders.

## Step 1: Create Incident Channel

Create a dedicated Slack channel for incident communication.

```yaml
action: slack.create_channel
inputs:
  name: "inc-{{ now | datetimeformat('%Y%m%d') }}-{{ inputs.service | lower | replace(' ', '-') }}"
  private: false
  description: "[{{ inputs.severity | upper }}] {{ inputs.description | truncate(80) }}"
output_variable: incident_channel
```

## Step 2: Get On-Call Responders

Identify who is currently on-call for the affected service.

```yaml
action: pagerduty.get_oncall
inputs:
  service: "{{ inputs.service }}"
  escalation_levels: [1, 2]
output_variable: oncall_responders
```

## Step 3: Gather System Metrics

Get recent metrics for the affected service.

```yaml
action: datadog.get_metrics
inputs:
  service: "{{ inputs.service }}"
  metrics:
    - "system.cpu.user"
    - "system.mem.used"
    - "trace.errors"
    - "http.response_time.p95"
  timeframe: "1h"
output_variable: service_metrics
```

## Step 4: Get Recent Deployments

Check for recent deployments that might be related.

```yaml
action: github.list_deployments
inputs:
  repo: "{{ inputs.service }}"
  environment: "production"
  per_page: 5
output_variable: recent_deployments
```

## Step 5: Find Relevant Runbook

Search for runbooks related to this incident.

```yaml
action: agent.search
inputs:
  task: "find_runbook"
  query: "{{ inputs.service }} {{ inputs.description }}"
  sources:
    - type: confluence
      space: "OPS"
    - type: github
      repo: "company/runbooks"
      path: "services/"
output_variable: runbook_results
```

## Step 6: Generate Initial Assessment

Create an initial assessment of the incident.

```yaml
action: agent.analyze
inputs:
  task: "incident_assessment"
  context:
    incident:
      id: "{{ inputs.incident_id }}"
      severity: "{{ inputs.severity }}"
      service: "{{ inputs.service }}"
      description: "{{ inputs.description }}"
    metrics: "{{ service_metrics }}"
    deployments: "{{ recent_deployments }}"
    runbooks: "{{ runbook_results }}"
  instructions: |
    Analyze this incident and provide:
    1. Likely root cause hypothesis
    2. Affected components
    3. Recommended immediate actions
    4. Escalation recommendations
output_variable: assessment
```

## Step 7: Post Incident Summary

Post the incident summary to the dedicated channel.

```yaml
action: slack.post_message
inputs:
  channel: "{{ incident_channel.id }}"
  blocks:
    - type: header
      text: ":rotating_light: Incident: {{ inputs.description | truncate(50) }}"
    - type: section
      fields:
        - type: mrkdwn
          text: "*Severity:* {{ inputs.severity | upper }}"
        - type: mrkdwn
          text: "*Service:* {{ inputs.service }}"
        - type: mrkdwn
          text: "*Incident ID:* {{ inputs.incident_id }}"
        - type: mrkdwn
          text: "*Time:* {{ now | datetimeformat('%Y-%m-%d %H:%M UTC') }}"
    - type: divider
    - type: section
      text: "*Initial Assessment*\n{{ assessment.summary }}"
    - type: section
      text: "*On-Call Responders*\n{% for r in oncall_responders %}• <@{{ r.slack_id }}> ({{ r.escalation_level }})\n{% endfor %}"
    - type: section
      text: "*Recent Deployments*\n{% for d in recent_deployments[:3] %}• {{ d.sha[:7] }} by {{ d.creator }} ({{ d.created_at | timeago }})\n{% endfor %}"
    - type: actions
      elements:
        - type: button
          text: "View Runbook"
          url: "{{ runbook_results[0].url if runbook_results else '#' }}"
        - type: button
          text: "View Dashboard"
          url: "https://app.datadoghq.com/dashboard/{{ inputs.service }}"
        - type: button
          text: "Acknowledge"
          action_id: "incident_ack"
output_variable: summary_post
```

## Step 8: Notify Responders

Page the on-call responders.

```yaml
action: pagerduty.notify
inputs:
  users: "{{ oncall_responders | map(attribute='id') | list }}"
  message: "[{{ inputs.severity | upper }}] {{ inputs.description }}"
  urgency: "{{ 'high' if inputs.severity in ['critical', 'high'] else 'low' }}"
output_variable: notification_result
condition: "inputs.severity in ['critical', 'high']"
```

## Step 9: Invite Responders to Channel

Add responders to the incident channel.

```yaml
action: slack.invite_users
inputs:
  channel: "{{ incident_channel.id }}"
  users: "{{ oncall_responders | map(attribute='slack_id') | list }}"
output_variable: invite_result
```

## Step 10: Create Incident Ticket

Create a tracking ticket for the incident.

```yaml
action: jira.create_issue
inputs:
  project: "OPS"
  issue_type: "Incident"
  summary: "[{{ inputs.severity | upper }}] {{ inputs.description }}"
  description: |
    ## Incident Details
    - **ID:** {{ inputs.incident_id }}
    - **Service:** {{ inputs.service }}
    - **Severity:** {{ inputs.severity }}
    - **Slack Channel:** #{{ incident_channel.name }}
    
    ## Initial Assessment
    {{ assessment.summary }}
    
    ## Timeline
    - {{ now | datetimeformat('%H:%M') }} - Incident detected
    - {{ now | datetimeformat('%H:%M') }} - Automated response initiated
  labels:
    - incident
    - "{{ inputs.severity }}"
    - "{{ inputs.service }}"
  priority: "{{ 'Highest' if inputs.severity == 'critical' else 'High' if inputs.severity == 'high' else 'Medium' }}"
output_variable: incident_ticket
```

## Step 11: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  incident_channel: "{{ incident_channel.name }}"
  runbook_url: "{{ runbook_results[0].url if runbook_results else null }}"
  assigned_responders: "{{ oncall_responders | map(attribute='name') | list }}"
```
