# Inputs & Outputs

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

See [Built-in Actions](./built-in-actions.md) for more details on `workflow.set_outputs`.
