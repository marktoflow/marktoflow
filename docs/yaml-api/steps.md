# Steps

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
| `permissions` | `object` | No | Permission restrictions for this step (see [Permissions](./permissions.md)) |

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

#### Tool Calling (Agentic)

Use `chatWithTools` to enable agentic tool-calling loops where the AI model decides which tools to call, executes them, and reasons over the results. Works with OpenAI, local llama.cpp, VLLM, and any OpenAI-compatible endpoint.

```yaml
tools:
  ai:
    sdk: openai
    auth:
      base_url: http://localhost:8000/v1
      api_key: dummy
    options:
      model: auto

steps:
  - id: research
    action: ai.chatWithTools
    inputs:
      messages:
        - role: system
          content: "You are a research assistant. Use tools to answer questions."
        - role: user
          content: "{{ inputs.query }}"
      tools:
        - type: function
          function:
            name: web_search
            description: Search the web for information
            parameters:
              type: object
              properties:
                query:
                  type: string
                  description: Search query
              required: [query]
        - type: function
          function:
            name: read_file
            description: Read contents of a file
            parameters:
              type: object
              properties:
                path:
                  type: string
              required: [path]
      tool_choice: auto        # auto | none | required
      maxTurns: 5              # Max tool-calling rounds (default: 10)
    output_variable: research_result
```

**Tool calling parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tools` | array | Tool definitions with `type: function` and JSON Schema parameters |
| `tool_choice` | string | `auto` (model decides), `none` (no tools), `required` (must use a tool) |
| `maxTurns` | number | Maximum tool-calling loop iterations (default: 10) |
| `response_format` | object | `{ type: "json_object" }` for JSON mode, or `{ type: "json_schema", json_schema: {...} }` for structured output |

#### Structured Output (JSON Mode)

Force the model to return valid JSON:

```yaml
- id: extract
  action: ai.generateJSON
  inputs:
    messages:
      - role: system
        content: "Extract structured data. Respond in JSON."
      - role: user
        content: "Parse this invoice: {{ inputs.text }}"
  output_variable: invoice_data
```

For schema-validated output:

```yaml
- id: classify
  action: ai.generateStructured
  inputs:
    messages:
      - role: user
        content: "Classify the sentiment: {{ inputs.text }}"
    schema:
      name: sentiment
      schema:
        type: object
        properties:
          sentiment:
            type: string
            enum: [positive, negative, neutral]
          confidence:
            type: number
        required: [sentiment, confidence]
      strict: true
  output_variable: classification
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
