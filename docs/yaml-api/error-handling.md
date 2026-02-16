# Error Handling

## Step-Level Error Handling

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

### Error Actions

| Action | Description |
|--------|-------------|
| `stop` | Stop workflow execution (default) |
| `continue` | Continue to next step |
| `rollback` | Execute registered rollback handlers and stop |

### Retry Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `max_retries` | `number` | `3` | Maximum retry attempts |
| `retry_delay_seconds` | `number` | `1` | Initial delay between retries (exponential backoff) |
| `fallback_action` | `string` | - | Alternative action to try if primary fails |

## Try/Catch Block

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

### Error Variable

In `catch` blocks, access the `error` variable:

```yaml
error.message: "{{error.message}}"   # Error message
error.step: "{{error.step}}"         # Failed step info
```

## Circuit Breaker

Automatic circuit breaker protection prevents cascading failures:

- **Failure Threshold:** 5 consecutive failures open the circuit
- **Recovery Timeout:** 30 seconds before attempting recovery
- **Half-Open Max Calls:** 3 test calls during recovery

Circuit breaker is enabled automatically per service.

## Failover

Automatic failover to alternative services:

```yaml
# In engine configuration (not workflow YAML)
failover_config:
  failover_on_timeout: true
  failover_on_step_failure: true
  fallback_agents:
    - copilot
    - claude-agent
    - opencode
  max_failover_attempts: 2
```
