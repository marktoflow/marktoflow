# Built-in Actions

marktoflow provides several built-in actions that don't require external tool configuration. These are available in all workflows without needing to declare them in the `tools` section.

## Workflow Control Actions

These actions control workflow execution and outputs.

### `workflow.set_outputs`

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

### `workflow.log`

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

### `workflow.sleep`

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

### `workflow.fail`

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

### `workflow.timestamp`

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

### `workflow.noop`

No-operation action that does nothing. Useful for testing or as a placeholder during workflow development.

```yaml
action: workflow.noop
```

## Utility Actions

Common utility actions for logging, scripting, delays, and HTTP requests.

### `core.log`

Logs a message to the console output. Useful for debugging and progress reporting.

```yaml
action: core.log
inputs:
  message: string    # Message to log (supports templates)
  level: string      # Optional: 'info' | 'warn' | 'error' | 'debug' (default: 'info')
```

**Example:**

```yaml
action: core.log
inputs:
  message: 'Processing item {{ index + 1 }} of {{ total }}: {{ item.name }}'
  level: info
```

**Note:** `workflow.log` can also be used as an alias for `core.log`.

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

**Example - Multi-line Log:**

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

### `core.writeFile`

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

### `file.read`

Reads a file from the filesystem with automatic format conversion. Supports text files, MS Word (.docx), PDF, Excel (.xlsx), and binary files.

```yaml
action: file.read
inputs:
  path: string               # File path to read (supports templates)
  encoding: string           # Optional: Text encoding (default: 'utf8')
output_variable: file_content
```

**Output:**
```json
{
  "content": "file content or base64 for binary",
  "path": "/absolute/path/to/file",
  "size": 1234,
  "originalFormat": "text|docx|pdf|xlsx|binary",
  "convertedFrom": "format name if converted"
}
```

**Supported Formats:**

- **Text files** (30+ extensions): .txt, .md, .json, .yaml, .xml, .html, .css, .js, .ts, .py, .java, .c, .cpp, .sh, .sql, .csv, .log, .env, .ini, .toml, .cfg, .conf, and more
- **MS Word** (.docx): Converted to markdown using mammoth package
- **PDF** (.pdf): Converted to text/markdown using pdf-parse package
- **Excel** (.xlsx): Converted to CSV using xlsx package
- **Binary files**: Returned as base64-encoded string

**Optional Dependencies:**

For document conversion, install these packages as needed:
```bash
pnpm add mammoth pdf-parse xlsx
```

**Examples:**

```yaml
# Read Text File
action: file.read
inputs:
  path: './data/config.json'
output_variable: config

# Read MS Word Document (converted to markdown)
action: file.read
inputs:
  path: '{{ inputs.document_path }}'
output_variable: doc

# Read PDF (converted to text)
action: file.read
inputs:
  path: './reports/report.pdf'
output_variable: report

# Read Excel Spreadsheet (converted to CSV)
action: file.read
inputs:
  path: './data/spreadsheet.xlsx'
output_variable: data

# Read Binary File (base64 encoded)
action: file.read
inputs:
  path: './images/logo.png'
output_variable: image
```

### `file.write`

Writes data to a file on the filesystem. Supports text, binary (base64), and automatic JSON serialization for objects.

```yaml
action: file.write
inputs:
  path: string               # File path to write (supports templates)
  data: string|object        # Data to write (text, base64, or object)
  encoding: string           # Optional: 'utf8' (default) or 'base64'
  createDirectory: boolean   # Optional: Create parent dirs (default: false)
output_variable: write_result
```

**Output:**
```json
{
  "path": "/absolute/path/to/file",
  "size": 1234,
  "success": true
}
```

**Examples:**

```yaml
# Write Text File
action: file.write
inputs:
  path: './output/result.txt'
  data: '{{ processed_text }}'

# Write JSON Object (auto-formatted)
action: file.write
inputs:
  path: './output/data.json'
  data: '{{ results_object }}'

# Write Binary Data (base64)
action: file.write
inputs:
  path: './output/image.png'
  data: '{{ base64_image_data }}'
  encoding: 'base64'

# Create Nested Directories
action: file.write
inputs:
  path: './reports/2024/january/summary.html'
  data: '{{ html_content }}'
  createDirectory: true
```

### `script` / `script.execute`

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

### `sleep`

Pauses workflow execution for a specified duration. Alias for `workflow.sleep`.

```yaml
action: sleep
inputs:
  duration: number   # Duration in milliseconds
  # OR
  seconds: number    # Duration in seconds
```

### `http.request`

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

## Parallel Execution Actions

Execute multiple AI agents concurrently for faster processing and diverse perspectives.

**Use cases:**
- Code review from multiple perspectives (security, performance, quality)
- Batch processing (PRs, issues, documents)
- Gathering consensus from different models
- A/B testing models on the same task

### `parallel.spawn`

Execute multiple AI agents concurrently with different prompts and wait strategies.

