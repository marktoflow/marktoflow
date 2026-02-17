# Tool Configuration

### `tools` (optional)

Defines external service integrations, MCP servers, and AI agents used in the workflow.

marktoflow v2.0 has **native MCP (Model Context Protocol) support**, allowing you to use any MCP-compatible server as a tool with zero configuration overhead.

#### Structure

```yaml
tools:
  <tool_name>:
    sdk: string                      # Required: npm package, MCP server, or SDK package
    auth:                            # Optional: Authentication credentials
      <key>: string | ${ENV_VAR} | ${secret:provider://path}
    options:                         # Optional: Tool-specific options
      <key>: any

secrets:                             # Optional: External secrets configuration
  providers:
    - type: string                   # Provider type: env, vault, aws, azure
      config:                        # Provider-specific configuration
        <key>: any
  defaultCacheTTL: number            # Cache TTL in seconds (default: 300)
  throwOnNotFound: boolean           # Throw on missing secrets (default: true)
```

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `sdk` | `string` | Yes | npm package name (e.g., `@slack/web-api`), MCP server package (e.g., `@modelcontextprotocol/server-filesystem`), or native SDK |
| `auth` | `object` | No | Authentication credentials. Values can be plain strings, `${ENV_VAR}` references, or `${secret:provider://path}` secret references |
| `options` | `object` | No | Additional configuration options (passed to MCP servers or SDKs) |

#### Secret References

Auth values can reference external secret stores using the syntax `${secret:provider://path#key}`:

| Provider | Syntax | Example |
|----------|--------|---------|
| Environment | `${secret:env://VAR}` | `${secret:env://SLACK_TOKEN}` |
| HashiCorp Vault | `${secret:vault://path}` | `${secret:vault://slack/bot-token}` |
| AWS Secrets Manager | `${secret:aws://name#key}` | `${secret:aws://prod/slack#token}` |
| Azure Key Vault | `${secret:azure://name}` | `${secret:azure://slack-token}` |

Secrets are resolved at SDK initialization time before credentials are passed to the SDK.

#### Tool Types

marktoflow supports three types of tool integrations:

1. **MCP Servers** - Native MCP protocol support with in-memory communication
2. **SDK Packages** - Direct npm package imports (Slack SDK, Google APIs, etc.)
3. **OpenAPI/REST** - HTTP-based integrations via OpenAPI specs

### MCP (Model Context Protocol) Integration

marktoflow v2.0 includes **native MCP support** with:
- Direct npm package imports (no subprocess bridging)
- In-memory communication (fast and efficient)
- Automatic tool discovery from MCP servers
- Type-safe operations with Zod validation
- Works with any MCP-compatible server

#### MCP Server Configuration

```yaml
tools:
  <tool_name>:
    sdk: <mcp-package-name>          # MCP server npm package
    auth:                            # Optional: Server authentication
      token: ${TOKEN_ENV_VAR}
    options:                         # Optional: Server-specific options
      allowedDirectories: [...]
      maxFileSize: 1000000
```

#### MCP Examples

**Filesystem Server**
```yaml
tools:
  filesystem:
    sdk: '@modelcontextprotocol/server-filesystem'
    options:
      allowedDirectories: ['./data', './uploads']
      maxFileSize: 10485760  # 10MB

# Usage in steps:
# action: filesystem.read_file
# action: filesystem.write_file
# action: filesystem.list_directory
```

**Slack MCP Server**
```yaml
tools:
  slack:
    sdk: '@modelcontextprotocol/server-slack'
    auth:
      token: ${SLACK_BOT_TOKEN}

# Usage in steps:
# action: slack.chat_postMessage
# action: slack.users_list
# action: slack.channels_list
```

**GitHub MCP Server**
```yaml
tools:
  github:
    sdk: '@modelcontextprotocol/server-github'
    auth:
      token: ${GITHUB_TOKEN}
    options:
      owner: 'myorg'
      repo: 'myrepo'

# Usage in steps:
# action: github.create_issue
# action: github.list_pull_requests
# action: github.get_file_contents
```

