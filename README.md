# aiworkflow - Unified AI Workflow Automation Framework

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
pip install aiworkflow
```

### Initialize a Project

```bash
aiworkflow init
```

This creates the `.aiworkflow/` directory structure with default configuration.

### Create a Workflow

Create `.aiworkflow/workflows/my-workflow.md`:

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
  message: "Hello from aiworkflow!"
```
```

### Run a Workflow

```bash
aiworkflow run .aiworkflow/workflows/my-workflow.md
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
aiworkflow init                    # Initialize project
aiworkflow version                 # Show version

# Workflow operations
aiworkflow run <workflow.md>       # Run a workflow
aiworkflow workflow list           # List available workflows
aiworkflow workflow validate <wf>  # Validate a workflow
aiworkflow workflow show <wf>      # Show workflow details

# Agent management
aiworkflow agent list              # List available agents
aiworkflow agent info <agent>      # Show agent capabilities

# Tool management
aiworkflow tools list              # List registered tools
```

## Configuration

### Main Configuration (`aiworkflow.yaml`)

```yaml
version: "1.0"
framework: aiworkflow

agent:
  primary: opencode
  fallback: null
  selection_strategy: manual

logging:
  level: info
  format: markdown

tools:
  discovery: auto
  registry_path: .aiworkflow/tools/registry.yaml
```

### Agent Capabilities (`.aiworkflow/agents/capabilities.yaml`)

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

## Tool Integration

### MCP Tools

Native support for MCP (Model Context Protocol) tools:

```yaml
# .aiworkflow/tools/mcp/jira.yaml
server:
  command: npx
  args: ["@modelcontextprotocol/server-jira"]
  env:
    JIRA_URL: "https://your-instance.atlassian.net"
```

### OpenAPI Tools

Integrate any REST API via OpenAPI specs:

```yaml
# .aiworkflow/tools/registry.yaml
tools:
  - name: github
    implementations:
      - type: openapi
        spec_url: https://api.github.com/openapi.json
```

### Custom Tools

Write Python adapters for custom integrations:

```python
# .aiworkflow/tools/custom/myservice/adapter.py
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
mypy src/aiworkflow

# Linting
ruff check src/
```

## Project Structure

```
project/
├── .aiworkflow/
│   ├── agents/              # Agent configurations
│   ├── workflows/           # Workflow definitions
│   ├── tools/               # Tool integrations
│   │   ├── mcp/
│   │   ├── openapi/
│   │   └── custom/
│   ├── triggers/            # Schedules, webhooks
│   └── state/               # Credentials, logs
├── aiworkflow.yaml          # Main configuration
└── pyproject.toml
```

## Documentation

- [AGENTS.md](AGENTS.md) - Development guidance for AI agents
- [CLAUDE.md](CLAUDE.md) - Claude-specific context
- [TODO.md](TODO.md) - Pending tasks
- [PROGRESS.md](PROGRESS.md) - Completed work

## License

MIT License

## Contributing

Contributions welcome! Please read the development guidelines in AGENTS.md.
