# marktoflow - Unified AI Workflow Automation Framework

**Write once, run on any AI coding agent.**

A universal automation framework that enables AI coding agents (Claude Code, OpenCode, Aider, Cursor, Codex, Gemini CLI, etc.) to execute markdown-based workflows with standardized tool integrations.

## Key Features

- **Agent Agnostic**: Single workflow definition works with any compatible AI agent
- **Standards Based**: Built on MCP, OpenAPI, and JSON Schema
- **Progressive Enhancement**: Basic features everywhere, advanced features leverage agent capabilities
- **Production Grade**: Security, monitoring, and reliability from day one

## Quick Start

### Installation

```bash
pip install marktoflow
```

### Initialize a Project

```bash
marktoflow init
```

This creates the `.marktoflow/` directory structure with default configuration.

### Create a Workflow

Create `.marktoflow/workflows/my-workflow.md`:

```markdown
---
workflow:
  id: my-workflow
  name: "My First Workflow"
  
compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported
    
requirements:
  tools: [slack]
---

# My First Workflow

## Step 1: Send Notification

```yaml
action: slack.send_message
inputs:
  channel: "#general"
  message: "Hello from marktoflow!"
```
```

### Run a Workflow

```bash
marktoflow run .marktoflow/workflows/my-workflow.md
```

## Architecture

```
Application Layer (Markdown Workflows)
         ▼
Abstraction Layer (Workflow Engine Core)
         ▼
Agent Layer (Pluggable Adapters)
         ▼
Tool Layer (MCP Bridge + OpenAPI + Custom)
         ▼
External Services (Jira, Slack, Email, etc.)
```

## Supported Agents

| Agent | Status | MCP Support | Notes |
|-------|--------|-------------|-------|
| Claude Code | Supported | Native | Recommended for complex reasoning |
| OpenCode | Supported | Native | Multi-model, self-hosted option |
| Aider | Planned | Via Bridge | Code editing focus |
| Codex | Planned | Via Bridge | Sandboxed execution |
| Gemini CLI | Planned | Via Bridge | Large context window |

### Recommended Agents

- **Claude Code**: Best for complex reasoning tasks and native MCP support. Recommended as primary agent.
- **OpenCode**: Excellent alternative when Claude Code is unavailable. Works great with GitHub Copilot and supports multiple model backends (OpenAI, Anthropic, Ollama). If you're using GitHub Copilot or need a self-hosted solution, OpenCode is the recommended choice.

## CLI Commands

```bash
# Project management
marktoflow init                    # Initialize project
marktoflow version                 # Show version

# Workflow operations
marktoflow run <workflow.md>       # Run a workflow (auto-detects bundles)
marktoflow workflow list           # List available workflows
marktoflow workflow validate <wf>  # Validate a workflow
marktoflow workflow show <wf>      # Show workflow details

# Bundle operations
marktoflow bundle info <path>      # Show bundle information
marktoflow bundle validate <path>  # Validate bundle structure
marktoflow bundle run <path>       # Run a bundle workflow
marktoflow bundle list [path]      # List bundles in directory

# Agent management
marktoflow agent list              # List available agents
marktoflow agent info <agent>      # Show agent capabilities

# Tool management
marktoflow tools list              # List registered tools
```

## Configuration

### Main Configuration (`marktoflow.yaml`)

```yaml
version: "1.0"
framework: marktoflow

agent:
  primary: opencode
  fallback: null
  selection_strategy: manual

logging:
  level: info
  format: markdown

tools:
  discovery: auto
  registry_path: .marktoflow/tools/registry.yaml
```

### Agent Capabilities (`.marktoflow/agents/capabilities.yaml`)

```yaml
agents:
  claude-code:
    capabilities:
      tool_calling: native
      reasoning: advanced
      mcp:
        native_support: true
        
  opencode:
    capabilities:
      tool_calling: supported
      reasoning: basic
      mcp:
        native_support: true
```

## Workflow Format

Workflows use markdown with YAML frontmatter:

