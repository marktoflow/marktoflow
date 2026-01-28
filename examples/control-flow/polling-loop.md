---
workflow:
  id: polling-loop
  name: 'API Job Polling with While Loop'
  description: 'Demonstrates while loop for polling a long-running job until completion'
  version: '1.0.0'

tools:
  http:
    sdk: 'axios'
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  api_url:
    type: string
    required: true
    default: 'https://api.example.com'
  job_type:
    type: string
    required: true
    default: 'data-export'
  max_wait_seconds:
    type: number
    required: false
    default: 300

triggers:
  - type: webhook
    config:
      path: '/webhooks/start-job'
      method: POST
---

# API Job Polling with While Loop

This workflow demonstrates using a `while` loop to poll a long-running job until it completes, with timeout protection.

## Use Cases

- Export large datasets
- Process batch operations
- Wait for CI/CD pipelines
- Monitor deployment status
- Wait for infrastructure provisioning

## Step 1: Initiate Job

Start the long-running job and get a job ID.

```yaml
action: http.post
inputs:
  url: "{{ inputs.api_url }}/jobs"
  data:
    type: "{{ inputs.job_type }}"
    parameters:
      format: "csv"
      compression: "gzip"
output_variable: job_response
```

## Step 2: Poll Until Complete

Use a while loop to check job status repeatedly until it's done.

```yaml
type: while
condition: "job_status.state != 'completed' && job_status.state != 'failed' && elapsed_time < inputs.max_wait_seconds"
max_iterations: 100
variables:
  job_status:
    initial: { state: 'pending' }
  elapsed_time:
    initial: 0
  poll_count:
    initial: 0
steps:
  - id: check_status
    name: 'Check Job Status'
    action: http.get
    inputs:
      url: "{{ inputs.api_url }}/jobs/{{ job_response.data.job_id }}"
    output_variable: status_response

  - id: update_status
    name: 'Update Status Variables'
    action: script.eval
    inputs:
      expression: |
        {
          job_status: status_response.data,
          elapsed_time: elapsed_time + 5,
          poll_count: poll_count + 1
        }
    output_variable: loop_vars

  - id: wait
    name: 'Wait Before Next Poll'
    action: util.sleep
    inputs:
      seconds: 5
    conditions:
      - "loop_vars.job_status.state == 'pending' || loop_vars.job_status.state == 'running'"

  - id: log_progress
    name: 'Log Progress'
    action: console.log
    inputs:
      message: "Poll #{{ loop_vars.poll_count }}: Job {{ loop_vars.job_status.state }} ({{ loop_vars.job_status.progress || 0 }}%)"
    conditions:
      - "loop_vars.poll_count % 6 == 0"  # Log every 30 seconds
```

## Step 3: Handle Result

Process the completed job or handle failure/timeout.

```yaml
type: switch
expression: "{{ job_status.state }}"
cases:
  completed:
    - id: download_result
      name: 'Download Job Result'
      action: http.get
      inputs:
        url: "{{ job_status.result_url }}"
      output_variable: job_result

    - id: notify_success
      name: 'Notify Success'
      action: slack.chat.postMessage
      inputs:
        channel: "#data-exports"
        text: |
          ✅ Job completed successfully!

          Job ID: {{ job_response.data.job_id }}
          Type: {{ inputs.job_type }}
          Duration: {{ elapsed_time }} seconds
          Polls: {{ poll_count }}
          Result: {{ job_status.result_url }}
      output_variable: success_notification

  failed:
    - id: notify_failure
      name: 'Notify Failure'
      action: slack.chat.postMessage
      inputs:
        channel: "#alerts"
        text: |
          ❌ Job failed!

          Job ID: {{ job_response.data.job_id }}
          Type: {{ inputs.job_type }}
          Error: {{ job_status.error || 'Unknown error' }}
          Duration: {{ elapsed_time }} seconds
      output_variable: failure_notification

default:
  - id: notify_timeout
    name: 'Notify Timeout'
    action: slack.chat.postMessage
    inputs:
      channel: "#alerts"
      text: |
        ⏱️ Job timed out!

        Job ID: {{ job_response.data.job_id }}
        Type: {{ inputs.job_type }}
        Last State: {{ job_status.state }}
        Max Wait: {{ inputs.max_wait_seconds }} seconds
        Polls: {{ poll_count }}
    output_variable: timeout_notification
```

## Step 4: Cleanup

```yaml
action: console.log
inputs:
  message: "Workflow completed. Final status: {{ job_status.state }}"
```

## While Loop Features

### Condition Expression
```yaml
condition: "job_status.state != 'completed' && job_status.state != 'failed' && elapsed_time < max_wait_seconds"
```

The loop continues while:
- Job is not completed
- Job has not failed
- We haven't exceeded max wait time

### Loop Variables
```yaml
variables:
  job_status:
    initial: { state: 'pending' }
  elapsed_time:
    initial: 0
  poll_count:
    initial: 0
```

Variables persist across iterations and can be updated.

### Safety Features

1. **Max Iterations**: `max_iterations: 100` prevents infinite loops
2. **Timeout Protection**: `elapsed_time < max_wait_seconds` stops after threshold
3. **Progressive Delay**: Wait 5 seconds between polls to respect rate limits
4. **Conditional Logging**: Only log every 6th iteration (30 seconds)

## Benefits

- **Efficient**: Only polls as needed, stops immediately on completion
- **Safe**: Multiple safeguards prevent infinite loops
- **Observable**: Progress logging for monitoring
- **Flexible**: Condition can check multiple states and timeouts
- **Reusable**: Can be adapted for any polling scenario

## Example API Responses

**Initial Job Creation:**
```json
{
  "job_id": "job_abc123",
  "state": "pending",
  "created_at": "2024-01-28T12:00:00Z"
}
```

**Polling Status (In Progress):**
```json
{
  "job_id": "job_abc123",
  "state": "running",
  "progress": 45,
  "message": "Processing records..."
}
```

**Completed:**
```json
{
  "job_id": "job_abc123",
  "state": "completed",
  "progress": 100,
  "result_url": "https://api.example.com/downloads/export_123.csv.gz",
  "records_processed": 50000
}
```

## Testing

```bash
# Trigger the workflow
curl -X POST http://localhost:3000/webhooks/start-job \
  -H "Content-Type: application/json" \
  -d '{
    "api_url": "https://api.example.com",
    "job_type": "data-export",
    "max_wait_seconds": 300
  }'
```

## Advanced Patterns

### Exponential Backoff

```yaml
type: while
condition: "retries < max_retries && !success"
variables:
  retries:
    initial: 0
  wait_seconds:
    initial: 1
steps:
  - action: http.get
    inputs:
      url: "{{ api_url }}"
    output_variable: response
    error_handling:
      action: continue

  - action: util.sleep
    inputs:
      seconds: "{{ wait_seconds }}"
    conditions:
      - "response.status != 200"

  - action: script.eval
    inputs:
      expression: |
        {
          retries: retries + 1,
          wait_seconds: wait_seconds * 2,  # Double the wait time
          success: response.status == 200
        }
    output_variable: loop_vars
```

### Pagination with While Loop

```yaml
type: while
condition: "has_more_pages"
variables:
  page:
    initial: 1
  all_results:
    initial: []
  has_more_pages:
    initial: true
steps:
  - action: http.get
    inputs:
      url: "{{ api_url }}/items?page={{ page }}"
    output_variable: page_response

  - action: script.eval
    inputs:
      expression: |
        {
          page: page + 1,
          all_results: all_results.concat(page_response.data.items),
          has_more_pages: page_response.data.has_more
        }
    output_variable: loop_vars
```
