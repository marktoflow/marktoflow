# @marktoflow/integrations

> 39 native service integrations and AI agent adapters with tool calling, structured output, and local LLM support.

[![npm](https://img.shields.io/npm/v/@marktoflow/integrations)](https://www.npmjs.com/package/@marktoflow/integrations)

Part of [marktoflow](https://github.com/marktoflow/marktoflow) — open-source AI workflow automation.

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

- **39 native SDK integrations** with full TypeScript types
- **7 AI agent adapters** — OpenAI, Claude, Copilot, Codex, OpenCode, Ollama + any OpenAI-compatible endpoint
- **Tool calling / function calling** — Agentic loops where AI models invoke tools autonomously
- **Structured output** — JSON mode and JSON Schema validation for reliable AI responses
- **Local LLM support** — llama.cpp, VLLM, LM Studio, LocalAI with auto model detection
- **Input validation** via Zod schemas for every action
- **Automatic retry** with circuit breakers and exponential backoff
- **Credential encryption** (AES-256-GCM) and OAuth token refresh
- **256+ contract tests** across 28 services (MSW-based, no API keys needed)

## AI Agent Adapters

| Agent | Setup | Tool Calling | Structured Output |
|-------|-------|:------------:|:-----------------:|
| **OpenAI** | `OPENAI_API_KEY` | ✅ | ✅ |
| **Local LLM** (llama.cpp, VLLM, LM Studio) | `base_url` + `api_key: dummy` | ✅ | ✅ |
| **GitHub Copilot** | `copilot auth login` | ✅ | — |
| **Claude Agent** | Claude CLI or `ANTHROPIC_API_KEY` | ✅ | — |
| **OpenAI Codex** | Codex CLI | ✅ | — |
| **OpenCode** | `opencode /connect` | ✅ | — |
| **Ollama** | Local install | ✅ | — |

### OpenAI / Local LLM Methods

| Method | Description |
|--------|-------------|
| `ai.generate` | Simple text generation |
| `ai.chatCompletion` | Full chat completion with tools and response_format |
| `ai.chatWithTools` | Agentic tool-calling loop (model calls tools → execute → repeat) |
| `ai.generateJSON` | Chat with JSON mode — returns parsed JSON |
| `ai.generateStructured` | Chat with JSON Schema validation |
| `ai.chatStream` | Streaming chat completion |
| `ai.embeddings` | Generate text embeddings |
| `ai.listModels` | List available models |
| `ai.autoDetectModel` | Auto-detect model from server |

### Tool Calling Example

```yaml
tools:
  ai:
    sdk: openai
    auth:
      base_url: http://localhost:8000/v1  # llama.cpp, VLLM, etc.
      api_key: dummy
    options:
      model: auto

steps:
  - action: ai.chatWithTools
    inputs:
      messages:
        - role: user
          content: "What's the weather in London?"
      tools:
        - type: function
          function:
            name: get_weather
            description: Get current weather
            parameters:
              type: object
              properties:
                city: { type: string }
              required: [city]
      maxTurns: 5
```

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

[AGPL-3.0](https://github.com/marktoflow/marktoflow/blob/main/LICENSE)