```markdown
---
workflow:
  id: example
  name: "Example Workflow"
  
compatibility:
  agents:
    - claude-code: recommended
    
requirements:
  tools: [jira, slack]
  features:
    - tool_calling: required
    
execution:
  timeout: 300s
  error_handling: continue
---

# Example Workflow

Description of what this workflow does.

## Step 1: Do Something

```yaml
action: tool.operation
inputs:
  param: value
output_variable: result
```

## Step 2: Use Previous Result

```yaml
action: another.operation
inputs:
  data: "{result}"
conditions:
  - result.success == true
```
```

## Self-Contained Workflow Bundles

Bundles are self-contained directories with everything needed to run a workflow:

```
my-workflow/
├── workflow.md              # Main workflow file
├── config.yaml              # Optional: bundle configuration
├── tools.yaml               # Optional: tool metadata
└── tools/                   # Script tools directory
    ├── build.sh             # Auto-discovered: tool name = "build"
    ├── deploy.py            # Auto-discovered: tool name = "deploy"
    └── notify               # Any executable
```

### Creating a Bundle

```bash
mkdir my-workflow
cd my-workflow

# Create workflow
cat > workflow.md << 'EOF'
---
workflow:
  id: my-workflow
  name: "My Workflow"
---

# My Workflow

## Step 1: Build

```yaml
action: build.run
inputs:
  target: production
```
EOF

# Create a script tool
mkdir tools
cat > tools/build.sh << 'EOF'
#!/bin/bash
echo '{"status": "success", "target": "'$1'"}'
EOF
chmod +x tools/build.sh
```

### Running a Bundle

```bash
# Direct bundle run
marktoflow bundle run my-workflow/

# Or auto-detected with regular run
marktoflow run my-workflow/
```

### Script Tool I/O

- **Inputs**: Passed as `--key=value` CLI arguments
- **Outputs**: Stdout parsed as JSON (or plain text if invalid JSON)
- **Multi-operation**: First argument is operation name

Example Python tool:

```python
#!/usr/bin/env python3
# tools/slack.py
import argparse
import json

def send_message(channel, message):
    # Your implementation here
    return {"ok": True, "channel": channel}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("operation")
    parser.add_argument("--channel")
    parser.add_argument("--message")
    args = parser.parse_args()
    
    if args.operation == "send_message":
        result = send_message(args.channel, args.message)
        print(json.dumps(result))
```

## Tool Integration

### MCP Tools

Native support for MCP (Model Context Protocol) tools:

```yaml
# .marktoflow/tools/mcp/jira.yaml
server:
  command: npx
  args: ["@modelcontextprotocol/server-jira"]
  env:
    JIRA_URL: "https://your-instance.atlassian.net"
```

### OpenAPI Tools

Integrate any REST API via OpenAPI specs:

```yaml
# .marktoflow/tools/registry.yaml
tools:
  - name: github
    implementations:
      - type: openapi
        spec_url: https://api.github.com/openapi.json
```

### Custom Tools

Write Python adapters for custom integrations:

```python
# .marktoflow/tools/custom/myservice/adapter.py
class Adapter:
    def op_get_data(self, id: str) -> dict:
        """Get data from my service."""
        return {"id": id, "data": "..."}
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy src/marktoflow

# Linting
ruff check src/
```

## Project Structure

```
project/
├── .marktoflow/
│   ├── agents/              # Agent configurations
│   ├── workflows/           # Workflow definitions
│   ├── tools/               # Tool integrations
│   │   ├── mcp/
│   │   ├── openapi/
│   │   └── custom/
│   ├── triggers/            # Schedules, webhooks
│   └── state/               # Credentials, logs
├── marktoflow.yaml          # Main configuration
└── pyproject.toml
```

## Documentation

- [AGENTS.md](AGENTS.md) - Development guidance for AI agents
- [CLAUDE.md](CLAUDE.md) - Claude-specific context
- [TODO.md](TODO.md) - Pending tasks
- [PROGRESS.md](PROGRESS.md) - Completed work

## License

Apache License 2.0

## Contributing

Contributions welcome! Please read the development guidelines in AGENTS.md.
