# Workflow Control Flow Guide

Complete reference for using control flow in marktoflow v2.0 workflows.

---

## Table of Contents

1. [Overview](#overview)
2. [If/Else Conditionals](#ifelse-conditionals)
3. [Switch/Case Routing](#switchcase-routing)
4. [For-Each Loops](#for-each-loops)
5. [While Loops](#while-loops)
6. [Parallel Execution](#parallel-execution)
7. [Map/Filter/Reduce](#mapfilterreduce)
8. [Try/Catch Error Handling](#trycatch-error-handling)
9. [Nesting Control Flow](#nesting-control-flow)
10. [Best Practices](#best-practices)
11. [Examples](#examples)

---

## Overview

marktoflow v2.0 introduces comprehensive control flow capabilities that enable sophisticated workflow automation patterns:

- **Conditionals**: If/else branching and switch/case routing
- **Loops**: For-each and while loops with metadata
- **Parallel**: Concurrent execution with rate limiting
- **Transformations**: Map, filter, reduce operations
- **Error Handling**: Try/catch/finally blocks

All control flow features work seamlessly with:
- ✅ Template variables (`{{ expression }}`)
- ✅ Nested steps (unlimited depth)
- ✅ Output variables
- ✅ Sub-workflows
- ✅ Visual workflow designer
- ✅ Backward compatibility (100%)

---

## If/Else Conditionals

Execute different steps based on a condition.

### Basic Syntax

```yaml
steps:
  - type: if
    condition: "{{ count > 0 }}"
    then:
      - action: slack.chat.postMessage
        inputs:
          text: "Found {{ count }} items"
    else:
      - action: slack.chat.postMessage
        inputs:
          text: "No items found"
```

### If Without Else

```yaml
steps:
  - type: if
    condition: "{{ pr.draft }}"
    steps:  # Alternative to 'then'
      - action: github.addLabel
        inputs:
          label: "draft"
```

### Complex Conditions

```yaml
steps:
  - type: if
    condition: "{{ priority === 'critical' && assignee !== null }}"
    then:
      - action: pagerduty.createIncident
    else:
      - action: jira.createIssue
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | ✅ | Must be `"if"` |
| `condition` | string | ✅ | Boolean expression to evaluate |
| `then` | array | ⬜ | Steps to execute when condition is true |
| `else` | array | ⬜ | Steps to execute when condition is false |
| `steps` | array | ⬜ | Alternative to `then` (for if-only) |

### Visual Designer

The If/Else node in the GUI features:
- Purple gradient design (#667eea → #764ba2)
- Dual output handles (then/else) with colored indicators
- **Active branch highlighting** with ring border (green for then, red for else)
- **Skipped branch visualization** - grayed out with "SKIP" badge
- GitBranch icon
- Real-time status updates (pending/running/completed/failed)

---

## Switch/Case Routing

Route execution to different branches based on an expression value.

### Basic Syntax

```yaml
steps:
  - type: switch
    expression: "{{ incident.severity }}"
    cases:
      critical:
        - action: pagerduty.createIncident
        - action: slack.chat.postMessage
          inputs:
            channel: "#incidents"
            text: "🚨 Critical incident"
      high:
        - action: jira.createIssue
          inputs:
            priority: "High"
        - action: slack.chat.postMessage
          inputs:
            channel: "#engineering"
            text: "⚠️ High priority issue"
      medium:
        - action: jira.createIssue
          inputs:
            priority: "Medium"
    default:
      - action: slack.chat.postMessage
        inputs:
          channel: "#general"
          text: "New issue: {{ incident.title }}"
```

### Without Default

```yaml
steps:
  - type: switch
    expression: "{{ status }}"
    cases:
      approved:
        - action: deploy.production
      rejected:
        - action: notify.team
    # If status is neither 'approved' nor 'rejected', nothing executes
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | ✅ | Must be `"switch"` |
| `expression` | string | ✅ | Expression to evaluate and match |
| `cases` | object | ✅ | Map of case values to step arrays |
| `default` | array | ⬜ | Steps to execute if no case matches |

### Visual Designer

The Switch node features:
- Purple/magenta gradient design (#a855f7 → #ec4899)
- **Smart handle positioning** - evenly distributed to prevent overlap
- Multiple output handles (one per case + default)
- Dynamic case list display (shows up to 4 cases)
- **Active case highlighting** with purple ring border
- **Skipped cases visualization** - strikethrough text with "SKIPPED" badge
- GitFork icon
- Displays case count and default status

---

## For-Each Loops

Iterate over arrays with full loop metadata access.

### Basic Syntax

```yaml
steps:
  - type: for_each
    items: "{{ orders }}"
    item_variable: order
    steps:
      - action: process.order
        inputs:
          order_id: "{{ order.id }}"
          amount: "{{ order.total }}"
```

### With Loop Metadata

```yaml
steps:
  - type: for_each
    items: "{{ users }}"
    item_variable: user
    steps:
      - action: slack.chat.postMessage
        inputs:
          text: "{{ loop.index + 1 }}. Processing {{ user.name }}"

      - type: if
        condition: "{{ loop.first }}"
        steps:
          - action: logger.info
            inputs:
              message: "Starting batch process"

      - type: if
        condition: "{{ loop.last }}"
        steps:
          - action: logger.info
            inputs:
              message: "Finished batch process"
```

### Loop Variables

Inside a for-each loop, you have access to:

| Variable | Type | Description |
|----------|------|-------------|
| `{{ loop.index }}` | number | 0-based index of current iteration |
| `{{ loop.first }}` | boolean | `true` on first iteration |
| `{{ loop.last }}` | boolean | `true` on last iteration |
| `{{ loop.length }}` | number | Total number of iterations |

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `type` | string | ✅ | - | Must be `"for_each"` |
| `items` | string | ✅ | - | Array expression to iterate over |
| `item_variable` | string | ⬜ | `"item"` | Variable name for current item |
| `steps` | array | ✅ | - | Steps to execute per iteration |

### Visual Designer

The For-Each node features:
- Pink/red gradient design (#f093fb → #f5576c)
- **Iteration progress bar** with percentage
- Current/total iterations display (e.g., "5 / 10")
- **Early exit indicator panel** when loop exits via break or error
- **Progress bar color change** - pink for normal, orange for early exit
- **"(stopped)" indicator** in progress text when early exit occurs
- Loop metadata info (loop.index, loop.first, loop.last access)
- Repeat icon
- LogOut icon for early exit warnings

---

## While Loops

Repeat steps until a condition becomes false.

### Basic Syntax

```yaml
steps:
  - id: init-counter
    action: set.variable
    inputs:
      name: retries
      value: 0
    output_variable: retries

  - type: while
    condition: "{{ retries < 3 }}"
    max_iterations: 10
    steps:
      - action: api.call
        output_variable: result

      - type: if
        condition: "{{ result.success }}"
        steps:
          - action: set.variable
            inputs:
              name: retries
              value: 999  # Exit loop
            output_variable: retries
        else:
          - action: increment.counter
            inputs:
              counter: "{{ retries }}"
            output_variable: retries
```

### Safety Limits

While loops have a safety limit to prevent infinite loops:

```yaml
steps:
  - type: while
    condition: "{{ shouldContinue }}"
    max_iterations: 100  # Default if not specified
    steps:
      # If loop runs 100 times, it will fail with an error
```

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `type` | string | ✅ | - | Must be `"while"` |
| `condition` | string | ✅ | - | Continue while this is true |
| `max_iterations` | number | ⬜ | 100 | Safety limit |
| `steps` | array | ✅ | - | Steps to execute per iteration |

### Visual Designer

The While node features:
- Orange gradient design (#fb923c → #f97316)
- Condition display with monospace font
- Current iteration counter
- Max iterations display (default: 100)
- **Progress bar** showing current vs max iterations
- **Early exit warnings** with contextual icons:
  - Break: LogOut icon, "Loop exited early (break)"
  - Max iterations: AlertTriangle icon, "Max iterations reached"
  - Error: LogOut icon, "Loop stopped on error"
- **Progress bar color** - orange for normal, changes on early exit
- **"(stopped)" indicator** when early exit occurs
- RotateCw icon

---

## Parallel Execution

Execute multiple branches concurrently.

### Basic Syntax

```yaml
steps:
  - type: parallel
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

  # After parallel completes, all output variables are available
  - action: generate.dashboard
    inputs:
      jira: "{{ jira_data }}"
      github: "{{ github_data }}"
      slack: "{{ slack_data }}"
```

### With Rate Limiting

```yaml
steps:
  - type: parallel
    max_concurrent: 3  # Only run 3 branches at a time
    branches:
      - id: process_1
        steps: [...]
      - id: process_2
        steps: [...]
      - id: process_3
        steps: [...]
      - id: process_4  # Will wait for one of 1-3 to complete
        steps: [...]
      - id: process_5
        steps: [...]
```

### Error Handling

```yaml
steps:
  - type: parallel
    on_error: continue  # 'stop' (default) or 'continue'
    branches:
      - id: critical_task
        steps:
          - action: important.operation

      - id: optional_task
        steps:
          - action: optional.operation

  # With 'continue', workflow continues even if optional_task fails
  # With 'stop', any failure stops entire parallel execution
```

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `type` | string | ✅ | - | Must be `"parallel"` |
| `branches` | array | ✅ | - | Array of branch objects |
| `branches[].id` | string | ✅ | - | Unique branch identifier |
| `branches[].steps` | array | ✅ | - | Steps for this branch |
| `max_concurrent` | number | ⬜ | unlimited | Max parallel branches |
| `on_error` | string | ⬜ | `"stop"` | `"stop"` or `"continue"` |

### Context Isolation

Each parallel branch gets a cloned context:
- ✅ Can read all parent variables
- ✅ Can modify variables (changes visible to parent)
- ✅ Cannot interfere with other branches
- ✅ Output variables merged after completion

### Visual Designer

The Parallel node features:
- Blue/cyan gradient design (#4facfe → #00f2fe)
- **Branch status badges** with color coding:
  - Gray: Pending
  - Blue (pulsing): Running
  - Green: Completed
  - **Red: Failed** (new)
- **Rate limiting warning panel** when max concurrent limit is hit
- Max concurrent badge (highlighted in yellow when limit active)
- On-error policy display (stop/continue)
- **Failed branch tracking** with red highlighting
- Displays up to 6 branches, shows "+N" for overflow
- Layers icon
- AlertTriangle icon for rate limiting warnings

---

## Map/Filter/Reduce

Collection transformation operations.

### Map - Transform Each Item

```yaml
steps:
  - type: map
    items: "{{ orders }}"
    item_variable: order
    expression: "{{ order.total }}"
    output_variable: totals

  # totals = [100, 200, 150, ...]
```

### Filter - Select Matching Items

```yaml
steps:
  - type: filter
    items: "{{ orders }}"
    item_variable: order
    condition: "{{ order.total >= 1000 }}"
    output_variable: high_value_orders

  # high_value_orders = orders where total >= 1000
```

### Reduce - Aggregate to Single Value

```yaml
steps:
  - type: reduce
    items: "{{ totals }}"
    item_variable: amount
    accumulator_variable: sum
    initial_value: 0
    expression: "{{ sum + amount }}"
    output_variable: total_revenue

  # total_revenue = 450
```

### Pipeline Example

```yaml
steps:
  # 1. Map: Extract totals
  - type: map
    items: "{{ orders }}"
    expression: "{{ order.total }}"
    output_variable: totals

  # 2. Filter: High values only
  - type: filter
    items: "{{ totals }}"
    condition: "{{ item >= 1000 }}"
    output_variable: high_totals

  # 3. Reduce: Calculate sum
  - type: reduce
    items: "{{ high_totals }}"
    accumulator_variable: sum
    initial_value: 0
    expression: "{{ sum + item }}"
    output_variable: total

  # 4. Report result
  - action: slack.chat.postMessage
    inputs:
      text: "High-value orders total: ${{ total }}"
```

### Properties

**Map:**
| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `type` | string | ✅ | - | Must be `"map"` |
| `items` | string | ✅ | - | Array to transform |
| `item_variable` | string | ⬜ | `"item"` | Variable name |
| `expression` | string | ✅ | - | Transform expression |
| `output_variable` | string | ⬜ | - | Result variable name |

**Filter:**
| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `type` | string | ✅ | - | Must be `"filter"` |
| `items` | string | ✅ | - | Array to filter |
| `item_variable` | string | ⬜ | `"item"` | Variable name |
| `condition` | string | ✅ | - | Boolean condition |
| `output_variable` | string | ⬜ | - | Result variable name |

**Reduce:**
| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `type` | string | ✅ | - | Must be `"reduce"` |
| `items` | string | ✅ | - | Array to reduce |
| `item_variable` | string | ⬜ | `"item"` | Item variable name |
| `accumulator_variable` | string | ✅ | - | Accumulator variable |
| `initial_value` | any | ✅ | - | Starting value |
| `expression` | string | ✅ | - | Reduction expression |
| `output_variable` | string | ⬜ | - | Result variable name |

### Visual Designer

The Transform node features:
- Teal/cyan gradient design
- Type-specific icons (ArrowRight, Filter, Minimize2)
- Expression/condition preview
- Input/output count display
- Single unified component

---

## Try/Catch Error Handling

Handle errors gracefully with fallback steps.

### Basic Syntax

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
          text: "API failed: {{ error.message }}"
```

### With Finally

```yaml
steps:
  - type: try
    try:
      - action: database.transaction
    catch:
      - action: database.rollback
      - action: notify.admin
        inputs:
          error: "{{ error.message }}"
    finally:
      - action: database.close
      - action: metrics.record
        inputs:
          operation: completed
```

### Error Object

In catch blocks, you have access to the error object:

```yaml
catch:
  - action: log.error
    inputs:
      message: "{{ error.message }}"
      stack: "{{ error.stack }}"
      step_id: "{{ error.stepId }}"
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | ✅ | Must be `"try"` |
| `try` | array | ✅ | Steps to attempt |
| `catch` | array | ⬜ | Steps if error occurs |
| `finally` | array | ⬜ | Steps that always execute |

### Execution Flow

1. **Try block executes**
   - If successful: skip catch, run finally (if present)
   - If fails: run catch, then run finally (if present)

2. **Error propagation**
   - Error caught: execution continues after try/catch
   - Error not caught: workflow fails
   - Error in catch: workflow fails
   - Error in finally: workflow fails

### Visual Designer

The Try/Catch node features:
- Yellow/orange gradient design
- Three branch indicators (try/catch/finally)
- Error indicator when error occurs
- Three output handles
- Shield icon

---

## Nesting Control Flow

Control flow steps can be nested to any depth.

### If Inside For-Each

```yaml
steps:
  - type: for_each
    items: "{{ users }}"
    steps:
      - type: if
        condition: "{{ user.active }}"
        then:
          - action: send.email
            inputs:
              to: "{{ user.email }}"
```

### Parallel with Loops

```yaml
steps:
  - type: parallel
    branches:
      - id: process_orders
        steps:
          - type: for_each
            items: "{{ orders }}"
            steps:
              - action: process.order

      - id: process_users
        steps:
          - type: for_each
            items: "{{ users }}"
            steps:
              - action: process.user
```

### Try Around Parallel

```yaml
steps:
  - type: try
    try:
      - type: parallel
        branches:
          - id: api1
            steps: [...]
          - id: api2
            steps: [...]
    catch:
      - action: fallback.process
```

### Switch with Nested If

```yaml
steps:
  - type: switch
    expression: "{{ severity }}"
    cases:
      critical:
        - type: if
          condition: "{{ on_call_available }}"
          then:
            - action: pagerduty.createIncident
          else:
            - action: escalate.toManager
      high:
        - action: jira.createIssue
```

---

## Best Practices

### 1. Use Meaningful Variable Names

```yaml
# Good
- type: for_each
  items: "{{ customers }}"
  item_variable: customer

# Avoid
- type: for_each
  items: "{{ list }}"
  item_variable: x
```

### 2. Keep Conditions Simple

```yaml
# Good
- type: if
  condition: "{{ isValid }}"

# Avoid
- type: if
  condition: "{{ (data.status === 'active' && data.verified === true && data.count > 0) || (data.status === 'pending' && data.priority === 'high') }}"
```

### 3. Handle Errors Early

```yaml
# Good
steps:
  - type: try
    try:
      - action: risky.operation
    catch:
      - action: handle.error

# Avoid - Let errors propagate unhandled
steps:
  - action: risky.operation
```

### 4. Limit Parallel Concurrency

```yaml
# Good
- type: parallel
  max_concurrent: 5  # Respect rate limits
  branches: [...]

# Avoid
- type: parallel
  # No limit - could overwhelm APIs
  branches: [...]
```

### 5. Use Map/Filter/Reduce for Data Processing

```yaml
# Good - Declarative
- type: filter
  items: "{{ orders }}"
  condition: "{{ item.total >= 1000 }}"

# Avoid - Imperative with for-each
- type: for_each
  items: "{{ orders }}"
  steps:
    - type: if
      condition: "{{ order.total >= 1000 }}"
      steps:
        - action: array.push
```

### 6. Avoid Deep Nesting

```yaml
# Good - Flat structure
steps:
  - type: if
    condition: "{{ needsProcessing }}"
    steps:
      - workflow: process-data.md

# Avoid - Deep nesting
steps:
  - type: if
    condition: "{{ cond1 }}"
    then:
      - type: if
        condition: "{{ cond2 }}"
        then:
          - type: if
            condition: "{{ cond3 }}"
            # Too deep!
```

### 7. Set While Loop Limits

```yaml
# Good
- type: while
  condition: "{{ retries < 3 }}"
  max_iterations: 10  # Safety limit

# Avoid
- type: while
  condition: "{{ true }}"  # Infinite loop!
```

---

## Examples

### Example 1: Data Processing Pipeline

**Use Case:** Process e-commerce orders with filtering and aggregation

```yaml
---
workflow:
  id: order-pipeline
  name: 'Order Processing Pipeline'

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'
---

# Order Processing Pipeline

## Step 1: Fetch Orders

```yaml
action: api.get
inputs:
  url: "https://api.example.com/orders"
output_variable: orders
```

## Step 2: Filter High-Value Orders

```yaml
type: filter
items: "{{ orders.data }}"
item_variable: order
condition: "{{ order.total >= 1000 }}"
output_variable: high_value_orders
```

## Step 3: Map to Summaries

```yaml
type: map
items: "{{ high_value_orders }}"
item_variable: order
expression: "{{ { id: order.id, total: order.total, customer: order.customer_name } }}"
output_variable: summaries
```

## Step 4: Calculate Total Revenue

```yaml
type: reduce
items: "{{ high_value_orders }}"
item_variable: order
accumulator_variable: sum
initial_value: 0
expression: "{{ sum + order.total }}"
output_variable: total_revenue
```

## Step 5: Report Results

```yaml
action: slack.chat.postMessage
inputs:
  channel: "#sales"
  text: "High-value orders: {{ high_value_orders.length }}\nTotal revenue: ${{ total_revenue }}"
```

### Example 2: Incident Router

**Use Case:** Route incidents based on severity

See [examples/control-flow/incident-router.md](../examples/control-flow/incident-router.md)

### Example 3: Parallel Dashboard

**Use Case:** Fetch data from multiple sources concurrently

See [examples/control-flow/parallel-fetch.md](../examples/control-flow/parallel-fetch.md)

### Example 4: Resilient API Integration

**Use Case:** Primary/fallback API with error handling

See [examples/control-flow/error-handling.md](../examples/control-flow/error-handling.md)

---

## Performance Considerations

### Parallel Execution

Parallel branches run truly concurrently:

```yaml
- type: parallel
  max_concurrent: 3
  branches:
    - id: task1  # Runs immediately
    - id: task2  # Runs immediately
    - id: task3  # Runs immediately
    - id: task4  # Waits for one of 1-3 to complete
```

**Performance:** 3x faster than sequential for I/O-bound tasks

### Loop Performance

```yaml
# For 1000-item array
- type: for_each
  items: "{{ array1000 }}"
  steps:
    - action: process.item
# Completes in ~100ms (sequential)

# Map is faster for simple transformations
- type: map
  items: "{{ array1000 }}"
  expression: "{{ item.value }}"
# Completes in ~50ms (optimized)
```

### Memory Considerations

- **For-Each**: O(1) memory - processes one item at a time
- **Map/Filter/Reduce**: O(n) memory - creates new arrays
- **Parallel**: O(branches) memory - clones context per branch

---

## Troubleshooting

### Common Issues

**1. Infinite while loop**

```yaml
# Problem: Condition never becomes false
- type: while
  condition: "{{ true }}"  # Always true!

# Solution: Use max_iterations
- type: while
  condition: "{{ retries < 3 }}"
  max_iterations: 10  # Safety limit
```

**2. Parallel context isolation**

```yaml
# Problem: Expecting branches to share state
- type: parallel
  branches:
    - id: branch1
      steps:
        - action: set.var
          inputs:
            name: shared
            value: 123
    - id: branch2
      steps:
        - action: use.var
          inputs:
            value: "{{ shared }}"  # Won't see branch1's change

# Solution: Use output variables and merge
- type: parallel
  branches:
    - id: branch1
      steps:
        - action: compute
          output_variable: result1
    - id: branch2
      steps:
        - action: compute
          output_variable: result2
- action: combine
  inputs:
    result1: "{{ result1 }}"
    result2: "{{ result2 }}"
```

**3. Empty loop variables**

```yaml
# Problem: Loop variables not accessible
- type: for_each
  items: "{{ users }}"
  steps:
    - action: process
      inputs:
        index: "{{ index }}"  # Wrong variable name

# Solution: Use correct variable names
- type: for_each
  items: "{{ users }}"
  item_variable: user
  steps:
    - action: process
      inputs:
        user: "{{ user }}"
        index: "{{ loop.index }}"
```

---

## Reference

### Type Field Values

| Type | Description |
|------|-------------|
| `if` | If/else conditional |
| `switch` | Switch/case routing |
| `for_each` | For-each loop |
| `while` | While loop |
| `parallel` | Parallel execution |
| `try` | Try/catch/finally |
| `map` | Map transformation |
| `filter` | Filter selection |
| `reduce` | Reduce aggregation |

### Reserved Variables

| Variable | Context | Description |
|----------|---------|-------------|
| `loop.index` | for_each, while | 0-based iteration index |
| `loop.first` | for_each | `true` on first iteration |
| `loop.last` | for_each | `true` on last iteration |
| `loop.length` | for_each | Total number of iterations |
| `error.message` | catch | Error message |
| `error.stack` | catch | Error stack trace |
| `error.stepId` | catch | ID of failed step |

---

For more examples, see the [examples/control-flow](../examples/control-flow/) directory.
