# CLAUDE.md - Claude Code Context

This file provides context for Claude Code when working on this project.

---

## Project Summary

You are working on **marktoflow** - a universal automation framework that enables AI coding agents (Claude Code, OpenCode, Aider, etc.) to execute markdown-based workflows with standardized tool integrations.

---

## Quick Start

```bash
# Run a workflow
marktoflow run .marktoflow/workflows/email-triage.md

# Validate a workflow
marktoflow workflow validate email-triage.md

# List available tools
marktoflow tools list

# Switch agents
marktoflow agent set-primary opencode
```

---

## Key Concepts

### 1. Workflows
Markdown files with YAML frontmatter that define automation steps. Located in `.marktoflow/workflows/`.

### 2. Agent Adapters
Python classes that translate workflow steps to agent-specific execution. Each agent (Claude Code, OpenCode, etc.) has its own adapter.

### 3. Tool Registry
Central registry of available tools (MCP, OpenAPI, custom). Tools have multiple implementations with fallback order.

### 4. MCP Bridge
Enables non-Claude agents to use MCP tools by converting MCP protocol to standard function calls.

---

## Architecture Layers

```
1. Workflow Layer (markdown files)
        ↓
2. Parser (extract steps, variables)
        ↓
3. Orchestrator (manage execution)
        ↓
4. Agent Adapter (translate to agent)
        ↓
5. Tool Layer (MCP/OpenAPI/Custom)
        ↓
6. External Services
```

---

## Directory Map

| Path | Purpose |
|------|---------|
| `src/marktoflow/` | Main Python package |
| `src/marktoflow/core/` | Parser, orchestrator, state |
| `src/marktoflow/agents/` | Agent adapters |
| `src/marktoflow/tools/` | Tool registry, MCP bridge |
| `src/marktoflow/cli/` | CLI commands |
| `.marktoflow/` | User configuration directory |
| `.marktoflow/workflows/` | Workflow definitions |
| `.marktoflow/tools/` | Tool configurations |

---

## Common Tasks

### Adding a New Agent Adapter

1. Create `src/marktoflow/agents/{agent_name}.py`
2. Inherit from `AgentAdapter` base class
3. Implement `execute_step()` and `supports_feature()`
4. Register in `src/marktoflow/agents/__init__.py`

### Adding a New Tool

1. For MCP: Add config in `.marktoflow/tools/mcp/`
2. For OpenAPI: Add spec in `.marktoflow/tools/openapi/`
3. For Custom: Create adapter in `.marktoflow/tools/custom/`
4. Register in `.marktoflow/tools/registry.yaml`

### Creating a Workflow

1. Create markdown file in `.marktoflow/workflows/`
2. Add YAML frontmatter with metadata
3. Define steps with action blocks
4. Test with `marktoflow workflow validate`

---

## Code Patterns

### Workflow Step Model
```python
@dataclass
class WorkflowStep:
    id: str
    name: str
    action: str  # e.g., "jira.create_issue"
    inputs: dict
    output_variable: str | None
    conditions: list[str]
    error_handling: ErrorConfig
```

### Agent Adapter Interface
```python
class AgentAdapter(ABC):
    @abstractmethod
    async def execute_step(
        self, 
        step: WorkflowStep, 
        context: ExecutionContext
    ) -> StepResult:
        pass
    
    @abstractmethod
    def supports_feature(self, feature: str) -> bool:
        pass
    
    @abstractmethod
    def get_capabilities(self) -> AgentCapabilities:
        pass
```

### Tool Execution
```python
async def execute_tool(
    tool_name: str,
    operation: str,
    params: dict,
    agent: str
) -> ToolResult:
    tool = registry.get_tool(tool_name, agent)
    return await tool.execute(operation, params)
```

---

## Testing

```bash
# Run all tests
pytest

# Run specific test
pytest tests/test_parser.py

# Run with coverage
pytest --cov=src/marktoflow
```

---

## Dependencies

Core:
- `pydantic` - Data validation
- `pyyaml` - YAML parsing
- `jinja2` - Template rendering
- `click` or `typer` - CLI framework
- `httpx` - HTTP client
- `aiofiles` - Async file operations

Optional:
- `anthropic` - Claude API
- `openai` - OpenAI API
- `mcp` - MCP client library

---

## Current Focus

Check `TODO.md` for current tasks. The immediate priorities are:

1. Project structure creation
2. Workflow parser implementation
3. Agent adapter base class
4. Tool registry foundation

---

## Conventions

- Use `async/await` for I/O operations
- Type hints on all functions
- Docstrings for public APIs
- Keep modules focused and small
- Prefer composition over inheritance
