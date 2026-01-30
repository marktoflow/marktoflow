---
workflow:
  id: gmail-notification
  name: 'Gmail Email Notification'
  version: '2.0.0'
  description: 'Send email notifications via Gmail API'
  author: 'marktoflow'
  tags:
    - email
    - gmail
    - notification

tools:
  gmail:
    sdk: 'google-gmail'
    auth:
      client_id: '${GOOGLE_CLIENT_ID}'
      client_secret: '${GOOGLE_CLIENT_SECRET}'
      redirect_uri: '${GOOGLE_REDIRECT_URI}'
      refresh_token: '${GOOGLE_REFRESH_TOKEN}'
      access_token: '${GOOGLE_ACCESS_TOKEN}'

triggers:
  - type: manual

inputs:
  to:
    type: string
    required: true
    description: 'Recipient email address'
  subject:
    type: string
    required: true
    description: 'Email subject line'
  body:
    type: string
    required: true
    description: 'Email body content (plain text or HTML)'
  html:
    type: boolean
    default: false
    description: 'Whether the body is HTML'

outputs:
  message_id:
    type: string
    description: 'ID of the sent message'
  thread_id:
    type: string
    description: 'Thread ID of the sent message'
---

# Gmail Email Notification

Send email notifications using the Gmail API with OAuth2 authentication.

## Step 1: Send Email

```yaml
action: gmail.sendEmail
inputs:
  to: '{{ inputs.to }}'
  subject: '{{ inputs.subject }}'
  body: '{{ inputs.body }}'
  isHtml: '{{ inputs.html }}'
output_variable: send_result
```

## Step 2: Log Result

```yaml
action: core.log
inputs:
  message: 'Email sent successfully to {{ inputs.to }}. Message ID: {{ send_result.id }}'
  level: info
```

## Step 3: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  message_id: '{{ send_result.id }}'
  thread_id: '{{ send_result.threadId }}'
```

---

## Setup Instructions

1. **Create Google Cloud Project:**
   ```bash
   # Enable Gmail API in Google Cloud Console
   # Create OAuth2 credentials (Desktop App)
   ```

2. **Connect Gmail:**
   ```bash
   marktoflow connect gmail
   ```

3. **Run Workflow:**
   ```bash
   marktoflow run examples/gmail-notification/workflow.md \
     --input to="recipient@example.com" \
     --input subject="Test Notification" \
     --input body="Hello from marktoflow!"
   ```

## HTML Email Example

```bash
marktoflow run examples/gmail-notification/workflow.md \
  --input to="recipient@example.com" \
  --input subject="Weekly Report" \
  --input body="<h1>Weekly Report</h1><p>Here are the highlights...</p>" \
  --input html=true
```
