# REST API Integration Guide

marktoflow includes a comprehensive HTTP client for calling any REST API endpoint, making it easy to integrate with services that don't have dedicated integrations.

## Features

- ✅ **All HTTP Methods**: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- ✅ **Multiple Auth Types**: Bearer Token, Basic Auth, API Key
- ✅ **GraphQL Support**: Built-in GraphQL client
- ✅ **Automatic JSON Parsing**: Smart content-type handling
- ✅ **Query Parameters**: Easy URL parameter building
- ✅ **Custom Headers**: Set default and per-request headers
- ✅ **Timeouts**: Configurable request timeouts
- ✅ **Error Handling**: Structured error responses

## Basic Usage

### Simple GET Request

```yaml
---
workflow:
  id: fetch-user
  name: 'Fetch User from API'

tools:
  api:
    sdk: 'http'
    options:
      base_url: 'https://api.example.com'
    auth:
      type: 'bearer'
      token: '${API_TOKEN}'

steps:
  - id: get_user
    action: api.get
    inputs:
      path: '/users/123'
    output_variable: user
---
```

### POST Request with Body

```yaml
steps:
  - id: create_user
    action: api.post
    inputs:
      path: '/users'
      body:
        name: 'John Doe'
        email: 'john@example.com'
        role: 'developer'
    output_variable: created_user
```

### Query Parameters

```yaml
steps:
  - id: search_users
    action: api.get
    inputs:
      path: '/users'
      query:
        status: 'active'
        role: 'developer'
        limit: 10
    output_variable: users
```

### Custom Headers

```yaml
steps:
  - id: custom_request
    action: api.post
    inputs:
      path: '/api/v2/data'
      headers:
        X-Custom-Header: 'custom-value'
        X-Request-ID: '{{ workflow.runId }}'
      body:
        data: 'example'
    output_variable: response
```

## Authentication

### Bearer Token

```yaml
tools:
  api:
    sdk: 'http'
    options:
      base_url: 'https://api.example.com'
    auth:
      type: 'bearer'
      token: '${API_TOKEN}'
```

### Basic Authentication

```yaml
tools:
  api:
    sdk: 'http'
    options:
      base_url: 'https://api.example.com'
    auth:
      type: 'basic'
      username: '${API_USERNAME}'
      password: '${API_PASSWORD}'
```

### API Key

```yaml
tools:
  api:
    sdk: 'http'
    options:
      base_url: 'https://api.example.com'
    auth:
      type: 'api-key'
      api_key: '${API_KEY}'
      api_key_header: 'X-API-Key' # Optional, defaults to X-API-Key
```

### No Authentication

```yaml
tools:
  public_api:
    sdk: 'http'
    options:
      base_url: 'https://api.public-service.com'
```

## Advanced Usage

### Multiple Endpoints

You can define multiple HTTP clients for different APIs:

```yaml
tools:
  github_api:
    sdk: 'http'
    options:
      base_url: 'https://api.github.com'
    auth:
      type: 'bearer'
      token: '${GITHUB_TOKEN}'

  stripe_api:
    sdk: 'http'
    options:
      base_url: 'https://api.stripe.com/v1'
    auth:
      type: 'bearer'
      token: '${STRIPE_SECRET_KEY}'

  internal_api:
    sdk: 'http'
    options:
      base_url: 'https://internal.company.com/api'
    auth:
      type: 'api-key'
      api_key: '${INTERNAL_API_KEY}'

steps:
  - id: get_repo
    action: github_api.get
    inputs:
      path: '/repos/owner/repo'
    output_variable: repo

  - id: create_customer
    action: stripe_api.post
    inputs:
      path: '/customers'
      body:
        email: '{{ repo.owner.email }}'
    output_variable: customer
```

### Error Handling

```yaml
steps:
  - id: fetch_data
    action: api.get
    inputs:
      path: '/data/123'
      timeout: 5000 # 5 second timeout
    output_variable: data
    error_handling:
      action: 'continue'
      max_retries: 3
      retry_delay_seconds: 2
```

