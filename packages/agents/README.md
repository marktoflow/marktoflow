# @marktoflow/agents

Unified SDK for AI agent providers in marktoflow.
This package is the source of truth for provider implementations.

## Features

- Provider-agnostic registry and discovery
- Typed auth abstraction (`api_key` and `oauth`)
- Capability metadata (`chat`, `tools`, `vision`, `code-exec`, etc.)
- Uniform client creation interface
- Normalized error model for provider failures
- Built-in provider adapters: `claude`, `codex`, `copilot`, `qwen`, `gemini`
- Provider implementation modules for workflow/CLI adapters:
  `claude-agent`, `codex`, `github-copilot`, `gemini-cli`, `openai`, `ollama`, `opencode`

## Installation

```bash
pnpm add @marktoflow/agents
```

## Quick Start

```ts
import { asSecret, createAgentsSDK } from '@marktoflow/agents';

const sdk = createAgentsSDK();

const client = await sdk.createClient({
  provider: 'codex',
  config: {
    model: 'codex-mini-latest',
    sandboxMode: 'workspace-write',
  },
  auth: {
    type: 'api_key',
    apiKey: asSecret(process.env.OPENAI_API_KEY ?? ''),
  },
});

const result = await client.invoke({ input: 'Review this PR for security issues' });
console.log(result.output);
```

## Provider Discovery

```ts
import { createAgentsSDK } from '@marktoflow/agents';

const sdk = createAgentsSDK();

const providers = sdk.listProviders();
const visionProviders = sdk.providersByCapability('vision');
```

## Auth Safety

`@marktoflow/agents` includes secure auth helpers:

```ts
import { sanitizeAuthForLogging } from '@marktoflow/agents';

const safe = sanitizeAuthForLogging({
  type: 'oauth',
  accessToken: 'token' as any,
  refreshToken: 'refresh' as any,
});

// tokens are redacted, safe to log
console.log(safe);
```

## API Overview

- `AgentsSDK`: high-level registry + client creation facade
- `AgentProviderRegistry`: low-level registration/discovery
- `AgentProvider<TConfig>`: provider adapter contract
- `AuthConfig`: discriminated union for auth modes
- `AgentError` + `toAgentError()`: normalized error model

## Adapter Modules

Legacy adapter entrypoints are available as subpaths:

```ts
import { OpenAIInitializer } from '@marktoflow/agents/adapters/openai';
import { CodexInitializer } from '@marktoflow/agents/adapters/codex';
```

`@marktoflow/integrations` re-exports these modules for backwards compatibility.

## Built-in Providers

- `ClaudeProvider`
- `CodexProvider`
- `CopilotProvider`
- `QwenProvider`
- `GeminiProvider`