**Custom MCP Server**
```yaml
tools:
  custom:
    sdk: './my-custom-mcp-server.js'  # Local MCP server
    options:
      customOption: 'value'
```

#### How MCP Works in marktoflow

1. **Install MCP package**: `npm install @modelcontextprotocol/server-slack`
2. **Configure in workflow**: Add to `tools` section with `sdk` pointing to package
3. **Use in steps**: Reference as `toolName.operation` (e.g., `slack.chat_postMessage`)
4. **Automatic discovery**: marktoflow auto-discovers all operations from the MCP server

#### MCP vs SDK Integration

| Feature | MCP Servers | SDK Packages |
|---------|-------------|--------------|
| Protocol | Model Context Protocol | Direct SDK calls |
| Setup | `npm install` package | `npm install` + adapter code |
| Discovery | Automatic tool listing | Manual operation definitions |
| Type Safety | Built-in with Zod | SDK-dependent |
| Best For | Standardized tools | Custom integrations |

See the [MCP Integration Guide](../../examples/mcp-integration/README.md) for complete examples.

#### Authentication Types

**OAuth2 (Gmail, Google services, Outlook)**
```yaml
auth:
  client_id: ${GOOGLE_CLIENT_ID}
  client_secret: ${GOOGLE_CLIENT_SECRET}
  redirect_uri: http://localhost:3000/callback
  refresh_token: ${GOOGLE_REFRESH_TOKEN}
  access_token: ${GOOGLE_ACCESS_TOKEN}
```

**API Token (Slack, GitHub, Notion, Discord)**
```yaml
auth:
  token: ${SLACK_BOT_TOKEN}
```

**API Key (Linear, Airtable)**
```yaml
auth:
  api_key: ${LINEAR_API_KEY}
```

**Email + API Token (Jira, Confluence)**
```yaml
auth:
  host: https://company.atlassian.net
  email: user@company.com
  api_token: ${JIRA_API_TOKEN}
```

**Database (PostgreSQL, MySQL)**
```yaml
auth:
  host: localhost
  port: 5432
  database: mydb
  user: postgres
  password: ${DB_PASSWORD}
  ssl: true  # Optional
```

**Supabase**
```yaml
auth:
  url: https://project.supabase.co
  key: ${SUPABASE_KEY}
```

#### Examples

**Slack Integration**
```yaml
tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: ${SLACK_BOT_TOKEN}
```

**Gmail Integration**
```yaml
tools:
  gmail:
    sdk: googleapis
    auth:
      client_id: ${GOOGLE_CLIENT_ID}
      client_secret: ${GOOGLE_CLIENT_SECRET}
      redirect_uri: http://localhost:3000/callback
      refresh_token: ${GOOGLE_REFRESH_TOKEN}
      access_token: ${GOOGLE_ACCESS_TOKEN}
```

**OpenAI Integration**
```yaml
tools:
  ai:
    sdk: openai
    auth:
      api_key: ${OPENAI_API_KEY}
    options:
      model: gpt-4o
```

**Local LLM (llama.cpp, VLLM, or any OpenAI-compatible server)**
```yaml
tools:
  ai:
    sdk: openai
    auth:
      base_url: http://localhost:8000/v1
      api_key: dummy           # Required by SDK but not validated locally
    options:
      model: auto              # Auto-detect from server, or specify model name
```

**GitHub Copilot Integration**
```yaml
tools:
  copilot:
    sdk: '@github/copilot-sdk'
    options:
      model: gpt-4.1
      auto_start: true
      exclude_files:
        - "node_modules/**"
        - "dist/**"
```

**HTTP/GraphQL Integration**
```yaml
tools:
  api:
    sdk: http
    auth:
      type: bearer
      token: ${API_TOKEN}
    options:
      base_url: https://api.example.com
      headers:
        Content-Type: application/json
```

---

### User-Defined SDK Integrations