### Dynamic URLs

```yaml
steps:
  - id: fetch_user
    action: api.get
    inputs:
      path: '/users/{{ inputs.user_id }}'
    output_variable: user

  - id: fetch_posts
    action: api.get
    inputs:
      path: '/users/{{ user.data.id }}/posts'
      query:
        limit: 20
        sort: 'recent'
    output_variable: posts
```

## GraphQL Support

marktoflow includes a built-in GraphQL client:

```yaml
---
workflow:
  id: graphql-example
  name: 'GraphQL Query Example'

tools:
  graphql_api:
    sdk: 'http'
    options:
      base_url: 'https://api.example.com/graphql'
    auth:
      type: 'bearer'
      token: '${GRAPHQL_TOKEN}'

steps:
  - id: query_data
    action: graphql_api.query
    inputs:
      query: |
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            name
            email
            posts {
              id
              title
              createdAt
            }
          }
        }
      variables:
        id: 'user-123'
    output_variable: user_data
---
```

## Complete Example: Multi-Service Workflow

```yaml
---
workflow:
  id: api-integration
  name: "Multi-API Integration Example"
  description: "Fetch data from multiple APIs and post to Slack"

tools:
  weather_api:
    sdk: 'http'
    options:
      base_url: 'https://api.weatherapi.com/v1'
    auth:
      type: 'api-key'
      api_key: '${WEATHER_API_KEY}'
      api_key_header: 'key'

  news_api:
    sdk: 'http'
    options:
      base_url: 'https://newsapi.org/v2'
    auth:
      type: 'bearer'
      token: '${NEWS_API_KEY}'

  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  city:
    type: string
    required: true
    default: "San Francisco"

steps:
  - id: get_weather
    name: "Fetch Current Weather"
    action: weather_api.get
    inputs:
      path: '/current.json'
      query:
        q: '{{ inputs.city }}'
        aqi: 'no'
    output_variable: weather

  - id: get_news
    name: "Fetch Top Headlines"
    action: news_api.get
    inputs:
      path: '/top-headlines'
      query:
        country: 'us'
        pageSize: 5
    output_variable: news

  - id: format_message
    name: "Format Slack Message"
    action: console.log
    inputs:
      message: |
        📍 Weather in {{ inputs.city }}: {{ weather.data.current.temp_f }}°F, {{ weather.data.current.condition.text }}

        📰 Top News:
        {% for article in news.data.articles %}
        • {{ article.title }}
        {% endfor %}
    output_variable: formatted_message

  - id: post_to_slack
    name: "Post to Slack"
    action: slack.chat.postMessage
    inputs:
      channel: '#general'
      text: '{{ formatted_message }}'
    output_variable: slack_response
---

# Multi-API Integration

This workflow demonstrates:
1. Calling multiple REST APIs
2. Different authentication methods
3. Combining data from multiple sources
4. Posting results to Slack
```

## Response Structure

All HTTP requests return a structured response:

```typescript
{
  status: number; // HTTP status code (200, 404, etc.)
  statusText: string; // Status text ("OK", "Not Found", etc.)
  headers: object; // Response headers
  data: any; // Parsed response body (JSON, text, or buffer)
  ok: boolean; // True if status is 2xx
  url: string; // Final URL (after redirects)
}
```

Access response data in your workflow:

```yaml
steps:
  - id: fetch_user
    action: api.get
    inputs:
      path: '/users/123'
    output_variable: response

  - id: use_data
    action: console.log
    inputs:
      message: |
        Status: {{ response.status }}
        User Name: {{ response.data.name }}
        User Email: {{ response.data.email }}
```

## Available Methods

