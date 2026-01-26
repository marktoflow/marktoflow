---
workflow:
  id: incident-router
  name: 'Smart Incident Router'
  description: 'Routes incidents to appropriate channels based on severity'
  version: '1.0.0'

tools:
  pagerduty:
    sdk: '@pagerduty/pdjs'
    auth:
      token: '${PAGERDUTY_API_TOKEN}'
  jira:
    sdk: 'jira-client'
    auth:
      host: '${JIRA_HOST}'
      username: '${JIRA_USERNAME}'
      password: '${JIRA_API_TOKEN}'
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  incident:
    type: object
    required: true
    description: 'Incident object with title, description, severity, and affected_services'

triggers:
  - type: webhook
    config:
      path: '/webhooks/incident'
      method: POST
---

# Smart Incident Router

This workflow demonstrates intelligent routing based on incident severity using switch/case logic.

## Step 1: Parse and Validate Incident

```yaml
action: console.log
inputs:
  message: "Processing incident: {{ inputs.incident.title }} ({{ inputs.incident.severity }})"
output_variable: log_result
```

## Step 2: Route by Severity

Use switch/case to route incidents to appropriate channels and teams.

```yaml
type: switch
expression: "{{ inputs.incident.severity }}"
cases:
  critical:
    - id: page_oncall
      name: 'Page On-Call Engineer'
      action: pagerduty.incidents.create
      inputs:
        title: "🚨 CRITICAL: {{ inputs.incident.title }}"
        service:
          id: "${PAGERDUTY_SERVICE_ID}"
          type: "service_reference"
        urgency: "high"
        body:
          type: "incident_body"
          details: "{{ inputs.incident.description }}\n\nAffected: {{ inputs.incident.affected_services }}"
      output_variable: pagerduty_incident

    - id: create_jira_critical
      name: 'Create P0 Jira Ticket'
      action: jira.createIssue
      inputs:
        fields:
          project:
            key: "OPS"
          summary: "P0: {{ inputs.incident.title }}"
          description: "{{ inputs.incident.description }}"
          issuetype:
            name: "Incident"
          priority:
            name: "Highest"
          labels: ["critical", "incident", "auto-created"]
      output_variable: jira_ticket

    - id: notify_slack_critical
      name: 'Alert in #incidents'
      action: slack.chat.postMessage
      inputs:
        channel: "#incidents"
        text: "🚨 CRITICAL INCIDENT 🚨"
        blocks:
          - type: header
            text:
              type: plain_text
              text: "🚨 CRITICAL INCIDENT"
          - type: section
            fields:
              - type: mrkdwn
                text: "*Title*\n{{ inputs.incident.title }}"
              - type: mrkdwn
                text: "*Severity*\nCritical"
              - type: mrkdwn
                text: "*PagerDuty*\n<{{ pagerduty_incident.html_url }}|View Incident>"
              - type: mrkdwn
                text: "*Jira*\n{{ jira_ticket.key }}"
          - type: section
            text:
              type: mrkdwn
              text: "{{ inputs.incident.description }}"
      output_variable: slack_alert

  high:
    - id: create_jira_high
      name: 'Create P1 Jira Ticket'
      action: jira.createIssue
      inputs:
        fields:
          project:
            key: "OPS"
          summary: "P1: {{ inputs.incident.title }}"
          description: "{{ inputs.incident.description }}"
          issuetype:
            name: "Bug"
          priority:
            name: "High"
          labels: ["high-priority", "incident"]
      output_variable: jira_ticket

    - id: notify_slack_high
      name: 'Post in #engineering'
      action: slack.chat.postMessage
      inputs:
        channel: "#engineering"
        text: "⚠️ High Priority Incident: {{ inputs.incident.title }}"
        blocks:
          - type: section
            text:
              type: mrkdwn
              text: "*⚠️ High Priority Incident*\n\n*Title:* {{ inputs.incident.title }}\n*Jira:* {{ jira_ticket.key }}\n\n{{ inputs.incident.description }}"
      output_variable: slack_notification

  medium:
    - id: create_jira_medium
      name: 'Create P2 Jira Task'
      action: jira.createIssue
      inputs:
        fields:
          project:
            key: "ENG"
          summary: "{{ inputs.incident.title }}"
          description: "{{ inputs.incident.description }}"
          issuetype:
            name: "Task"
          priority:
            name: "Medium"
      output_variable: jira_ticket

    - id: notify_slack_medium
      name: 'Post in #alerts'
      action: slack.chat.postMessage
      inputs:
        channel: "#alerts"
        text: "ℹ️ {{ inputs.incident.title }} - {{ jira_ticket.key }}"
      output_variable: slack_notification

  low:
    - id: create_jira_low
      name: 'Create Backlog Item'
      action: jira.createIssue
      inputs:
        fields:
          project:
            key: "ENG"
          summary: "{{ inputs.incident.title }}"
          description: "{{ inputs.incident.description }}"
          issuetype:
            name: "Task"
          priority:
            name: "Low"
          labels: ["backlog"]
      output_variable: jira_ticket

default:
  - id: unknown_severity
    name: 'Handle Unknown Severity'
    action: slack.chat.postMessage
    inputs:
      channel: "#alerts"
      text: "⚠️ Incident with unknown severity: {{ inputs.incident.severity }}\n\nTitle: {{ inputs.incident.title }}"
    output_variable: default_notification
```

## Step 3: Log Completion

```yaml
action: console.log
inputs:
  message: "Incident routing complete for {{ inputs.incident.title }}"
```

## Routing Matrix

| Severity | PagerDuty | Jira Priority | Slack Channel | Auto-Assign |
|----------|-----------|---------------|---------------|-------------|
| Critical | ✅ Page On-Call | P0 (Highest) | #incidents | Yes |
| High | ❌ | P1 (High) | #engineering | No |
| Medium | ❌ | P2 (Medium) | #alerts | No |
| Low | ❌ | P3 (Low) | - | No |
| Unknown | ❌ | - | #alerts | No |

## Benefits

- **Smart Routing**: Automatic escalation based on severity
- **Multi-Channel**: Coordinates across PagerDuty, Jira, and Slack
- **Consistent**: Every incident handled the same way
- **Auditable**: All actions logged and tracked
- **Extensible**: Easy to add new severity levels or integrations

## Example Webhook Payload

```json
{
  "incident": {
    "title": "Database connection pool exhausted",
    "description": "Production DB unable to accept new connections",
    "severity": "critical",
    "affected_services": ["api", "web-app", "worker-jobs"]
  }
}
```

## Testing

```bash
# Send test incident
curl -X POST http://localhost:3000/webhooks/incident \
  -H "Content-Type: application/json" \
  -d '{
    "incident": {
      "title": "Test incident",
      "description": "This is a test",
      "severity": "low",
      "affected_services": ["test-service"]
    }
  }'
```
