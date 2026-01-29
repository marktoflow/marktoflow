---
workflow:
  id: resilient-api-call
  name: 'Resilient API Integration with Fallback'
  description: 'Demonstrates try/catch/finally with primary and fallback APIs'
  version: '1.0.0'

tools:
  http:
    sdk: 'axios'
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  primary_api_url:
    type: string
    required: true
    default: 'https://api.primary.com/data'
  fallback_api_url:
    type: string
    required: true
    default: 'https://api.fallback.com/data'
  user_id:
    type: string
    required: true

triggers:
  - type: schedule
    config:
      cron: '*/15 * * * *'  # Every 15 minutes
---

# Resilient API Integration

This workflow demonstrates robust error handling with primary/fallback APIs and comprehensive cleanup.

## Step 1: Initialize Request

```yaml
action: console.log
inputs:
  message: "Starting API request for user {{ inputs.user_id }}"
output_variable: init_log
```

## Step 2: Try Primary API with Fallback

Attempt primary API, fall back to secondary if it fails, and always log the attempt.

```yaml
type: try
timeout: 30
try:
  # Primary API attempt
  - id: call_primary_api
    name: 'Call Primary API'
    action: http.get
    inputs:
      url: "{{ inputs.primary_api_url }}?user_id={{ inputs.user_id }}"
      timeout: 5000
      headers:
        Authorization: "Bearer ${PRIMARY_API_TOKEN}"
    output_variable: api_response

  - id: validate_primary
    name: 'Validate Primary Response'
    type: if
    condition: "api_response.status == 200"
    then:
      - action: console.log
        inputs:
          message: "✅ Primary API succeeded"
    else:
      - action: console.log
        inputs:
          message: "❌ Primary API returned non-200 status"

catch:
  # Fallback to secondary API
  - id: log_primary_failure
    name: 'Log Primary API Failure'
    action: console.log
    inputs:
      message: "Primary API failed: {{ error.message }}, trying fallback..."

  - id: call_fallback_api
    name: 'Call Fallback API'
    action: http.get
    inputs:
      url: "{{ inputs.fallback_api_url }}?user_id={{ inputs.user_id }}"
      timeout: 10000
      headers:
        Authorization: "Bearer ${FALLBACK_API_TOKEN}"
    output_variable: api_response

  - id: notify_fallback_used
    name: 'Alert Team of Fallback'
    action: slack.chat.postMessage
    inputs:
      channel: "#alerts"
      text: |
        ⚠️ Primary API Failed - Using Fallback

        User ID: {{ inputs.user_id }}
        Error: {{ error.message }}
        Fallback Status: Success
finally:
  # Always execute cleanup and logging
  - id: log_request_metadata
    name: 'Log Request Metadata'
    action: console.log
    inputs:
      message: |
        Request completed for user {{ inputs.user_id }}
        Timestamp: {{ Date.now() }}
        API Used: {{ api_response ? 'Primary or Fallback' : 'None' }}

  - id: update_metrics
    name: 'Update API Metrics'
    action: http.post
    inputs:
      url: "https://metrics.internal.com/api/requests"
      data:
        user_id: "{{ inputs.user_id }}"
        timestamp: "{{ Date.now() }}"
        success: "{{ api_response != null }}"

output_variable: request_result
```

## Step 3: Process API Response

```yaml
type: if
condition: "api_response != null"
then:
  - id: process_data
    name: 'Process Successful Response'
    action: console.log
    inputs:
      message: "Processing data: {{ api_response.data }}"

  - id: transform_data
    name: 'Transform Data'
    type: map
    items: "{{ api_response.data.items || [] }}"
    item_variable: item
    expression: "{{ item.name }}: {{ item.value }}"
    output_variable: transformed_data

  - id: post_success
    name: 'Post Success to Slack'
    action: slack.chat.postMessage
    inputs:
      channel: "#data-pipeline"
      text: |
        ✅ Data Retrieved Successfully

        User: {{ inputs.user_id }}
        Items: {{ transformed_data.length }}
else:
  - id: post_failure
    name: 'Post Failure to Slack'
    action: slack.chat.postMessage
    inputs:
      channel: "#alerts"
      text: |
        ❌ API Request Failed

        User: {{ inputs.user_id }}
        Both primary and fallback APIs failed
```