```yaml
action: parallel.spawn
inputs:
  agents:             # Required: Array of agent configurations
    - id: string      # Required: Unique agent identifier
      provider: string  # Required: claude, copilot, opencode, ollama, openai
      model: string   # Optional: Model name (uses provider default if omitted)
      prompt: string  # Required: Prompt template (supports {{ }} variables)
      inputs: object  # Optional: Additional inputs
  wait: string        # Optional: all|any|majority|<number> (default: all)
  timeout: string     # Optional: Max time per agent (default: 60s)
  onError: string     # Optional: fail|continue|partial (default: fail)
```

**Wait Strategies:**
- `all` (default) - Wait for all agents to complete
- `any` - Return as soon as any agent completes (fastest wins)
- `majority` - Wait for >50% of agents to complete
- `<number>` - Wait for specific count (e.g., `wait: 3` waits for 3 agents)

**Error Handling:**
- `fail` (default) - Fail if any agent fails
- `continue` - Continue with successful results
- `partial` - Fail only if all agents fail

**Output Structure:**
```typescript
{
  results: {
    [agentId]: {
      id: string;
      success: boolean;
      output?: any;
      error?: string;
      timing: { started: string; completed: string; duration: number };
      cost?: number;
    }
  },
  successful: string[];  // Array of successful agent IDs
  failed: string[];      // Array of failed agent IDs
  timing: { duration: number; started: string; completed: string },
  costs: { total: number; byAgent: { [agentId]: number } }
}
```

**Example - Multi-Perspective Code Review (3x faster than sequential):**

```yaml
- action: parallel.spawn
  inputs:
    agents:
      - id: security
        provider: claude
        model: sonnet
        prompt: "Security review of {{ code_file }}: {{ code_content }}"
      - id: performance
        provider: copilot
        prompt: "Performance review of {{ code_file }}: {{ code_content }}"
      - id: quality
        provider: claude
        model: haiku
        prompt: "Code quality review of {{ code_file }}: {{ code_content }}"
    wait: all
    timeout: 90s
    onError: partial
  outputs:
    security_review: '{{ results.security.output }}'
    performance_review: '{{ results.performance.output }}'
    quality_review: '{{ results.quality.output }}'
    total_cost: '{{ results.costs.total }}'
```

### `parallel.map`

Process an array of items in parallel with configurable concurrency.

```yaml
action: parallel.map
inputs:
  items: array        # Required: Array to process (can be template)
  agent:              # Required: Agent configuration
    provider: string  # Required: claude, copilot, opencode, ollama, openai
    model: string     # Optional: Model name
    prompt: string    # Required: Prompt template (access {{ item }} and {{ itemIndex }})
  concurrency: number # Optional: Max concurrent agents (default: 5)
  timeout: string     # Optional: Timeout per item (default: 60s)
  onError: string     # Optional: fail|continue|partial (default: fail)
```

**Context Variables:**
- `{{ item }}` - Current item being processed
- `{{ itemIndex }}` - Index of current item (0-based)

**Example - Batch PR Processing:**

```yaml
- action: parallel.map
  inputs:
    items: '{{ pull_requests }}'
    concurrency: 5
    agent:
      provider: claude
      model: haiku
      prompt: |
        Review PR #{{ item.number }}: {{ item.title }}
        Files changed: {{ item.changed_files }}

        Provide: summary, issues found, recommendation (approve/request-changes/comment)
  outputs:
    pr_reviews: '{{ results }}'
```

**Performance Comparison:**

| Scenario | Sequential | Parallel | Speedup |
|----------|-----------|----------|---------|
| 3 code reviews (30s each) | 90s | 30s | 3x |
| 50 PRs (30s each) @ concurrency=5 | 25min | 5min | 5x |
| 50 PRs (30s each) @ concurrency=10 | 25min | 2.5min | 10x |

**Best Practices:**

1. **Set appropriate concurrency** to avoid rate limits (5 conservative, 10 moderate, 20 aggressive)
2. **Use cheaper models for batch operations** (haiku for simple, sonnet for standard, opus for complex)
3. **Handle partial results** with `onError: continue`
4. **Test with small batches first**: `items: '{{ all_items | slice(0, 5) }}'`

**Examples:**
- [Multi-Agent Code Review](../../examples/parallel-agents/multi-agent-code-review.md)
- [Batch PR Processing](../../examples/parallel-agents/batch-pr-processing.md)
- [Consensus Decision Making](../../examples/parallel-agents/consensus-decision.md)

## Best Practices

### 1. Always Set Outputs Explicitly

```yaml
# Good - clear outputs
action: workflow.set_outputs
inputs:
  user_id: '{{ created_user.id }}'
  email: '{{ created_user.email }}'
  status: 'created'
```

### 2. Use Meaningful Output Names

```yaml
# Good
action: workflow.set_outputs
inputs:
  order_id: '{{ order.id }}'
  total_amount: '{{ order.total }}'
  confirmation_sent: true
```

### 3. Include Status Information

```yaml
action: workflow.set_outputs
inputs:
  status: 'success'
  data: '{{ processed_data }}'
  timestamp: '{{ now() }}'
  error: null
```

### 4. Log Important Steps

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
