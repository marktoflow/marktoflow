# marktoflow YAML API Reference

Complete API reference for marktoflow v2.0 workflow YAML syntax.

---

## Table of Contents

1. [Workflow Structure](#workflow-structure)
2. [Workflow Metadata](#workflow-metadata)
3. [Tool Configuration](#tool-configuration)
4. [Inputs](#inputs)
5. [Outputs](#outputs)
6. [Triggers](#triggers)
7. [Steps](#steps)
8. [Built-in Actions](#built-in-actions)
9. [Control Flow](#control-flow)
10. [Variable Resolution](#variable-resolution)
11. [Error Handling](#error-handling)
12. [Permissions](#permissions)
13. [External Prompts](#external-prompts)
14. [Service Integrations](./yaml-api/services.md)
15. [AI Agent Integrations](./yaml-api/ai-agents.md)

---

## Workflow Structure

A marktoflow workflow is a markdown file with YAML frontmatter:

```yaml
---
workflow:
  id: string              # Required: Unique workflow identifier
  name: string            # Required: Human-readable name
  version: string         # Optional: Version (default: "1.0.0")
  description: string     # Optional: Workflow description
  author: string          # Optional: Author name
  tags: string[]          # Optional: Tags for categorization

tools:
  # Tool configurations (see Tool Configuration section)

inputs:
  # Input parameters (see Inputs section)

triggers:
  # Trigger configurations (see Triggers section)

steps:
  # Optional: Steps can be defined here instead of markdown
---

# Workflow Documentation

Markdown content with step definitions in code blocks...

## Step 1: Example

```yaml
action: slack.chat.postMessage
inputs:
  channel: "#general"
  text: "Hello!"
```
```

---

## Workflow Metadata

### `workflow` (required)

Top-level workflow metadata object.

#### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `id` | `string` | Yes | - | Unique workflow identifier (lowercase, hyphens allowed) |
| `name` | `string` | Yes | - | Human-readable workflow name |
| `version` | `string` | No | `"1.0.0"` | Semantic version |
| `description` | `string` | No | - | Workflow description |
| `author` | `string` | No | - | Author name or email |
| `tags` | `string[]` | No | - | Tags for categorization and search |

#### Example

```yaml
workflow:
  id: daily-standup-slack
  name: Daily Standup Slack Notification
  version: 2.1.0
  description: Automatically sends daily standup reminders to Slack
  author: DevOps Team <devops@company.com>
  tags:
    - slack
    - standup
    - automation
```

---

## Tool Configuration

### `tools` (optional)

Defines external service integrations and AI agents used in the workflow.

#### Structure

```yaml
tools:
  <tool_name>:
    sdk: string                      # Required: npm package or MCP server
    auth:                            # Optional: Authentication credentials
      <key>: string | ${ENV_VAR}
    options:                         # Optional: Tool-specific options
      <key>: any
```

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `sdk` | `string` | Yes | npm package name (e.g., `@slack/web-api`) or MCP server name |
| `auth` | `object` | No | Authentication credentials (tool-specific) |
| `options` | `object` | No | Additional configuration options |

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

## Inputs

### `inputs` (optional)

Defines workflow input parameters with validation.

#### Structure

```yaml
inputs:
  <input_name>:
    type: string | number | boolean | array | object
    required: boolean
    default: any
    description: string
    enum: any[]        # Optional: Allowed values
    pattern: string    # Optional: Regex pattern for strings
    min: number        # Optional: Min value/length
    max: number        # Optional: Max value/length
```

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | Yes | Data type: `string`, `number`, `boolean`, `array`, `object` |
| `required` | `boolean` | No | Whether input is required (default: `false`) |
| `default` | `any` | No | Default value if not provided |
| `description` | `string` | No | Human-readable description |
| `enum` | `any[]` | No | List of allowed values |
| `pattern` | `string` | No | Regex pattern for string validation |
| `min` | `number` | No | Minimum value (numbers) or length (strings/arrays) |
| `max` | `number` | No | Maximum value (numbers) or length (strings/arrays) |

#### Examples

```yaml
inputs:
  channel:
    type: string
    required: true
    description: Slack channel to post message
    pattern: "^#[a-z0-9-]+$"

  message:
    type: string
    required: true
    description: Message text
    min: 1
    max: 4000

  priority:
    type: string
    default: medium
    enum: [low, medium, high, critical]
    description: Message priority level

  send_notification:
    type: boolean
    default: true
    description: Whether to send push notifications

  recipients:
    type: array
    default: []
    description: List of recipient user IDs

  max_retries:
    type: number
    default: 3
    min: 0
    max: 10
    description: Maximum retry attempts
```

#### Accessing Inputs in Steps

Use `{{inputs.<name>}}` template syntax:

```yaml
action: slack.chat.postMessage
inputs:
  channel: "{{inputs.channel}}"
  text: "{{inputs.message}}"
```

---

## Outputs

### `outputs` (optional)

Defines workflow output values that are returned when the workflow completes.

#### Structure

```yaml
outputs:
  <output_name>:
    type: string | number | boolean | array | object
    description: string
```

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | Yes | Data type: `string`, `number`, `boolean`, `array`, `object` |
| `description` | `string` | No | Human-readable description of the output |

#### Example

```yaml
outputs:
  summary:
    type: string
    description: 'Generated summary of the workflow results'
  processed_count:
    type: number
    description: 'Number of items processed'
  results:
    type: array
    description: 'Array of processed results'
  metadata:
    type: object
    description: 'Additional metadata about the execution'
```

#### Setting Outputs

Use the `workflow.set_outputs` action to set output values during workflow execution:

```yaml
action: workflow.set_outputs
inputs:
  summary: '{{ generated_summary }}'
  processed_count: '{{ items.length }}'
  results: '{{ processed_items }}'
```

See [Built-in Actions](#built-in-actions) for more details on `workflow.set_outputs`.

---

## Triggers

### `triggers` (optional)

Defines how the workflow is triggered.

#### Structure

```yaml
triggers:
  - type: schedule | webhook | file_watch | manual
    enabled: boolean          # Optional: Enable/disable trigger (default: true)
    config:                   # Optional: Trigger-specific configuration
      <key>: any
```

#### Trigger Types

##### **schedule** - Cron-based scheduling

```yaml
triggers:
  - type: schedule
    config:
      cron: "0 9 * * 1-5"     # Every weekday at 9 AM
      timezone: America/New_York  # Optional: Timezone (default: UTC)
```

**Cron Format:** `minute hour day month day-of-week`

Common patterns:
- `"0 9 * * *"` - Every day at 9 AM
- `"*/15 * * * *"` - Every 15 minutes
- `"0 0 * * 0"` - Every Sunday at midnight
- `"0 9 * * 1-5"` - Weekdays at 9 AM
- `"0 0 1 * *"` - First day of every month

##### **webhook** - HTTP webhook trigger

```yaml
triggers:
  - type: webhook
    config:
      path: /hooks/deploy          # Webhook URL path
      method: POST                 # HTTP method (default: POST)
      secret: ${WEBHOOK_SECRET}    # Optional: Webhook secret for validation
```

##### **file_watch** - File system watcher

```yaml
triggers:
  - type: file_watch
    config:
      path: ./data                 # Directory or file to watch
      pattern: "*.json"            # Optional: File pattern
      events: [create, update]     # Optional: Events to watch (create, update, delete)
```

##### **manual** - Manual execution only

```yaml
triggers:
  - type: manual
```

#### Multiple Triggers

A workflow can have multiple triggers:

```yaml
triggers:
  - type: schedule
    config:
      cron: "0 9 * * 1-5"

  - type: webhook
    config:
      path: /hooks/manual-trigger

  - type: manual
```

---

## Steps

### Step Types

marktoflow supports multiple step types:

1. **Action Step** - Execute a service action
2. **Workflow Step** - Call another workflow
3. **If Step** - Conditional branching
4. **Switch Step** - Multi-way branching
5. **For-Each Step** - Iterate over arrays
6. **While Step** - Conditional loops
7. **Map Step** - Transform arrays
8. **Filter Step** - Filter arrays
9. **Reduce Step** - Aggregate arrays
10. **Parallel Step** - Execute branches in parallel
11. **Try Step** - Exception handling

### Common Step Properties

All steps support these base properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | No | Step identifier (auto-generated if not provided) |
| `name` | `string` | No | Human-readable step name |
| `type` | `string` | No | Step type (auto-detected if not provided) |
| `conditions` | `string[]` | No | Conditions that must be true for step to execute |
| `timeout` | `number` | No | Step timeout in milliseconds (default: 60000) |
| `output_variable` | `string` | No | Variable name to store step output |
| `model` | `string` | No | Override model for this step (e.g., 'haiku', 'gpt-4.1') |
| `agent` | `string` | No | Override agent backend for this step (e.g., 'claude-agent', 'copilot') |
| `permissions` | `object` | No | Permission restrictions for this step (see [Permissions](#permissions)) |

### Action Step

Executes a service action.

#### Syntax

```yaml
type: action                    # Optional: auto-detected
action: <tool>.<method>         # Required: Tool action to execute
inputs:                         # Optional: Action inputs
  <key>: any
output_variable: string         # Optional: Store result
error_handling:                 # Optional: Error handling config
  action: stop | continue | rollback
  max_retries: number
  retry_delay_seconds: number
  fallback_action: <tool>.<method>
model: string                   # Optional: Override AI model for this step
agent: string                   # Optional: Override agent backend for this step
prompt: string                  # Optional: Path to external prompt file (.md)
prompt_inputs:                  # Optional: Variables for the prompt template
  <key>: any
permissions:                    # Optional: Step-level permission restrictions
  <permission_config>
```

#### Example

```yaml
action: slack.chat.postMessage
inputs:
  channel: "#general"
  text: "{{inputs.message}}"
output_variable: slack_response
error_handling:
  action: stop
  max_retries: 3
  retry_delay_seconds: 5
```

#### Example with Per-Step Model Override

```yaml
# Use fast model for quick summary
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
  agent: claude-agent             # Override backend
  inputs:
    messages:
      - role: user
        content: "Detailed analysis: {{ inputs.code }}"
```

#### Example with External Prompt

```yaml
action: agent.chat.completions
prompt: ./prompts/code-review.md
prompt_inputs:
  code: '{{ inputs.code }}'
  language: typescript
output_variable: review
```

### Workflow Step

Calls another workflow as a sub-workflow.

#### Syntax

```yaml
type: workflow                  # Optional: auto-detected
workflow: string                # Required: Path to workflow file
inputs:                         # Optional: Workflow inputs
  <key>: any
output_variable: string         # Optional: Store result
use_subagent: boolean           # Optional: Execute via AI sub-agent (default: false)
subagent_config:                # Optional: Sub-agent configuration
  model: string                 # Model to use
  max_turns: number             # Maximum agentic turns (default: 10)
  system_prompt: string         # System prompt for the agent
  tools: string[]               # Available tools for the agent
```

#### Example

```yaml
workflow: ./workflows/send-notification.md
inputs:
  service: slack
  channel: "{{inputs.channel}}"
  message: "{{inputs.message}}"
output_variable: notification_result
```

#### Example with Sub-Agent Execution

Execute a subworkflow via an AI agent that interprets and runs the workflow autonomously:

```yaml
- id: security-audit
  workflow: ./workflows/security-audit.md
  use_subagent: true
  subagent_config:
    model: opus
    max_turns: 20
    tools: [Read, Grep, Glob]
  inputs:
    target: '{{ inputs.code_path }}'
  output_variable: audit_results
```

---

## Built-in Actions

marktoflow provides several built-in actions that don't require external tool configuration. These are available in all workflows without needing to declare them in the `tools` section.

### Workflow Control Actions

These actions control workflow execution and outputs.

#### `workflow.set_outputs`

Sets workflow output values explicitly. Use this to define the final outputs of your workflow instead of returning all intermediate variables.

```yaml
action: workflow.set_outputs
inputs:
  output_name: '{{ value }}'
  another_output: '{{ other_value }}'
```

**Example:**

```yaml
## Step 1: Process data
action: core.process
inputs:
  data: '{{ inputs.data }}'
output_variable: processed

## Step 2: Set workflow outputs
action: workflow.set_outputs
inputs:
  result: '{{ processed }}'
  count: '{{ processed.items.length }}'
  timestamp: '{{ now() }}'
  status: 'success'
```

**Result:**
```json
{
  "workflowId": "process-data",
  "status": "completed",
  "output": {
    "result": { /* processed data */ },
    "count": 42,
    "timestamp": "2024-01-01T12:00:00Z",
    "status": "success"
  }
}
```

**Implementation Details:**
- If `workflow.set_outputs` is never called, all workflow variables are returned as outputs (default behavior)
- If called multiple times, the **last call wins**
- Recommended for production workflows to provide clean, controlled outputs

#### `workflow.log`

Logs a message during workflow execution with optional severity levels and metadata.

```yaml
action: workflow.log
inputs:
  message: string    # Message to log (supports templates)
  level: string      # Optional: 'info' | 'warning' | 'error' | 'critical' (default: 'info')
  metadata: object   # Optional: Additional metadata to include
```

**Levels:**
- `info` - Informational messages (default)
- `warning` - Warning messages
- `error` - Error messages
- `critical` - Critical error messages

**Example:**

```yaml
action: workflow.log
inputs:
  message: 'Processing item {{ item.id }}'
  level: 'info'
  metadata:
    item_id: '{{ item.id }}'
    step: 'validation'
```

#### `workflow.sleep`

Pauses workflow execution for a specified duration. Useful for rate limiting or waiting between API calls.

```yaml
action: workflow.sleep
inputs:
  duration: number   # Duration in milliseconds
```

**Example - Rate Limiting:**

```yaml
## Step 1: Call API
action: http.get
inputs:
  url: 'https://api.example.com/data'
output_variable: api_result

## Step 2: Wait before next call
action: workflow.sleep
inputs:
  duration: 1000  # 1 second delay

## Step 3: Call API again
action: http.get
inputs:
  url: 'https://api.example.com/more-data'
output_variable: more_data
```

#### `workflow.fail`

Fails the workflow execution with a custom error message and optional error code.

```yaml
action: workflow.fail
inputs:
  message: string    # Error message
  code: string       # Optional: Error code
```

**Example - Conditional Failure:**

```yaml
## Step 1: Validate
action: script.execute
inputs:
  code: |
    return { valid: input.email.includes('@') }
output_variable: validation

## Step 2: Fail if invalid
action: workflow.fail
inputs:
  message: 'Invalid email: {{ inputs.email }}'
  code: 'INVALID_EMAIL'
conditions:
  - '{{ not validation.valid }}'
```

#### `workflow.timestamp`

Generates a timestamp in various formats.

```yaml
action: workflow.timestamp
inputs:
  format: string     # Optional: 'iso' | 'unix' | 'ms' (default: 'iso')
output_variable: timestamp
```

**Formats:**
- `iso` - ISO 8601 format (default): `2024-01-01T12:00:00.000Z`
- `unix` - Unix timestamp in seconds: `1704110400`
- `ms` - Milliseconds since epoch: `1704110400000`

**Example:**

```yaml
## Generate timestamp
action: workflow.timestamp
inputs:
  format: 'iso'
output_variable: created_at

## Use in output
action: workflow.set_outputs
inputs:
  created_at: '{{ created_at.timestamp }}'
  data: '{{ processed_data }}'
```

#### `workflow.noop`

No-operation action that does nothing. Useful for testing or as a placeholder during workflow development.

```yaml
action: workflow.noop
```

### Utility Actions

Common utility actions for logging, scripting, delays, and HTTP requests.

#### `console.log`

Logs a message to the console output. Useful for debugging and progress reporting.

```yaml
action: console.log
inputs:
  message: string    # Message to log (supports templates)
  level: string      # Optional: 'info' | 'warn' | 'error' | 'debug' (default: 'info')
```

**Example:**

```yaml
action: console.log
inputs:
  message: 'Processing item {{ index + 1 }} of {{ total }}: {{ item.name }}'
  level: info
```

#### `script` / `script.execute`

Executes inline code or an external script file. Useful for data transformations and custom logic.

```yaml
action: script
inputs:
  code: string       # Inline JavaScript/Python code
  # OR
  script: string     # Path to script file
  args: object       # Optional: Arguments to pass to the script
output_variable: script_result
```

**Inline Code Example:**

```yaml
action: script
inputs:
  code: |
    const items = inputs.items;
    const filtered = items.filter(i => i.status === 'active');
    return { count: filtered.length, items: filtered };
output_variable: filtered_data
```

**External Script Example:**

```yaml
action: script.execute
inputs:
  script: ./scripts/process_data.py
  args:
    input_file: '{{ inputs.file_path }}'
    output_format: json
output_variable: processed_data
```

#### `sleep`

Pauses workflow execution for a specified duration. Alias for `workflow.sleep`.

```yaml
action: sleep
inputs:
  duration: number   # Duration in milliseconds
  # OR
  seconds: number    # Duration in seconds
```

**Example:**

```yaml
action: sleep
inputs:
  seconds: 5
```

#### `http.request`

Makes HTTP requests to external APIs. Part of the HTTP tool but commonly used standalone.

```yaml
action: http.request
inputs:
  url: string        # Request URL
  method: string     # HTTP method: GET, POST, PUT, DELETE, PATCH
  headers: object    # Optional: Request headers
  body: any          # Optional: Request body (for POST, PUT, PATCH)
  timeout: number    # Optional: Timeout in milliseconds
output_variable: response
```

**Example:**

```yaml
action: http.request
inputs:
  url: 'https://api.example.com/data'
  method: POST
  headers:
    Content-Type: application/json
    Authorization: 'Bearer {{ api_token }}'
  body:
    name: '{{ inputs.name }}'
    value: '{{ calculated_value }}'
output_variable: api_response
```

### Core Tools

Core tools are built-in actions available in all workflows without needing to be declared in the `tools` section. They provide essential functionality for logging, file operations, and more.

#### `core.log`

Logs a message during workflow execution with optional severity level and metadata.

```yaml
action: core.log
inputs:
  message: string    # Message to log (supports templates)
  level: string      # Optional: 'info' | 'warning' | 'error' | 'critical' (default: 'info')
  metadata: object   # Optional: Additional metadata to include in log
```

**Levels:**
- `info` - Informational messages (default)
- `warning` - Warning messages
- `error` - Error messages
- `critical` - Critical error messages

**Example:**

```yaml
action: core.log
inputs:
  level: 'info'
  message: |
    ========================================
    WORKFLOW COMPLETE
    ========================================

    Processed: {{ results.count }} items
    Status: {{ results.status }}
```

**Example with Metadata:**

```yaml
action: core.log
inputs:
  message: 'Processing item {{ item.id }}'
  level: 'info'
  metadata:
    item_id: '{{ item.id }}'
    step: 'validation'
    timestamp: '{{ now() }}'
```

#### `core.writeFile`

Writes content to a file on the local filesystem. Creates parent directories if they don't exist.

```yaml
action: core.writeFile
inputs:
  path: string       # File path to write (relative or absolute)
  content: string    # Content to write to the file
  encoding: string   # Optional: File encoding (default: 'utf-8')
output_variable: file_result
```

**Output:**
```json
{
  "written": true,
  "path": "/path/to/file.html",
  "size": 1234
}
```

**Example - Write HTML Report:**

```yaml
action: core.writeFile
inputs:
  path: './reports/summary.html'
  content: '{{ html_report }}'
output_variable: file_result
```

**Example - Write JSON Data:**

```yaml
action: core.writeFile
inputs:
  path: './output/results.json'
  content: '{{ JSON.stringify(results, null, 2) }}'
output_variable: json_file
```

**Example - Conditional File Output:**

```yaml
type: if
condition: '{{ inputs.save_to_file == true }}'
then:
  - action: core.writeFile
    inputs:
      path: '{{ inputs.output_path }}'
      content: '{{ generated_content }}'
```

### Best Practices

#### 1. Always Set Outputs Explicitly

```yaml
# Good - clear outputs
action: workflow.set_outputs
inputs:
  user_id: '{{ created_user.id }}'
  email: '{{ created_user.email }}'
  status: 'created'

# Avoid - returns all variables including intermediate values
# (no workflow.set_outputs call)
```

#### 2. Use Meaningful Output Names

```yaml
# Good
action: workflow.set_outputs
inputs:
  order_id: '{{ order.id }}'
  total_amount: '{{ order.total }}'
  confirmation_sent: true

# Avoid
action: workflow.set_outputs
inputs:
  x: '{{ order.id }}'
  y: '{{ order.total }}'
  z: true
```

#### 3. Include Status Information

```yaml
action: workflow.set_outputs
inputs:
  status: 'success'
  data: '{{ processed_data }}'
  timestamp: '{{ now() }}'
  error: null  # Makes it clear there was no error
```

#### 4. Log Important Steps

```yaml
## Before critical operation
action: workflow.log
inputs:
  message: 'Starting payment processing for {{ order.id }}'
  level: 'info'

## After critical operation
action: workflow.log
inputs:
  message: 'Payment processed successfully'
  level: 'info'
  metadata:
    order_id: '{{ order.id }}'
    amount: '{{ payment.amount }}'
```

---

## Control Flow

See the [Control Flow Guide](./yaml-api/control-flow.md) for detailed documentation on:

- **If/Else** - Conditional branching
- **Switch/Case** - Multi-way branching
- **For-Each** - Array iteration
- **While** - Conditional loops
- **Map** - Array transformations
- **Filter** - Array filtering
- **Reduce** - Array aggregation
- **Parallel** - Concurrent execution
- **Try/Catch/Finally** - Exception handling

---

## Variable Resolution

### Template Syntax

marktoflow uses a Jinja2-inspired template syntax for variable interpolation.

#### Simple Interpolation

Use `{{ variable }}` for simple variable references:

```yaml
text: '{{ inputs.message }}'
channel: '{{ slack_response.channel }}'
count: '{{ results.length }}'
```

#### Expressions

Template expressions support basic operations:

```yaml
# Arithmetic
total: '{{ count + 1 }}'
average: '{{ sum / count }}'

# String concatenation
full_name: '{{ first_name }} {{ last_name }}'

# Ternary/conditional
status: '{{ success ? "completed" : "failed" }}'

# Array access
first: '{{ items[0] }}'
last: '{{ items[items.length - 1] }}'
```

#### Jinja2 Filters and Control Structures

In multi-line strings (using `|`), you can use Jinja2-style filters and control structures:

```yaml
action: slack.chat.postMessage
inputs:
  text: |
    **Daily Report**

    {% for item in items %}
    - {{ item.name }}: {{ item.status }}
    {% endfor %}

    {% if errors.length > 0 %}
    **Errors:** {{ errors | length }}
    {% endif %}

    Total: {{ items | length }} items
```

**Available Filters:**
- `length` - Get array/string length
- `join(separator)` - Join array elements
- `upper` / `lower` - Case conversion
- `default(value)` - Default value if undefined
- `first` / `last` - First/last array element
- `sort` / `reverse` - Array ordering

**Control Structures:**
- `{% for item in array %}...{% endfor %}` - Iteration
- `{% if condition %}...{% elif %}...{% else %}...{% endif %}` - Conditionals
- `{% set var = value %}` - Variable assignment

#### Input Variables

Access workflow inputs with `inputs.` prefix:

```yaml
text: "{{inputs.message}}"
channel: "{{inputs.channel}}"
```

#### Step Output Variables

Reference step outputs by their `output_variable` name:

```yaml
# Step 1: Get user info
action: slack.users.info
inputs:
  user: "{{inputs.user_id}}"
output_variable: user_info

# Step 2: Use output from Step 1
action: slack.chat.postMessage
inputs:
  channel: "{{inputs.channel}}"
  text: "Hello {{user_info.user.real_name}}!"
```

#### Nested Property Access

Access nested properties with dot notation:

```yaml
text: "{{user_info.user.profile.email}}"
```

#### Array Access

Access array elements by index:

```yaml
first_item: "{{results[0]}}"
```

#### Loop Variables

Special variables available in loops:

```yaml
# In for_each loops:
item: "{{item}}"              # Current item
index: "{{index}}"            # Current index (if index_variable set)
loop.index: "{{loop.index}}"  # Current iteration index
loop.first: "{{loop.first}}"  # true if first iteration
loop.last: "{{loop.last}}"    # true if last iteration
loop.length: "{{loop.length}}"# Total iterations
```

#### Step Metadata

Access step execution metadata:

```yaml
# Check step status
condition: step_id.status == 'completed'

# Access retry count
retry_count: "{{step_id.retryCount}}"

# Access error message
error_msg: "{{step_id.error}}"
```

### Environment Variables

Reference environment variables in `tools.auth` and `inputs.default`:

```yaml
auth:
  token: ${SLACK_BOT_TOKEN}

inputs:
  api_url:
    type: string
    default: ${API_URL}
```

**Note:** Environment variables use `${VAR}` syntax (dollar sign), while template variables use `{{var}}` (double braces).

---

## Error Handling

### Step-Level Error Handling

Configure error handling per step:

```yaml
action: slack.chat.postMessage
inputs:
  channel: "#general"
  text: "Hello!"
error_handling:
  action: stop | continue | rollback
  max_retries: 3
  retry_delay_seconds: 5
  fallback_action: discord.sendMessage
```

#### Error Actions

| Action | Description |
|--------|-------------|
| `stop` | Stop workflow execution (default) |
| `continue` | Continue to next step |
| `rollback` | Execute registered rollback handlers and stop |

#### Retry Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `max_retries` | `number` | `3` | Maximum retry attempts |
| `retry_delay_seconds` | `number` | `1` | Initial delay between retries (exponential backoff) |
| `fallback_action` | `string` | - | Alternative action to try if primary fails |

### Try/Catch Block

Use try/catch steps for explicit error handling:

```yaml
type: try
try:
  - action: api.getData
    inputs:
      endpoint: /users
    output_variable: users

catch:
  - action: slack.chat.postMessage
    inputs:
      channel: "#alerts"
      text: "Failed to fetch users: {{error.message}}"

finally:
  - action: logger.info
    inputs:
      message: "Attempt completed"
```

#### Error Variable

In `catch` blocks, access the `error` variable:

```yaml
error.message: "{{error.message}}"   # Error message
error.step: "{{error.step}}"         # Failed step info
```

### Circuit Breaker

Automatic circuit breaker protection prevents cascading failures:

- **Failure Threshold:** 5 consecutive failures open the circuit
- **Recovery Timeout:** 30 seconds before attempting recovery
- **Half-Open Max Calls:** 3 test calls during recovery

Circuit breaker is enabled automatically per service.

### Failover

Automatic failover to alternative services:

```yaml
# In engine configuration (not workflow YAML)
failover_config:
  failover_on_timeout: true
  failover_on_step_failure: true
  fallback_agents:
    - copilot
    - claude-code
    - opencode
  max_failover_attempts: 2
```

---

## Permissions

Permission restrictions allow you to control what operations a workflow or individual steps can perform. Permissions can be set at both the workflow level (applied to all steps) and the step level (overrides workflow-level settings).

### Structure

```yaml
permissions:
  # File operations
  read: boolean | string[]        # Allow reading files (true, false, or glob patterns)
  write: boolean | string[]       # Allow writing files (true, false, or glob patterns)

  # Command execution
  execute: boolean | string[]     # Allow command execution
  allowed_commands: string[]      # Whitelist of allowed commands
  blocked_commands: string[]      # Blacklist of blocked commands

  # Directory restrictions
  allowed_directories: string[]   # Directories where operations are allowed
  blocked_paths: string[]         # Paths that are always blocked

  # Network
  network: boolean                # Allow network access
  allowed_hosts: string[]         # Whitelist of allowed hosts

  # Limits
  max_file_size: number           # Maximum file size in bytes
```

### Workflow-Level Permissions

Apply permissions to all steps in the workflow:

```yaml
workflow:
  id: secure-workflow
  name: "Secure Workflow"

permissions:
  read: true
  write: ['./output/**', './tmp/**']
  blocked_commands: ['rm -rf', 'sudo', 'chmod']
  network: false

steps:
  - id: process
    action: script.execute
    inputs:
      script: ./scripts/process.js
```

### Step-Level Permissions

Override or restrict permissions for specific steps:

```yaml
steps:
  - id: analyze
    action: agent.chat.completions
    permissions:
      write: false              # Step cannot write any files
    inputs:
      messages:
        - role: user
          content: "Analyze: {{ inputs.code }}"

  - id: save
    action: script.execute
    permissions:
      write: ['./output/*.json']  # Only allow writing JSON to output dir
    inputs:
      code: |
        fs.writeFileSync('./output/result.json', JSON.stringify(data));
```

### Permission Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `read` | `boolean \| string[]` | `true` | Allow file reads. If array, specifies allowed glob patterns |
| `write` | `boolean \| string[]` | `true` | Allow file writes. If array, specifies allowed glob patterns |
| `execute` | `boolean \| string[]` | `true` | Allow command execution. If array, specifies allowed commands |
| `allowed_commands` | `string[]` | `[]` | Whitelist of allowed commands (supports wildcards) |
| `blocked_commands` | `string[]` | `[]` | Blacklist of blocked commands (supports wildcards) |
| `allowed_directories` | `string[]` | `[]` | Only allow operations in these directories |
| `blocked_paths` | `string[]` | `[]` | Always block operations on these paths |
| `network` | `boolean` | `true` | Allow network requests |
| `allowed_hosts` | `string[]` | `[]` | Whitelist of allowed hosts (supports `*.example.com` wildcards) |
| `max_file_size` | `number` | - | Maximum file size in bytes |

### Permission Resolution

When both workflow and step permissions are defined, they are merged:

1. **Step permissions override workflow permissions** - If a step defines `write: false`, it overrides `write: true` at workflow level
2. **Lists are merged** - `blocked_commands` from both levels are combined
3. **Most restrictive wins for limits** - The smaller `max_file_size` is used

### Examples

#### Restrict Writes to Specific Directories

```yaml
permissions:
  read: true
  write:
    - './output/**'
    - './tmp/**'
    - './logs/*.log'
  blocked_paths:
    - '.env'
    - '**/secrets/**'
    - '**/*.key'
```

#### Block Dangerous Commands

```yaml
permissions:
  execute: true
  blocked_commands:
    - 'rm -rf'
    - 'sudo *'
    - 'chmod *'
    - 'curl * | bash'
```

#### Network Whitelist

```yaml
permissions:
  network: true
  allowed_hosts:
    - 'api.slack.com'
    - '*.github.com'
    - 'hooks.slack.com'
```

#### Read-Only Step

```yaml
- id: analyze
  action: agent.chat.completions
  permissions:
    write: false
    execute: false
    network: false
  inputs:
    messages:
      - role: user
        content: "Review this code for security issues"
```

---

## External Prompts

External prompts allow you to store prompt templates in separate markdown files with optional YAML frontmatter for variable definitions. This enables prompt reuse, better organization, and cleaner workflows.

### Prompt File Format

Prompt files use markdown with optional YAML frontmatter:

```markdown
---
name: Code Review
description: Review code for quality and security
variables:
  code:
    type: string
    required: true
    description: The code to review
  language:
    type: string
    default: auto
    description: Programming language
  focus:
    type: array
    default: ['security', 'performance', 'maintainability']
---

# Code Review

Review this {{ prompt.language }} code:

```
{{ prompt.code }}
```

Focus on these areas:
{% for area in prompt.focus %}
- {{ area }}
{% endfor %}

Provide specific, actionable feedback.
```

### Frontmatter Variables

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No | Human-readable prompt name |
| `description` | `string` | No | Description of what the prompt does |
| `variables` | `object` | No | Variable definitions (see below) |

#### Variable Definition

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | No | Data type: `string`, `number`, `boolean`, `array`, `object` |
| `required` | `boolean` | No | Whether the variable is required |
| `default` | `any` | No | Default value if not provided |
| `description` | `string` | No | Human-readable description |

### Using External Prompts in Workflows

Reference external prompts using the `prompt` and `prompt_inputs` properties:

```yaml
steps:
  - id: review
    action: agent.chat.completions
    prompt: ./prompts/code-review.md
    prompt_inputs:
      code: '{{ inputs.code }}'
      language: typescript
    output_variable: review
```

### Template Syntax in Prompts

External prompts support two template syntaxes:

#### `{{ prompt.variable }}` - Prompt Variables

Access variables defined in the prompt or passed via `prompt_inputs`:

```markdown
Language: {{ prompt.language }}
Code: {{ prompt.code }}
```

#### `{{ variable }}` - Workflow Context

Access workflow variables and context (resolved during execution):

```markdown
User: {{ inputs.user_name }}
Previous result: {{ previous_step.output }}
```

### Examples

#### Basic Prompt

**prompts/summarize.md:**
```markdown
---
variables:
  content:
    type: string
    required: true
  max_words:
    type: number
    default: 100
---

Summarize the following content in {{ prompt.max_words }} words or less:

{{ prompt.content }}
```

**workflow.md:**
```yaml
- id: summarize
  action: agent.chat.completions
  prompt: ./prompts/summarize.md
  prompt_inputs:
    content: '{{ document.text }}'
    max_words: 50
```

#### Multi-Step Analysis Prompt

**prompts/security-analysis.md:**
```markdown
---
name: Security Analysis
variables:
  code:
    type: string
    required: true
  severity_threshold:
    type: string
    default: medium
    description: Minimum severity to report (low, medium, high, critical)
---

# Security Analysis

Analyze the following code for security vulnerabilities.

## Code to Analyze

```
{{ prompt.code }}
```

## Requirements

1. Identify vulnerabilities with severity >= {{ prompt.severity_threshold }}
2. For each vulnerability found, provide:
   - Severity level
   - Description
   - Location in code
   - Recommended fix
3. Format output as JSON

## Output Format

```json
{
  "vulnerabilities": [
    {
      "severity": "high",
      "type": "SQL Injection",
      "location": "line 42",
      "description": "...",
      "fix": "..."
    }
  ]
}
```
```

**workflow.md:**
```yaml
- id: security-scan
  action: agent.chat.completions
  model: opus
  prompt: ./prompts/security-analysis.md
  prompt_inputs:
    code: '{{ inputs.source_code }}'
    severity_threshold: high
  output_variable: security_results
```

#### Prompt with Workflow Context

**prompts/pr-review.md:**
```markdown
---
variables:
  diff:
    type: string
    required: true
---

# Pull Request Review

## Changes

```diff
{{ prompt.diff }}
```

## Previous Reviews

{% if previous_reviews %}
Consider this feedback from previous reviews:
{% for review in previous_reviews %}
- {{ review.author }}: {{ review.comment }}
{% endfor %}
{% endif %}

Provide a thorough code review.
```

### Validation

Prompts are validated when loaded:

1. **Required variables** - All required variables must be provided in `prompt_inputs`
2. **Type checking** - Values must match declared types
3. **Unused inputs warning** - Warns about `prompt_inputs` not used in the prompt

### Path Resolution

Prompt paths are resolved relative to the workflow file:

```
project/
├── workflows/
│   └── main.md         # workflow: prompt: ../prompts/review.md
└── prompts/
    └── review.md
```

---

## Next Steps

- **[Service Integrations](./yaml-api/services.md)** - Complete reference for all 20+ service integrations
- **[AI Agent Integrations](./yaml-api/ai-agents.md)** - Complete reference for AI agents (Copilot, Claude, etc.)
- **[Control Flow Guide](./yaml-api/control-flow.md)** - Detailed control flow documentation with examples
- **[Examples](../examples/)** - Production-ready workflow examples

---

## Additional Resources

- [Installation Guide](./INSTALLATION.md)
- [REST API Guide](./REST-API-GUIDE.md)
- [Project README](../README.md)
- [Development Progress](../PROGRESS.md)
