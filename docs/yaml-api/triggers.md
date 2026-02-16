# Triggers

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
