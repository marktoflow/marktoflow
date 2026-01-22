# AGENTS.md - Development Guidance

This file provides guidance for AI coding agents working on this project.

---

## Project Overview

**Unified AI Workflow Automation Framework** - An agent-agnostic automation platform that allows workflows written in markdown to run on any compatible AI coding agent (Claude Code, OpenCode, Aider, Cursor, Codex, Gemini CLI, etc.).

### Key Principles

1. **Write Once, Run Anywhere**: Workflows should work on any agent without modification
2. **Standards-Based**: Use MCP, OpenAPI, and JSON Schema for integrations
3. **Progressive Enhancement**: Basic features everywhere, advanced features leverage agent capabilities
4. **Production Grade**: Security, monitoring, and reliability from day one

---

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

---

## Directory Structure

```
project/
├── .aiworkflow/                    # Framework directory
│   ├── config.yaml                 # Global configuration
│   ├── agents/                     # Agent configs and capabilities
│   ├── workflows/                  # Workflow definitions (.md)
│   ├── tools/                      # Tool integrations
│   │   ├── mcp/                    # MCP server configs
│   │   ├── openapi/                # OpenAPI specs
│   │   └── custom/                 # Custom adapters
│   ├── triggers/                   # Schedules, webhooks, events
│   ├── state/                      # Credentials, logs, state
│   └── plugins/                    # Installed plugins
├── src/                            # Framework source code
│   ├── aiworkflow/                 # Main package
│   │   ├── core/                   # Core framework
│   │   ├── agents/                 # Agent adapters
│   │   ├── tools/                  # Tool integration
│   │   └── cli/                    # CLI commands
├── aiworkflow.yaml                 # Main config (project root)
└── pyproject.toml                  # Python project config
```

---

## Development Guidelines

### Code Style
- Python 3.11+ with type hints
- Use `dataclasses` or `pydantic` for data models
- Async/await for I/O operations
- Follow PEP 8, use `ruff` for linting

### Key Patterns

**Agent Adapter Pattern**:
```python
class AgentAdapter(ABC):
    @abstractmethod
    def execute_step(self, step: WorkflowStep, context: dict) -> StepResult:
        pass
    
    @abstractmethod
    def supports_feature(self, feature: str) -> bool:
        pass
```

**Tool Registry Pattern**:
```python
class ToolRegistry:
    def register(self, tool: Tool) -> None: ...
    def get_tool(self, name: str, agent: str) -> Tool: ...
    def list_compatible_tools(self, agent: str) -> List[Tool]: ...
```

### Testing
- Unit tests for all core components
- Integration tests with mock agents
- Cross-agent compatibility tests

---

## Current Focus

See TODO.md for current tasks. Priority order:

1. **Project Structure** - Create .aiworkflow directory tree
2. **Workflow Parser** - Parse YAML frontmatter + markdown workflows
3. **Agent Adapters** - Base class and capability detection
4. **MCP Bridge** - Enable non-Claude agents to use MCP tools
5. **Tool Registry** - Manage tool discovery and selection
6. **CLI** - Command-line interface for workflow management

---

## Workflow Format

Workflows use markdown with YAML frontmatter:

```markdown
---
workflow:
  id: my-workflow
  name: "My Workflow"
  
compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported
    
requirements:
  tools: [tool1, tool2]
  features:
    - tool_calling: required
---

# My Workflow

Description of the workflow.

## Step 1: Do Something

```yaml
action: tool.operation
inputs:
  param: value
output_variable: result
```
```

---

## Agent Capabilities

| Feature | Claude Code | OpenCode | Aider |
|---------|-------------|----------|-------|
| MCP Native | Yes | Via Bridge | No |
| Tool Calling | Yes | Yes | Limited |
| Extended Reasoning | Yes | Model-dependent | No |
| Streaming | Yes | Yes | Yes |
| Web Search | Native | Via Tools | No |

---

## File References

- `PRD.md` - Full product requirements
- `TODO.md` - Pending tasks
- `PROGRESS.md` - Completed work
- `CLAUDE.md` - Claude-specific context