| Method  | Action        | Description                  |
| ------- | ------------- | ---------------------------- |
| GET     | `api.get`     | Retrieve data                |
| POST    | `api.post`    | Create new resource          |
| PUT     | `api.put`     | Update entire resource       |
| PATCH   | `api.patch`   | Partial update               |
| DELETE  | `api.delete`  | Delete resource              |
| HEAD    | `api.head`    | Get headers only (no body)   |
| request | `api.request` | Custom method (full control) |

## Configuration Options

### Tool Configuration

| Option   | Type   | Description                      | Default |
| -------- | ------ | -------------------------------- | ------- |
| base_url | string | Base URL for all requests        | ""      |
| timeout  | number | Default timeout in milliseconds  | 30000   |
| headers  | object | Default headers for all requests | {}      |

### Request Options

| Option          | Type    | Description                     | Default |
| --------------- | ------- | ------------------------------- | ------- |
| path            | string  | Request path (relative to base) | -       |
| method          | string  | HTTP method                     | GET     |
| headers         | object  | Additional headers              | {}      |
| query           | object  | URL query parameters            | {}      |
| body            | any     | Request body (auto-serialized)  | -       |
| timeout         | number  | Request timeout (ms)            | 30000   |
| followRedirects | boolean | Follow 3xx redirects            | true    |

## Best Practices

### 1. Use Environment Variables for Secrets

```yaml
tools:
  api:
    sdk: 'http'
    auth:
      type: 'bearer'
      token: '${API_TOKEN}' # Load from .env file
```

### 2. Set Reasonable Timeouts

```yaml
steps:
  - id: slow_endpoint
    action: api.get
    inputs:
      path: '/long-running-task'
      timeout: 60000 # 60 seconds for slow endpoints
```

### 3. Handle Errors Gracefully

```yaml
steps:
  - id: risky_call
    action: api.get
    inputs:
      path: '/might-fail'
    output_variable: result
    error_handling:
      action: 'continue' # Don't stop workflow on failure
      fallback_action: 'use_default_data'
```

### 4. Use Retry Logic

```yaml
steps:
  - id: flaky_endpoint
    action: api.get
    inputs:
      path: '/unstable'
    output_variable: data
    error_handling:
      max_retries: 3
      retry_delay_seconds: 5
```

### 5. Log Requests for Debugging

```yaml
steps:
  - id: debug_request
    action: console.log
    inputs:
      message: 'Calling API: {{ api.baseUrl }}/{{ path }}'

  - id: make_request
    action: api.get
    inputs:
      path: '{{ path }}'
    output_variable: response

  - id: debug_response
    action: console.log
    inputs:
      message: 'Response status: {{ response.status }}'
```

## Real-World Examples

See the `examples/` directory for complete workflow examples:

- **Webhook Integration** - Receive webhooks and call external APIs
- **Data Pipeline** - Fetch, transform, and push data between services
- **API Monitoring** - Check API health and alert on failures
- **Multi-Service Orchestration** - Coordinate actions across multiple APIs

## Troubleshooting

### Request Timeout

```
Error: Request timeout after 30000ms
```

**Solution**: Increase timeout in request options or tool configuration.

### Authentication Failed

```
Error: HTTP 401: Unauthorized
```

**Solution**: Verify token/credentials are correct and not expired.

### Invalid JSON Response

```
Error: Unexpected token in JSON
```

**Solution**: Check if the API actually returns JSON. Use `.data` to inspect raw response.

### CORS Errors

CORS errors don't apply to server-side requests. marktoflow runs on the server, not in a browser.

## Summary

The HTTP integration in marktoflow provides:

✅ **Universal API Support** - Connect to any REST API  
✅ **Multiple Auth Methods** - Bearer, Basic, API Key  
✅ **GraphQL Support** - Built-in GraphQL client  
✅ **Type-Safe Responses** - Structured response format  
✅ **Error Handling** - Automatic retries and fallbacks  
✅ **Full Control** - Custom headers, timeouts, methods

This makes marktoflow a powerful tool for API orchestration, data pipelines, and multi-service automation workflows.
