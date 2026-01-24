# Marktoflow Framework Analysis & Recommendations

**Date:** January 2026
**Purpose:** Comprehensive evaluation of the marktoflow framework for ease of use, effectiveness, and recommendations for built-in tool integrations and trigger mechanisms.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Language Choice: TypeScript vs Python](#language-choice-typescript-vs-python)
3. [Current State Assessment](#current-state-assessment)
4. [Ease of Use Improvements](#ease-of-use-improvements)
5. [Effectiveness Evaluation](#effectiveness-evaluation)
6. [Built-in Tool Integrations](#built-in-tool-integrations)
7. [Trigger Mechanisms](#trigger-mechanisms)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Appendix: Research Sources](#appendix-research-sources)

---

## Executive Summary

Marktoflow is a well-architected automation framework with solid foundations. The core engine, state management, and agent adapter patterns are production-ready. However, to maximize adoption and real-world effectiveness, the framework needs:

1. **Simplified onboarding** - One-command setup for common integrations
2. **Pre-built tool packages** - Ready-to-use Slack, Gmail, Outlook, Jira integrations
3. **Robust trigger system** - Email, message, and webhook triggers with minimal configuration
4. **Better developer experience** - Interactive workflow creation and testing

### Key Recommendations Summary

| Priority | Recommendation | Impact |
|----------|---------------|--------|
| High | Add OAuth flow handler for built-in tools | Eliminates manual API key setup |
| High | Create MCP server registry integration | Leverage existing MCP ecosystem |
| High | Implement email-to-webhook bridge | Enables email triggers |
| Medium | Add Slack app manifest generator | Simplifies Slack setup |
| Medium | Build workflow playground/tester | Faster development cycles |
| Low | Visual workflow editor | Broader user adoption |

---

## Language Choice: TypeScript vs Python

### Recommendation: TypeScript (with migration path)

For a framework focused on **integrating existing tools** rather than building from scratch, **TypeScript is the better choice**. Here's why:

### Ecosystem Comparison

| Aspect | Python | TypeScript/Node.js |
|--------|--------|-------------------|
| **MCP Servers** | Few, must wrap npm | Native - all @modelcontextprotocol/* packages |
| **Slack SDK** | python-slack-sdk | @slack/bolt, @slack/web-api (official, more active) |
| **Jira SDK** | jira-python (community) | jira.js, @forge/api (official Atlassian) |
| **Microsoft Graph** | msgraph-sdk-python | @microsoft/microsoft-graph-client (official) |
| **Gmail** | google-api-python-client | googleapis (official, same team) |
| **GitHub** | PyGithub (community) | @octokit/rest (official) |
| **NPM package count** | PyPI: ~500k | NPM: ~2.5M+ |
| **Automation tools** | Limited | Extensive (n8n plugins, Zapier apps) |

### Why TypeScript Wins for Tool Integration

#### 1. MCP Ecosystem is JavaScript-First

The Model Context Protocol ecosystem is almost entirely npm-based:

```bash
# Available as npm packages - just import and use
@modelcontextprotocol/server-slack
@modelcontextprotocol/server-github
@modelcontextprotocol/server-filesystem
@modelcontextprotocol/server-postgres
@modelcontextprotocol/server-fetch
# ... and 50+ more
```

In Python, you'd need to:
- Spawn Node.js subprocess for each MCP server
- Use JSON-RPC to communicate
- Handle process lifecycle
- Lose native error handling

In TypeScript:
```typescript
import { SlackServer } from '@modelcontextprotocol/server-slack';
const slack = new SlackServer({ token: process.env.SLACK_TOKEN });
// Direct function calls, native types, full IDE support
```

#### 2. Official SDKs are Better Maintained

| Service | Python SDK Status | TypeScript SDK Status |
|---------|------------------|----------------------|
| Slack | Good, but @slack/bolt has more features | **Best-in-class**, Socket Mode, Block Kit |
| Jira | Community-maintained | **Official Atlassian packages** |
| Microsoft | Good | **Primary platform**, full Graph API |
| GitHub | Octokit exists for both | **Primary platform**, GitHub maintains it |

#### 3. Existing Tool Libraries

TypeScript has extensive automation-focused libraries:

```typescript
// Can directly use these without writing adapters:
import { Octokit } from '@octokit/rest';
import { WebClient } from '@slack/web-api';
import { Client as NotionClient } from '@notionhq/client';
import { Anthropic } from '@anthropic-ai/sdk';
import { google } from 'googleapis';
import { Client as LinearClient } from '@linear/sdk';
import Stripe from 'stripe';
import Twilio from 'twilio';
// ... hundreds more production-ready SDKs
```

#### 4. n8n and Zapier Compatibility

Both n8n (open source) and Zapier apps are JavaScript:

```typescript
// Could potentially import n8n node implementations directly
import { Slack } from 'n8n-nodes-base/nodes/Slack/Slack.node';
```

### What Python Does Better

Python has advantages in:

1. **AI/ML workloads** - Better LangChain, transformers, data processing
2. **Scientific computing** - NumPy, pandas for data analysis workflows
3. **Existing codebase** - Your 600+ tests and production-ready code

### Migration Strategy

**Recommended: Gradual Migration with TypeScript Core**

```
Phase 1: TypeScript Tool Layer
├── packages/tools/           # New TypeScript package
│   ├── src/
│   │   ├── slack/           # Direct SDK usage
│   │   ├── jira/            # Direct SDK usage
│   │   ├── gmail/           # Direct SDK usage
│   │   └── mcp/             # MCP server wrappers
│   └── package.json

Phase 2: TypeScript CLI
├── packages/cli/            # New TypeScript CLI
│   └── (replaces Python CLI)

Phase 3: Core Engine (Optional)
├── packages/core/           # Engine in TypeScript
│   └── (if Python overhead becomes issue)

Keep Python For:
├── src/marktoflow/agents/   # Agent adapters (work well in Python)
└── Complex ML workflows     # Keep using Python when needed
```

### Hybrid Architecture (Best of Both)

Use TypeScript for tools, keep Python for orchestration:

```
┌─────────────────────────────────────────────────────────┐
│                    marktoflow CLI                        │
│                    (TypeScript)                          │
└─────────────────────────┬───────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                  │
┌────────▼────────┐              ┌─────────▼─────────┐
│  Tool Layer     │              │  Agent Layer      │
│  (TypeScript)   │              │  (Python)         │
│                 │              │                   │
│  - Slack SDK    │   JSON-RPC   │  - Claude Code    │
│  - Jira SDK     │◄────────────►│  - OpenCode       │
│  - Gmail API    │              │  - Ollama         │
│  - MCP Servers  │              │                   │
└─────────────────┘              └───────────────────┘
```

### Quick Wins Without Full Rewrite

If you want to keep Python as primary, here's how to leverage npm packages:

```python
# src/marktoflow/tools/npm_bridge.py
import subprocess
import json

class NPMToolBridge:
    """Bridge to npm packages via JSON-RPC."""

    def __init__(self, package: str):
        self.package = package
        self.process = None

    async def start(self):
        """Start npm tool server."""
        self.process = subprocess.Popen(
            ['npx', self.package],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

    async def call(self, method: str, params: dict) -> dict:
        """Call method on npm tool."""
        request = json.dumps({
            'jsonrpc': '2.0',
            'method': method,
            'params': params,
            'id': 1
        })
        self.process.stdin.write(request.encode() + b'\n')
        self.process.stdin.flush()
        response = self.process.stdout.readline()
        return json.loads(response)
```

### Final Recommendation

**For your stated goals (easy tool integration, referencing other projects):**

| Goal | Best Choice |
|------|-------------|
| Pull in Jira, Slack, etc. easily | TypeScript |
| Reference existing projects | TypeScript (npm ecosystem is larger) |
| Avoid writing tools from scratch | TypeScript (more pre-built SDKs) |
| Keep existing tests/code | Python with TypeScript tool layer |

**My recommendation: Rewrite the tool layer in TypeScript while keeping the Python orchestration core, then gradually migrate as needed.** This gives you:

1. Immediate access to npm ecosystem (MCP servers, SDKs)
2. Preservation of existing Python test coverage
3. Flexibility to fully migrate later if desired

---

## Current State Assessment

### Strengths

1. **Robust Architecture**
   - Clean separation of concerns (parser, engine, agents, tools)
   - Multi-implementation tool support (MCP, OpenAPI, Custom)
   - Production-grade error handling (retry, circuit breaker, failover)

2. **Agent Flexibility**
   - Agent-agnostic workflow execution
   - Claude Code, OpenCode, and Ollama adapters implemented
   - Automatic failover between agents

3. **Comprehensive Feature Set**
   - Cron-based scheduling
   - Webhook receivers with signature verification
   - File system event triggers
   - Message queue integration (Redis, RabbitMQ)
   - State persistence and checkpointing
   - RBAC, audit logging, credential encryption

### Gaps Identified

1. **Tool Integration Complexity**
   - Users must manually configure OAuth credentials
   - No automated setup flow for common services
   - MCP servers referenced but not pre-installed

2. **Trigger Limitations**
   - Webhook receiver requires external exposure (ngrok, public IP)
   - No built-in email monitoring capability
   - No Slack Events API integration

3. **Onboarding Friction**
   - Multiple manual steps to connect first service
   - No guided setup wizard
   - Limited real-world examples

---

## Ease of Use Improvements

### 1. One-Command Tool Setup

**Current State:** Users must manually create OAuth apps, configure credentials, and set environment variables.

**Recommendation:** Implement `marktoflow connect <service>` command with interactive OAuth flow.

```bash
# Proposed command flow
marktoflow connect slack
# Opens browser for OAuth
# Automatically stores tokens in credential store
# Validates connection with test API call
# Outputs: "Slack connected! Available actions: send_message, create_channel, ..."

marktoflow connect gmail
# Opens Google OAuth consent screen
# Stores refresh token securely
# Sets up Gmail API scopes automatically
```

**Implementation Approach:**
```python
# src/marktoflow/integrations/oauth.py
class OAuthFlow:
    def __init__(self, service: str):
        self.service = service
        self.config = OAUTH_CONFIGS[service]

    async def start_flow(self) -> Credentials:
        # 1. Start local callback server
        # 2. Open browser to auth URL
        # 3. Receive callback with auth code
        # 4. Exchange for tokens
        # 5. Store in credential store
        pass
```

### 2. Workflow Template Wizard

**Current State:** `marktoflow workflow create` provides basic templates.

**Recommendation:** Add interactive wizard for common use cases.

```bash
marktoflow new
# ? What would you like to automate?
#   > Email triage
#   > Incident response
#   > Daily standup
#   > Custom workflow
#
# ? Which services will you use? (select multiple)
#   > Slack
#   > Gmail
#   > Jira
#   > GitHub
#
# ? What should trigger this workflow?
#   > Schedule (cron)
#   > Webhook
#   > Email received
#   > Slack message
```

### 3. Workflow Playground

**Current State:** Testing requires running full workflow execution.

**Recommendation:** Add dry-run mode with step-by-step visualization.

```bash
marktoflow test email-triage.md --dry-run
# Step 1: [SIMULATE] outlook.get_emails
#   Would fetch: 50 emails from Inbox
#   Mock output: [5 sample emails generated]
#
# Step 2: [SIMULATE] agent.analyze
#   Would categorize: 5 emails
#   Mock output: [categories assigned]
#
# Continue? [y/n]
```

### 4. Quick Start Presets

Add ready-to-use workflow bundles for common scenarios:

```
.marktoflow/
  quickstart/
    slack-notifications/        # Post to Slack on events
    email-to-jira/             # Convert emails to tickets
    github-pr-review/          # Auto-review PRs
    daily-digest/              # Aggregate daily updates
```

---

## Effectiveness Evaluation

### Claude Code CLI Efficiency

**Strengths:**
- Native MCP support eliminates bridge overhead
- Extended thinking mode for complex reasoning
- 200k context window for large workflows

**Optimization Recommendations:**

1. **Batch tool calls** - Group related operations to reduce API round-trips
2. **Use streaming** - Enable streaming for real-time progress feedback
3. **Leverage SDK mode** - Prefer SDK over CLI for production (better control, lower latency)

**Measured Considerations:**
- CLI mode adds subprocess overhead (~100-200ms per call)
- SDK mode provides direct API access with streaming
- MCP native support avoids bridge translation

### OpenCode Efficiency

**Strengths:**
- Backend-agnostic (works with Copilot, local models)
- Server mode provides lower latency (~2s vs ~5s for Zapier-style)
- No API key required (uses user's existing configuration)

**Optimization Recommendations:**

1. **Use server mode** - Start OpenCode server for persistent connections
2. **Local models for sensitive data** - Route confidential workflows to Ollama
3. **Parallel execution** - OpenCode handles concurrent requests well

**Comparison:**
| Aspect | Claude Code | OpenCode |
|--------|-------------|----------|
| Latency (CLI) | ~1-2s | ~2-3s |
| Latency (SDK/Server) | ~0.5-1s | ~1-2s |
| Context Window | 200k | Varies by backend |
| MCP Support | Native | Native |
| Cost | Per token | Free (Copilot) or local |

### Workflow Execution Patterns

**Most Efficient Patterns:**

1. **Conditional early exit** - Skip unnecessary steps based on conditions
2. **Parallel independent steps** - Execute non-dependent steps concurrently
3. **Agent-specific hints** - Provide agent-optimized prompts
4. **Checkpoint recovery** - Resume from failures without full restart

**Anti-patterns to Avoid:**

1. Large context accumulation without summarization
2. Sequential steps that could be parallel
3. Redundant API calls (cache where possible)
4. Over-prompting (let agents use native capabilities)

---

## Built-in Tool Integrations

### Recommended Tool Architecture

Based on research into MCP ecosystem and automation platforms:

```
marktoflow/
  integrations/
    __init__.py
    base.py              # Base integration class
    oauth.py             # OAuth flow handler

    slack/
      __init__.py
      mcp_server.py      # MCP server wrapper
      actions.py         # Direct API actions
      triggers.py        # Event subscriptions
      manifest.py        # Slack app manifest generator

    gmail/
      __init__.py
      mcp_server.py
      actions.py
      triggers.py        # Pub/Sub push notifications
      oauth.py           # Gmail-specific OAuth

    outlook/
      __init__.py
      mcp_server.py
      actions.py
      triggers.py        # Graph API subscriptions
      oauth.py           # Microsoft OAuth

    jira/
      __init__.py
      mcp_server.py
      actions.py
      triggers.py        # Jira webhooks
      oauth.py           # Atlassian OAuth
```

### Slack Integration

**Setup Approach:**

1. **Slack App Manifest** - Auto-generate `manifest.yaml` for required scopes
2. **OAuth Installation** - Handle OAuth flow with token storage
3. **Event Subscriptions** - Receive real-time events via Socket Mode

**Available Actions:**
```yaml
slack:
  actions:
    - send_message       # Post to channel/DM
    - create_channel     # Create public/private channel
    - invite_users       # Add users to channel
    - get_messages       # Fetch channel history
    - add_reaction       # React to message
    - upload_file        # Share file in channel
    - search_messages    # Search workspace
    - get_user_info      # Get user details
    - create_reminder    # Set reminder

  triggers:
    - message_received   # New message in channel
    - reaction_added     # Emoji reaction
    - app_mention        # @app mention
    - slash_command      # /command invocation
    - channel_created    # New channel
```

**Implementation:**
```python
# src/marktoflow/integrations/slack/actions.py
from slack_sdk import WebClient
from slack_sdk.socket_mode import SocketModeClient

class SlackIntegration:
    def __init__(self, bot_token: str, app_token: str = None):
        self.client = WebClient(token=bot_token)
        self.socket_client = SocketModeClient(
            app_token=app_token,
            web_client=self.client
        ) if app_token else None

    async def send_message(
        self,
        channel: str,
        text: str = None,
        blocks: list = None,
        thread_ts: str = None
    ) -> dict:
        """Send message to Slack channel."""
        return self.client.chat_postMessage(
            channel=channel,
            text=text,
            blocks=blocks,
            thread_ts=thread_ts
        )

    async def start_socket_mode(self, event_handler):
        """Start receiving real-time events."""
        self.socket_client.socket_mode_request_listeners.append(event_handler)
        self.socket_client.connect()
```

### Gmail Integration

**Setup Approach:**

1. **Google Cloud Project** - Provide instructions or automate setup
2. **OAuth Consent** - Handle OAuth 2.0 with refresh tokens
3. **Pub/Sub Push** - Receive new email notifications

**Available Actions:**
```yaml
gmail:
  actions:
    - get_messages       # List/search emails
    - get_message        # Get single email with body
    - send_email         # Send new email
    - reply_to_email     # Reply to thread
    - forward_email      # Forward to recipient
    - create_draft       # Save draft
    - add_label          # Apply label
    - archive            # Archive message
    - trash              # Move to trash
    - create_filter      # Create email filter

  triggers:
    - email_received     # New email in inbox
    - email_sent         # Email sent
    - label_added        # Label applied
```

**Push Notification Setup:**
```python
# src/marktoflow/integrations/gmail/triggers.py
from google.cloud import pubsub_v1

class GmailTrigger:
    def __init__(self, gmail_service, pubsub_topic: str):
        self.gmail = gmail_service
        self.topic = pubsub_topic

    async def setup_push(self) -> dict:
        """Enable push notifications for inbox changes."""
        request = {
            'labelIds': ['INBOX'],
            'topicName': self.topic
        }
        return self.gmail.users().watch(userId='me', body=request).execute()

    async def process_notification(self, message: dict):
        """Process Pub/Sub notification."""
        history_id = message.get('historyId')
        # Fetch changes since last history ID
        changes = self.gmail.users().history().list(
            userId='me',
            startHistoryId=history_id
        ).execute()
        return changes
```

### Outlook Integration

**Setup Approach:**

1. **Azure App Registration** - Create app with Graph API permissions
2. **OAuth Flow** - Microsoft identity platform OAuth
3. **Change Notifications** - Graph API webhooks

**Available Actions:**
```yaml
outlook:
  actions:
    - get_emails         # List/search emails
    - get_email          # Get email with body
    - send_email         # Send new email
    - reply              # Reply to email
    - forward            # Forward email
    - create_draft       # Save draft
    - move_email         # Move to folder
    - create_folder      # Create mail folder
    - get_calendar       # Get calendar events
    - create_event       # Create calendar event

  triggers:
    - email_received     # New email
    - calendar_event     # Calendar notification
```

**Graph API Integration:**
```python
# src/marktoflow/integrations/outlook/actions.py
from msgraph import GraphServiceClient

class OutlookIntegration:
    def __init__(self, credential):
        self.client = GraphServiceClient(credentials=credential)

    async def get_emails(
        self,
        folder: str = "inbox",
        filters: dict = None,
        limit: int = 50
    ) -> list:
        """Get emails from folder."""
        query_params = MessagesRequestBuilder.MessagesRequestBuilderGetQueryParameters(
            top=limit,
            filter=self._build_filter(filters),
            orderby=['receivedDateTime desc']
        )
        messages = await self.client.me.mail_folders.by_mail_folder_id(folder).messages.get(
            request_configuration=RequestConfiguration(
                query_parameters=query_params
            )
        )
        return messages.value
```

### Jira Integration

**Setup Approach:**

1. **Atlassian API Token** - Personal access token or OAuth app
2. **Webhook Registration** - Register for issue events
3. **Automation Rules** - Integrate with Jira Automation

**Available Actions:**
```yaml
jira:
  actions:
    - create_issue       # Create new issue
    - update_issue       # Update issue fields
    - transition_issue   # Change issue status
    - add_comment        # Add comment
    - assign_issue       # Assign to user
    - search_issues      # JQL search
    - get_issue          # Get issue details
    - add_attachment     # Attach file
    - link_issues        # Create issue link
    - get_project        # Get project info

  triggers:
    - issue_created      # New issue
    - issue_updated      # Issue modified
    - issue_transitioned # Status changed
    - comment_added      # New comment
```

### Leveraging MCP Ecosystem

The [MCP Registry](https://github.com/modelcontextprotocol/servers) provides pre-built servers. Recommendation:

1. **Reference MCP Servers** - Use official implementations where available
2. **Fallback to OpenAPI** - Generate from OpenAPI specs for unsupported services
3. **Custom Adapters** - Build only when necessary

**MCP Integration Pattern:**
```python
# src/marktoflow/integrations/mcp_loader.py
class MCPServerLoader:
    """Load and manage MCP servers for tool integrations."""

    KNOWN_SERVERS = {
        'slack': '@modelcontextprotocol/server-slack',
        'github': '@modelcontextprotocol/server-github',
        'filesystem': '@modelcontextprotocol/server-filesystem',
        'postgres': '@modelcontextprotocol/server-postgres',
    }

    async def ensure_installed(self, server_name: str) -> bool:
        """Ensure MCP server package is installed."""
        package = self.KNOWN_SERVERS.get(server_name)
        if not package:
            return False

        # Check if installed
        result = await run_command(f"npm list -g {package}")
        if result.returncode != 0:
            # Install package
            await run_command(f"npm install -g {package}")
        return True

    async def start_server(self, server_name: str, config: dict) -> MCPServer:
        """Start MCP server with configuration."""
        await self.ensure_installed(server_name)
        # Start and return server handle
        ...
```

---

## Trigger Mechanisms

### Current Trigger Types

| Type | Status | Implementation |
|------|--------|----------------|
| Schedule (cron) | Complete | `core/scheduler.py` |
| Webhook | Complete | `core/webhook.py` |
| File system | Complete | `core/filewatcher.py` |
| Message queue | Complete | `core/queue.py` |
| Manual | Complete | CLI command |

### Recommended Additional Triggers

#### 1. Email Trigger

**Challenge:** Email protocols (IMAP/POP3) require polling or complex push setup.

**Solution Options:**

**Option A: Email-to-Webhook Service (Recommended)**
Use services like [MailSlurp](https://www.mailslurp.com/guides/email-webhooks/), Mailgun, or Mailparser:

```yaml
triggers:
  - type: email
    provider: mailslurp
    address: "workflow-123@inbound.marktoflow.app"
    events:
      - received
    webhook_url: "https://your-server.com/webhooks/email"
```

**Option B: Gmail Push Notifications**
Using Google Pub/Sub:

```python
# src/marktoflow/triggers/gmail.py
class GmailTrigger:
    async def setup(self, workflow_id: str) -> str:
        """Set up Gmail push notifications."""
        # 1. Create Pub/Sub topic
        topic = f"marktoflow-{workflow_id}"

        # 2. Register Gmail watch
        watch_request = {
            'labelIds': ['INBOX'],
            'topicName': f'projects/{PROJECT}/topics/{topic}'
        }
        self.gmail.users().watch(userId='me', body=watch_request).execute()

        # 3. Subscribe to topic
        return topic
```

**Option C: Microsoft Graph API**
Change notifications for Outlook:

```python
# src/marktoflow/triggers/outlook.py
class OutlookTrigger:
    async def create_subscription(self, webhook_url: str) -> dict:
        """Create Graph API subscription for new emails."""
        subscription = {
            'changeType': 'created',
            'notificationUrl': webhook_url,
            'resource': '/me/mailFolders/inbox/messages',
            'expirationDateTime': (datetime.now() + timedelta(days=3)).isoformat(),
            'clientState': secrets.token_urlsafe(32)
        }
        return await self.client.subscriptions.post(subscription)
```

#### 2. Slack Message Trigger

**Implementation using Socket Mode:**

```python
# src/marktoflow/triggers/slack.py
from slack_sdk.socket_mode import SocketModeClient
from slack_sdk.socket_mode.request import SocketModeRequest
from slack_sdk.socket_mode.response import SocketModeResponse

class SlackTrigger:
    def __init__(self, app_token: str, bot_token: str):
        self.client = SocketModeClient(
            app_token=app_token,
            web_client=WebClient(token=bot_token)
        )

    async def start(self, event_handler: Callable):
        """Start listening for Slack events."""

        def process(client: SocketModeClient, req: SocketModeRequest):
            if req.type == "events_api":
                event = req.payload.get("event", {})

                # Acknowledge immediately
                client.send_socket_mode_response(
                    SocketModeResponse(envelope_id=req.envelope_id)
                )

                # Trigger workflow
                asyncio.create_task(event_handler(event))

        self.client.socket_mode_request_listeners.append(process)
        self.client.connect()
```

**Workflow Definition:**
```yaml
triggers:
  - type: slack
    events:
      - message         # Any message
      - app_mention     # @mention
      - reaction_added  # Emoji reaction
    channels:
      - "#support"      # Specific channels
    filters:
      contains: "urgent"
```

#### 3. GitHub Trigger

**Implementation using GitHub Webhooks:**

```yaml
triggers:
  - type: github
    events:
      - push
      - pull_request.opened
      - pull_request.closed
      - issues.opened
      - workflow_run.completed
    repository: "owner/repo"
    branches:
      - main
      - develop
```

**Webhook Handler:**
```python
# src/marktoflow/triggers/github.py
class GitHubTrigger:
    def verify_signature(self, payload: bytes, signature: str, secret: str) -> bool:
        """Verify GitHub webhook signature."""
        expected = 'sha256=' + hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected)

    async def handle_webhook(self, event_type: str, payload: dict) -> dict:
        """Process GitHub webhook event."""
        return {
            'event': event_type,
            'action': payload.get('action'),
            'repository': payload.get('repository', {}).get('full_name'),
            'sender': payload.get('sender', {}).get('login'),
            'payload': payload
        }
```

#### 4. Unified Trigger Manager

**Design:**

```python
# src/marktoflow/triggers/manager.py
class TriggerManager:
    """Unified manager for all trigger types."""

    def __init__(self):
        self.triggers: dict[str, BaseTrigger] = {}
        self.handlers: dict[str, Callable] = {}

    async def register_workflow_triggers(self, workflow: Workflow) -> list[str]:
        """Register all triggers for a workflow."""
        trigger_ids = []

        for trigger_config in workflow.triggers:
            trigger = self._create_trigger(trigger_config)
            trigger_id = f"{workflow.metadata.id}_{trigger_config.type}"

            self.triggers[trigger_id] = trigger
            await trigger.start(
                lambda event: self._handle_event(workflow, event)
            )
            trigger_ids.append(trigger_id)

        return trigger_ids

    def _create_trigger(self, config: TriggerConfig) -> BaseTrigger:
        """Factory for trigger types."""
        match config.type:
            case 'schedule':
                return ScheduleTrigger(config)
            case 'webhook':
                return WebhookTrigger(config)
            case 'email':
                return EmailTrigger(config)
            case 'slack':
                return SlackTrigger(config)
            case 'github':
                return GitHubTrigger(config)
            case _:
                raise ValueError(f"Unknown trigger type: {config.type}")
```

### Trigger Exposure Strategies

For triggers requiring external access (webhooks, push notifications):

#### Option 1: Built-in Tunnel (Development)

```python
# src/marktoflow/triggers/tunnel.py
class TunnelManager:
    """Manage secure tunnels for webhook exposure."""

    async def create_tunnel(self, local_port: int) -> str:
        """Create tunnel using ngrok or cloudflared."""
        # Try cloudflared first (free, no account needed)
        result = await run_command(
            f"cloudflared tunnel --url http://localhost:{local_port}"
        )
        # Parse and return public URL
        return url
```

#### Option 2: Hosted Webhook Receiver (Production)

Provide optional cloud service:

```yaml
# marktoflow.yaml
triggers:
  hosted_receiver:
    enabled: true
    api_key: "${MARKTOFLOW_CLOUD_KEY}"
    # Provides: https://hooks.marktoflow.io/your-org/workflow-id
```

#### Option 3: Self-Hosted Proxy

Docker-based proxy service:

```yaml
# docker-compose.yml
services:
  marktoflow-receiver:
    image: marktoflow/webhook-receiver:latest
    ports:
      - "8080:8080"
    environment:
      - MARKTOFLOW_SECRET=xxx
      - FORWARD_TO=http://host.docker.internal:9000
```

---

## Implementation Roadmap

### Phase 1: Core Integrations (Priority: High)

| Task | Effort | Dependencies |
|------|--------|--------------|
| OAuth flow handler | 2 weeks | None |
| Slack integration (actions + Socket Mode trigger) | 1 week | OAuth handler |
| Jira integration (actions + webhooks) | 1 week | OAuth handler |
| GitHub integration (actions + webhooks) | 1 week | OAuth handler |
| `marktoflow connect` command | 1 week | OAuth handler |

### Phase 2: Email & Advanced Triggers (Priority: Medium)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Gmail integration (OAuth + Pub/Sub) | 2 weeks | OAuth handler |
| Outlook integration (Graph API + subscriptions) | 2 weeks | OAuth handler |
| Email trigger abstraction | 1 week | Gmail/Outlook |
| Tunnel manager | 1 week | None |

### Phase 3: Developer Experience (Priority: Medium)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Workflow wizard (`marktoflow new`) | 1 week | Core integrations |
| Dry-run/playground mode | 2 weeks | None |
| Quick start presets | 1 week | Core integrations |
| Integration test suite | 2 weeks | All integrations |

### Phase 4: Scale & Polish (Priority: Low)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Visual workflow editor | 4+ weeks | All above |
| Hosted webhook service | 4+ weeks | Production infrastructure |
| Community marketplace | 4+ weeks | Plugin system |

---

## Appendix: Research Sources

### Automation Platform Architecture
- [n8n vs Zapier: The Ultimate Automation Tool Showdown](https://webspacekit.com/n8n-vs-zapier/)
- [Outgrowing Zapier, Make, and n8n for AI Agents](https://composio.dev/blog/outgrowing-make-zapier-n8n-ai-agents)
- [OpenAI AgentKit vs n8n vs Zapier: The Definitive Guide](https://inkeep.com/blog/openai-agentkit-vs-n8n-vs-zapier)

### Slack-Jira Integration
- [An easier way to use JIRA with Slack](https://slack.com/blog/productivity/an-easier-way-to-use-jira-with-slack)
- [Jira Slack Integration Guide 2025](https://www.bizdata360.com/jira-slack-integration/)
- [Use automation with Slack - Atlassian Documentation](https://confluence.atlassian.com/spaces/AUTOMATION/pages/993924688/Use+automation+with+Slack)

### Email Webhook Triggers
- [MailSlurp Email Webhooks Guide](https://www.mailslurp.com/guides/email-webhooks/)
- [Trigger Webhook when email is received - Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1373454/trigger-webhook-when-an-email-is-received)
- [Webhook Triggers for Event-Driven APIs](https://blog.dreamfactory.com/webhook-triggers-for-event-driven-apis)

### MCP (Model Context Protocol)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [Best MCP Servers in 2025](https://www.pomerium.com/blog/best-model-context-protocol-mcp-servers-in-2025)
- [One Year of MCP: November 2025 Spec Release](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
- [MCP Specification - Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

### Gmail API
- [Gmail OAuth 2.0 Mechanism](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol)
- [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2)
- [n8n Gmail Node Explained](https://automategeniushub.com/n8n-gmail-node-explained-setup-use-cases/)

---

## Conclusion

Marktoflow has a solid foundation for becoming a powerful automation framework. By implementing the recommendations in this document, particularly:

1. **One-command OAuth setup** for common services
2. **Pre-built Slack, Gmail, Outlook, Jira integrations** with MCP fallback
3. **Email and message triggers** via push notifications and Socket Mode
4. **Improved developer experience** with wizards and dry-run modes

...the framework can significantly reduce the barrier to entry and increase real-world effectiveness for users automating tasks with Claude Code and OpenCode.

The key insight from researching platforms like n8n and Zapier is that **ease of setup** is often more important than feature depth. Users abandon tools that require extensive manual configuration, even if those tools are more powerful. The recommendations here prioritize making the first automation successful within minutes, not hours.
