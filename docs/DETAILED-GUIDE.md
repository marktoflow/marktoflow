# marktoflow - Detailed Guide

This guide provides comprehensive documentation for marktoflow's features, integrations, and advanced usage.

## Table of Contents

- [What's New in v2.0](#whats-new-in-v20)
- [Architecture](#architecture-v20)
- [Workflow Examples](#workflow-examples)
- [CLI Commands](#cli-commands)
- [Visual Workflow Designer](#visual-workflow-designer)
- [Advanced Features](#advanced-features)
- [Development](#development)

---

## What's New in v2.0

marktoflow v2.0 brings powerful new capabilities and integrations:

- ✅ **Nunjucks Template System** - Industry-standard Jinja2-compatible templating
  - `{{ repo | split('/') | first }}` - Clean pipeline syntax
  - `{{ error | match('/timeout/') }}` - Regex pattern matching
  - Built-in operations: core.set, core.transform, core.extract, core.format
  - Full control structures: `{% for %}`, `{% if %}`, `{% elif %}`
- ✅ **Workflow Control Flow** - If/else conditionals, switch/case, loops, parallel execution, try/catch error handling
- ✅ **Visual Workflow Designer** - Web-based drag-and-drop editor with AI assistance
- ✅ **Native SDK integrations** - Direct SDK method calls with full type safety
- ✅ **Native MCP support** - Import MCP servers as npm packages
- ✅ **Sub-workflow composition** - Build reusable workflow components
- ✅ **Command line tool execution** - Run bash, Python, Node.js scripts directly
- ✅ **30+ built-in integrations** - Slack, GitHub, Jira, Gmail, Outlook, Google Suite, Telegram, WhatsApp, databases, and more
- ✅ **Full TypeScript** - Type-safe workflows and integrations
- ✅ **Enterprise features** - RBAC, approvals, audit logging, cost tracking

---

## Architecture (v2.0)

```
Workflow Layer (Markdown + YAML)
         ▼
Parser (TypeScript Core)
         ▼
Engine (Executor + State + Retry)
         ▼
Integrations / SDK Registry
    ├── Direct SDKs (@slack/web-api, @octokit/rest, etc.)
    ├── Native MCP (In-memory MCP Servers)
    └── Script Tools (Local Executables)
```

---

## Workflow Examples

### Sub-Workflows: Reusable Workflow Composition

Create modular, reusable workflows by calling other workflows as steps:

```yaml
---
workflow:
  id: user-onboarding
  name: 'User Onboarding'

steps:
  # Call validation sub-workflow
  - id: validate_email
    workflow: ./common/validate-input.md
    inputs:
      data: '{{ inputs.email }}'
      min_length: 5
      max_length: 100
    output_variable: validation_result

  # Call notification sub-workflow
  - id: notify_team
    workflow: ./common/send-notification.md
    inputs:
      channel: '#onboarding'
      message: 'New user: {{ inputs.username }}'
      level: 'info'
---
```

**Benefits:**

- ✅ Reusable workflow components
- ✅ Unlimited nesting depth
- ✅ Clean separation of concerns
- ✅ Easy testing and maintenance

See [Sub-Workflows Example](../examples/sub-workflows/) for complete guide.

### Execute Command Line Tools

Run any command line tool directly from workflows:

```yaml
---
workflow:
  id: run-scripts
  name: 'Command Line Execution'

tools:
  script:
    sdk: 'script'

steps:
  # Run shell commands
  - id: run_bash
    action: script.execute
    inputs:
      code: |
        #!/bin/bash
        echo "Hello from bash!"
        ls -la
        git status
    output_variable: bash_result

  # Run Python scripts
  - id: run_python
    action: script.execute
    inputs:
      code: |
        import sys
        print(f"Python {sys.version}")
        result = {"status": "success", "data": [1, 2, 3]}
        print(result)
      interpreter: python3
    output_variable: python_result

  # Run Node.js scripts
  - id: run_node
    action: script.execute
    inputs:
      code: |
        console.log("Hello from Node.js!");
        const data = { message: "Success" };
        console.log(JSON.stringify(data));
      interpreter: node
    output_variable: node_result
---
```

**Supported:**

- ✅ Shell scripts (bash, zsh, sh)
- ✅ Python scripts
- ✅ Node.js scripts
- ✅ Any executable with custom interpreter
- ✅ Capture stdout/stderr/exit code
- ✅ Environment variable support

### Inline JavaScript Execution

Execute JavaScript code directly in workflows with access to workflow context:

```yaml
---
workflow:
  id: inline-script
  name: 'Inline JavaScript Execution'

tools:
  script:
    sdk: 'script'
    options:
      path: 'inline'

steps:
  - id: process_data
    action: script.execute
    inputs:
      code: |
        // Access workflow context variables
        const tasks = context.api_result.tasks || [];
        const summary = context.api_result.summary;

        // Transform data
        const passed = tasks.filter(t => t.status === 'passed').length;
        const failed = tasks.filter(t => t.status === 'failed').length;

        // Return result (becomes output_variable)
        return {
          total: tasks.length,
          passed,
          failed,
          summary: `${passed}/${tasks.length} tasks passed`
        };
    output_variable: stats
---
```

**Features:**

- ✅ Access workflow variables via `context` object
- ✅ Access workflow inputs via `context.inputs`
- ✅ Sandboxed execution (Node.js VM)
- ✅ Async/await support
- ✅ Built-in objects: JSON, Math, Date, Array, Object, String, etc.
- ✅ Configurable timeout (default: 30s)
- ✅ Return values become output_variable

### Connect to Any REST API

```yaml
---
workflow:
  id: api-integration
  name: 'Custom API Integration'

tools:
  my_api:
    sdk: 'http'
    options:
      base_url: 'https://api.example.com'
    auth:
      type: 'bearer'
      token: '${API_TOKEN}'

steps:
  - id: fetch_data
    action: my_api.get
    inputs:
      path: '/users'
      query:
        status: 'active'
    output_variable: users

  - id: create_user
    action: my_api.post
    inputs:
      path: '/users'
      body:
        name: 'John Doe'
        email: 'john@example.com'
    output_variable: new_user
---
```

See [REST API Guide](REST-API-GUIDE.md) for complete documentation.

---

## CLI Commands

### Project Management

```bash
marktoflow init                    # Initialize project
marktoflow version                 # Show version
marktoflow doctor                  # Check environment
```

### Visual Designer

```bash
marktoflow gui                     # Start visual workflow designer
marktoflow gui --port 3000         # Custom port
marktoflow gui --open              # Open browser automatically
```

### Workflow Operations

```bash
marktoflow new                     # Create workflow from template (interactive)
marktoflow update <workflow.md>    # Update workflow with AI coding agents
marktoflow run <workflow.md>       # Run a workflow
marktoflow run --dry-run           # Simulate workflow without executing
marktoflow debug <workflow.md>     # Debug workflow step-by-step
marktoflow workflow list           # List available workflows
```

### Service Connections

```bash
marktoflow connect <service>       # Set up OAuth for services (gmail, outlook)
```

### Webhook Server

```bash
marktoflow serve                   # Start webhook server
marktoflow serve --port 3000       # Custom port
marktoflow serve -w workflow.md    # Serve specific workflow
marktoflow serve --socket          # Use Slack Socket Mode (no public URL needed)
```

### Distributed Execution

```bash
marktoflow worker                  # Start a workflow worker
marktoflow trigger                 # Start trigger service (Scheduler)
```

### Developer Tools

```bash
marktoflow agent list              # List available AI agents
marktoflow tools list              # List registered tools
marktoflow bundle list             # List workflow bundles
```

### AI-Powered Workflow Updates

The `marktoflow update` command uses AI coding agents to automatically update your workflow files based on natural language descriptions:

```bash
# Interactive mode (recommended)
marktoflow update workflow.md

# With prompt
marktoflow update workflow.md --prompt "Add error handling to all steps"

# Specify agent
marktoflow update workflow.md --agent opencode --prompt "Refactor to use async/await"

# List available agents
marktoflow update --list-agents
```

**Supported Coding Agents:**

- **OpenCode** - Best for general-purpose updates and refactoring (75+ AI backends)
- **Claude Code** - Great for complex logic changes (uses existing Claude subscription)
- **OpenAI Codex** - Powerful code generation and refactoring (uses existing Codex access)
- **Cursor** - IDE integration for visual updates
- **Aider** - Specialized for code transformations

**Authentication**: All agents use your existing CLI authentication. No additional API keys or subscriptions required if you already use these tools in your development workflow.

**Features:**

- ✅ Automatic backup creation before updates
- ✅ Interactive preview of current workflow
- ✅ Auto-detects available coding agents on your system
- ✅ Validates and confirms changes before applying
- ✅ Shows diff and next steps after update

**Example workflow:**

1. Run `marktoflow update my-workflow.md`
2. Describe desired changes in natural language
3. Select from available coding agents
4. Review and confirm changes
5. Agent updates the workflow file
6. Review diff and test the updated workflow

---

## Visual Workflow Designer

marktoflow includes a web-based visual workflow editor with AI-powered assistance.

### Starting the GUI

```bash
# Start the visual designer
marktoflow gui

# With options
marktoflow gui --port 3000    # Custom port
marktoflow gui --open         # Open browser automatically
```

### Features

- **Drag-and-Drop Editor** - Visual node-based workflow canvas
- **AI Assistance** - Natural language commands to modify workflows
- **Multiple AI Backends** - Claude Code, GitHub Copilot, Claude API, Ollama (beta)
- **Real-time Execution** - Run and debug workflows from the UI
- **Live File Sync** - Changes sync automatically with workflow files

### AI Providers

The GUI supports multiple AI backends. **Use existing subscriptions without extra API keys**:

| Provider | Authentication | Cost |
|----------|----------------|------|
| GitHub Copilot | `copilot auth` (CLI) | Uses existing subscription |
| OpenAI Codex | Codex CLI authentication | Uses existing Codex access |
| Claude Code | Claude CLI (automatic) | Uses existing subscription |
| OpenCode | CLI configuration | Supports 75+ backends |
| Claude API | `ANTHROPIC_API_KEY` | Direct API usage (pay per use) |
| Ollama (beta) | Local server | Free (runs locally) |

**Recommended**: Use CLI-authenticated providers (Copilot, Codex, Claude Code) to avoid additional API costs if you already subscribe to these services.

### Interface

```
+------------------+------------------------+------------------+
|                  |                        |                  |
|    Sidebar       |        Canvas          |   Properties     |
|   (Workflows     |    (Visual Editor)     |     Panel        |
|    & Tools)      |                        |                  |
+------------------+------------------------+------------------+
|                     AI Prompt Input                          |
+--------------------------------------------------------------+
```

For detailed documentation, see:
- [GUI User Guide](GUI_USER_GUIDE.md)
- [GUI API Reference](GUI_API_REFERENCE.md)
- [GUI Developer Guide](GUI_DEVELOPER_GUIDE.md)

---

## Advanced Features

### Workflow Control Flow

marktoflow v2.0 introduces comprehensive control flow capabilities for building sophisticated automation workflows:

#### If/Else Conditionals

Branch execution based on conditions:

```yaml
steps:
  - type: if
    condition: "{{ result.count > 0 }}"
    then:
      - action: slack.chat.postMessage
        inputs:
          text: "Found {{ result.count }} items"
    else:
      - action: slack.chat.postMessage
        inputs:
          text: "No items found"
```

#### Switch/Case Routing

Multi-branch routing based on expression values:

```yaml
steps:
  - type: switch
    expression: "{{ incident.severity }}"
    cases:
      critical:
        - action: pagerduty.createIncident
      high:
        - action: jira.createIssue
          inputs:
            priority: "High"
      medium:
        - action: jira.createIssue
          inputs:
            priority: "Medium"
    default:
      - action: slack.chat.postMessage
        inputs:
          text: "Low priority: {{ incident.title }}"
```

#### For-Each Loops

Iterate over arrays with full loop metadata:

```yaml
steps:
  - type: for_each
    items: "{{ orders }}"
    item_variable: order
    steps:
      - action: process.order
        inputs:
          order_id: "{{ order.id }}"
          index: "{{ loop.index }}"      # 0-based index
          is_first: "{{ loop.first }}"   # true on first iteration
          is_last: "{{ loop.last }}"     # true on last iteration
```

#### While Loops

Repeat steps until a condition becomes false:

```yaml
steps:
  - type: while
    condition: "{{ retries < 3 }}"
    max_iterations: 10
    steps:
      - action: api.call
      - action: counter.increment
        output_variable: retries
```

#### Parallel Execution

Run multiple branches concurrently with optional rate limiting:

```yaml
steps:
  - type: parallel
    max_concurrent: 3
    on_error: continue
    branches:
      - id: fetch_jira
        steps:
          - action: jira.issueSearch
            output_variable: jira_data
      - id: fetch_github
        steps:
          - action: github.issues.list
            output_variable: github_data
      - id: fetch_slack
        steps:
          - action: slack.conversations.history
            output_variable: slack_data
```

#### Map/Filter/Reduce

Collection transformations for data processing:

```yaml
steps:
  # Transform each item
  - type: map
    items: "{{ orders }}"
    item_variable: order
    expression: "{{ order.total }}"
    output_variable: totals

  # Select matching items
  - type: filter
    items: "{{ orders }}"
    item_variable: order
    condition: "{{ order.total >= 1000 }}"
    output_variable: high_value_orders

  # Aggregate to single value
  - type: reduce
    items: "{{ totals }}"
    item_variable: amount
    accumulator_variable: sum
    initial_value: 0
    expression: "{{ sum + amount }}"
    output_variable: total_revenue
```

#### Try/Catch Error Handling

Graceful error handling with fallback steps:

```yaml
steps:
  - type: try
    try:
      - action: primary_api.call
        output_variable: result
    catch:
      - action: fallback_api.call
        output_variable: result
      - action: slack.chat.postMessage
        inputs:
          text: "Primary API failed: {{ error.message }}"
    finally:
      - action: metrics.record
        inputs:
          api_call: completed
```

**Example Workflows:**

See the [Control Flow Guide](CONTROL-FLOW-GUIDE.md) for detailed examples including map/filter/reduce operations, concurrent execution, switch/case routing, and try/catch patterns.

### Template Expressions (Nunjucks)

marktoflow v2.0 uses **[Nunjucks](https://mozilla.github.io/nunjucks/)** as its template engine - a powerful Jinja2-compatible system with pipeline syntax, regex filters, and 50+ custom helpers:

#### Pipeline Syntax

Chain operations together for clean, readable transformations:

```yaml
steps:
  # Extract owner from GitHub repo
  - action: github.repos.get
    inputs:
      owner: "{{ inputs.repo | split('/') | first() }}"
      repo: "{{ inputs.repo | split('/') | last() }}"

  # Format PR title as slug
  - action: core.set
    inputs:
      slug: "{{ pr.title | slugify() }}"
      upper_name: "{{ user.name | upper() | trim() }}"

  # Chain multiple filters
  - action: slack.chat.postMessage
    inputs:
      text: "{{ users | join(', ') | prefix('Team: ') }}"
```

#### Regex Filters

Pattern matching and extraction using Nunjucks filters:

```yaml
steps:
  # Check if error message matches pattern
  - type: if
    condition: "{{ error_message | match('/timeout/') }}"
    then: [...]

  # Negative pattern match
  - type: if
    condition: "{{ status | notMatch('/^(error|failed)/') }}"
    then: [...]

  # Extract with capture groups
  - action: core.set
    inputs:
      issue_key: "{{ message | match('/([A-Z]+-\\d+)/', 1) }}"  # "ABC-123"

  # Regex replacement
  - action: core.set
    inputs:
      cleaned: "{{ text | regexReplace('/\\d+/', '', 'g') }}"
```

#### Built-in Helpers (60+)

**String Helpers:**
- `split`, `join`, `trim`, `upper`, `lower`
- `slugify`, `prefix`, `suffix`, `replace`
- `truncate`, `substring`, `contains`

**Array Helpers:**
- `first`, `last`, `nth`, `count`, `sum`
- `unique`, `flatten`, `reverse`, `sort`, `slice`

**Object Helpers:**
- `path`, `keys`, `values`, `entries`
- `pick`, `omit`, `merge`

**Logic & Validation:**
- `default`, `or`, `and`, `not`, `ternary`
- `is_array`, `is_object`, `is_string`, `is_number`, `is_empty`, `is_null`

**Date, JSON, Math:**
- `now`, `format_date`, `add_days`, `subtract_days`, `diff_days`
- `parse_json`, `to_json`
- `abs`, `round`, `floor`, `ceil`, `min`, `max`

**Examples:**

```yaml
steps:
  # CSV processing
  - action: core.transform
    inputs:
      input: "{{ csv_data | split(',') | unique() | sort() }}"
      operation: map
      expression: "{{ item | trim() | upper() }}"

  # Safe value access
  - action: slack.chat.postMessage
    inputs:
      text: "{{ user.name | default('Unknown') }}"
      channel: "{{ config.channel | default('#general') }}"

  # Conditional formatting
  - action: github.issues.createComment
    inputs:
      body: "{{ approved | ternary('✅ Approved', '❌ Rejected') }}"

  # Date operations
  - action: jira.issues.create
    inputs:
      due_date: "{{ now() | add_days(7) | format_date('YYYY-MM-DD') }}"
```

#### Built-in Operations

Declarative operations for common tasks without script blocks:

```yaml
steps:
  # Set variables
  - action: core.set
    inputs:
      count: 42
      message: "Hello World"

  # Transform arrays
  - action: core.transform
    inputs:
      input: "{{ issues }}"
      operation: map
      expression: "{{ item.key }}"
    output_variable: issue_keys

  # Extract nested values safely
  - action: core.extract
    inputs:
      input: "{{ api_response }}"
      path: "data.user.email"
      default: "unknown@example.com"
    output_variable: email

  # Format values
  - action: core.format
    inputs:
      value: "{{ timestamp }}"
      type: date
      format: "YYYY-MM-DD HH:mm:ss"
    output_variable: formatted_date
```

**Transform Operations:**
- `map` - Transform each item
- `filter` - Select matching items
- `reduce` - Aggregate to single value
- `find` - Find first matching item
- `group_by` - Group by field
- `unique` - Remove duplicates
- `sort` - Sort by field

**Format Types:**
- `date` - Date formatting with custom patterns
- `number` - Number formatting with decimals
- `currency` - Currency formatting (USD, EUR, GBP, JPY)
- `string` - String templates
- `json` - JSON formatting with indentation

See [TEMPLATE-EXPRESSIONS.md](TEMPLATE-EXPRESSIONS.md) for complete documentation of all Nunjucks filters and features.

### Native MCP Support

Marktoflow v2.0 can load MCP servers directly from NPM packages and communicate with them in-memory, bypassing the need for separate processes or JSON-RPC over stdio.

```yaml
tools:
  filesystem:
    sdk: '@modelcontextprotocol/server-filesystem'
    options:
      allowedDirectories: ['./safe-zone']
```

### Script Tools

Execute local scripts as part of your workflow:

```yaml
tools:
  deploy:
    sdk: 'script'
    options:
      path: './tools/deploy.sh'

steps:
  - action: deploy.run
    inputs:
      env: production
```

### File Watcher Triggers

Trigger workflows on file changes:

```typescript
import { FileWatcher } from '@marktoflow/core';

const watcher = new FileWatcher({ path: './src' });
watcher.onEvent(async (event) => {
  // Trigger workflow execution
});
watcher.start();
```

### Webhook Server

Start a webhook server to receive events and trigger workflows automatically:

```bash
# Start webhook server (scans for workflows with webhook triggers)
marktoflow serve

# With options
marktoflow serve --port 3000           # Custom port
marktoflow serve --host 0.0.0.0        # Custom host
marktoflow serve -d /path/to/workflows # Workflow directory
marktoflow serve -w workflow.md        # Serve specific workflow
marktoflow serve --agent claude-code   # Default agent for workflows
```

**Workflow with Webhook Trigger:**

```yaml
---
workflow:
  id: slack-handler
  name: 'Slack Webhook Handler'

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

triggers:
  - type: webhook
    path: /slack/my-handler
    config:
      provider: slack
      events:
        - message
        - app_mention

inputs:
  channel:
    type: string
    required: true
  question:
    type: string
    required: true

steps:
  - id: respond
    action: slack.chat.postMessage
    inputs:
      channel: '{{ inputs.channel }}'
      text: 'Received: {{ inputs.question }}'
---
```

**Supported Providers:**

| Provider | Auto-extracted Inputs | Verification |
|----------|----------------------|--------------|
| Slack | channel, text, user, thread_ts | URL verification, signature validation |
| Telegram | chat_id, text, message_id, from | Webhook setup |
| GitHub | action, repository, sender | Signature validation |
| Generic | Full payload as `payload` input | - |

### Slack Socket Mode

Use Slack Socket Mode to receive events without a public URL:

```bash
# Set environment variables
export SLACK_APP_TOKEN="xapp-..."  # App-level token with connections:write
export SLACK_BOT_TOKEN="xoxb-..."  # Bot token

# Start Socket Mode server
marktoflow serve --socket

# Or with explicit tokens
marktoflow serve --socket --app-token xapp-... --bot-token xoxb-...
```

**Setup Steps:**

1. Go to your Slack app settings at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable Socket Mode under "Socket Mode" settings
3. Create an App-Level Token with `connections:write` scope under "Basic Information" > "App-Level Tokens"
4. Add event subscriptions (message, app_mention) under "Event Subscriptions"
5. Run `marktoflow serve --socket`

**Benefits:**

- ✅ No public URL or ngrok required
- ✅ Works behind firewalls
- ✅ Simpler development setup
- ✅ Real-time bidirectional communication

---

## Development

This project is a monorepo managed with `pnpm` and `turborepo`.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Project Structure

```
marktoflow/
├── packages/
│   ├── core/                 # Engine, State, Security, Queue, Costs, Metrics
│   ├── cli/                  # Command Line Interface
│   ├── gui/                  # Visual Workflow Designer (Web UI)
│   └── integrations/         # Service Integrations
├── .marktoflow/              # User configuration
├── package.json
└── pnpm-workspace.yaml
```

---

## Example Workflows

See `examples/` directory for production-ready workflow templates:

### AI Agent Workflows

- **[codebase-qa](../examples/codebase-qa/)** - Answer questions about codebases via Slack/Telegram
- **[agent-task-executor](../examples/agent-task-executor/)** - Execute agent tasks from messages with pass/fail reporting
- **[copilot-code-review](../examples/copilot-code-review/)** - AI code review with GitHub Copilot
- **[code-review](../examples/code-review/)** - Automated PR reviews with AI
- **[sprint-planning](../examples/sprint-planning/)** - AI-powered sprint planning

### Automation Workflows

- **[sub-workflows](../examples/sub-workflows/)** - Reusable workflow composition with sub-workflows
- **[daily-standup](../examples/daily-standup/)** - Team update aggregation (scheduled)
- **[incident-response](../examples/incident-response/)** - Incident coordination (webhook-triggered)
- **[dependency-update](../examples/dependency-update/)** - Automated dependency PRs
