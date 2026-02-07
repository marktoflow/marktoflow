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
7. [Version Control API](#version-control-api)
8. [Collaboration API](#collaboration-api)
9. [Admin / Governance API](#admin--governance-api)
10. [Templates API](#templates-api)
11. [Settings API](#settings-api)
12. [WebSocket Events](#websocket-events)
13. [Error Handling](#error-handling)
14. [Rate Limiting](#rate-limiting)

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

## Version Control API

### List Versions

```http
GET /api/versions/:path/versions
```

Get all version snapshots for a workflow.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |

**Response:**
```json
{
  "versions": [
    {
      "id": "v-1705312200000",
      "path": "examples/code-review/workflow.md",
      "timestamp": "2024-01-15T10:30:00Z",
      "description": "Added error handling",
      "author": "user@example.com"
    }
  ]
}
```

---

### Create Version Snapshot

```http
POST /api/versions/:path/versions
```

Create a new version snapshot of the current workflow state.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |

**Request Body:**
```json
{
  "description": "Added Slack notification step"
}
```

**Response:**
```json
{
  "version": {
    "id": "v-1705312200001",
    "path": "examples/code-review/workflow.md",
    "timestamp": "2024-01-15T10:35:00Z",
    "description": "Added Slack notification step"
  }
}
```

---

### Get Version

```http
GET /api/versions/:path/versions/:id
```

Get a specific version snapshot.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |
| `id` | string | Version ID |

**Response:**
```json
{
  "version": {
    "id": "v-1705312200000",
    "timestamp": "2024-01-15T10:30:00Z",
    "description": "Added error handling",
    "workflow": { ... }
  }
}
```

---

### Restore Version

```http
POST /api/versions/:path/versions/:id/restore
```

Restore a workflow to a previous version. This creates a new version snapshot with the restored content (non-destructive).

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |
| `id` | string | Version ID to restore |

**Response:**
```json
{
  "version": {
    "id": "v-1705312200002",
    "timestamp": "2024-01-15T10:40:00Z",
    "description": "Restored from v-1705312200000",
    "workflow": { ... }
  }
}
```

---

### Compare Versions

```http
GET /api/versions/:path/versions/compare?v1=VERSION_ID_1&v2=VERSION_ID_2
```

Compare two version snapshots side-by-side.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |
| `v1` | string | First version ID (query parameter) |
| `v2` | string | Second version ID (query parameter) |

**Response:**
```json
{
  "v1": { "id": "v-1", "workflow": { ... } },
  "v2": { "id": "v-2", "workflow": { ... } },
  "diff": {
    "added": ["step-3"],
    "removed": [],
    "modified": ["step-1"]
  }
}
```

---

## Collaboration API

### Acquire Lock

```http
POST /api/collaboration/lock
```

Acquire an editing lock on a workflow. Locks auto-release after 5 minutes of inactivity.

**Request Body:**
```json
{
  "path": "examples/code-review/workflow.md",
  "user": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "lock": {
    "path": "examples/code-review/workflow.md",
    "user": "user@example.com",
    "acquiredAt": "2024-01-15T10:30:00Z",
    "expiresAt": "2024-01-15T10:35:00Z"
  }
}
```

**Error Responses:**
- `409` - Workflow is already locked by another user

---

### Release Lock

```http
POST /api/collaboration/unlock
```

Release an editing lock on a workflow.

**Request Body:**
```json
{
  "path": "examples/code-review/workflow.md",
  "user": "user@example.com"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### Get Lock Status

```http
GET /api/collaboration/lock/:path
```

Check if a workflow is currently locked.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |

**Response:**
```json
{
  "locked": true,
  "lock": {
    "user": "user@example.com",
    "acquiredAt": "2024-01-15T10:30:00Z",
    "expiresAt": "2024-01-15T10:35:00Z"
  }
}
```

---

### List Comments

```http
GET /api/collaboration/comments/:path
```

Get all comments for a workflow.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |

**Response:**
```json
{
  "comments": [
    {
      "id": "comment-1",
      "nodeId": "step-1",
      "author": "user@example.com",
      "text": "Should we add retry logic here?",
      "timestamp": "2024-01-15T10:30:00Z",
      "resolved": false,
      "replies": [
        {
          "id": "reply-1",
          "author": "other@example.com",
          "text": "Good idea, I will add it.",
          "timestamp": "2024-01-15T10:32:00Z"
        }
      ]
    }
  ]
}
```

---

### Add Comment

```http
POST /api/collaboration/comments/:path
```

Add a comment to a workflow node.

**Request Body:**
```json
{
  "nodeId": "step-1",
  "author": "user@example.com",
  "text": "Should we add retry logic here?",
  "parentId": null
}
```

Set `parentId` to an existing comment ID to create a threaded reply.

**Response:**
```json
{
  "comment": {
    "id": "comment-2",
    "nodeId": "step-1",
    "author": "user@example.com",
    "text": "Should we add retry logic here?",
    "timestamp": "2024-01-15T10:30:00Z",
    "resolved": false
  }
}
```

---

### Resolve Comment

```http
POST /api/collaboration/comments/:id/resolve
```

Mark a comment as resolved.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | string | Comment ID |

**Response:**
```json
{
  "success": true,
  "comment": {
    "id": "comment-1",
    "resolved": true,
    "resolvedBy": "user@example.com",
    "resolvedAt": "2024-01-15T10:40:00Z"
  }
}
```

---

### Get Activity Feed

```http
GET /api/collaboration/activity/:path
```

Get the activity feed for a workflow.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | URL-encoded workflow file path |

**Response:**
```json
{
  "activities": [
    {
      "id": "activity-1",
      "type": "step_modified",
      "user": "user@example.com",
      "timestamp": "2024-01-15T10:30:00Z",
      "details": {
        "stepId": "step-1",
        "field": "inputs.channel",
        "oldValue": "#general",
        "newValue": "#engineering"
      }
    }
  ]
}
```

---

## Admin / Governance API

### Roles

#### List Roles

```http
GET /api/admin/roles
```

**Response:**
```json
{
  "roles": [
    {
      "id": "admin",
      "name": "Admin",
      "permissions": ["read", "write", "execute", "admin"]
    },
    {
      "id": "editor",
      "name": "Editor",
      "permissions": ["read", "write", "execute"]
    },
    {
      "id": "viewer",
      "name": "Viewer",
      "permissions": ["read"]
    },
    {
      "id": "operator",
      "name": "Operator",
      "permissions": ["read", "execute"]
    }
  ]
}
```

#### Assign Role

```http
POST /api/admin/roles
```

**Request Body:**
```json
{
  "userId": "user@example.com",
  "role": "editor"
}
```

**Response:**
```json
{
  "success": true,
  "assignment": {
    "userId": "user@example.com",
    "role": "editor"
  }
}
```

---

### Environments

#### List Environments

```http
GET /api/admin/environments
```

**Response:**
```json
{
  "environments": [
    {
      "id": "dev",
      "name": "Development",
      "variables": { "API_URL": "https://dev.api.example.com" }
    },
    {
      "id": "staging",
      "name": "Staging",
      "variables": { "API_URL": "https://staging.api.example.com" }
    },
    {
      "id": "prod",
      "name": "Production",
      "variables": { "API_URL": "https://api.example.com" }
    }
  ]
}
```

#### Create/Update Environment

```http
POST /api/admin/environments
```

**Request Body:**
```json
{
  "id": "staging",
  "name": "Staging",
  "variables": {
    "API_URL": "https://staging.api.example.com",
    "LOG_LEVEL": "debug"
  }
}
```

---

### Secrets

#### List Secrets

```http
GET /api/admin/secrets
```

Returns secret names and metadata (values are masked).

**Response:**
```json
{
  "secrets": [
    {
      "name": "SLACK_BOT_TOKEN",
      "createdAt": "2024-01-10T00:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "maskedValue": "xoxb-****-****"
    }
  ]
}
```

#### Create/Update Secret

```http
POST /api/admin/secrets
```

**Request Body:**
```json
{
  "name": "SLACK_BOT_TOKEN",
  "value": "xoxb-real-token-value"
}
```

**Response:**
```json
{
  "success": true,
  "secret": {
    "name": "SLACK_BOT_TOKEN",
    "maskedValue": "xoxb-****-****"
  }
}
```

---

### Audit Trail

#### Get Audit Log

```http
GET /api/admin/audit
```

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `limit` | number | Max entries to return (default: 50) |
| `offset` | number | Pagination offset |
| `action` | string | Filter by action type |
| `user` | string | Filter by user |

**Response:**
```json
{
  "entries": [
    {
      "id": "audit-1",
      "action": "role.assigned",
      "user": "admin@example.com",
      "timestamp": "2024-01-15T10:30:00Z",
      "details": {
        "targetUser": "user@example.com",
        "role": "editor"
      }
    }
  ],
  "total": 142
}
```

---

## Templates API

### List Templates

```http
GET /api/templates
```

Get all available workflow templates. Templates are seeded from the `examples/` directory.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `search` | string | Search templates by name or description |
| `category` | string | Filter by category |

**Response:**
```json
{
  "templates": [
    {
      "id": "code-review",
      "name": "Code Review Workflow",
      "description": "Automated PR review with AI assistance",
      "category": "Development",
      "tags": ["github", "ai", "code-review"],
      "stepCount": 5
    }
  ]
}
```

---

### Get Template

```http
GET /api/templates/:id
```

Get a specific template with full workflow content.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | string | Template identifier |

**Response:**
```json
{
  "template": {
    "id": "code-review",
    "name": "Code Review Workflow",
    "description": "Automated PR review with AI assistance",
    "category": "Development",
    "workflow": { ... }
  }
}
```

---

## Settings API

User preferences are persisted to `~/.marktoflow/settings.json`. The API provides read/write access with automatic deep-merging against defaults, so new settings added in future versions get their defaults without user intervention.

### Get Settings

```http
GET /api/settings
```

Returns the full settings object, merged with defaults.

**Response:**
```json
{
  "general": { "theme": "dark" },
  "canvas": { "showGrid": true, "snapToGrid": true, "gridSize": 20, "showMinimap": true, "animateEdges": true },
  "editor": { "autoSaveEnabled": false, "autoSaveIntervalMs": 30000, "autoValidateOnChange": true, "confirmBeforeDelete": true },
  "execution": { "confirmBeforeExecute": true, "autoScrollLogs": true, "showExecutionNotifications": true },
  "ai": { "showPromptBar": true, "showAISuggestions": true },
  "notifications": { "executionComplete": true, "executionFailed": true, "workflowSaved": false, "connectionStatus": true }
}
```

---

### Replace All Settings

```http
PUT /api/settings
```

Full replacement of all settings. The body is deep-merged with defaults, so you can send a partial object.

**Request Body:**
```json
{
  "general": { "theme": "light" }
}
```

**Response:** Full settings object (same format as GET).

---

### Update a Category

```http
PATCH /api/settings/:category
```

Partially update one settings category. Only the provided keys are changed; other keys in the category are preserved.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `category` | string | One of: `general`, `canvas`, `editor`, `execution`, `ai`, `notifications` |

**Request Body:**
```json
{
  "showGrid": false,
  "gridSize": 40
}
```

**Response:** Full settings object (same format as GET).

**Error Responses:**
- `400` - Unknown settings category

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

#### Presence Events

Emitted when users join, leave, or update their presence in the GUI.

```javascript
socket.on('presence:join', (data) => {
  // { user: 'user@example.com', timestamp: '...' }
});

socket.on('presence:leave', (data) => {
  // { user: 'user@example.com', timestamp: '...' }
});

socket.on('presence:update', (data) => {
  // { user: 'user@example.com', cursor: { x, y }, selectedNodes: [...] }
});
```

#### Comment Events

Emitted when comments are added or resolved.

```javascript
socket.on('comment:added', (data) => {
  // { comment: { id, nodeId, author, text, timestamp } }
});

socket.on('comment:resolved', (data) => {
  // { commentId: 'comment-1', resolvedBy: 'user@example.com' }
});
```

#### Lock Events

Emitted when workflow locks are acquired or released.

```javascript
socket.on('lock:acquired', (data) => {
  // { path: 'workflow.md', user: 'user@example.com', expiresAt: '...' }
});

socket.on('lock:released', (data) => {
  // { path: 'workflow.md', user: 'user@example.com' }
});
```

#### Version Events

Emitted when a new version snapshot is created.

```javascript
socket.on('version:created', (data) => {
  // { version: { id, path, timestamp, description } }
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
