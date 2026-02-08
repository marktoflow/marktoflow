---
workflow:
  id: oauth-refresh-demo
  name: 'OAuth Token Refresh Demo'
  version: '1.0.0'
  description: 'Demonstrates automatic OAuth2 token refresh for Gmail and Outlook'

tools:
  gmail:
    sdk: 'google-gmail'
    auth:
      client_id: '${GOOGLE_CLIENT_ID}'
      client_secret: '${GOOGLE_CLIENT_SECRET}'
      redirect_uri: '${GOOGLE_REDIRECT_URI}'
      refresh_token: '${GOOGLE_REFRESH_TOKEN}'
      access_token: '${GOOGLE_ACCESS_TOKEN}'

inputs:
  recipient:
    type: string
    required: true
    description: 'Email recipient'
---

# OAuth Token Refresh Demo

This workflow demonstrates marktoflow's automatic OAuth2 token refresh capability.

## How It Works

1. **Initial Setup**: Configure OAuth2 credentials (client ID, secret, redirect URI, refresh token)
2. **Automatic Detection**: On SDK initialization, marktoflow checks if the access token is expired or expires soon (within 5 minutes)
3. **Transparent Refresh**: If expired, marktoflow automatically refreshes the token using the refresh token
4. **Persistent Storage**: Refreshed tokens are automatically saved to `.marktoflow/credentials/` for future use
5. **Seamless Execution**: Workflow executes normally with the refreshed token

## Supported Services

- **Gmail**: Google Gmail API with OAuth2
- **Outlook**: Microsoft Graph API with OAuth2
- **Google Sheets**: Google Sheets API with OAuth2
- **Google Drive**: Google Drive API with OAuth2
- **Google Calendar**: Google Calendar API with OAuth2

## Step 1: Send Test Email

```yaml
action: gmail.sendEmail
inputs:
  to: '{{ inputs.recipient }}'
  subject: 'OAuth Refresh Test'
  body: 'This email was sent after automatic OAuth token refresh!'
output_variable: send_result
```

## Step 2: Log Success

```yaml
action: core.log
inputs:
  message: 'Email sent successfully! Message ID: {{ send_result.id }}'
  level: info
```

---

## Token Refresh Flow

```
┌─────────────────────────────────────────┐
│  Workflow Execution Starts              │
└──────────────┬──────────────────────────┘
               │
               v
┌─────────────────────────────────────────┐
│  Load Tool Configuration                │
│  - client_id, client_secret             │
│  - refresh_token, access_token          │
└──────────────┬──────────────────────────┘
               │
               v
┌─────────────────────────────────────────┐
│  Check Token Expiration                 │
│  - Is token expired?                    │
│  - Expires within 5 minutes?            │
└──────────────┬──────────────────────────┘
               │
          ┌────┴────┐
          │ Expired?│
          └────┬────┘
               │
      ┌────────┴────────┐
      │ No              │ Yes
      v                 v
┌──────────┐   ┌─────────────────────────┐
│ Use      │   │ Refresh Access Token    │
│ Existing │   │ - Call OAuth2 endpoint  │
│ Token    │   │ - Get new access token  │
└────┬─────┘   └────────┬────────────────┘
     │                  │
     │                  v
     │         ┌─────────────────────────┐
     │         │ Save Refreshed Token    │
     │         │ - Update credentials    │
     │         │ - Set new expiration    │
     │         └────────┬────────────────┘
     │                  │
     └──────────────────┘
                │
                v
┌─────────────────────────────────────────┐
│  Initialize SDK with Valid Token        │
└──────────────┬──────────────────────────┘
               │
               v
┌─────────────────────────────────────────┐
│  Execute Workflow Steps                 │
└─────────────────────────────────────────┘
```

## Setup

### 1. Install marktoflow

```bash
npm install -g marktoflow
```

### 2. Connect Gmail

```bash
marktoflow connect gmail
```

This will:
- Open browser for OAuth2 authorization
- Save credentials to `.marktoflow/credentials/gmail.json`
- Store refresh token for automatic renewal

### 3. Run Workflow

```bash
marktoflow run examples/oauth-refresh-demo/workflow.md \
  --input recipient="your-email@example.com"
```

## Token Lifecycle

| Time | Event | Access Token | Refresh Token |
|------|-------|--------------|---------------|
| T+0 | Initial Authorization | Valid (60min) | Valid (indefinite) |
| T+55min | Pre-expiration Check | Expires in 5min | Valid |
| T+55min | **Auto Refresh** | **New token (60min)** | Same |
| T+1h55min | Pre-expiration Check | Expires in 5min | Valid |
| T+1h55min | **Auto Refresh** | **New token (60min)** | Same |
| ... | Continues indefinitely | Always fresh | Persistent |

## Benefits

- ✅ **No Manual Intervention**: Tokens refresh automatically
- ✅ **Long-Running Workflows**: Works for workflows that take hours
- ✅ **Persistent Tokens**: Saved for next workflow execution
- ✅ **5-Minute Buffer**: Refreshes before expiration to prevent failures
- ✅ **Multiple Services**: Works with Gmail, Outlook, Google Drive, etc.

## Security Notes

1. **Credentials Storage**: Tokens are stored in `.marktoflow/credentials/` (add to `.gitignore`)
2. **Encryption**: marktoflow supports encrypted credentials (AES-256-GCM, Age, GPG, Fernet)
3. **Refresh Token Security**: Refresh tokens should be treated as sensitive secrets
4. **Token Rotation**: Access tokens rotate frequently (typically every hour)
5. **Revocation**: Revoke tokens in Google/Microsoft admin console if compromised

## Example: Long-Running Email Campaign

```text
---
workflow:
  id: email-campaign
  name: 'Long-Running Email Campaign'

tools:
  gmail:
    sdk: 'google-gmail'
    auth:
      # Tokens will auto-refresh as needed
      client_id: '${GOOGLE_CLIENT_ID}'
      client_secret: '${GOOGLE_CLIENT_SECRET}'
      refresh_token: '${GOOGLE_REFRESH_TOKEN}'
---

# Email Campaign

## Send 1000 Emails (Takes ~2 hours)

type: for_each
items: '{{ inputs.recipients }}'  # 1000 recipients
steps:
  - action: gmail.sendEmail
    inputs:
      to: '{{ item }}'
      subject: 'Campaign Email'
      body: 'Hello!'
  - action: core.sleep
    inputs:
      duration: 7200  # 2 hour delay between batches
```

Token will automatically refresh after ~1 hour, ensuring the campaign completes successfully.
