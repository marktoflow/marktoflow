# @marktoflow/integrations

> 30+ native service integrations and AI agent adapters for workflow automation.

[![npm](https://img.shields.io/npm/v/@marktoflow/integrations)](https://www.npmjs.com/package/@marktoflow/integrations)

Part of [marktoflow](../../README.md) — open-source markdown workflow automation.

## Quick Start

```bash
npm install @marktoflow/integrations
```

Use in workflows:

```yaml
tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

steps:
  - action: slack.chat.postMessage
    inputs:
      channel: '#general'
      text: 'Hello from marktoflow!'
```

Or programmatically:

```typescript
import { SlackInitializer } from '@marktoflow/integrations';
import { SDKRegistry } from '@marktoflow/core';

const registry = new SDKRegistry();
await registry.registerSDK(SlackInitializer);
const slack = await registry.loadSDK('slack', { auth: { token: process.env.SLACK_BOT_TOKEN } });
await registry.executeAction('slack', 'chat.postMessage', slack, { channel: '#general', text: 'Hello!' });
```

## Features

- **30+ native SDK integrations** with full TypeScript types
- **6 AI agent adapters** (Copilot, Claude, Codex, OpenCode, Ollama)
- **Input validation** via Zod schemas for every action
- **Automatic retry** with circuit breakers and exponential backoff
- **Credential encryption** (AES-256-GCM) and OAuth token refresh
- **256+ contract tests** across 28 services (MSW-based, no API keys needed)

## Service Reference

| Service | Category | Key Actions |
|---------|----------|-------------|
| **Slack** | Communication | `chat.postMessage`, `conversations.list`, `users.list` |
| **Teams** | Communication | `sendMessage`, `createChannel`, `createMeeting` |
| **Discord** | Communication | `sendMessage`, `editMessage`, `deleteMessage` |
| **Telegram** | Communication | `sendMessage`, `sendPhoto`, `sendDocument` |
| **WhatsApp** | Communication | `sendMessage`, `sendTemplate`, `sendMedia` |
| **Twilio** | Communication | `sendSMS`, `makeCall`, `sendWhatsApp` |
| **Gmail** | Email | `users.messages.send`, `users.messages.list` |
| **Outlook** | Email | `sendMail`, `listMessages`, `listCalendarEvents` |
| **SendGrid** | Email | `sendEmail`, `sendMultiple` |
| **Mailchimp** | Email | `addMember`, `createCampaign`, `sendCampaign` |
| **Google Sheets** | Productivity | `getValues`, `updateValues`, `appendValues` |
| **Google Calendar** | Productivity | `listEvents`, `createEvent`, `deleteEvent` |
| **Google Drive** | Productivity | `listFiles`, `uploadFile`, `downloadFile` |
| **Google Docs** | Productivity | `getDocument`, `createDocument`, `appendText` |
| **Notion** | Knowledge | `databases.query`, `pages.create`, `blocks.children.append` |
| **Confluence** | Knowledge | `getPage`, `createPage`, `updatePage` |
| **Jira** | Project Mgmt | `issues.createIssue`, `issues.searchIssues` |
| **Linear** | Project Mgmt | `createIssue`, `updateIssue`, `listIssues` |
| **Asana** | Project Mgmt | `createTask`, `updateTask`, `getTasksInProject` |
| **Trello** | Project Mgmt | `createCard`, `updateCard`, `addChecklistToCard` |
| **GitHub** | Developer | `pulls.create`, `issues.create`, `repos.get` |
| **Airtable** | Developer | `select`, `create`, `update`, `delete` |
| **Stripe** | Payments | `createCustomer`, `createPaymentIntent`, `createSubscription` |
| **Shopify** | Commerce | `getProducts`, `createOrder`, `updateInventoryLevel` |
| **Zendesk** | Support | `createTicket`, `updateTicket`, `search` |
| **Dropbox** | Storage | `uploadFile`, `downloadFile`, `listFolder` |
| **AWS S3** | Storage | `uploadObject`, `getObject`, `listObjects` |
| **Supabase** | Database | `select`, `insert`, `update`, `rpc` |
| **PostgreSQL** | Database | `query`, `insert`, `update`, `delete` |
| **MySQL** | Database | `query`, `insert`, `update`, `delete` |
| **HTTP** | Universal | `request` (any REST API) |

## AI Agent Adapters

| Agent | Setup | Notes |
|-------|-------|-------|
| **GitHub Copilot** | `copilot auth login` | Use existing subscription |
| **Claude Agent** | Claude CLI | Use existing subscription |
| **Claude Agent** | `ANTHROPIC_API_KEY` | Direct API with tool calling |
| **OpenAI Codex** | Codex CLI | Use existing subscription |
| **OpenCode** | `opencode /connect` | 75+ AI backends |
| **Ollama** | Local install | Free, runs locally |

## Creating Custom Integrations

```typescript
import type { SDKInitializer } from '@marktoflow/core';

export const MyServiceInitializer: SDKInitializer = {
  name: 'myservice',
  async initialize(config) {
    return new MyServiceClient(config.auth.apiKey);
  },
  actions: {
    doSomething: async (sdk, inputs) => sdk.doSomething(inputs),
  },
};
```

For per-service setup details (environment variables, OAuth, examples), see the [full documentation](https://github.com/marktoflow/marktoflow#integrations).

## Contributing

See the [contributing guide](https://github.com/marktoflow/marktoflow/blob/main/CONTRIBUTING.md).

## License

Apache-2.0
