# Control Flow Reference

Complete guide to control flow structures in marktoflow workflows.

---

## Table of Contents

1. [If/Else - Conditional Branching](#ifelse---conditional-branching)
2. [Switch/Case - Multi-way Branching](#switchcase---multi-way-branching)
3. [For-Each - Array Iteration](#for-each---array-iteration)
4. [While - Conditional Loops](#while---conditional-loops)
5. [Map - Array Transformation](#map---array-transformation)
6. [Filter - Array Filtering](#filter---array-filtering)
7. [Reduce - Array Aggregation](#reduce---array-aggregation)
8. [Parallel - Concurrent Execution](#parallel---concurrent-execution)
9. [Try/Catch/Finally - Exception Handling](#trycatchfinally---exception-handling)
10. [Sub-Workflows](#sub-workflows)

---

## If/Else - Conditional Branching

Execute different steps based on a condition.

### Syntax

```yaml
type: if
condition: string               # Required: Condition expression
then:                          # Optional: Steps if condition is true
  - <step>
else:                          # Optional: Steps if condition is false
  - <step>
steps:                         # Optional: Alias for 'then'
  - <step>
```

### Condition Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equals | `priority == 'high'` |
| `!=` | Not equals | `status != 'completed'` |
| `>` | Greater than | `count > 10` |
| `<` | Less than | `price < 100` |
| `>=` | Greater or equal | `score >= 50` |
| `<=` | Less or equal | `age <= 18` |

### Examples

#### Simple If/Else

```yaml
type: if
condition: priority == 'high'
then:
  - action: slack.chat.postMessage
    inputs:
      channel: "#urgent"
      text: "High priority alert!"
else:
  - action: slack.chat.postMessage
    inputs:
      channel: "#general"
      text: "Normal message"
```

#### Check Step Status

```yaml
# Step 1: Try to get data
action: api.getData
inputs:
  endpoint: /users
output_variable: api_result

# Step 2: Handle based on success/failure
type: if
condition: api_result.success == true
then:
  - action: slack.chat.postMessage
    inputs:
      channel: "#success"
      text: "Got {{api_result.data.length}} users"
else:
  - action: slack.chat.postMessage
    inputs:
      channel: "#errors"
      text: "API call failed"
```

#### Nested Conditions

```yaml
type: if
condition: user_role == 'admin'
then:
  - type: if
    condition: action_type == 'delete'
    then:
      - action: database.delete
        inputs:
          table: users
          id: "{{user_id}}"
    else:
      - action: database.update
        inputs:
          table: users
          id: "{{user_id}}"
```

---

## Switch/Case - Multi-way Branching

Execute different steps based on expression value matching.

### Syntax

```yaml
type: switch
expression: string | {{variable}}    # Required: Expression to evaluate
cases:                               # Required: Case branches
  <value>:
    - <step>
  <value>:
    - <step>
default:                            # Optional: Default case
  - <step>
```

### Example

```yaml
type: switch
expression: "{{inputs.environment}}"
cases:
  production:
    - action: slack.chat.postMessage
      inputs:
        channel: "#production"
        text: "Deploying to production"
    - action: github.deployments.create
      inputs:
        environment: production

  staging:
    - action: slack.chat.postMessage
      inputs:
        channel: "#staging"
        text: "Deploying to staging"
    - action: github.deployments.create
      inputs:
        environment: staging

  development:
    - action: slack.chat.postMessage
      inputs:
        channel: "#dev"
        text: "Deploying to development"

default:
  - action: slack.chat.postMessage
    inputs:
      channel: "#alerts"
      text: "Unknown environment: {{inputs.environment}}"
```

---

## For-Each - Array Iteration

Iterate over an array and execute steps for each item.

### Syntax

```yaml
type: for_each
items: array | {{variable}}          # Required: Array to iterate
item_variable: string                # Optional: Variable name for current item (default: 'item')
index_variable: string               # Optional: Variable name for current index
steps:                               # Required: Steps to execute per item
  - <step>
error_handling:                      # Optional: Error handling
  action: stop | continue
```

### Loop Variables

| Variable | Description |
|----------|-------------|
| `{{item}}` | Current item (or custom name from `item_variable`) |
| `{{index}}` | Current index (if `index_variable` set) |
| `{{loop.index}}` | Current iteration index |
| `{{loop.first}}` | `true` if first iteration |
| `{{loop.last}}` | `true` if last iteration |
| `{{loop.length}}` | Total iterations |

### Examples

#### Basic Iteration

```yaml
type: for_each
items: ["alice@example.com", "bob@example.com", "carol@example.com"]
item_variable: email
steps:
  - action: gmail.sendEmail
    inputs:
      to: "{{email}}"
      subject: "Team Update"
      body: "Hello from marktoflow!"
```

#### Iterate with Index

```yaml
type: for_each
items: "{{api_result.users}}"
item_variable: user
index_variable: idx
steps:
  - action: slack.chat.postMessage
    inputs:
      channel: "#updates"
      text: "Processing user #{{idx}}: {{user.name}}"
```

#### Error Handling in Loops

```yaml
type: for_each
items: "{{file_list}}"
item_variable: file
steps:
  - action: storage.uploadFile
    inputs:
      path: "{{file.path}}"
      bucket: uploads
error_handling:
  action: continue  # Continue to next item on error
```

#### Nested Loops

```yaml
type: for_each
items: "{{teams}}"
item_variable: team
steps:
  - type: for_each
    items: "{{team.members}}"
    item_variable: member
    steps:
      - action: slack.chat.postMessage
        inputs:
          channel: "{{team.channel}}"
          text: "Hello {{member.name}}!"
```

---

## While - Conditional Loops

Execute steps repeatedly while a condition is true.

### Syntax

```yaml
type: while
condition: string                    # Required: Loop condition
max_iterations: number               # Optional: Safety limit (default: 100)
steps:                               # Required: Steps to execute
  - <step>
error_handling:                      # Optional: Error handling
  action: stop | continue
```

### Example

```yaml
# Poll API until job completes
action: api.getJobStatus
inputs:
  job_id: "{{job_id}}"
output_variable: job_status

type: while
condition: job_status.status != 'completed'
max_iterations: 60
steps:
  - action: sleep
    inputs:
      seconds: 5

  - action: api.getJobStatus
    inputs:
      job_id: "{{job_id}}"
    output_variable: job_status

  - action: slack.chat.postMessage
    inputs:
      channel: "#status"
      text: "Job status: {{job_status.status}}"
```

---

## Map - Array Transformation

Transform an array by applying an expression to each element.

### Syntax

```yaml
type: map
items: array | {{variable}}          # Required: Array to transform
item_variable: string                # Optional: Variable name (default: 'item')
expression: any                      # Required: Expression to evaluate per item
output_variable: string              # Optional: Store result array
```

### Examples

#### Extract Property

```yaml
type: map
items: "{{users}}"
item_variable: user
expression: "{{user.email}}"
output_variable: email_list
```

#### Transform Objects

```yaml
type: map
items: "{{products}}"
item_variable: product
expression:
  name: "{{product.name}}"
  price_usd: "{{product.price}}"
  discounted: "{{product.price * 0.9}}"
output_variable: product_list
```

#### Chain with For-Each

```yaml
# Map: Extract email addresses
type: map
items: "{{team_members}}"
expression: "{{item.email}}"
output_variable: emails

# For-Each: Send emails
type: for_each
items: "{{emails}}"
item_variable: email
steps:
  - action: gmail.sendEmail
    inputs:
      to: "{{email}}"
      subject: "Update"
      body: "Hello!"
```

---

## Filter - Array Filtering

Filter an array based on a condition.

### Syntax

```yaml
type: filter
items: array | {{variable}}          # Required: Array to filter
item_variable: string                # Optional: Variable name (default: 'item')
condition: string                    # Required: Filter condition
output_variable: string              # Optional: Store filtered array
```

### Examples

#### Filter by Property

```yaml
type: filter
items: "{{users}}"
item_variable: user
condition: user.role == 'admin'
output_variable: admin_users
```

#### Filter by Numeric Comparison

```yaml
type: filter
items: "{{orders}}"
item_variable: order
condition: order.total > 1000
output_variable: high_value_orders
```

#### Combine Map and Filter

```yaml
# Filter: Get active users
type: filter
items: "{{all_users}}"
item_variable: user
condition: user.active == true
output_variable: active_users

# Map: Extract emails
type: map
items: "{{active_users}}"
expression: "{{item.email}}"
output_variable: active_emails

# Send notifications
type: for_each
items: "{{active_emails}}"
steps:
  - action: gmail.sendEmail
    inputs:
      to: "{{item}}"
      subject: "Newsletter"
```

---

## Reduce - Array Aggregation

Aggregate an array into a single value.

### Syntax

```yaml
type: reduce
items: array | {{variable}}          # Required: Array to reduce
item_variable: string                # Optional: Variable name (default: 'item')
accumulator_variable: string         # Optional: Accumulator name (default: 'accumulator')
initial_value: any                   # Optional: Initial accumulator value
expression: any                      # Required: Expression to compute accumulator
output_variable: string              # Optional: Store final result
```

### Examples

#### Sum Numbers

```yaml
type: reduce
items: [10, 20, 30, 40, 50]
initial_value: 0
expression: "{{accumulator + item}}"
output_variable: total
# Result: 150
```

#### Count Items

```yaml
type: reduce
items: "{{orders}}"
accumulator_variable: count
initial_value: 0
expression: "{{count + 1}}"
output_variable: order_count
```

#### Build Object

```yaml
type: reduce
items: "{{users}}"
item_variable: user
accumulator_variable: lookup
initial_value: {}
expression:
  "{{user.id}}": "{{user.name}}"
output_variable: user_lookup
# Result: { "1": "Alice", "2": "Bob", ... }
```

#### Aggregate Statistics

```yaml
type: reduce
items: "{{sales}}"
item_variable: sale
accumulator_variable: stats
initial_value:
  total: 0
  count: 0
  max: 0
expression:
  total: "{{stats.total + sale.amount}}"
  count: "{{stats.count + 1}}"
  max: "{{sale.amount > stats.max ? sale.amount : stats.max}}"
output_variable: sales_stats
```

---

## Parallel - Concurrent Execution

Execute multiple branches concurrently.

### Syntax

```yaml
type: parallel
branches:                            # Required: List of branches
  - id: string                       # Optional: Branch identifier
    name: string                     # Optional: Branch name
    steps:                           # Required: Steps for this branch
      - <step>
max_concurrent: number               # Optional: Limit concurrent branches
on_error: stop | continue            # Optional: Error behavior (default: 'stop')
output_variable: string              # Optional: Store branch outputs
```

### Examples

#### Parallel API Calls

```yaml
type: parallel
branches:
  - id: get_users
    steps:
      - action: api.get
        inputs:
          endpoint: /users
        output_variable: users

  - id: get_products
    steps:
      - action: api.get
        inputs:
          endpoint: /products
        output_variable: products

  - id: get_orders
    steps:
      - action: api.get
        inputs:
          endpoint: /orders
        output_variable: orders

# Access branch outputs with branch ID prefix:
# {{get_users.users}}, {{get_products.products}}, {{get_orders.orders}}
```

#### Parallel Notifications

```yaml
type: parallel
branches:
  - id: slack
    steps:
      - action: slack.chat.postMessage
        inputs:
          channel: "#alerts"
          text: "Deployment started"

  - id: email
    steps:
      - action: gmail.sendEmail
        inputs:
          to: "team@company.com"
          subject: "Deployment Started"
          body: "Deployment in progress"

  - id: discord
    steps:
      - action: discord.sendMessage
        inputs:
          channel_id: "123456"
          content: "Deployment started"

on_error: continue  # Continue even if one notification fails
```

#### Limited Concurrency

```yaml
type: parallel
branches:
  - steps:
      - action: heavy_task_1
  - steps:
      - action: heavy_task_2
  - steps:
      - action: heavy_task_3
  - steps:
      - action: heavy_task_4
max_concurrent: 2  # Only run 2 tasks at once
```

---

## Try/Catch/Finally - Exception Handling

Handle errors explicitly with try/catch/finally blocks.

### Syntax

```yaml
type: try
try:                                 # Required: Steps to attempt
  - <step>
catch:                               # Optional: Steps if error occurs
  - <step>
finally:                             # Optional: Steps that always run
  - <step>
```

### Error Variable

In `catch` blocks, access the `error` object:

| Property | Description |
|----------|-------------|
| `{{error.message}}` | Error message |
| `{{error.step}}` | Failed step information |

### Examples

#### Basic Try/Catch

```yaml
type: try
try:
  - action: api.deleteUser
    inputs:
      user_id: "{{inputs.user_id}}"

catch:
  - action: slack.chat.postMessage
    inputs:
      channel: "#errors"
      text: "Failed to delete user: {{error.message}}"
```

#### With Finally Block

```yaml
type: try
try:
  - action: database.connect
    output_variable: db

  - action: database.query
    inputs:
      sql: "SELECT * FROM users"
    output_variable: users

catch:
  - action: slack.chat.postMessage
    inputs:
      channel: "#alerts"
      text: "Database error: {{error.message}}"

finally:
  - action: database.disconnect
```

#### Nested Try/Catch

```yaml
type: try
try:
  - action: api.getPrimaryData
    inputs:
      endpoint: /data
    output_variable: data

catch:
  # Try fallback API
  - type: try
    try:
      - action: api.getBackupData
        inputs:
          endpoint: /backup/data
        output_variable: data
    catch:
      # Both APIs failed
      - action: slack.chat.postMessage
        inputs:
          channel: "#critical"
          text: "All data sources failed!"
```

#### Resource Cleanup

```yaml
type: try
try:
  - action: storage.createTempFile
    output_variable: temp_file

  - action: processor.processFile
    inputs:
      path: "{{temp_file.path}}"

  - action: storage.uploadFile
    inputs:
      local_path: "{{temp_file.path}}"
      remote_path: /processed/data.json

catch:
  - action: logger.error
    inputs:
      message: "Processing failed: {{error.message}}"

finally:
  # Always cleanup temp file
  - action: storage.deleteFile
    inputs:
      path: "{{temp_file.path}}"
```

---

## Sub-Workflows

Call another workflow as a sub-workflow. Sub-workflows enable code reuse, modularity, and can optionally be executed by an AI sub-agent.

### Basic Syntax

```yaml
type: workflow
workflow: string                     # Required: Path to workflow file
inputs:                              # Optional: Inputs to pass
  <key>: any
output_variable: string              # Optional: Store result
```

### Examples

#### Basic Sub-Workflow

```yaml
- id: validate
  workflow: ./workflows/validate-input.md
  inputs:
    data: "{{inputs.user_data}}"
  output_variable: validation_result
```

#### Chain Sub-Workflows

```yaml
steps:
  - id: fetch
    workflow: ./workflows/fetch-data.md
    inputs:
      source: api
    output_variable: raw_data

  - id: transform
    workflow: ./workflows/transform.md
    inputs:
      data: "{{raw_data}}"
    output_variable: transformed

  - id: save
    workflow: ./workflows/save-results.md
    inputs:
      data: "{{transformed}}"
```

### Sub-Agent Execution

Execute a sub-workflow using an AI sub-agent. The agent interprets the workflow definition and executes it autonomously, making decisions about how to accomplish the workflow's goals.

#### Syntax

```yaml
type: workflow
workflow: string                     # Required: Path to workflow file
use_subagent: boolean                # Execute via AI sub-agent (default: false)
subagent_config:                     # Optional: Sub-agent configuration
  model: string                      # AI model to use
  max_turns: number                  # Maximum agentic turns (default: 10)
  system_prompt: string              # Custom system prompt
  tools: string[]                    # Available tools for the agent
inputs:                              # Optional: Inputs to pass
  <key>: any
output_variable: string              # Optional: Store result
```

#### Example: AI-Driven Security Audit

```yaml
- id: security-audit
  workflow: ./workflows/security-audit.md
  use_subagent: true
  subagent_config:
    model: opus                      # Use most capable model
    max_turns: 20
    tools: [Read, Grep, Glob]
  inputs:
    target: '{{ inputs.code_path }}'
  output_variable: audit_results
```

#### Example: Autonomous Code Review

```yaml
- id: code-review
  workflow: ./workflows/review-pr.md
  use_subagent: true
  subagent_config:
    model: claude-sonnet-4-5
    max_turns: 15
    system_prompt: |
      You are a senior code reviewer. Focus on:
      - Security vulnerabilities
      - Performance issues
      - Code maintainability
    tools: [Read, Grep, Glob, WebSearch]
  inputs:
    pr_url: '{{ inputs.pr_url }}'
    focus_areas: ['security', 'performance']
  output_variable: review
```

### When to Use Sub-Agent Execution

| Scenario | Normal Execution | Sub-Agent Execution |
|----------|-----------------|---------------------|
| Deterministic tasks | ✓ | |
| Fixed step sequence | ✓ | |
| Complex analysis | | ✓ |
| Tasks requiring judgment | | ✓ |
| Exploratory tasks | | ✓ |
| Research tasks | | ✓ |

### Sub-Agent Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Inherited | AI model to use (`opus`, `claude-sonnet-4-5`, `haiku`, etc.) |
| `max_turns` | `number` | `10` | Maximum conversation turns before stopping |
| `system_prompt` | `string` | Auto-generated | Custom system prompt for the agent |
| `tools` | `string[]` | `['Read', 'Glob', 'Grep']` | Tools the agent can use |

### Passing Data to Sub-Workflows

Sub-workflow inputs support full template resolution:

```yaml
- id: process
  workflow: ./workflows/process.md
  inputs:
    # Simple value
    name: "John"

    # Template reference
    user_id: "{{inputs.user_id}}"

    # Computed value
    total: "{{items.length}}"

    # Previous step output
    data: "{{fetch_result.data}}"

    # Object
    config:
      timeout: 5000
      retries: 3
```

### Accessing Sub-Workflow Outputs

Sub-workflow outputs are stored in the `output_variable`:

```yaml
# Sub-workflow returns { status: 'success', count: 42 }
- id: process
  workflow: ./process.md
  output_variable: result

# Access in next step
- action: slack.chat.postMessage
  inputs:
    text: "Processed {{result.count}} items with status: {{result.status}}"
```

---

## Best Practices

### 1. Use Descriptive IDs

```yaml
# Good
id: fetch-user-data
name: Fetch User Data from API

# Bad
id: step1
```

### 2. Handle Errors Appropriately

```yaml
# For critical steps, use stop (default)
error_handling:
  action: stop

# For non-critical steps, continue
error_handling:
  action: continue

# For transactional operations, use rollback
error_handling:
  action: rollback
```

### 3. Set Reasonable Timeouts

```yaml
# Quick API call
timeout: 5000  # 5 seconds

# Long-running process
timeout: 300000  # 5 minutes

# Database query
timeout: 30000  # 30 seconds
```

### 4. Use Output Variables Wisely

```yaml
# Store important results
output_variable: user_data

# Don't store every step result
# Only store what you'll use later
```

### 5. Limit Loop Iterations

```yaml
type: while
condition: retry_count < 10
max_iterations: 100  # Safety limit
```

### 6. Parallel Execution Guidelines

```yaml
# Use parallel for independent operations
type: parallel
branches:
  - id: send_slack
  - id: send_email
  - id: update_db

# Use for_each for dependent operations
type: for_each
items: "{{users}}"
steps:
  - action: notify_user
```

---

## Next Steps

- [Service Integrations](./services.md) - Learn about available service actions
- [AI Agent Integrations](./ai-agents.md) - Integrate AI agents into workflows
- [Examples](../../examples/) - See real-world workflow examples