## Advanced Error Handling Example

Nested try/catch for granular error handling:

```yaml
type: try
try:
  - id: outer_operation
    type: try
    try:
      - action: http.post
        inputs:
          url: "{{ inputs.primary_api_url }}/process"
        output_variable: process_result
    catch:
      - action: console.log
        inputs:
          message: "Processing failed, attempting recovery"

      - action: http.post
        inputs:
          url: "{{ inputs.primary_api_url }}/recover"
        output_variable: recovery_result
catch:
  - action: slack.chat.postMessage
    inputs:
      channel: "#incidents"
      text: "🚨 Critical: Both process and recovery failed"
finally:
  - action: console.log
    inputs:
      message: "Cleanup complete"
```

## Error Handling Patterns

### 1. Primary with Fallback
```yaml
type: try
try:
  - action: primary.service
catch:
  - action: fallback.service
```

### 2. Retry with Delay
```yaml
type: try
try:
  - action: unreliable.service
catch:
  - action: console.log
    inputs:
      message: "Retrying after delay..."
  - action: unreliable.service  # Second attempt
```

### 3. Graceful Degradation
```yaml
type: try
try:
  - action: feature.enhanced
    output_variable: result
catch:
  - action: feature.basic
    output_variable: result
finally:
  - action: analytics.track
    inputs:
      feature_used: "{{ result ? 'enhanced' : 'basic' }}"
```

### 4. Multi-Step with Partial Success
```yaml
type: try
try:
  - action: step1
  - action: step2
  - action: step3
catch:
  - type: if
    condition: "step1 && step2"
    then:
      - action: rollback.step2
      - action: rollback.step1
```

## Benefits

- **Resilience**: Automatic fallback to secondary systems
- **Transparency**: All failures logged and reported
- **Cleanup**: Finally block ensures resources are always released
- **Observability**: Metrics tracked regardless of success/failure
- **User Experience**: Seamless failover invisible to end users

## Error Object Structure

When an error occurs, the `error` object in catch blocks contains:

```typescript
{
  message: string;        // Error message
  step: {                 // Failed step info
    id: string;
    action?: string;
    // ... other step properties
  }
}
```

## Testing Scenarios

```bash
# Test primary API success
curl -X POST http://localhost:3000/run/resilient-api-call \
  -d '{"user_id": "user123"}'

# Test primary failure (invalid URL)
curl -X POST http://localhost:3000/run/resilient-api-call \
  -d '{
    "user_id": "user123",
    "primary_api_url": "https://invalid.url.com/api"
  }'

# Test both APIs fail
curl -X POST http://localhost:3000/run/resilient-api-call \
  -d '{
    "user_id": "user123",
    "primary_api_url": "https://invalid1.com/api",
    "fallback_api_url": "https://invalid2.com/api"
  }'
```

## Monitoring Dashboard

Track error rates and fallback usage:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Primary Success Rate | % requests succeeding on primary | < 95% |
| Fallback Usage | % requests using fallback | > 10% |
| Total Failure Rate | % requests failing both | > 1% |
| Average Response Time | Time to complete request | > 5s |

## Integration with Monitoring

```yaml
# Add to finally block for comprehensive monitoring
finally:
  - action: datadog.metric
    inputs:
      metric: "api.request.duration"
      value: "{{ Date.now() - start_time }}"
      tags:
        - "user:{{ inputs.user_id }}"
        - "api:{{ api_response ? 'primary' : 'fallback' }}"
        - "status:{{ api_response ? 'success' : 'failed' }}"
```
