---
workflow:
  id: send-notification
  name: 'Send Notification'
  version: '1.0.0'
  description: 'Reusable notification workflow'

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  channel:
    type: string
    required: true
    description: 'Slack channel to send to'
  message:
    type: string
    required: true
    description: 'Message content'
  level:
    type: string
    required: false
    default: 'info'
    description: 'Notification level (info, warning, error)'

steps:
  - id: format_message
    action: script.execute
    inputs:
      code: |
        const level = inputs.level || 'info';
        const emoji = {
          info: 'ℹ️',
          warning: '⚠️',
          error: '🚨'
        }[level] || 'ℹ️';

        return {
          formatted: `${emoji} ${inputs.message}`
        };
    output_variable: formatted

  - id: send_slack
    action: slack.chat.postMessage
    inputs:
      channel: '{{ inputs.channel }}'
      text: '{{ formatted.formatted }}'
    output_variable: result
---

# Send Notification Sub-Workflow

This sub-workflow sends formatted notifications to Slack.

## Usage

```yaml
steps:
  - id: notify
    workflow: ./common/send-notification.md
    inputs:
      channel: '#alerts'
      message: 'Deployment completed successfully'
      level: 'info'
    output_variable: notification_result
```

## Outputs

- Slack message timestamp and channel info
