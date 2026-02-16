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
