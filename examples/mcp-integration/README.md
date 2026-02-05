# MCP Integration Example

This example demonstrates how to integrate Model Context Protocol (MCP) servers into marktoflow workflows.

## What is MCP?

MCP (Model Context Protocol) is a standard protocol for connecting AI applications to external tools and data sources. marktoflow v2.0 has **native MCP support**, allowing you to use any MCP-compatible server as a tool in your workflows.

## How to Add MCP to a Workflow

### 1. Install the MCP Server Package

First, install the MCP server you want to use:

```bash
npm install @modelcontextprotocol/server-filesystem
npm install @modelcontextprotocol/server-slack
```

### 2. Configure Tools in Workflow YAML

Add the MCP tools to your workflow's frontmatter:

```yaml
---
workflow:
  id: my-workflow
  name: My Workflow with MCP

tools:
  # Syntax: toolName -> sdk points to the npm package
  filesystem:
    sdk: "@modelcontextprotocol/server-filesystem"
    options:
      allowedDirectories: ["./data", "./uploads"]

  slack:
    sdk: "@modelcontextprotocol/server-slack"
    auth:
      token: "${SLACK_BOT_TOKEN}"  # Env vars are resolved automatically
---
```

### 3. Use MCP Tools in Steps

Reference MCP tools using the `toolName.operation` format:

```yaml
## Step: Read a file

\`\`\`yaml
action: filesystem.read_file
inputs:
  path: "./data/config.json"
output_variable: file_content
\`\`\`

## Step: Send Slack message

\`\`\`yaml
action: slack.chat_postMessage
inputs:
  channel: "#general"
  text: "Hello from marktoflow!"
\`\`\`
```

## Available MCP Operations

marktoflow automatically discovers all operations (tools) exposed by the MCP server. Each server defines its own operations.

### Filesystem Server Operations

- `filesystem.read_file` - Read file contents
- `filesystem.write_file` - Write file contents
- `filesystem.list_directory` - List directory contents
- `filesystem.create_directory` - Create a directory
- `filesystem.move_file` - Move or rename a file

### Slack Server Operations

- `slack.chat_postMessage` - Send a message to a channel
- `slack.users_list` - List workspace users
- `slack.channels_list` - List channels
- And more...

## Authentication

MCP servers that require authentication use environment variables:

```yaml
tools:
  slack:
    sdk: "@modelcontextprotocol/server-slack"
    auth:
      token: "${SLACK_BOT_TOKEN}"  # Resolved from env
```

Set the environment variable before running:

```bash
export SLACK_BOT_TOKEN=xoxb-your-token
./marktoflow run examples/mcp-integration/workflow.md
```

## Creating Custom MCP Servers

You can create your own MCP servers using the MCP SDK:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function createMcpServer(config?: Record<string, unknown>) {
  const server = new McpServer({
    name: 'my-custom-server',
    version: '1.0.0',
  });

  // Register a tool
  server.registerTool('greet', {
    description: 'Greet a person',
    inputSchema: z.object({
      name: z.string().describe('Name to greet'),
    }),
  }, async (args) => {
    return {
      content: [{
        type: 'text',
        text: `Hello, ${args.name}!`
      }]
    };
  });

  return server;
}
```

Then use it in workflows:

```yaml
tools:
  custom:
    sdk: "./my-custom-server.js"
```

## Benefits of Native MCP Support

✅ **No subprocess bridging** - Direct in-memory communication
✅ **Type-safe** - Full TypeScript type inference
✅ **Fast** - No serialization overhead
✅ **Simple** - Just npm install and configure
✅ **Ecosystem** - Use any MCP-compatible server

## Example: Complete Workflow

See `workflow.md` in this directory for a complete working example that:
1. Reads a file using MCP filesystem server
2. Processes data
3. Sends Slack notification using MCP Slack server
4. Writes results back to disk

## Running the Example

```bash
# Install dependencies
cd examples/mcp-integration
npm install

# Set up environment
export SLACK_BOT_TOKEN=xoxb-your-token

# Create test data
mkdir -p data
echo '{"status": "ready"}' > data/config.json

# Run the workflow
../../marktoflow run workflow.md --input message="Test run"
```

## Learn More

- [MCP Official Docs](https://modelcontextprotocol.io)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)
- [marktoflow Tool Guide](../../docs/YAML-API.md#tools)
