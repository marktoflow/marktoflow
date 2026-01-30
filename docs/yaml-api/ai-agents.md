# AI Agent Integrations API Reference

Complete API reference for AI agent integrations in marktoflow workflows.

---

## Table of Contents

1. [Overview](#overview)
2. [Per-Step Model Configuration](#per-step-model-configuration)
3. [External Prompts](#external-prompts)
4. [GitHub Copilot](#github-copilot)
5. [Claude Agent](#claude-agent)
6. [OpenAI Codex](#openai-codex)
7. [OpenCode](#opencode)
8. [Claude Code](#claude-code)
9. [Ollama](#ollama)
10. [AI-Powered Browser Automation](#ai-powered-browser-automation)

---

## Overview

AI agent integrations enable intelligent task automation, code generation, analysis, and decision-making within workflows. These agents can:

- Generate and modify code
- Answer questions about codebases
- Execute shell commands
- Perform web research
- Analyze and review code
- Automate browser interactions

---

## Per-Step Model Configuration

marktoflow allows you to override the AI model and agent backend on a per-step basis. This enables cost optimization by using cheaper models for simple tasks and more capable models for complex tasks.

### Basic Model Override

Override the model for a specific step:

```yaml
steps:
  # Use fast, cheap model for quick summary
  - id: quick-summary
    action: agent.chat.completions
    model: haiku                    # Fast, cheap
    inputs:
      messages:
        - role: user
          content: "Summarize: {{ inputs.text }}"

  # Use powerful model for deep analysis
  - id: deep-analysis
    action: agent.chat.completions
    model: opus                     # Most capable
    inputs:
      messages:
        - role: user
          content: "Detailed analysis: {{ inputs.code }}"
```

### Agent Backend Override

Override the agent backend for a specific step:

```yaml
steps:
  - id: copilot-task
    action: agent.chat.completions
    agent: copilot                  # Use GitHub Copilot
    model: gpt-4.1
    inputs:
      messages:
        - role: user
          content: "Generate code: {{ inputs.spec }}"

  - id: claude-task
    action: agent.chat.completions
    agent: claude-agent             # Use Claude Agent
    model: claude-sonnet-4-5
    inputs:
      messages:
        - role: user
          content: "Review code: {{ inputs.code }}"
```

### Workflow-Level Defaults

Set default model and agent at the workflow level:

```yaml
workflow:
  id: my-workflow
  name: "My Workflow"
  default_agent: claude-agent
  default_model: claude-sonnet-4-5

steps:
  - id: uses-defaults
    action: agent.chat.completions
    # Uses default_agent and default_model
    inputs:
      messages:
        - role: user
          content: "Process this"

  - id: overrides-model
    action: agent.chat.completions
    model: haiku                    # Override for this step only
    inputs:
      messages:
        - role: user
          content: "Quick task"
```

### Available Models

| Agent | Available Models |
|-------|-----------------|
| Claude Agent | `claude-opus-4`, `claude-sonnet-4-5`, `haiku` |
| GitHub Copilot | `gpt-4.1`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| OpenAI Codex | `gpt-4-turbo`, `gpt-3.5-turbo` |
| Ollama | Any locally installed model (`llama2`, `codellama`, etc.) |

---

## External Prompts

External prompts allow you to store prompt templates in separate markdown files. This improves maintainability, enables prompt reuse, and keeps workflows clean.

### Basic Usage

Reference an external prompt file in a step:

```yaml
- id: review
  action: agent.chat.completions
  prompt: ./prompts/code-review.md
  prompt_inputs:
    code: '{{ inputs.code }}'
    language: typescript
  output_variable: review
```

### Prompt File Format

Prompt files use markdown with optional YAML frontmatter:

**prompts/code-review.md:**
```markdown
---
name: Code Review
description: Review code for quality and security
variables:
  code:
    type: string
    required: true
  language:
    type: string
    default: auto
---

# Code Review

Review this {{ prompt.language }} code:

```
{{ prompt.code }}
```

Focus on:
- Security vulnerabilities
- Performance issues
- Code style and best practices
```

### Template Syntax

Prompts support two template syntaxes:

- **`{{ prompt.variable }}`** - Access variables defined in the prompt or `prompt_inputs`
- **`{{ variable }}`** - Access workflow context (inputs, step outputs)

### Combining with Model Overrides

Use external prompts with per-step model configuration:

```yaml
- id: security-scan
  action: agent.chat.completions
  model: opus                       # Use most capable model
  prompt: ./prompts/security-analysis.md
  prompt_inputs:
    code: '{{ inputs.source_code }}'
    severity_threshold: high
  output_variable: security_results
```

### Best Practices

1. **Organize prompts by domain**: `prompts/code/`, `prompts/docs/`, `prompts/analysis/`
2. **Use frontmatter for documentation**: Declare variables with types and descriptions
3. **Keep prompts focused**: One task per prompt file
4. **Version control prompts**: Track changes like code

For more details on prompt file format and validation, see [External Prompts](../YAML-API.md#external-prompts) in the main API reference.

---

## GitHub Copilot

Advanced AI coding assistant powered by OpenAI models.

### Configuration

```yaml
tools:
  copilot:
    sdk: '@github/copilot-sdk'
    options:
      cli_path: string         # Optional: Path to Copilot CLI
      cli_url: string          # Optional: Download URL for CLI
      model: string            # Optional: Model name (default: "gpt-4.1")
      auto_start: boolean      # Optional: Auto-start server (default: true)
      log_level: string        # Optional: Log level
      cwd: string              # Optional: Working directory
      exclude_files: string[]  # Optional: Files to exclude from context
      env: object              # Optional: Environment variables
```

**Example:**

```yaml
tools:
  copilot:
    sdk: '@github/copilot-sdk'
    options:
      model: gpt-4.1
      auto_start: true
      cwd: /path/to/project
      exclude_files:
        - "node_modules/**"
        - "dist/**"
        - "*.log"
```

### Simple Actions

#### `copilot.send`

Send a prompt and get a response.

```yaml
action: copilot.send
inputs:
  message: string          # Required: User message/prompt
  system: string           # Optional: System prompt
  temperature: number      # Optional: Temperature (0-1)
  max_tokens: number       # Optional: Max response tokens
  top_p: number            # Optional: Nucleus sampling
```

**Example:**

```yaml
action: copilot.send
inputs:
  message: "Write a TypeScript function to validate email addresses using regex"
  temperature: 0.7
output_variable: email_validator_code
```

#### `copilot.stream`

Stream a response with callbacks.

```yaml
action: copilot.stream
inputs:
  message: string          # Required: User message
  system: string           # Optional: System prompt
  on_chunk: function       # Optional: Callback for each chunk
  on_complete: function    # Optional: Callback on completion
```

### Session Actions

Sessions enable multi-turn conversations with context preservation.

#### `copilot.sendWithSession`

Send message with full session control.

```yaml
action: copilot.sendWithSession
inputs:
  message: string          # Required: User message
  session_config:          # Optional: Session configuration
    system: string         # System prompt
    temperature: number
    max_tokens: number
    files: string[]        # Files to include in context
    tools: object[]        # Custom tools to enable
```

**Example:**

```yaml
# First message creates session
action: copilot.sendWithSession
inputs:
  message: "I need to refactor the authentication module"
  session_config:
    system: "You are an expert TypeScript developer"
    files:
      - "src/auth/*.ts"
      - "tests/auth/*.test.ts"
output_variable: refactoring_plan

# Follow-up message reuses session
action: copilot.sendWithSession
inputs:
  message: "Now implement the changes you suggested"
output_variable: refactored_code
```

#### `copilot.createSession`

Create a new session.

```yaml
action: copilot.createSession
inputs:
  system: string           # Optional: System prompt
  temperature: number      # Optional: Temperature
  max_tokens: number       # Optional: Max tokens
  files: string[]          # Optional: Context files
output_variable: session_id
```

#### `copilot.resumeSession`

Resume an existing session.

```yaml
action: copilot.resumeSession
inputs:
  session_id: string       # Required: Session ID to resume
  system: string           # Optional: Update system prompt
```

#### `copilot.resumeAndSend`

Resume session and send message in one action.

```yaml
action: copilot.resumeAndSend
inputs:
  session_id: string       # Required: Session ID
  message: string          # Required: Message to send
```

### Tool Actions

Enable Copilot to use custom tools.

#### `copilot.sendWithTools`

Send message with custom tools enabled.

```yaml
action: copilot.sendWithTools
inputs:
  message: string          # Required: User message
  tools: object[]          # Required: Tool definitions
  session_config: object   # Optional: Session config
```

**Example:**

```yaml
action: copilot.sendWithTools
inputs:
  message: "Check the weather in San Francisco and send a Slack message with the forecast"
  tools:
    - type: "function"
      function:
        name: "get_weather"
        description: "Get current weather for a location"
        parameters:
          type: "object"
          properties:
            location:
              type: "string"
              description: "City name"
          required: ["location"]
    - type: "function"
      function:
        name: "send_slack_message"
        description: "Send a message to Slack"
        parameters:
          type: "object"
          properties:
            channel:
              type: "string"
            text:
              type: "string"
          required: ["channel", "text"]
```

#### `copilot.sendWithAgents`

Use custom agents for specialized tasks.

```yaml
action: copilot.sendWithAgents
inputs:
  message: string          # Required: User message
  custom_agents: object[]  # Required: Agent definitions
```

#### `copilot.sendWithMcp`

Enable MCP (Model Context Protocol) servers.

```yaml
action: copilot.sendWithMcp
inputs:
  message: string          # Required: User message
  mcp_servers: object[]    # Required: MCP server configs
```

### Status Actions

#### `copilot.listModels`

List available models.

```yaml
action: copilot.listModels
inputs: {}
```

#### `copilot.getStatus`

Get server status.

```yaml
action: copilot.getStatus
inputs: {}
```

#### `copilot.checkAuth`

Check authentication status.

```yaml
action: copilot.checkAuth
inputs: {}
```

---

## Claude Agent

Anthropic Claude agent with advanced agentic capabilities.

### Configuration

```yaml
tools:
  claude:
    sdk: '@anthropic-ai/claude-agent-sdk'
    auth:
      api_key: ${ANTHROPIC_API_KEY}
    options:
      model: string            # Optional: Model (default: "claude-sonnet-4-5")
      cwd: string              # Optional: Working directory
      additional_directories: string[] # Optional: Extra context dirs
      exclude_files: string[]  # Optional: Files to exclude
      permission_mode: string  # Optional: Permission mode
      max_turns: number        # Optional: Max turns (default: 50)
      max_budget_usd: number   # Optional: Budget limit
      allowed_tools: string[]  # Optional: Allowed tools
      disallowed_tools: string[] # Optional: Disallowed tools
      mcp_servers: object[]    # Optional: MCP servers
      agents: object[]         # Optional: Subagent definitions
```

**Permission Modes:**
- `acceptEdits` - Auto-accept file edits
- `acceptCommands` - Auto-accept bash commands
- `acceptAll` - Auto-accept everything
- `prompt` - Prompt for each action (default)

**Example:**

```yaml
tools:
  claude:
    sdk: '@anthropic-ai/claude-agent-sdk'
    auth:
      api_key: ${ANTHROPIC_API_KEY}
    options:
      model: claude-sonnet-4-5
      cwd: /path/to/project
      permission_mode: acceptEdits
      max_turns: 100
      max_budget_usd: 5.00
      exclude_files:
        - "node_modules/**"
        - ".git/**"
```

### Simple Actions

#### `claude.generate`

Simple prompt-response generation.

```yaml
action: claude.generate
inputs:
  prompt: string           # Required: User prompt
  system: string           # Optional: System prompt
  max_tokens: number       # Optional: Max response tokens
  temperature: number      # Optional: Temperature (0-1)
```

**Example:**

```yaml
action: claude.generate
inputs:
  prompt: "Explain how React hooks work"
  max_tokens: 1000
output_variable: explanation
```

### Agentic Actions

These actions give Claude full agentic capabilities to use tools and make decisions.

#### `claude.run`

Full agentic query with tool use.

```yaml
action: claude.run
inputs:
  prompt: string           # Required: User prompt
  system: string           # Optional: System prompt
  max_turns: number        # Optional: Max conversation turns
  max_budget_usd: number   # Optional: Budget limit
  allowed_tools: string[]  # Optional: Limit tools
```

**Example:**

```yaml
action: claude.run
inputs:
  prompt: "Find all TODO comments in the codebase and create GitHub issues for them"
  max_turns: 50
  allowed_tools: ["Read", "Glob", "Grep"]
output_variable: created_issues
```

#### `claude.stream`

Stream agentic response with callbacks.

```yaml
action: claude.stream
inputs:
  prompt: string           # Required: User prompt
  on_message: function     # Optional: Callback for messages
  on_complete: function    # Optional: Completion callback
  max_turns: number        # Optional: Max turns
```

#### `claude.query`

Async generator for messages.

```yaml
action: claude.query
inputs:
  prompt: string           # Required: User prompt
  system: string           # Optional: System prompt
  max_turns: number        # Optional: Max turns
```

### Tool-Specific Actions

Restrict Claude to specific tools for focused tasks.

#### `claude.runWithTools`

Run with specific tools only.

```yaml
action: claude.runWithTools
inputs:
  prompt: string           # Required: User prompt
  tools: string[]          # Required: Tools to enable
  max_turns: number        # Optional: Max turns
```

**Example:**

```yaml
action: claude.runWithTools
inputs:
  prompt: "Analyze error rate trends in the logs"
  tools: ["Read", "Grep", "Bash"]
output_variable: analysis
```

#### `claude.analyzeCode`

Code analysis (Read, Glob, Grep only).

```yaml
action: claude.analyzeCode
inputs:
  prompt: string           # Required: Analysis prompt
  focus_files: string[]    # Optional: Files to focus on
```

**Example:**

```yaml
action: claude.analyzeCode
inputs:
  prompt: "Find all potential security vulnerabilities in the authentication code"
  focus_files: ["src/auth/**/*.ts"]
output_variable: vulnerabilities
```

#### `claude.modifyCode`

Code modification (Read, Write, Edit, Glob, Grep).

```yaml
action: claude.modifyCode
inputs:
  prompt: string           # Required: Modification prompt
  files: string[]          # Optional: Files to modify
```

**Example:**

```yaml
action: claude.modifyCode
inputs:
  prompt: "Add TypeScript type annotations to all functions in the utils directory"
  files: ["src/utils/**/*.js"]
output_variable: changes
```

#### `claude.runCommands`

Execute bash commands (Bash, Read, Glob).

```yaml
action: claude.runCommands
inputs:
  prompt: string           # Required: Command prompt
  cwd: string              # Optional: Working directory
```

**Example:**

```yaml
action: claude.runCommands
inputs:
  prompt: "Run the test suite and generate a coverage report"
  cwd: /path/to/project
output_variable: test_results
```

#### `claude.webResearch`

Web research (WebSearch, WebFetch).

```yaml
action: claude.webResearch
inputs:
  prompt: string           # Required: Research prompt
  max_searches: number     # Optional: Max search queries
```

**Example:**

```yaml
action: claude.webResearch
inputs:
  prompt: "Research the latest best practices for React Server Components in 2024"
  max_searches: 5
output_variable: research_findings
```

### Subagent Actions

Delegate tasks to specialized subagents.

#### `claude.runWithSubagents`

Run with custom subagents.

```yaml
action: claude.runWithSubagents
inputs:
  prompt: string           # Required: User prompt
  agents: object[]         # Required: Subagent definitions
```

**Example:**

```yaml
action: claude.runWithSubagents
inputs:
  prompt: "Implement a new feature: user profile page with avatar upload"
  agents:
    - name: "backend"
      description: "Backend API developer"
      allowed_tools: ["Read", "Write", "Edit"]
      focus_dirs: ["src/api", "src/models"]
    - name: "frontend"
      description: "React frontend developer"
      allowed_tools: ["Read", "Write", "Edit"]
      focus_dirs: ["src/components", "src/pages"]
    - name: "reviewer"
      description: "Code reviewer"
      allowed_tools: ["Read", "Grep"]
output_variable: implementation
```

#### `claude.codeReview`

Multi-expert code review.

```yaml
action: claude.codeReview
inputs:
  prompt: string           # Required: Review prompt
  files: string[]          # Optional: Files to review
  reviewers: string[]      # Optional: Review focus areas
```

**Example:**

```yaml
action: claude.codeReview
inputs:
  prompt: "Review this pull request for security, performance, and code quality issues"
  files:
    - "src/auth/login.ts"
    - "src/auth/session.ts"
  reviewers: ["security", "performance", "style"]
output_variable: review_report
```

### Session Actions

#### `claude.resumeSession`

Resume a previous session.

```yaml
action: claude.resumeSession
inputs:
  session_id: string       # Required: Session ID
  prompt: string           # Required: New prompt
```

#### `claude.getSessionId`

Get the last session ID.

```yaml
action: claude.getSessionId
inputs: {}
```

#### `claude.interrupt`

Interrupt the current query.

```yaml
action: claude.interrupt
inputs: {}
```

### Built-in Tools

Claude Agent has access to these built-in tools:

| Tool | Description |
|------|-------------|
| `Read` | Read file contents |
| `Write` | Write/create files |
| `Edit` | Edit existing files |
| `Bash` | Execute bash commands |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `WebSearch` | Search the web |
| `WebFetch` | Fetch web pages |
| `Task` | Delegate to subagents |

---

## OpenAI Codex

OpenAI Codex SDK integration for code generation and editing.

### Configuration

```yaml
tools:
  codex:
    sdk: '@openai/codex-sdk'
    auth:
      api_key: ${OPENAI_API_KEY}
    options:
      codex_path_override: string  # Optional: Custom CLI path
      base_url: string             # Optional: API base URL
      env: object                  # Optional: Environment variables
      default_thread_options:      # Optional: Default thread config
        model: string
        temperature: number
```

**Example:**

```yaml
tools:
  codex:
    sdk: '@openai/codex-sdk'
    auth:
      api_key: ${OPENAI_API_KEY}
    options:
      default_thread_options:
        model: gpt-4-turbo
        temperature: 0.3
```

### Simple Actions

#### `codex.send`

Send prompt and get response.

```yaml
action: codex.send
inputs:
  message: string          # Required: User message
  system: string           # Optional: System prompt
  model: string            # Optional: Model override
  temperature: number      # Optional: Temperature
  max_tokens: number       # Optional: Max tokens
```

**Example:**

```yaml
action: codex.send
inputs:
  message: "Generate a Python function to parse JSON with error handling"
  temperature: 0.2
output_variable: python_code
```

#### `codex.stream`

Stream response.

```yaml
action: codex.stream
inputs:
  message: string          # Required: User message
  on_chunk: function       # Optional: Chunk callback
  on_complete: function    # Optional: Complete callback
```

### Thread Actions

Threads enable persistent conversations.

#### `codex.sendWithThread`

Send message with thread control.

```yaml
action: codex.sendWithThread
inputs:
  message: string          # Required: User message
  thread_options:          # Optional: Thread config
    model: string
    temperature: number
    max_tokens: number
    tools: object[]
  turn_options:            # Optional: Turn config
    temperature: number
```

**Example:**

```yaml
# First message creates thread
action: codex.sendWithThread
inputs:
  message: "Help me build a REST API for a todo app"
  thread_options:
    model: gpt-4-turbo
    temperature: 0.5
output_variable: api_design

# Follow-up in same thread
action: codex.sendWithThread
inputs:
  message: "Now generate the Express.js routes"
output_variable: api_routes
```

#### `codex.startThread`

Create a new thread.

```yaml
action: codex.startThread
inputs:
  model: string            # Optional: Model
  temperature: number      # Optional: Temperature
  system: string           # Optional: System prompt
output_variable: thread_id
```

#### `codex.resumeThread`

Resume existing thread.

```yaml
action: codex.resumeThread
inputs:
  thread_id: string        # Required: Thread ID
```

#### `codex.resumeAndSend`

Resume thread and send message.

```yaml
action: codex.resumeAndSend
inputs:
  thread_id: string        # Required: Thread ID
  message: string          # Required: Message
```

### Structured Output

#### `codex.sendStructured`

Get JSON response with schema validation.

```yaml
action: codex.sendStructured
inputs:
  message: string          # Required: User message
  schema: object           # Required: JSON schema
  model: string            # Optional: Model
```

**Example:**

```yaml
action: codex.sendStructured
inputs:
  message: "Analyze this code and identify bugs, performance issues, and style problems"
  schema:
    type: "object"
    properties:
      bugs:
        type: "array"
        items:
          type: "object"
          properties:
            line: { type: "number" }
            severity: { type: "string" }
            description: { type: "string" }
      performance_issues:
        type: "array"
        items:
          type: "object"
          properties:
            line: { type: "number" }
            impact: { type: "string" }
            suggestion: { type: "string" }
      style_issues:
        type: "array"
        items:
          type: "object"
          properties:
            line: { type: "number" }
            rule: { type: "string" }
    required: ["bugs", "performance_issues", "style_issues"]
output_variable: code_analysis
```

### Specialized Actions

#### `codex.modifyCode`

Code modification with file changes.

```yaml
action: codex.modifyCode
inputs:
  message: string          # Required: Modification request
  files: string[]          # Required: Files to modify
  auto_apply: boolean      # Optional: Auto-apply changes
```

#### `codex.executeCommands`

Execute shell commands.

```yaml
action: codex.executeCommands
inputs:
  message: string          # Required: Command request
  cwd: string              # Optional: Working directory
```

#### `codex.webSearch`

Web research capability.

```yaml
action: codex.webSearch
inputs:
  message: string          # Required: Search query
  max_results: number      # Optional: Max results
```

#### `codex.analyzeCode`

Read-only code analysis.

```yaml
action: codex.analyzeCode
inputs:
  message: string          # Required: Analysis request
  files: string[]          # Optional: Files to analyze
```

---

## OpenCode

OpenCode AI SDK for code generation.

### Configuration

```yaml
tools:
  opencode:
    sdk: '@opencode-ai/sdk'
    options:
      mode: string         # Optional: "cli", "server", or "auto" (default: "auto")
      server_url: string   # Optional: Server URL (default: http://localhost:4096)
      cli_path: string     # Optional: CLI path (default: "opencode")
      model: string        # Optional: Model name
      exclude_files: string[] # Optional: Files to exclude
```

**Example:**

```yaml
tools:
  opencode:
    sdk: '@opencode-ai/sdk'
    options:
      mode: auto
      model: gpt-4
      exclude_files:
        - "node_modules/**"
        - "dist/**"
```

### Actions

#### `opencode.generate`

Generate code from prompt.

```yaml
action: opencode.generate
inputs:
  prompt: string           # Required: User prompt
  context_files: string[]  # Optional: Context files
  temperature: number      # Optional: Temperature
```

**Example:**

```yaml
action: opencode.generate
inputs:
  prompt: "Create a React component for a user profile card with avatar, name, and bio"
  context_files:
    - "src/components/Card.tsx"
    - "src/styles/theme.ts"
output_variable: component_code
```

---

## Claude Code

Claude CLI wrapper for command-line usage.

### Configuration

```yaml
tools:
  claude_cli:
    sdk: claude-code
    options:
      cli_path: string     # Optional: Path to Claude CLI (default: "claude")
      model: string        # Optional: Model name
      cwd: string          # Optional: Working directory
      timeout: number      # Optional: Timeout in ms (default: 300000)
```

**Example:**

```yaml
tools:
  claude_cli:
    sdk: claude-code
    options:
      cli_path: /usr/local/bin/claude
      model: claude-sonnet-4-5
      cwd: /path/to/project
```

### Actions

#### `claude_cli.generate`

Execute Claude CLI command.

```yaml
action: claude_cli.generate
inputs:
  prompt: string           # Required: User prompt
  files: string[]          # Optional: Files to include
```

**Example:**

```yaml
action: claude_cli.generate
inputs:
  prompt: "Refactor this module to use async/await instead of callbacks"
  files:
    - "src/api/client.js"
output_variable: refactored_code
```

---

## Ollama

Local LLM integration via Ollama.

### Configuration

```yaml
tools:
  ollama:
    sdk: ollama
    options:
      host: string         # Optional: Ollama host (default: http://127.0.0.1:11434)
```

**Example:**

```yaml
tools:
  ollama:
    sdk: ollama
    options:
      host: http://localhost:11434
```

### Actions

All Ollama SDK methods are available. Common actions:

#### `ollama.generate`

Generate text completion.

```yaml
action: ollama.generate
inputs:
  model: string            # Required: Model name (e.g., "llama2", "codellama")
  prompt: string           # Required: User prompt
  system: string           # Optional: System prompt
  temperature: number      # Optional: Temperature
  top_p: number            # Optional: Nucleus sampling
  top_k: number            # Optional: Top-k sampling
```

**Example:**

```yaml
action: ollama.generate
inputs:
  model: codellama
  prompt: "Write a Python function to calculate Fibonacci numbers"
  temperature: 0.7
output_variable: fibonacci_code
```

#### `ollama.chat`

Chat completion.

```yaml
action: ollama.chat
inputs:
  model: string            # Required: Model name
  messages: object[]       # Required: Chat messages
  temperature: number      # Optional: Temperature
```

**Example:**

```yaml
action: ollama.chat
inputs:
  model: llama2
  messages:
    - role: "system"
      content: "You are a helpful coding assistant"
    - role: "user"
      content: "Explain async/await in JavaScript"
output_variable: explanation
```

#### `ollama.list`

List available models.

```yaml
action: ollama.list
inputs: {}
```

#### `ollama.pull`

Download a model.

```yaml
action: ollama.pull
inputs:
  model: string            # Required: Model name
```

#### `ollama.embeddings`

Generate embeddings.

```yaml
action: ollama.embeddings
inputs:
  model: string            # Required: Model name
  prompt: string           # Required: Text to embed
```

---

## AI-Powered Browser Automation

Combine Playwright with AI agents for intelligent browser automation.

### Configuration

```yaml
tools:
  ai_browser:
    sdk: ai-browser
    options:
      backend: string      # Required: "copilot" or "claude-code"
      ai_client: object    # Optional: Pre-initialized AI client
      playwright_client: object # Optional: Pre-initialized Playwright client
      debug: boolean       # Optional: Enable debug logging
```

**Example:**

```yaml
tools:
  # Setup AI agent
  copilot:
    sdk: '@github/copilot-sdk'
    options:
      model: gpt-4.1

  # Setup Playwright
  browser:
    sdk: playwright
    options:
      headless: false

  # Setup AI browser
  ai_browser:
    sdk: ai-browser
    options:
      backend: copilot
      debug: true
```

### Actions

#### `ai_browser.act`

Perform natural language browser action.

```yaml
action: ai_browser.act
inputs:
  action: string           # Required: Natural language action
  url: string              # Optional: URL to navigate to first
  selector: string         # Optional: Target element selector
```

**Example:**

```yaml
action: ai_browser.act
inputs:
  url: "https://github.com"
  action: "Search for 'marktoflow' in the search bar and click on the first repository result"
```

#### `ai_browser.observe`

Get description of interactive elements.

```yaml
action: ai_browser.observe
inputs:
  instruction: string      # Optional: What to observe
```

**Example:**

```yaml
action: ai_browser.observe
inputs:
  instruction: "Identify all buttons and forms on this page"
output_variable: page_elements
```

#### `ai_browser.aiExtract`

AI-powered data extraction.

```yaml
action: ai_browser.aiExtract
inputs:
  instruction: string      # Required: What to extract
  schema: object           # Optional: JSON schema for validation
  model_name: string       # Optional: Model to use
```

**Example:**

```yaml
action: ai_browser.aiExtract
inputs:
  instruction: "Extract all product information including names, prices, descriptions, and image URLs"
  schema:
    type: "array"
    items:
      type: "object"
      properties:
        name: { type: "string" }
        price: { type: "number" }
        description: { type: "string" }
        image_url: { type: "string" }
      required: ["name", "price"]
output_variable: products
```

---

## Complete Workflow Examples

### Example 1: Code Review with Claude

```yaml
---
workflow:
  id: ai-code-review
  name: AI Code Review

tools:
  claude:
    sdk: '@anthropic-ai/claude-agent-sdk'
    auth:
      api_key: ${ANTHROPIC_API_KEY}
    options:
      model: claude-sonnet-4-5
      permission_mode: acceptAll

  github:
    sdk: '@octokit/rest'
    auth:
      token: ${GITHUB_TOKEN}

inputs:
  pr_number:
    type: number
    required: true
---

# AI Code Review Workflow

## Step 1: Get PR Files

```yaml
action: github.pulls.listFiles
inputs:
  owner: company
  repo: project
  pull_number: "{{inputs.pr_number}}"
output_variable: pr_files
```

## Step 2: Run Code Review

```yaml
action: claude.codeReview
inputs:
  prompt: "Review these changes for security, performance, and best practices"
  files: "{{pr_files}}"
  reviewers: ["security", "performance", "architecture"]
output_variable: review
```

## Step 3: Post Review Comment

```yaml
action: github.pulls.createReview
inputs:
  owner: company
  repo: project
  pull_number: "{{inputs.pr_number}}"
  body: "{{review.summary}}"
  event: COMMENT
```

### Example 2: AI-Powered Web Scraping

```yaml
---
workflow:
  id: ai-web-scraping
  name: AI Web Scraping

tools:
  copilot:
    sdk: '@github/copilot-sdk'

  browser:
    sdk: playwright

  ai_browser:
    sdk: ai-browser
    options:
      backend: copilot

  sheets:
    sdk: googleapis
    auth:
      # Google OAuth credentials
---

# AI Web Scraping

## Step 1: Navigate and Extract

```yaml
action: ai_browser.aiExtract
inputs:
  url: "{{inputs.target_url}}"
  instruction: "Extract all product listings with name, price, rating, and availability"
  schema:
    type: "array"
    items:
      type: "object"
      properties:
        name: { type: "string" }
        price: { type: "number" }
        rating: { type: "number" }
        in_stock: { type: "boolean" }
output_variable: products
```

## Step 2: Save to Google Sheets

```yaml
action: sheets.appendValues
inputs:
  spreadsheet_id: "{{inputs.sheet_id}}"
  range: "Products!A:D"
  values: "{{products}}"
```

---

## Best Practices

### 1. Choose the Right AI Agent

- **GitHub Copilot**: Best for code generation and completion
- **Claude Agent**: Best for complex agentic tasks with tool use
- **OpenAI Codex**: Best for structured code generation
- **Ollama**: Best for local/offline AI

### 2. Manage Costs

```yaml
options:
  max_budget_usd: 5.00      # Set budget limits
  max_turns: 50             # Limit conversation turns
```

### 3. Provide Context

```yaml
options:
  cwd: /path/to/project
  additional_directories:
    - /path/to/docs
  exclude_files:
    - "node_modules/**"
```

### 4. Use Sessions for Multi-Turn

```yaml
# Create session for related queries
action: copilot.createSession
output_variable: session_id

# Reuse session
action: copilot.resumeAndSend
inputs:
  session_id: "{{session_id}}"
  message: "Follow-up question..."
```

### 5. Restrict Tools for Safety

```yaml
action: claude.runWithTools
inputs:
  prompt: "Analyze the code"
  tools: ["Read", "Grep"]  # No write or bash access
```

---

## Next Steps

- [Service Integrations](./services.md) - Integrate with external services
- [Control Flow Guide](./control-flow.md) - Control flow structures
- [Examples](../../examples/) - Real-world workflow examples