You can create your own SDK integrations and use them in workflows just like built-in ones. marktoflow discovers user integrations from three sources (in priority order):

1. **`marktoflow.integrations.ts`** — Config file with inline integrations
2. **`./integrations/` directory** — Auto-discovered integration files
3. **NPM packages** — `marktoflow-integration-*` packages from node_modules

#### Quick Start: Integration File

Create `integrations/my-api.ts` in your project directory:

```ts
import { defineIntegration } from '@marktoflow/core';

export default defineIntegration({
  name: 'my-api',
  description: 'My custom API integration',

  // Optional: validate config before initialization
  validate(config) {
    const errors: string[] = [];
    if (!config.auth?.api_key) errors.push('auth.api_key is required');
    return errors;
  },

  // Required: return an object whose methods become workflow actions
  async initialize(config) {
    const apiKey = config.auth?.api_key as string;
    const baseUrl = config.options?.baseUrl as string || 'https://api.example.com';

    return {
      getItems: async (inputs) => {
        const res = await fetch(`${baseUrl}/items?q=${inputs.query}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.json();
      },
      createItem: async (inputs) => {
        const res = await fetch(`${baseUrl}/items`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: inputs.name }),
        });
        return res.json();
      },
    };
  },
});
```

Then use in your workflow:

```yaml
tools:
  myapi:
    sdk: 'my-api'
    auth:
      api_key: ${MY_API_KEY}

steps:
  - id: search
    action: my-api.getItems
    inputs:
      query: 'typescript'

  - id: create
    action: my-api.createItem
    inputs:
      name: 'New Item'
```

#### Config File: `marktoflow.integrations.ts`

For more control, create a config file at your project root:

```ts
import { defineIntegrationsConfig, defineIntegration } from '@marktoflow/core';

export default defineIntegrationsConfig({
  // Inline integrations
  integrations: [
    defineIntegration({
      name: 'internal-api',
      async initialize(config) {
        return {
          healthCheck: async () => ({ status: 'ok' }),
        };
      },
    }),
  ],

  // Custom integration directories (default: ['./integrations'])
  integrationDirs: ['./integrations', './custom-sdks'],

  // Auto-discover marktoflow-integration-* npm packages (default: true)
  discoverNpmIntegrations: true,
});
```

#### NPM Package Convention

Publish your integration as `marktoflow-integration-<name>`:

```json
{
  "name": "marktoflow-integration-weather",
  "main": "dist/index.js",
  "exports": { ".": "./dist/index.js" }
}
```

```ts
// src/index.ts
import { defineIntegration } from '@marktoflow/core';

export default defineIntegration({
  name: 'weather',
  async initialize(config) {
    return {
      getCurrent: async (inputs) => { /* ... */ },
      getForecast: async (inputs) => { /* ... */ },
    };
  },
});
```

Install and it's auto-discovered:

```bash
npm install marktoflow-integration-weather
```

> **Note:** NPM discovery scans `node_modules` in the workflow directory. In pnpm workspaces or hoisted monorepos, packages may live in a parent `node_modules` — use `marktoflow.integrations.ts` with explicit imports in those setups.

```yaml
tools:
  weather:
    sdk: 'weather'
# Just works — no additional config needed
```

#### UserIntegration Interface

```ts
interface UserIntegration {
  /** Unique name — used in tools.sdk and action references */
  name: string;

  /** Human-readable description */
  description?: string;

  /** Return an object with async methods callable from workflow steps */
  initialize(config: ToolConfig): Promise<Record<string, (inputs: Record<string, unknown>) => Promise<unknown>>>;

  /** Optional config validation — return array of error strings */
  validate?(config: ToolConfig): string[];
}
```

#### Debugging

Run with `--debug` to see which user integrations were discovered:

```bash
marktoflow run workflow.md --debug
```

Output:
```
🐛 Debug: SDK Registry
  Registered tools: weather, core
  User integrations: weather
    weather → dir:/project/integrations
```

See [examples/custom-integration](../../examples/custom-integration/) for a complete working example.
