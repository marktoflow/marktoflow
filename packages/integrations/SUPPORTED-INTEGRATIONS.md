# Supported Integrations

marktoflow v2.0 includes 38 native service integrations, 6 AI agent adapters, and built-in tools.

## Communication & Collaboration

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| Slack | `@slack/web-api` | `@slack/web-api` | Bot Token |
| Discord | `discord` | Custom REST client | Bot Token |
| Telegram | `telegram` | Custom REST client | Bot Token |
| WhatsApp | `whatsapp` | Custom REST client (Cloud API) | Access Token |
| Microsoft Teams | `teams` | `@microsoft/microsoft-graph-client` | OAuth2 |

## Email

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| Gmail | `google-gmail` | `googleapis` | OAuth2 |
| Outlook | `@microsoft/microsoft-graph-client` | `@microsoft/microsoft-graph-client` | OAuth2 |

## Project Management & Issue Tracking

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| Jira | `jira.js` | `jira.js` | API Token |
| Linear | `linear` | `@linear/sdk` | API Key |
| Asana | `asana` | Custom REST client | Personal Access Token |
| Trello | `trello` | Custom REST client | API Key + Token |
| Monday.com | `monday` | Custom GraphQL client | API Token |

## Documentation & Knowledge

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| Notion | `notion` | `@notionhq/client` | Integration Token |
| Confluence | `confluence` | Custom REST client | API Token |

## Developer Tools & DevOps

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| GitHub | `@octokit/rest` | `@octokit/rest` | Personal Access Token |
| GitLab | `gitlab` | Custom REST client | Personal Access Token |
| PagerDuty | `pagerduty` | Custom REST client | API Key |
| Sentry | `sentry` | Custom REST client | Auth Token |

## Data & Databases

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| Airtable | `airtable` | `airtable` | API Key |
| Supabase | `supabase` | `@supabase/supabase-js` | Anon/Service Key |
| PostgreSQL | `pg` | `pg` | Connection string |
| MySQL | `mysql2` | `mysql2` | Connection string |

## Google Services

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| Google Sheets | `google-sheets` | `googleapis` | OAuth2 / Service Account |
| Google Calendar | `google-calendar` | `googleapis` | OAuth2 / Service Account |
| Google Drive | `google-drive` | `googleapis` | OAuth2 / Service Account |
| Google Docs | `google-docs` | `googleapis` | OAuth2 / Service Account |

## Payments & E-commerce

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| Stripe | `stripe` | `stripe` | Secret Key |
| Shopify | `@shopify/shopify-api` | `@shopify/shopify-api` | Access Token |

## Communications (SMS/Voice)

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| Twilio | `twilio` | `twilio` | Account SID + Auth Token |
| SendGrid | `@sendgrid/mail` | `@sendgrid/mail` | API Key |
| Mailchimp | `@mailchimp/mailchimp_marketing` | `@mailchimp/mailchimp_marketing` | API Key |

## Customer Support & Scheduling

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| Zendesk | `node-zendesk` | `node-zendesk` | API Token |
| Intercom | `intercom` | Custom REST client | Access Token |
| Calendly | `calendly` | Custom REST client | Personal Access Token |

## CRM & Sales

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| HubSpot | `hubspot` | Custom REST client | Access Token |
| Salesforce | `salesforce` | Custom REST client | OAuth2 |

## File Storage

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| Dropbox | `dropbox` | Custom REST client | Access Token |
| AWS S3 | `@aws-sdk/client-s3` | `@aws-sdk/client-s3` | Access Key + Secret |

## Generic

| Service | SDK Key | SDK Package | Auth |
|---------|---------|-------------|------|
| HTTP | `http` | Built-in (fetch) | Configurable |
| Playwright | `playwright` | `playwright` | N/A |

## AI Agent Adapters

| Adapter | SDK Key(s) | Description |
|---------|-----------|-------------|
| Ollama | `ollama` | Local LLM inference |
| Claude Code | `claude-code` | Anthropic Claude Code CLI |
| Claude Agent | `claude-agent`, `@anthropic-ai/claude-agent-sdk` | Anthropic Claude Agent SDK |
| OpenCode | `opencode` | OpenCode CLI agent |
| GitHub Copilot | `github-copilot`, `@github/copilot-sdk` | GitHub Copilot SDK |
| Codex | `codex`, `@openai/codex-sdk` | OpenAI Codex SDK |

## Built-in Tools

| Tool | SDK Key | Description |
|------|---------|-------------|
| Core | `core` | Built-in operations (log, set, transform, etc.) |
| Workflow | `workflow` | Sub-workflow execution |
| Script | `script` | Inline JavaScript execution |

## Usage

Reference integrations in workflow YAML by their SDK key:

```yaml
tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'
```

Then use them in steps:

```yaml
action: slack.chat.postMessage
inputs:
  channel: '#general'
  text: 'Hello from marktoflow!'
```
