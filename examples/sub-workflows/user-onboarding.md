---
workflow:
  id: user-onboarding
  name: 'User Onboarding with Sub-Workflows'
  version: '1.0.0'
  description: 'Demonstrates sub-workflow composition'
  author: 'marktoflow'

inputs:
  username:
    type: string
    required: true
    description: 'Username to onboard'
  email:
    type: string
    required: true
    description: 'User email address'
  slack_channel:
    type: string
    required: false
    default: '#onboarding'
    description: 'Notification channel'

steps:
  # Step 1: Validate username
  - id: validate_username
    workflow: ./common/validate-input.md
    inputs:
      data: '{{ inputs.username }}'
      min_length: 3
      max_length: 20
    output_variable: username_validation
    error_handling:
      action: stop
      max_retries: 0

  # Step 2: Validate email
  - id: validate_email
    workflow: ./common/validate-input.md
    inputs:
      data: '{{ inputs.email }}'
      min_length: 5
      max_length: 100
    output_variable: email_validation
    error_handling:
      action: stop
      max_retries: 0

  # Step 3: Create user account (simulated)
  - id: create_account
    action: script.execute
    inputs:
      code: |
        // Simulate account creation
        const username = inputs.username;
        const email = inputs.email;

        return {
          user_id: Math.floor(Math.random() * 10000),
          username: username,
          email: email,
          created_at: new Date().toISOString(),
          status: 'active'
        };
    output_variable: user_account

  # Step 4: Send success notification
  - id: notify_success
    workflow: ./common/send-notification.md
    inputs:
      channel: '{{ inputs.slack_channel }}'
      message: 'New user onboarded: {{ user_account.username }} (ID: {{ user_account.user_id }})'
      level: 'info'
    output_variable: notification_result

  # Step 5: Send welcome email (simulated)
  - id: send_welcome_email
    action: script.execute
    inputs:
      code: |
        // Simulate sending welcome email
        return {
          email_id: `email-${Date.now()}`,
          sent_to: inputs.email,
          subject: `Welcome ${inputs.username}!`,
          sent_at: new Date().toISOString()
        };
    output_variable: welcome_email
---

# User Onboarding Workflow

This workflow demonstrates sub-workflow composition by orchestrating multiple reusable sub-workflows.

## Features

- **Input Validation**: Uses reusable validation sub-workflows
- **Account Creation**: Simulates user account creation
- **Notifications**: Uses notification sub-workflow for Slack alerts
- **Email**: Sends welcome email

## Sub-Workflows Used

1. `common/validate-input.md` - Validates username and email
2. `common/send-notification.md` - Sends Slack notification

## Usage

```bash
marktoflow run examples/sub-workflows/user-onboarding.md \
  --input username=johndoe \
  --input email=john@example.com \
  --input slack_channel=#onboarding
```

## Outputs

The workflow outputs:

- `username_validation` - Username validation results
- `email_validation` - Email validation results
- `user_account` - Created user account details
- `notification_result` - Slack notification response
- `welcome_email` - Welcome email details

## Error Handling

- Validation failures stop the workflow immediately
- Sub-workflows can be reused in other workflows
- Each sub-workflow is self-contained with its own inputs/outputs
