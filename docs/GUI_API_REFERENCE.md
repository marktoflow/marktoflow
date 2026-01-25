# Marktoflow Visual Workflow Designer - API Reference

Complete REST API and WebSocket documentation for the Marktoflow GUI server.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Workflows API](#workflows-api)
4. [AI API](#ai-api)
5. [Execution API](#execution-api)
6. [Tools API](#tools-api)
7. [WebSocket Events](#websocket-events)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)

---

## Overview

### Base URL

```
http://localhost:3001/api
```

The default port is 3001. You can customize it with the `--port` flag or `PORT` environment variable.

### Request Format

All POST/PUT requests should include:

```http
Content-Type: application/json
```

### Response Format

All responses return JSON with the following structure:

**Success:**
```json
{
  "workflows": [...],
  "workflow": {...},
  "success": true
}
```

**Error:**
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

---

## Authentication

The GUI server runs locally and does not require authentication. API keys for AI providers and service integrations are configured via environment variables or the provider configuration endpoints.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude AI API key |
| `GITHUB_TOKEN` | GitHub personal access token |
| `SLACK_BOT_TOKEN` | Slack bot OAuth token |
| `WORKFLOW_DIR` | Directory to watch for workflows |

---

## Workflows API

### List All Workflows

```http
GET /api/workflows
```

Returns all discovered workflows in the watched directory.

**Response:**
```json
{
  "workflows": [
    {
      "path": "examples/code-review/workflow.md",
      "name": "Code Review Workflow",
      "description": "Automated PR review with AI",
      "version": "1.0.0",
      "stepCount": 5,
      "lastModified": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### Get Workflow

```http
GET /api/workflows/:path
```

Get a specific workflow by its file path.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |

**Example:**
```bash
curl http://localhost:3001/api/workflows/examples%2Fcode-review%2Fworkflow.md
```

**Response:**
```json
{
  "workflow": {
    "metadata": {
      "name": "Code Review Workflow",
      "description": "Automated PR review",
      "version": "1.0.0"
    },
    "inputs": {
      "repo": { "type": "string", "description": "Repository name" },
      "pr_number": { "type": "number", "description": "PR number" }
    },
    "tools": {
      "github": {
        "sdk": "@octokit/rest",
        "auth": { "token": "${GITHUB_TOKEN}" }
      }
    },
    "steps": [
      {
        "id": "get-pr",
        "name": "Get Pull Request",
        "action": "github.pulls.get",
        "inputs": {
          "owner": "{{ inputs.repo.split('/')[0] }}",
          "repo": "{{ inputs.repo.split('/')[1] }}",
          "pull_number": "{{ inputs.pr_number }}"
        },
        "output_variable": "pr_details"
      }
    ]
  }
}
```

**Error Responses:**
- `404` - Workflow not found
- `500` - Failed to read workflow

---

### Create Workflow

```http
POST /api/workflows
```

Create a new workflow file.

**Request Body:**
```json
{
  "name": "my-new-workflow",
  "template": "blank"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Workflow filename (without extension) |
| `template` | string | No | Template to use: `blank`, `slack`, `github` |

**Response:**
```json
{
  "workflow": {
    "path": "my-new-workflow.md",
    "metadata": {
      "name": "my-new-workflow",
      "version": "1.0.0"
    },
    "steps": []
  }
}
```

---

### Update Workflow

```http
PUT /api/workflows/:path
```

Update an existing workflow.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |

**Request Body:**
```json
{
  "workflow": {
    "metadata": { "name": "Updated Name" },
    "steps": [...]
  }
}
```

**Response:**
```json
{
  "workflow": { ... }
}
```

---

### Delete Workflow

```http
DELETE /api/workflows/:path
```

Delete a workflow file.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |

**Response:**
```json
{
  "success": true
}
```

---

### Get Execution History

```http
GET /api/workflows/:path/runs
```

Get the execution history for a workflow.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |

**Response:**
```json
{
  "runs": [
    {
      "runId": "run-1705312200000",
      "status": "completed",
      "startTime": "2024-01-15T10:30:00Z",
      "endTime": "2024-01-15T10:30:45Z",
      "duration": 45000,
      "stepResults": [...]
    }
  ]
}
```

---

## AI API

### Process Prompt

```http
POST /api/ai/prompt
```

Send a natural language prompt to modify a workflow.

**Request Body:**
```json
{
  "prompt": "Add a Slack notification step after the GitHub step",
  "workflow": { ... }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Natural language instruction |
| `workflow` | object | No | Current workflow state |

**Response:**
```json
{
  "explanation": "I've added a Slack notification step that sends a message to #engineering when the PR is reviewed.",
  "workflow": { ... },
  "diff": "+ Added 1 step(s): notify-slack\n"
}
```

| Field | Description |
|-------|-------------|
| `explanation` | Human-readable explanation of changes |
| `workflow` | Modified workflow object (if changes made) |
| `diff` | Summary of structural changes |
| `error` | Error message (if failed) |

---

### Get Prompt History

```http
GET /api/ai/history
```

Get the history of AI prompts in the current session.

**Response:**
```json
{
  "history": [
    {
      "prompt": "Add a Slack notification step",
      "timestamp": "2024-01-15T10:30:00Z",
      "success": true
    }
  ]
}
```

---

### Get Suggestions

```http
POST /api/ai/suggestions
```

Get AI-generated suggestions for the current context.

**Request Body:**
```json
{
  "workflow": { ... },
  "selectedStepId": "get-pr"
}
```

**Response:**
```json
{
  "suggestions": [
    "Add error handling to retry on failure",
    "Add a condition to skip if PR is draft",
    "Add a Slack notification for this step"
  ]
}
```

---

### Get AI Providers

```http
GET /api/ai/providers
```

Get the status of all available AI providers.

**Response:**
```json
{
  "active": "claude",
  "providers": {
    "claude": {
      "ready": true,
      "model": "claude-sonnet-4-20250514"
    },
    "copilot": {
      "ready": false,
      "error": "Not authenticated"
    },
    "ollama": {
      "ready": true,
      "model": "llama3.2"
    },
    "demo": {
      "ready": true
    }
  }
}
```

---

### Set AI Provider

```http
POST /api/ai/providers/:providerId
```

Set and configure the active AI provider.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `providerId` | string | Provider ID: `claude`, `copilot`, `ollama`, `demo` |

**Request Body:**
```json
{
  "apiKey": "sk-...",
  "baseUrl": "https://api.anthropic.com",
  "model": "claude-sonnet-4-20250514"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | string | No | API key (for Claude) |
| `baseUrl` | string | No | Custom API base URL |
| `model` | string | No | Model to use |

**Response:**
```json
{
  "success": true,
  "status": {
    "active": "claude",
    "providers": { ... }
  }
}
```

---

## Execution API

### Execute Workflow

```http
POST /api/execute/:path
```

Start executing a workflow.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |

**Request Body:**
```json
{
  "inputs": {
    "repo": "owner/repo",
    "pr_number": 123
  },
  "dryRun": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inputs` | object | No | Input values for the workflow |
| `dryRun` | boolean | No | Validate without executing |

**Response:**
```json
{
  "runId": "run-1705312200000",
  "status": "started",
  "workflowPath": "examples/code-review/workflow.md",
  "inputs": { ... },
  "dryRun": false
}
```

---

### Get Execution Status

```http
GET /api/execute/status/:runId
```

Get the current status of a running execution.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `runId` | string | Execution run ID |

**Response:**
```json
{
  "runId": "run-1705312200000",
  "status": "running",
  "currentStep": "step-1",
  "progress": 50
}
```

| Status | Description |
|--------|-------------|
| `pending` | Not yet started |
| `running` | Currently executing |
| `completed` | Finished successfully |
| `failed` | Error occurred |
| `cancelled` | User cancelled |

---

### Cancel Execution

```http
POST /api/execute/cancel/:runId
```

Cancel a running execution.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `runId` | string | Execution run ID |

**Response:**
```json
{
  "runId": "run-1705312200000",
  "status": "cancelled"
}
```

---

## Tools API

### List Tools

```http
GET /api/tools
```

Get all available tools/integrations.

**Response:**
```json
{
  "tools": [
    {
      "id": "slack",
      "name": "Slack",
      "icon": "💬",
      "category": "Communication",
      "description": "Send messages and manage Slack workspaces",
      "sdk": "@slack/web-api",
      "authType": "token",
      "actionCount": 3
    },
    {
      "id": "github",
      "name": "GitHub",
      "icon": "🐙",
      "category": "Development",
      "description": "Manage repositories, issues, and pull requests",
      "sdk": "@octokit/rest",
      "authType": "token",
      "actionCount": 4
    }
  ]
}
```

---

### Get Tool Details

```http
GET /api/tools/:toolId
```

Get detailed information about a specific tool.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `toolId` | string | Tool identifier (e.g., `slack`, `github`) |

**Response:**
```json
{
  "tool": {
    "id": "slack",
    "name": "Slack",
    "icon": "💬",
    "category": "Communication",
    "description": "Send messages and manage Slack workspaces",
    "sdk": "@slack/web-api",
    "authType": "token",
    "docsUrl": "https://api.slack.com/methods",
    "actions": [
      {
        "id": "chat.postMessage",
        "name": "Post Message",
        "description": "Send a message to a channel",
        "inputs": [
          {
            "name": "channel",
            "type": "string",
            "required": true,
            "description": "Channel ID or name"
          },
          {
            "name": "text",
            "type": "string",
            "required": true,
            "description": "Message text"
          }
        ],
        "output": {
          "type": "object",
          "description": "Message response with ts"
        }
      }
    ]
  }
}
```

---

### Get Action Schema

```http
GET /api/tools/:toolId/actions/:actionId
```

Get the schema for a specific tool action.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `toolId` | string | Tool identifier |
| `actionId` | string | Action identifier |

**Response:**
```json
{
  "action": {
    "id": "chat.postMessage",
    "name": "Post Message",
    "description": "Send a message to a channel",
    "inputs": [...],
    "output": {...}
  },
  "tool": {
    "id": "slack",
    "name": "Slack",
    "sdk": "@slack/web-api"
  }
}
```

---

## WebSocket Events

Connect to the WebSocket server at `ws://localhost:3001` using Socket.IO.

### Client → Server Events

#### Subscribe to Workflow Updates

```javascript
socket.emit('workflow:subscribe', 'examples/code-review/workflow.md');
```

#### Unsubscribe from Workflow Updates

```javascript
socket.emit('workflow:unsubscribe', 'examples/code-review/workflow.md');
```

#### Subscribe to Execution Updates

```javascript
socket.emit('execution:subscribe', 'run-1705312200000');
```

#### Unsubscribe from Execution Updates

```javascript
socket.emit('execution:unsubscribe', 'run-1705312200000');
```

---

### Server → Client Events

#### Workflow Updated

Emitted when a workflow file changes on disk.

```javascript
socket.on('workflow:updated', (data) => {
  console.log(data);
  // {
  //   path: 'examples/code-review/workflow.md',
  //   workflow: { ... },
  //   changeType: 'modified'
  // }
});
```

#### Execution Step

Emitted for each step during execution.

```javascript
socket.on('execution:step', (data) => {
  console.log(data);
  // {
  //   runId: 'run-1705312200000',
  //   stepId: 'get-pr',
  //   status: 'completed',
  //   duration: 1234,
  //   output: { ... }
  // }
});
```

#### Execution Completed

Emitted when workflow execution finishes.

```javascript
socket.on('execution:completed', (data) => {
  console.log(data);
  // {
  //   runId: 'run-1705312200000',
  //   status: 'completed',
  //   duration: 45000,
  //   results: { ... }
  // }
});
```

#### AI Processing

Emitted when AI is processing a prompt.

```javascript
socket.on('ai:processing', (data) => {
  console.log(data);
  // { processing: true }
});
```

#### AI Response

Emitted when AI response is ready.

```javascript
socket.on('ai:response', (data) => {
  console.log(data);
  // {
  //   explanation: '...',
  //   workflow: { ... },
  //   diff: '...'
  // }
});
```

---

### Connection Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected to GUI server');

  // Subscribe to workflow updates
  socket.emit('workflow:subscribe', 'examples/code-review/workflow.md');
});

socket.on('workflow:updated', (data) => {
  console.log('Workflow changed:', data.path);
  // Update UI with new workflow data
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created (for POST requests) |
| `400` | Bad Request - Missing or invalid parameters |
| `404` | Not Found - Resource doesn't exist |
| `500` | Internal Server Error |

### Error Response Format

```json
{
  "error": "Failed to get workflow",
  "message": "File not found: examples/missing.md"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Workflow not found` | Invalid path | Check workflow path exists |
| `Prompt is required` | Empty prompt | Provide a prompt string |
| `Provider not available` | AI provider error | Check API key or connectivity |
| `Tool not found` | Invalid tool ID | Use valid tool from /api/tools |

---

## Rate Limiting

The GUI server does not enforce rate limiting by default since it runs locally. For production deployments, consider adding rate limiting middleware.

### AI Provider Limits

Different AI providers have their own rate limits:

| Provider | Rate Limit |
|----------|------------|
| Claude | Depends on API tier |
| GitHub Copilot | Per-minute limits apply |
| Ollama | No external limits (local) |
| Demo | No limits |

---

## Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "2.0.0-alpha.1"
}
```

---

## Related Documentation

- [User Guide](./GUI_USER_GUIDE.md) - Using the visual workflow designer
- [Developer Guide](./GUI_DEVELOPER_GUIDE.md) - Extending and customizing the GUI
