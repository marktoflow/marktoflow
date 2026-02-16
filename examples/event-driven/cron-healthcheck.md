---
metadata:
  name: cron-healthcheck
  description: Run periodic health checks on APIs
  version: "1.0"
  tags: [cron, event-driven, monitoring, health]
mode: daemon
sources:
  - kind: cron
    id: health-timer
    options:
      schedule: "5m"
      immediate: true
---

# API Health Check (Cron-Triggered)

Runs every 5 minutes to check API health endpoints.
Only alerts when something is down.

## Wait for Next Check

```yaml
action: event.wait
inputs:
  source: health-timer
  type: tick
output: trigger
```

## Check API Health

```yaml
action: http
inputs:
  url: "https://api.example.com/health"
  method: GET
  timeout: 10000
output: health_response
on_error: continue
```

## Evaluate Health

```yaml
action: core.set
inputs:
  is_healthy: "{{ health_response.status == 200 }}"
  status_code: "{{ health_response.status | default('timeout') }}"
  checked_at: "{{ trigger.data.scheduledAt }}"
output: result
```

## Alert if Unhealthy

```yaml
if: "{{ not result.is_healthy }}"
action: copilot
inputs:
  prompt: |
    API health check failed at {{ result.checked_at }}.
    Status: {{ result.status_code }}

    Generate a brief incident summary and suggest next steps.
  model: gpt-4o-mini
output: incident_report
```
