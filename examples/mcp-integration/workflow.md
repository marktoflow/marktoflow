---
workflow:
  id: mcp-example
  name: MCP Integration Example
  description: Demonstrates how to use MCP (Model Context Protocol) servers in marktoflow
  version: 1.0.0

# MCP Tools Configuration
# Format: sdk points to the MCP package name
tools:
  filesystem:
    sdk: "@modelcontextprotocol/server-filesystem"
    options:
      allowedDirectories: ["./data"]

  slack:
    sdk: "@modelcontextprotocol/server-slack"
    auth:
      token: "${SLACK_BOT_TOKEN}"

inputs:
  message:
    type: string
    required: true
    description: Message to process and send
---

# MCP Integration Example Workflow

This workflow demonstrates how to integrate MCP servers into marktoflow workflows.

## Step 1: Read file using MCP filesystem server

```yaml
action: filesystem.read_file
inputs:
  path: "./data/config.json"
output_variable: file_content
```

## Step 2: Process the data

```yaml
action: script
inputs:
  code: |
    const data = JSON.parse(context.file_content);
    return {
      processed: true,
      ...data,
      message: context.inputs.message
    };
output_variable: processed_data
```

## Step 3: Send notification via MCP Slack server

```yaml
action: slack.chat_postMessage
inputs:
  channel: "#general"
  text: "Processed: {{ processed_data.message }}"
output_variable: slack_result
```

## Step 4: Write result using MCP filesystem server

```yaml
action: filesystem.write_file
inputs:
  path: "./data/result.json"
  content: "{{ processed_data | json }}"
```
