# Event-Driven Workflows

Marktoflow supports event-driven workflows that connect to external services via WebSocket, Discord, Slack, SSE, or cron — and react to events in real time.

## Workflow Modes

| Mode | Description |
|------|-------------|
| `run` (default) | Execute steps once and exit |
| `daemon` | Run continuously — after the last step, loop back to the first |
| `event` | Wait for trigger events, then execute steps for each event |

## Event Sources

| Source | Description | Required Options |
|--------|-------------|------------------|
| `websocket` | Connect to any WebSocket endpoint | `url` |
| `discord` | Discord bot via Gateway WebSocket | `token`, `intents` |
| `slack` | Slack events via Socket Mode | `appToken` |
| `cron` | Emit events on a schedule | `schedule` |
| `http-stream` | Server-Sent Events (SSE) | `url` |

## Event Operations

| Operation | Description |
|-----------|-------------|
| `event.connect` | Connect to an event source |
| `event.wait` | Wait for the next matching event |
| `event.disconnect` | Disconnect an event source |
| `event.send` | Send data through a connected source (WebSocket) |
| `event.status` | Get status of all connected sources |

## Example: Discord Bot

```yaml
metadata:
  name: discord-bot
mode: daemon
sources:
  - kind: discord
    id: my-bot
    options:
      token: "{{ env.DISCORD_BOT_TOKEN }}"
      intents: 33281
    filter: [MESSAGE_CREATE]
```

```yaml
# Step 1: Wait for a Discord message
action: event.wait
inputs:
  source: my-bot
  type: MESSAGE_CREATE
output: msg

# Step 2: Respond with AI
action: copilot
inputs:
  prompt: "Respond to: {{ msg.data.content }}"
output: reply
```

## Example: Cron-Triggered Workflow

```yaml
metadata:
  name: hourly-report
mode: daemon
sources:
  - kind: cron
    id: hourly
    options:
      schedule: "1h"
```

```yaml
action: event.wait
inputs:
  source: hourly
  type: tick
output: trigger
```

## Example: WebSocket Stream

```yaml
sources:
  - kind: websocket
    id: price-feed
    options:
      url: "wss://stream.example.com/prices"
    reconnect: true
```

## event.wait Options

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Source id to wait on (omit for any) |
| `type` | string | Event type to match (omit for any) |
| `timeout` | number | Timeout in ms (0 = no timeout) |

## event.connect Options

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | Source type: websocket, discord, slack, cron, http-stream, rss |
| `id` | string | Unique connection id |
| `options` | object | Source-specific config (url, token, etc.) |
| `filter` | string[] | Only emit matching event types |
| `reconnect` | boolean | Auto-reconnect (default: true) |

## RSS Event Source Example

```yaml
sources:
  - kind: rss
    id: tech-feed
    options:
      url: "https://hnrss.org/newest?points=100"
      interval: "5m"
      immediate: true
```

RSS sources poll a feed at the configured interval and emit `new_item` events for each new entry. On the first poll, existing items are tracked but not emitted, so only genuinely new items trigger events.

See [examples/event-driven/](../../examples/event-driven/) for complete workflow examples.
