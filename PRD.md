# Product Requirements Document: Unified AI Workflow Automation Framework

## Executive Summary

A universal framework enabling AI coding agents (Claude Code, OpenCode, Aider, Cursor, and others) to function as intelligent automation platforms through standardized markdown-based workflow definitions, event triggers, and dynamic tool integration. This system provides a single, portable specification format that works across all major AI coding assistants while leveraging their unique strengths.

**Key Value Propositions**:
- **Write Once, Run Anywhere**: Single workflow definition works with any compatible AI agent
- **Best-of-Breed**: Choose the right agent for each task (Claude for reasoning, OpenCode for self-hosted, etc.)
- **Open Standards**: Built on MCP, OpenAPI, and industry standards
- **Gradual Migration**: Switch agents without rewriting workflows
- **Enterprise Ready**: Security, compliance, and audit from day one

---

## Vision & Goals

**Vision**: Create the first truly agent-agnostic automation framework that treats AI coding assistants as interchangeable execution engines, allowing organizations to choose tools based on their needs rather than vendor lock-in.

**Primary Goals**:
1. **Universal Compatibility**: Single workflow format that works with any AI agent
2. **Agent Selection Flexibility**: Switch between agents without workflow changes
3. **Standards-Based**: Leverage MCP, OpenAPI, JSON Schema for tool integration
4. **Progressive Enhancement**: Basic features work everywhere, advanced features use agent capabilities
5. **Production Grade**: Enterprise security, monitoring, and reliability from the start

**Success Metrics**:
- Support 3+ AI agents at launch (Claude Code, OpenCode, Aider)
- 95%+ workflow compatibility across agents
- <5 minute agent switching time
- Zero workflow rewrites when changing agents

---

## Architecture Overview

### **Three-Layer Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│         (Workflow Definitions - Agent Agnostic)                  │
│                                                                   │
│  • Markdown workflow specifications                              │
│  • Trigger definitions (schedule, webhook, event)               │
│  • Business logic in natural language                           │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Abstraction Layer                               │
│           (Universal Workflow Engine Core)                       │
│                                                                   │
│  • Workflow parser & validator                                  │
│  • Agent capability detection                                   │
│  • Execution orchestration                                      │
│  • State management                                             │
│  • Retry & error handling                                       │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Layer                                   │
│        (Pluggable Agent Adapters)                               │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Claude Code  │  │   OpenCode   │  │     Aider    │         │
│  │   Adapter    │  │   Adapter    │  │   Adapter    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Tool Layer                                     │
│         (Universal Tool Integration)                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────┐          │
│  │             MCP Bridge Layer                      │          │
│  │  • Native MCP (Claude Code)                       │          │
│  │  • MCP → Python adapter (OpenCode)               │          │
│  │  • MCP → Generic adapter (Others)                │          │
│  └──────────────────────────────────────────────────┘          │
│                       │                                          │
│  ┌──────────────────────────────────────────────────┐          │
│  │          OpenAPI / REST Integration              │          │
│  │  • Standard HTTP clients                         │          │
│  │  • OpenAPI spec parsing                          │          │
│  │  • OAuth 2.0 / API key auth                      │          │
│  └──────────────────────────────────────────────────┘          │
│                       │                                          │
│  ┌──────────────────────────────────────────────────┐          │
│  │          Custom Tool Adapters                    │          │
│  │  • Python-based adapters                         │          │
│  │  • Plugin system                                 │          │
│  │  • Community marketplace                         │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ▼
        ┌───────────────────┬───────────────────┬───────────────┐
        ▼                   ▼                   ▼               ▼
    ┌──────┐            ┌──────┐          ┌──────┐        ┌──────┐
    │ Jira │            │Email │          │Slack │        │GitHub│
    └──────┘            └──────┘          └──────┘        └──────┘
```

---

## Project Structure

```
project/
├── .aiworkflow/                       # Framework directory
│   ├── config.yaml                    # Global configuration
│   │
│   ├── agents/
│   │   ├── claude-code.yaml          # Claude Code configuration
│   │   ├── opencode.yaml             # OpenCode configuration
│   │   ├── aider.yaml                # Aider configuration
│   │   └── capabilities.yaml         # Agent capability matrix
│   │
│   ├── workflows/
│   │   ├── email-triage.md           # Universal workflow definitions
│   │   ├── jira-automation.md
│   │   ├── daily-standup.md
│   │   └── incident-response.md
│   │
│   ├── tools/
│   │   ├── registry.yaml             # Tool registry (all types)
│   │   │
│   │   ├── mcp/                      # MCP server configs
│   │   │   ├── jira.yaml
│   │   │   ├── outlook.yaml
│   │   │   └── slack.yaml
│   │   │
│   │   ├── openapi/                  # OpenAPI specs
│   │   │   ├── github.yaml
│   │   │   └── stripe.yaml
│   │   │
│   │   └── custom/                   # Custom adapters
│   │       ├── jira/
│   │       │   ├── adapter.py
│   │       │   ├── spec.yaml
│   │       │   └── README.md
│   │       └── salesforce/
│   │
│   ├── triggers/
│   │   ├── schedules.yaml            # Cron schedules
│   │   ├── webhooks.yaml             # Webhook listeners
│   │   └── events.yaml               # File/system events
│   │
│   ├── state/
│   │   ├── credentials/              # Encrypted credentials
│   │   │   ├── vault.encrypted       # Age/GPG encrypted
│   │   │   └── .gitignore
│   │   ├── execution-logs/           # Run history
│   │   │   └── 2025-01-21/
│   │   └── workflow-state/           # Persistent state
│   │
│   └── plugins/
│       ├── installed.yaml            # Installed plugins
│       └── community/                # Community plugins
│
├── aiworkflow.yaml                    # Main configuration (root)
├── .gitignore
├── docker-compose.yaml               # Optional: containerized deployment
└── README.md
```

---

## Universal Workflow Format

### **Core Principle: Agent-Agnostic Markdown**

Workflows are written in a standardized markdown format with YAML frontmatter and structured sections. The framework automatically adapts to the executing agent's capabilities.

### **Workflow Header** (Universal Metadata)

```yaml
---
# Universal Workflow Metadata
workflow:
  id: email-triage
  version: "1.3.0"
  name: "Email Triage Automation"
  description: "Automatically categorize and route incoming emails"
  author: "Scott"
  
# Agent Compatibility
compatibility:
  min_version: "1.0.0"
  agents:
    - claude-code: recommended    # Best reasoning capabilities
    - opencode: supported         # Fully compatible
    - aider: supported           # Basic support
    - cursor: experimental       # Limited testing
  
# Requirements
requirements:
  tools: [outlook, jira, slack]
  permissions: [email:read, email:write, jira:write, slack:write]
  features:
    - tool_calling: required
    - reasoning: recommended    # Uses if available
    - streaming: optional
    
# Execution Settings
execution:
  timeout: 300s
  max_retries: 3
  concurrency: sequential       # sequential | parallel
  error_handling: continue      # continue | stop | rollback
  
# Risk Assessment
risk_level: low                 # low | medium | high
estimated_duration: 2-5min
---
```

---

## Configuration Files

### **Main Configuration** (`aiworkflow.yaml`)

```yaml
version: "1.0"
framework: aiworkflow

# Active Agent Selection
agent:
  primary: claude-code           # Primary agent to use
  fallback: opencode            # Fallback if primary unavailable
  
  # Agent selection strategy
  selection_strategy: manual    # manual | auto | load_balanced
  
  # Auto-selection rules (when strategy = auto)
  auto_selection:
    - condition: workflow.requires.reasoning == true
      agent: claude-code
    - condition: deployment.type == self_hosted
      agent: opencode
    - condition: workflow.estimated_cost < 0.10
      agent: opencode
    - default: claude-code

# Execution Runtime
runtime:
  mode: local                   # local | docker | kubernetes
  python_version: "3.11"
  node_version: "20"
  
# Security
security:
  credential_store: age         # age | gpg | vault | env
  encryption_key_path: ~/.aiworkflow/keys/master.key
  vault_path: .aiworkflow/state/credentials/
  
  # Per-agent auth strategies
  auth_strategies:
    claude-code: anthropic_managed
    opencode: local_vault
    aider: local_vault

# Logging
logging:
  level: info
  destination: file
  format: markdown              # markdown | json | text
  retention_days: 30
  
  # Agent-specific logging
  per_agent_logs: true

# Tool Configuration
tools:
  discovery: auto               # auto | explicit
  timeout: 30s
  
  # Tool type priorities (in order)
  type_priority:
    - mcp                       # Try MCP first (if agent supports)
    - openapi                   # Then OpenAPI specs
    - custom                    # Finally custom adapters
  
  retry_policy:
    max_attempts: 3
    backoff: exponential
    initial_delay: 1s
    max_delay: 60s

# Workflow Defaults
workflows:
  max_concurrent: 5
  default_timeout: 300s
  state_persistence: enabled
  
# Monitoring
monitoring:
  enabled: true
  metrics_endpoint: http://localhost:9090
  alert_channels: [slack:#automation-alerts]
  
# Feature Flags
features:
  mcp_bridge: enabled           # MCP bridge for non-Claude agents
  auto_healing: enabled         # Auto-retry failed workflows
  progressive_rollout: enabled  # Gradual workflow updates
```

---

### **Agent Capability Matrix** (`.aiworkflow/agents/capabilities.yaml`)

```yaml
# Agent Capability Definitions
# Used by framework to optimize workflow execution

agents:
  claude-code:
    version: "1.0.0"
    provider: anthropic
    
    capabilities:
      # Core Features
      tool_calling: native
      reasoning: advanced       # Deep reasoning with thinking blocks
      streaming: supported
      code_execution: supported
      file_creation: supported
      
      # MCP Support
      mcp:
        native_support: true
        mcp_servers: auto_discovered
        
      # Advanced Features
      extended_reasoning: true  # Can use <thinking> blocks
      multi_turn: true
      context_window: 200000    # tokens
      web_search: native
      artifacts: supported
      
      # Authentication
      auth_method: anthropic_managed
      oauth_flows: [google, microsoft, github, slack]
      
    strengths:
      - Advanced reasoning and decision making
      - Natural language understanding
      - Context-aware responses
      - Native MCP integration
      
    limitations:
      - Cloud-only (no self-hosting)
      - API rate limits apply
      - Cost per workflow execution
      
  opencode:
    version: "0.1.0"
    provider: open_source
    
    capabilities:
      # Core Features
      tool_calling: supported
      reasoning: basic          # Standard LLM reasoning
      streaming: supported
      code_execution: supported
      file_creation: supported
      
      # MCP Support
      mcp:
        native_support: false
        mcp_servers: via_bridge  # Uses MCP bridge layer
        
      # Advanced Features
      extended_reasoning: model_dependent
      multi_turn: true
      context_window: model_dependent  # Varies by LLM
      web_search: via_tools
      artifacts: not_supported
      
      # Authentication
      auth_method: local_vault
      oauth_flows: [google, microsoft, github, slack]
      
      # Model Flexibility
      supported_models:
        - provider: openai
          models: [gpt-4, gpt-4-turbo, gpt-3.5-turbo]
        - provider: anthropic
          models: [claude-3-5-sonnet, claude-3-opus]
        - provider: ollama
          models: [llama3, codellama, mistral]
        - provider: custom
          models: [any]
          
    strengths:
      - Self-hosted deployment
      - Model flexibility (any LLM)
      - No vendor lock-in
      - Cost control (local models)
      
    limitations:
      - Requires infrastructure setup
      - MCP support through bridge
      - Reasoning quality depends on model
      
  aider:
    version: "0.40.0"
    provider: open_source
    
    capabilities:
      # Core Features
      tool_calling: limited
      reasoning: basic
      streaming: supported
      code_execution: supported
      file_creation: supported
      
      # MCP Support
      mcp:
        native_support: false
        mcp_servers: not_supported
        
      # Advanced Features
      extended_reasoning: false
      multi_turn: true
      context_window: model_dependent
      web_search: not_supported
      artifacts: not_supported
      
      # Authentication
      auth_method: api_keys_only
      oauth_flows: []
      
      # Model Support
      supported_models:
        - provider: openai
          models: [gpt-4, gpt-3.5-turbo]
        - provider: anthropic
          models: [claude-3-5-sonnet]
          
    strengths:
      - Excellent for code editing
      - Git integration
      - Fast iteration
      
    limitations:
      - Limited tool ecosystem
      - No MCP support
      - Focus on coding, not automation

# Capability-Based Routing
routing_rules:
  # Use Claude Code for workflows requiring advanced reasoning
  - if: workflow.requires.reasoning == "advanced"
    prefer: claude-code
    
  # Use OpenCode for self-hosted deployments
  - if: deployment.requirement == "self_hosted"
    prefer: opencode
    
  # Use OpenCode for cost-sensitive workflows
  - if: workflow.estimated_cost_per_run > 0.50
    prefer: opencode
    
  # Use Claude Code for MCP-heavy workflows
  - if: workflow.tools.filter(type="mcp").length > 3
    prefer: claude-code
```

---

## Universal Workflow Definition

### **Example: Email Triage Workflow** (`.aiworkflow/workflows/email-triage.md`)

```markdown
---
# Workflow Metadata (YAML Frontmatter)
workflow:
  id: email-triage
  version: "1.3.0"
  name: "Intelligent Email Triage"
  
compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported
    - aider: partial
    
requirements:
  tools: [outlook, jira, slack]
  features:
    - tool_calling: required
    - reasoning: recommended

execution:
  timeout: 300s
  error_handling: continue
  
risk_level: low
---

# Intelligent Email Triage Automation

Automatically categorizes, prioritizes, and routes customer emails using AI-powered analysis.

## Overview

This workflow processes incoming customer emails, categorizes them based on content and urgency, creates appropriate Jira tickets, and sends notifications to relevant teams. It demonstrates the framework's ability to handle complex decision-making across different AI agents.

---

## Trigger Configuration

```yaml
triggers:
  # Schedule-based (runs automatically)
  - type: schedule
    schedule: "*/30 9-17 * * 1-5"  # Every 30 min during work hours
    timezone: America/Chicago
    enabled: true
    
  # Webhook-based (triggered by events)
  - type: webhook
    path: /webhooks/email-received
    method: POST
    enabled: false
    
  # Manual (run on demand)
  - type: manual
    enabled: true
```

---

## Input Parameters

Define configurable parameters for the workflow:

```yaml
inputs:
  inbox_folder:
    type: string
    default: "Inbox"
    description: Outlook folder to process
    validation:
      pattern: "^[A-Za-z0-9/\\s-]+$"
    
  max_emails:
    type: integer
    default: 50
    min: 1
    max: 100
    description: Maximum emails to process per run
    
  confidence_threshold:
    type: float
    default: 0.75
    min: 0.0
    max: 1.0
    description: Minimum confidence for automated actions
    
  urgent_threshold_hours:
    type: integer
    default: 2
    description: Hours after which urgent emails trigger alerts
```

---

## Workflow Steps

### Step 1: Fetch Unread Emails

**Objective**: Retrieve unread emails from Outlook inbox

**Tool**: `outlook`  
**Operation**: `get_emails`

```yaml
action: outlook.get_emails
inputs:
  folder: "{inputs.inbox_folder}"
  filters:
    unread: true
  limit: "{inputs.max_emails}"
  order_by: received_desc
  
output_variable: emails_list

# Agent-specific optimizations
agent_hints:
  claude-code:
    # Claude can understand complex email structures
    include_metadata: full
    parse_html: true
    
  opencode:
    # OpenCode prefers simpler structures
    include_metadata: essential
    parse_html: false
```

**Expected Output Structure**:
```json
{
  "emails": [
    {
      "id": "AAMkAD...",
      "subject": "Payment processing error",
      "from": {
        "name": "John Customer",
        "email": "customer@example.com"
      },
      "received": "2025-01-21T14:23:00Z",
      "body": "Full email body...",
      "body_preview": "We're experiencing payment timeouts...",
      "importance": "high",
      "has_attachments": false
    }
  ],
  "count": 23,
  "fetch_time": "2025-01-21T14:30:00Z"
}
```

**Error Handling**:
```yaml
on_error:
  - error_code: 401
    action: refresh_credentials
    retry: true
    max_retries: 1
    
  - error_code: 429
    action: exponential_backoff
    initial_delay: 30s
    max_retries: 3
    
  - error_code: [500, 502, 503, 504]
    action: retry
    max_retries: 3
    backoff: exponential
    
  - error_code: default
    action: log_and_continue
    notify: slack:#automation-alerts
```

---

### Step 2: Intelligent Email Categorization

**Objective**: Analyze and categorize each email using AI reasoning

**Agent Task**: Analyze email content and make intelligent categorization decisions

This step adapts to the executing agent's capabilities:
- **Claude Code**: Uses advanced reasoning with confidence scoring
- **OpenCode**: Uses standard LLM reasoning with structured output
- **Aider**: Uses basic categorization with keyword matching

```yaml
# Agent-Adaptive Prompt Template
action: agent.analyze
task: categorize_emails

# Universal categories
categories:
  - urgent_bug: "Production issues, critical failures, security incidents"
  - feature_request: "New feature suggestions, enhancements"
  - question: "Customer inquiries, clarifications needed"
  - spam: "Marketing, unsolicited emails, automated notifications"
  - escalation: "Complaints, legal matters, executive concerns"
  - other: "Requires human review"

# Analysis prompt (adapts based on agent)
prompt_template: |
  Analyze each email and categorize it appropriately.
  
  {% if agent.capabilities.reasoning == 'advanced' %}
  Use deep reasoning to understand context, sentiment, and business impact.
  Provide detailed justification for your categorization.
  {% else %}
  Categorize based on content and keywords.
  Provide brief reasoning.
  {% endif %}
  
  For each email, determine:
  1. **Category**: Which category best fits?
  2. **Urgency Score** (1-10): How quickly does this need attention?
  3. **Confidence** (0.0-1.0): How confident are you?
  {% if agent.capabilities.reasoning == 'advanced' %}
  4. **Business Impact**: What's the potential business impact?
  5. **Sentiment Analysis**: customer_frustrated | neutral | customer_satisfied
  6. **Key Entities**: Extract important data (customer ID, order number, etc.)
  7. **Recommended Action**: What should be done?
  {% endif %}
  
  Email to analyze:
  - Subject: {email.subject}
  - From: {email.from.name} <{email.from.email}>
  - Received: {email.received}
  - Body: {email.body}
  
  {% if agent.name == 'claude-code' %}
  Return detailed JSON with full analysis.
  {% else %}
  Return JSON with essential fields only.
  {% endif %}

# Expected output format (adapts to agent)
output_schema:
  type: object
  required: [category, urgency_score, confidence]
  properties:
    category:
      type: string
      enum: [urgent_bug, feature_request, question, spam, escalation, other]
    urgency_score:
      type: integer
      minimum: 1
      maximum: 10
    confidence:
      type: number
      minimum: 0.0
      maximum: 1.0
    reasoning:
      type: string
    # Optional fields (advanced agents only)
    business_impact:
      type: string
    sentiment:
      type: string
      enum: [customer_frustrated, neutral, customer_satisfied]
    extracted_entities:
      type: object
    recommended_action:
      type: string

output_variable: categorized_emails
```

**Agent-Specific Processing**:

```python
# Framework automatically handles agent differences

if agent_name == "claude-code":
    # Claude uses native reasoning with full context
    result = claude.analyze_email(
        email=email,
        use_reasoning=True,
        include_sentiment=True,
        extract_entities=True
    )
    
elif agent_name == "opencode":
    # OpenCode uses selected model's capabilities
    result = opencode.analyze_email(
        email=email,
        model=config.model,
        structured_output=True
    )
    
elif agent_name == "aider":
    # Aider uses basic analysis
    result = aider.categorize_email(
        email=email,
        use_keywords=True,
        simple_scoring=True
    )
```

---

### Step 3: Execute Context-Aware Actions

**Objective**: Take appropriate actions based on categorization

The framework executes actions appropriate to each category with automatic fallbacks.

---

#### 3.1: Handle Urgent Bugs

For emails categorized as `urgent_bug` with `confidence >= 0.75`:

**3.1.1 Create Jira Ticket**

```yaml
action: jira.create_issue
inputs:
  project: ENG
  issue_type: Bug
  priority: |
    {% if email.urgency_score >= 9 %}Highest
    {% elif email.urgency_score >= 7 %}High
    {% else %}Medium{% endif %}
  
  summary: "{email.subject}"
  
  description: |
    ## Customer Report
    **Reported By**: {email.from.name} ({email.from.email})
    **Received**: {email.received}
    {% if email.sentiment %}**Sentiment**: {email.sentiment}{% endif %}
    
    ## Issue Details
    {% if email.extracted_entities.error_type %}
    **Error Type**: {email.extracted_entities.error_type}
    {% endif %}
    **Urgency Score**: {email.urgency_score}/10
    
    ## Original Email
    {email.body}
    
    {% if agent.name == 'claude-code' and email.business_impact %}
    ## AI Analysis
    **Business Impact**: {email.business_impact}
    **Reasoning**: {email.reasoning}
    **Confidence**: {email.confidence}
    {% endif %}
    
  labels:
    - email-reported
    - auto-triaged
    - "agent:{agent.name}"
    {% if email.extracted_entities.error_type %}
    - "{email.extracted_entities.error_type}"
    {% endif %}

output_variable: jira_ticket

# Error handling with fallbacks
fallback:
  on_failure: log_and_continue
  notification:
    channel: slack:#automation-errors
    message: "Failed to create Jira ticket for urgent email: {email.subject}"
```

**3.1.2 Notify Team**

```yaml
action: slack.send_message
inputs:
  channel: "#on-call"
  message: |
    🚨 **Urgent Bug Reported**
    
    **Jira**: {jira_ticket.url}
    **Subject**: {email.subject}
    **Customer**: {email.from.email}
    **Urgency**: {email.urgency_score}/10
    {% if email.sentiment %}**Sentiment**: {email.sentiment}{% endif %}
    
    {% if agent.name == 'claude-code' and email.reasoning %}
    **AI Assessment**: {email.reasoning}
    {% endif %}
    
    {% if email.urgency_score >= 9 %}
    @oncall-engineer - Immediate attention required
    {% endif %}
  
  priority: |
    {% if email.urgency_score >= 9 %}urgent
    {% else %}high{% endif %}

# Conditional execution
conditions:
  - email.urgency_score >= 7
  - jira_ticket.created == true
```

**3.1.3 Send Customer Acknowledgment**

```yaml
# Agent-adaptive response generation
action: agent.generate_response
task: draft_acknowledgment

inputs:
  context: |
    Draft a professional acknowledgment email for this bug report.
    
    Customer: {email.from.name}
    Issue: {email.subject}
    Jira Ticket: {jira_ticket.key}
    Urgency: {email.urgency_score}/10
    {% if email.sentiment %}Sentiment: {email.sentiment}{% endif %}
    
  tone: |
    {% if email.sentiment == 'customer_frustrated' %}
    Empathetic and apologetic
    {% else %}
    Professional and helpful
    {% endif %}
    
  requirements:
    - Acknowledge the issue
    - Provide ticket reference
    - Set expectations for response time
    - {% if agent.name == 'claude-code' %}
      Suggest workarounds if applicable
      {% endif %}
    - Keep under 200 words
    
  # Agent-specific hints
  agent_hints:
    claude-code:
      use_reasoning: true
      check_company_policies: true
    opencode:
      use_template: basic_acknowledgment
      keep_simple: true

output_variable: acknowledgment_draft

---

# Send or save draft based on urgency
action: outlook.send_reply
inputs:
  email_id: "{email.id}"
  body: "{acknowledgment_draft}"
  
  # Auto-send for critical issues, otherwise save as draft
  send_immediately: |
    {% if email.urgency_score >= 8 %}true
    {% else %}false{% endif %}

---

# Archive email
action: outlook.move_email
inputs:
  email_id: "{email.id}"
  destination_folder: "Processed/Urgent Bugs"
```

---

#### 3.2: Handle Feature Requests

For emails categorized as `feature_request`:

```yaml
# Agent-adaptive feature analysis
action: agent.analyze
task: evaluate_feature_request

inputs:
  email_body: "{email.body}"
  
  analysis_requirements:
    - core_feature_description
    - estimated_complexity: [low, medium, high]
    - similar_existing_features
    {% if agent.capabilities.reasoning == 'advanced' %}
    - business_value_assessment
    - strategic_alignment
    - implementation_considerations
    {% endif %}

output_variable: feature_analysis

---

action: jira.create_issue
inputs:
  project: PRODUCT
  issue_type: Story
  priority: |
    {% if feature_analysis.complexity == 'low' and agent.name == 'claude-code' and feature_analysis.business_value == 'high' %}
    High
    {% else %}
    Medium
    {% endif %}
  
  summary: "[Feature Request] {email.subject}"
  
  description: |
    ## Feature Request
    **Requested By**: {email.from.name} ({email.from.email})
    **Date**: {email.received}
    
    ### Customer Description
    {email.body}
    
    ### AI Analysis
    **Core Feature**: {feature_analysis.core_feature_description}
    **Estimated Complexity**: {feature_analysis.complexity}
    
    {% if agent.name == 'claude-code' %}
    **Business Value**: {feature_analysis.business_value_assessment}
    **Strategic Alignment**: {feature_analysis.strategic_alignment}
    **Similar Features**: {feature_analysis.similar_existing_features}
    {% endif %}
    
  labels:
    - feature-request
    - email-source
    - "{feature_analysis.complexity}-complexity"
    - "agent:{agent.name}"

---

action: outlook.move_email
inputs:
  email_id: "{email.id}"
  destination_folder: "Processed/Feature Requests"
```

---

#### 3.3: Handle Questions

For emails categorized as `question`:

```yaml
# Agent drafts intelligent response
action: agent.generate_response
task: answer_question

inputs:
  question: "{email.subject}"
  context: "{email.body}"
  sender: "{email.from.name}"
  
  guidelines:
    - Answer directly and completely
    - Provide relevant resources/links
    - Suggest next steps
    - Use friendly, professional tone
    - Keep concise (< 300 words)
    
  # Adapt to sender type
  internal: |
    {% if email.from.email matches '@company.com' %}true
    {% else %}false{% endif %}
  
  # Agent-specific instructions
  agent_instructions:
    claude-code: |
      Use your knowledge base to provide accurate answers.
      Reference company policies where relevant.
      Suggest helpful resources.
    
    opencode: |
      Provide clear, direct answers.
      Keep language simple.
      Avoid jargon for external users.

output_variable: answer_draft

---

# Create draft for review
action: outlook.create_draft
inputs:
  reply_to: "{email.id}"
  body: "{answer_draft}"
  subject: "Re: {email.subject}"

---

action: outlook.move_email
inputs:
  email_id: "{email.id}"
  destination_folder: "Needs Review/Drafts Ready"

---

action: outlook.add_flag
inputs:
  email_id: "{email.id}"
  flag_type: follow_up
  reminder_time: "+2 hours"
```

---

#### 3.4: Handle Spam

For emails categorized as `spam`:

```yaml
# Only auto-archive high-confidence spam
conditions:
  - email.category == "spam"
  - email.confidence >= 0.90

actions:
  - action: outlook.move_email
    inputs:
      email_id: "{email.id}"
      destination_folder: "Deleted Items"
  
  - action: outlook.mark_as_read
    inputs:
      email_id: "{email.id}"

# Low confidence spam → manual review
else:
  - action: outlook.move_email
    inputs:
      email_id: "{email.id}"
      destination_folder: "Needs Review/Possible Spam"
  
  - action: outlook.add_flag
    inputs:
      email_id: "{email.id}"
      flag_type: review_required
      note: "Low confidence spam detection: {email.confidence}"
```

---

### Step 4: Generate Execution Report

**Objective**: Create comprehensive execution summary

The report adapts to the executing agent's analysis capabilities:

```yaml
action: agent.generate_report
task: execution_summary

inputs:
  execution_data: "{workflow_context}"
  
  analysis_depth: |
    {% if agent.capabilities.reasoning == 'advanced' %}
    comprehensive  # Full trend analysis, insights, recommendations
    {% else %}
    standard       # Basic statistics and summary
    {% endif %}
  
  include:
    - processing_statistics
    - categorization_breakdown
    - performance_metrics
    - error_summary
    {% if agent.name == 'claude-code' %}
    - trend_analysis
    - pattern_detection
    - recommendations
    {% endif %}

output_file: ".aiworkflow/state/execution-logs/{run_id}.md"
format: markdown
```

**Report Template** (Agent-Adaptive):

```markdown
# Email Triage Execution Report

**Run ID**: {run_id}
**Timestamp**: {execution_timestamp}
**Duration**: {duration_seconds}s
**Agent**: {agent.name} {agent.version}

---

## Executive Summary

{summary_paragraph}

---

## Statistics

| Metric | Value |
|--------|-------|
| Total Emails | {total_emails} |
| Successfully Processed | {processed_count} ({success_rate}%) |
| Manual Review Required | {manual_review_count} |
| Average Confidence | {avg_confidence} |

---

## Categorization Breakdown

{% for category in categories %}
### {category.name}: {category.count} ({category.percentage}%)

{% for item in category.items %}
- **{item.jira_key}**: {item.subject} (Urgency: {item.urgency}/10)
{% endfor %}
{% endfor %}

---

{% if agent.name == 'claude-code' %}
## Trends & Insights

### Patterns Detected
{ai_detected_patterns}

### Recommendations
{ai_recommendations}
{% endif %}

---

## Performance Metrics

| Service | Calls | Errors | Avg Latency |
|---------|-------|--------|-------------|
| Outlook | {outlook_calls} | {outlook_errors} | {outlook_latency}ms |
| Jira | {jira_calls} | {jira_errors} | {jira_latency}ms |
| Slack | {slack_calls} | {slack_errors} | {slack_latency}ms |

---

## Next Scheduled Run

{next_run_time}
```

---

## Success Criteria

```yaml
success_conditions:
  # Universal criteria (all agents)
  - emails_processed >= emails_fetched * 0.95
  - errors_critical == 0
  - execution_time < timeout
  
  # Agent-specific criteria
  agent_specific:
    claude-code:
      - average_confidence >= 0.80
      - reasoning_quality_score >= 0.85
    
    opencode:
      - average_confidence >= 0.75
      - model_inference_time < 5s_per_email
      
quality_checks:
  - categorization_consistency: true
  - spam_false_positive_rate: < 0.05
  - urgent_response_time: < 300s
```

---

## Rollback & Recovery

```yaml
recovery:
  # Universal recovery strategies
  auto_recovery:
    - condition: step_timeout
      action: retry_with_increased_timeout
      max_retries: 2
      
    - condition: tool_unavailable
      action: try_alternative_tool
      fallback_order: [primary, secondary, manual_intervention]
      
    - condition: agent_error
      action: switch_to_fallback_agent
      fallback_agent: "{config.agent.fallback}"
  
  # State preservation
  state_management:
    save_on_failure: true
    resume_capability: true
    checkpoint_frequency: per_step
    
  # Manual recovery
  manual_intervention:
    notify: [slack:#automation-alerts, email:admin@company.com]
    provide_context: true
    enable_step_replay: true
```

---

## Agent Selection Logic

The framework automatically selects the best agent for each workflow based on:

```yaml
selection_criteria:
  # Reasoning Requirements
  - if: workflow.requires.advanced_reasoning
    prefer: claude-code
    reason: "Superior reasoning capabilities"
    
  # Cost Optimization
  - if: workflow.estimated_cost > 1.00 AND deployment.allows_self_hosted
    prefer: opencode
    reason: "Cost-effective for high-volume"
    
  # MCP Tool Count
  - if: workflow.tools.filter(type='mcp').count() > 3
    prefer: claude-code
    reason: "Native MCP support"
    
  # Self-Hosted Requirement
  - if: security.requires_self_hosted
    require: opencode
    reason: "Only self-hosted option"
    
  # Speed Requirements
  - if: workflow.execution.max_latency < 10s
    prefer: opencode
    use_model: gpt-4-turbo
    reason: "Fastest inference"
```

---

## Version History

### v1.3.0 (2025-01-21)
- Added universal agent compatibility
- Implemented agent-adaptive prompts
- Enhanced error handling with fallbacks
- Added automatic agent selection logic

### v1.2.0 (2025-01-15)
- Added confidence thresholds
- Improved categorization logic
- Added retry mechanisms

### v1.1.0 (2025-01-10)
- Added draft generation for questions
- Implemented basic error handling

### v1.0.0 (2025-01-05)
- Initial release
- Support for Claude Code and OpenCode
```

---

## Tool Integration Standards

### **Universal Tool Registry** (`.aiworkflow/tools/registry.yaml`)

```yaml
tools:
  # MCP-based tool (preferred for Claude Code)
  - name: jira
    versions:
      - type: mcp
        priority: 1
        package: "@modelcontextprotocol/server-jira"
        config_path: .aiworkflow/tools/mcp/jira.yaml
        agent_compatibility:
          claude-code: native
          opencode: via_bridge
          aider: not_supported
      
      - type: openapi
        priority: 2
        spec_path: .aiworkflow/tools/openapi/jira.yaml
        agent_compatibility:
          claude-code: supported
          opencode: native
          aider: supported
      
      - type: custom
        priority: 3
        adapter_path: .aiworkflow/tools/custom/jira/adapter.py
        agent_compatibility:
          claude-code: supported
          opencode: native
          aider: supported
    
    authentication:
      type: oauth2
      scopes: [read:jira-work, write:jira-work]
      
    rate_limits:
      requests_per_minute: 100
      burst: 10
      
  # REST API tool
  - name: github
    versions:
      - type: openapi
        priority: 1
        spec_url: https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.yaml
        agent_compatibility:
          claude-code: supported
          opencode: native
          aider: supported
      
      - type: custom
        priority: 2
        adapter_path: .aiworkflow/tools/custom/github/adapter.py
        agent_compatibility:
          claude-code: supported
          opencode: native
          aider: supported
    
    authentication:
      type: bearer_token
      token_env: GITHUB_TOKEN
      
  # Outlook (email)
  - name: outlook
    versions:
      - type: mcp
        priority: 1
        package: "@modelcontextprotocol/server-outlook"
        config_path: .aiworkflow/tools/mcp/outlook.yaml
        agent_compatibility:
          claude-code: native
          opencode: via_bridge
          aider: not_supported
      
      - type: openapi
        priority: 2
        spec_path: .aiworkflow/tools/openapi/microsoft-graph.yaml
        agent_compatibility:
          claude-code: supported
          opencode: native
          aider: supported
    
    authentication:
      type: oauth2
      provider: microsoft
      scopes: [Mail.ReadWrite, Mail.Send]
```

---

## MCP Bridge for Non-Claude Agents

### **Bridge Architecture**

```python
"""
MCP Bridge - Allows non-Claude agents to use MCP servers
Converts MCP protocol to standard function calls
"""

class MCPBridge:
    """
    Bridge layer between MCP servers and non-native agents
    """
    
    def __init__(self, mcp_server_config):
        self.server = self._initialize_mcp_server(mcp_server_config)
        self.tool_registry = {}
        
    def register_tools(self):
        """Discover and register all MCP tools"""
        tools = self.server.list_tools()
        
        for tool in tools:
            self.tool_registry[tool.name] = MCPToolAdapter(
                mcp_tool=tool,
                server=self.server
            )
    
    def call_tool(self, tool_name: str, parameters: dict) -> dict:
        """
        Call MCP tool and return standardized result
        
        Converts between:
        - MCP protocol format
        - Standard function call format
        """
        if tool_name not in self.tool_registry:
            raise ToolNotFoundError(f"Tool {tool_name} not found")
        
        adapter = self.tool_registry[tool_name]
        
        # Convert parameters to MCP format
        mcp_params = adapter.convert_params(parameters)
        
        # Call MCP server
        mcp_result = self.server.call_tool(tool_name, mcp_params)
        
        # Convert result to standard format
        standard_result = adapter.convert_result(mcp_result)
        
        return standard_result


class MCPToolAdapter:
    """Adapter for individual MCP tool"""
    
    def __init__(self, mcp_tool, server):
        self.mcp_tool = mcp_tool
        self.server = server
        self.schema = self._parse_schema(mcp_tool.input_schema)
    
    def convert_params(self, params: dict) -> dict:
        """Convert standard params to MCP format"""
        return {
            "arguments": params
        }
    
    def convert_result(self, mcp_result) -> dict:
        """Convert MCP result to standard format"""
        return {
            "success": not mcp_result.is_error,
            "data": mcp_result.content,
            "metadata": {
                "tool": self.mcp_tool.name,
                "server": self.server.name
            }
        }
    
    def to_function_schema(self) -> dict:
        """
        Convert MCP tool schema to OpenAI function format
        
        Allows OpenCode/other agents to understand the tool
        """
        return {
            "name": self.mcp_tool.name,
            "description": self.mcp_tool.description,
            "parameters": self.schema
        }
```

---

## Agent Adapters

### **Claude Code Adapter**

```python
"""
Claude Code adapter - Native MCP support
"""

class ClaudeCodeAdapter(AgentAdapter):
    """Adapter for Claude Code"""
    
    def __init__(self, config):
        super().__init__(config)
        self.client = anthropic.Anthropic(api_key=config.api_key)
        
    def execute_workflow_step(self, step: WorkflowStep, context: dict):
        """Execute a workflow step using Claude"""
        
        # Claude uses native MCP - no conversion needed
        tools = self._get_mcp_tools(step.required_tools)
        
        # Build messages with context
        messages = self._build_messages(step, context)
        
        # Call Claude with native MCP tools
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=tools,  # MCP tools directly
            messages=messages
        )
        
        # Process tool use
        result = self._process_response(response)
        
        return result
    
    def supports_feature(self, feature: str) -> bool:
        """Check Claude-specific features"""
        features = {
            "mcp_native": True,
            "extended_reasoning": True,
            "web_search": True,
            "artifacts": True
        }
        return features.get(feature, False)
```

### **OpenCode Adapter**

```python
"""
OpenCode adapter - Uses MCP bridge for compatibility
"""

class OpenCodeAdapter(AgentAdapter):
    """Adapter for OpenCode"""
    
    def __init__(self, config):
        super().__init__(config)
        self.model = config.model
        self.mcp_bridge = MCPBridge(config.mcp_servers)
        
    def execute_workflow_step(self, step: WorkflowStep, context: dict):
        """Execute workflow step using OpenCode"""
        
        # Convert MCP tools to function definitions
        tools = []
        for tool_name in step.required_tools:
            tool_config = self._get_tool_config(tool_name)
            
            if tool_config.type == "mcp":
                # Use MCP bridge
                mcp_tool = self.mcp_bridge.get_tool(tool_name)
                function_schema = mcp_tool.to_function_schema()
                tools.append(function_schema)
            else:
                # Native support (OpenAPI, custom)
                tools.append(tool_config.function_schema)
        
        # Build prompt
        prompt = self._build_prompt(step, context)
        
        # Call OpenCode (via OpenAI-compatible API)
        response = self._call_model(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            tools=tools,
            tool_choice="auto"
        )
        
        # Execute tool calls
        if response.tool_calls:
            tool_results = []
            for tool_call in response.tool_calls:
                result = self._execute_tool(tool_call)
                tool_results.append(result)
            
            return self._synthesize_results(tool_results)
        
        return response.content
    
    def _execute_tool(self, tool_call):
        """Execute a tool call (may use MCP bridge)"""
        tool_name = tool_call.function.name
        params = json.loads(tool_call.function.arguments)
        
        tool_config = self._get_tool_config(tool_name)
        
        if tool_config.type == "mcp":
            # Route through MCP bridge
            return self.mcp_bridge.call_tool(tool_name, params)
        else:
            # Direct execution
            return self.tool_executor.execute(tool_name, params)
```

---

## CLI Interface

### **Universal Commands**

```bash
# Initialize workflow project
aiworkflow init
# Creates .aiworkflow/ directory with config templates

# Configure agents
aiworkflow agent add claude-code
aiworkflow agent add opencode --model gpt-4
aiworkflow agent add aider

aiworkflow agent list
aiworkflow agent set-primary claude-code

# Workflow management
aiworkflow workflow validate email-triage.md
aiworkflow workflow test email-triage.md --agent opencode --dry-run
aiworkflow workflow run email-triage.md
aiworkflow workflow run email-triage.md --agent opencode  # Override

# Deploy with scheduling
aiworkflow workflow deploy email-triage.md
aiworkflow workflow pause email-triage
aiworkflow workflow resume email-triage

# View logs
aiworkflow logs list
aiworkflow logs show email-triage --last 7d
aiworkflow logs show --run-id et-20250121-093000

# Tool management
aiworkflow tools list
aiworkflow tools install jira
aiworkflow tools test jira
aiworkflow tools configure jira --type mcp

# Agent comparison
aiworkflow compare-agents email-triage.md
# Output: Cost, speed, quality comparison across agents

# Credentials
aiworkflow credentials add jira_oauth
aiworkflow credentials list
aiworkflow credentials test jira_oauth

# Monitoring
aiworkflow status
aiworkflow metrics --last 7d
aiworkflow health-check
```

---

## Deployment Options

### **Option 1: Local Development**

```bash
# Install framework
pip install aiworkflow

# Initialize project
cd my-automation-project
aiworkflow init

# Add agents
aiworkflow agent add claude-code
aiworkflow agent add opencode --model ollama/llama3

# Run workflows
aiworkflow workflow run email-triage.md
```

### **Option 2: Docker Deployment**

```yaml
# docker-compose.yaml
version: '3.8'

services:
  aiworkflow:
    image: aiworkflow:latest
    environment:
      # Agent configs
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      
      # Tool credentials
      - JIRA_CLIENT_ID=${JIRA_CLIENT_ID}
      - JIRA_CLIENT_SECRET=${JIRA_CLIENT_SECRET}
      
      # Primary agent
      - AIWORKFLOW_PRIMARY_AGENT=claude-code
      - AIWORKFLOW_FALLBACK_AGENT=opencode
      
    volumes:
      - ./workflows:/app/.aiworkflow/workflows
      - ./state:/app/.aiworkflow/state
      - ./logs:/app/.aiworkflow/logs
    
    restart: unless-stopped
    
  # Optional: Local LLM for OpenCode
  ollama:
    image: ollama/ollama
    volumes:
      - ollama-data:/root/.ollama
    ports:
      - "11434:11434"

volumes:
  ollama-data:
```

### **Option 3: Kubernetes**

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aiworkflow
spec:
  replicas: 2
  selector:
    matchLabels:
      app: aiworkflow
  template:
    metadata:
      labels:
        app: aiworkflow
    spec:
      containers:
      - name: aiworkflow
        image: aiworkflow:latest
        env:
        - name: AIWORKFLOW_PRIMARY_AGENT
          value: "claude-code"
        - name: AIWORKFLOW_FALLBACK_AGENT
          value: "opencode"
        
        # Load balancing across agents
        - name: AIWORKFLOW_LOAD_BALANCE
          value: "true"
        
        volumeMounts:
        - name: workflows
          mountPath: /app/.aiworkflow/workflows
        - name: credentials
          mountPath: /app/.aiworkflow/state/credentials
          readOnly: true
        
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
      
      volumes:
      - name: workflows
        configMap:
          name: workflow-definitions
      - name: credentials
        secret:
          secretName: aiworkflow-credentials
```

---

## Agent Switching & Migration

### **Zero-Downtime Agent Switching**

```yaml
# Switch primary agent
agent_migration:
  from: claude-code
  to: opencode
  
  strategy: blue_green  # blue_green | canary | instant
  
  # Blue-green deployment
  blue_green:
    # Run both agents in parallel
    parallel_execution: true
    duration: 24h
    
    # Compare results
    validation:
      compare_outputs: true
      quality_threshold: 0.95
      
    # Auto-rollback if quality drops
    auto_rollback:
      enabled: true
      threshold: 0.90
  
  # Canary deployment
  canary:
    initial_percentage: 10
    increment: 20
    interval: 6h
    success_rate_threshold: 0.95
```

### **Migration Checklist**

```markdown
# Agent Migration Checklist

## Pre-Migration
- [ ] Test workflow with new agent in dev environment
- [ ] Verify all required tools are compatible
- [ ] Check credential compatibility
- [ ] Review cost implications
- [ ] Set up monitoring for new agent

## During Migration
- [ ] Enable parallel execution
- [ ] Monitor quality metrics
- [ ] Compare outputs between agents
- [ ] Watch for errors and warnings
- [ ] Keep rollback plan ready

## Post-Migration
- [ ] Verify all workflows running successfully
- [ ] Compare performance metrics
- [ ] Review cost savings (if applicable)
- [ ] Update documentation
- [ ] Disable old agent (after cooldown period)
```

---

## Security & Compliance

### **Universal Security Model**

```yaml
security:
  # Credential Management
  credentials:
    storage:
      claude-code: anthropic_managed
      opencode: local_vault_encrypted
      aider: local_vault_encrypted
    
    encryption:
      algorithm: age
      key_derivation: argon2id
      key_location: ~/.aiworkflow/keys/master.key
    
    rotation:
      enabled: true
      frequency: 90_days
      alert_before_expiry: 7_days
  
  # Access Control
  rbac:
    enabled: true
    roles:
      - name: admin
        permissions: [read, write, execute, configure, delete]
      
      - name: developer
        permissions: [read, write, execute]
      
      - name: viewer
        permissions: [read]
    
    workflow_permissions:
      email-triage:
        allowed_users: [admin, developer]
        allowed_groups: [engineering, support]
  
  # Approval Gates
  approvals:
    - operation_pattern: "*.delete_*"
      required_approvers: 1
      approver_roles: [admin]
      timeout: 1h
      
    - operation_pattern: "*.send_email"
      condition: "recipient_count > 10"
      required_approvers: 1
      approver_roles: [admin, manager]
      
  # Audit Logging
  audit:
    enabled: true
    log_level: detailed
    
    events:
      - workflow_started
      - workflow_completed
      - workflow_failed
      - tool_called
      - credential_accessed
      - approval_requested
      - approval_granted
      - agent_switched
    
    retention:
      standard: 90_days
      compliance: 7_years
    
    export:
      formats: [json, csv, syslog]
      destinations:
        - type: s3
          bucket: aiworkflow-audit-logs
        - type: splunk
          index: aiworkflow
```

---

## Monitoring & Observability

### **Multi-Agent Monitoring**

```yaml
monitoring:
  # Metrics Collection
  metrics:
    enabled: true
    collection_interval: 30s
    
    # Per-agent metrics
    agent_metrics:
      - workflow_execution_count
      - workflow_success_rate
      - average_execution_time
      - tool_call_count
      - error_rate
      - cost_per_execution
      - quality_score
    
    # Tool metrics
    tool_metrics:
      - api_call_count
      - api_error_rate
      - api_latency
      - rate_limit_hits
    
    # Business metrics
    business_metrics:
      - emails_processed
      - tickets_created
      - customer_response_time
      - automation_savings
  
  # Dashboards
  dashboards:
    - name: Agent Comparison
      metrics:
        - agent_execution_time_comparison
        - agent_cost_comparison
        - agent_quality_comparison
        - agent_error_rate_comparison
    
    - name: Workflow Health
      metrics:
        - workflow_success_rate_by_agent
        - workflow_execution_trends
        - tool_performance
        - error_breakdown
    
    - name: Business Impact
      metrics:
        - automation_coverage
        - time_saved
        - cost_savings
        - customer_satisfaction_impact
  
  # Alerting
  alerts:
    - name: agent_error_spike
      condition: error_rate > 0.10
      window: 5m
      severity: warning
      channels: [slack:#automation-alerts]
      
    - name: workflow_failure
      condition: workflow.status == failed
      severity: error
      channels: [slack:#on-call, pagerduty]
      
    - name: cost_threshold_exceeded
      condition: daily_cost > 100
      severity: warning
      channels: [email:finance@company.com]
      
    - name: agent_performance_degradation
      condition: |
        current_agent.avg_quality < 
        historical_avg_quality * 0.90
      window: 1h
      severity: warning
      action: trigger_agent_switch_evaluation
```

---

## Cost Optimization

### **Multi-Agent Cost Management**

```yaml
cost_optimization:
  # Per-agent cost tracking
  cost_tracking:
    enabled: true
    
    agent_costs:
      claude-code:
        model: claude-sonnet-4-20250514
        input_cost_per_1k: 0.003
        output_cost_per_1k: 0.015
        
      opencode:
        model: gpt-4
        input_cost_per_1k: 0.03
        output_cost_per_1k: 0.06
        
        # Or local model (no API cost)
        local_model: ollama/llama3
        cost_per_run: 0.00  # Infrastructure cost amortized
  
  # Cost-based routing
  routing_rules:
    - condition: estimated_cost > 0.50
      prefer: opencode
      reason: "More cost-effective for expensive workflows"
      
    - condition: workflow.priority == low AND deployment.allows_local
      require: opencode
      use_model: ollama/llama3
      reason: "Use local model for low-priority tasks"
      
    - condition: time_of_day in [22:00-06:00] AND priority != urgent
      prefer: opencode
      use_model: ollama/llama3
      reason: "Use local models for off-peak processing"
  
  # Budget limits
  budgets:
    - scope: daily
      limit: 100.00
      currency: USD
      action_on_exceed: switch_to_local_models
      
    - scope: monthly
      limit: 2000.00
      currency: USD
      alert_threshold: 0.80
      action_on_exceed: require_approval
  
  # Cost reporting
  reporting:
    frequency: daily
    recipients: [finance@company.com, engineering-leads@company.com]
    include:
      - cost_by_agent
      - cost_by_workflow
      - cost_trends
      - optimization_recommendations
```

---

## Testing & Quality Assurance

### **Cross-Agent Testing**

```yaml
testing:
  # Test across multiple agents
  cross_agent_testing:
    enabled: true
    
    agents_to_test:
      - claude-code
      - opencode
      
    comparison_metrics:
      - output_quality
      - execution_time
      - cost
      - error_rate
  
  # Test suites
  test_suites:
    - name: email-triage-tests
      workflow: email-triage.md
      
      fixtures:
        - name: urgent_bug
          file: fixtures/urgent-bug.json
          expected_category: urgent_bug
          expected_confidence: ">= 0.85"
          
        - name: spam_email
          file: fixtures/spam.json
          expected_category: spam
          expected_confidence: ">= 0.90"
      
      # Test with each agent
      test_with_agents: [claude-code, opencode]
      
      # Acceptance criteria
      acceptance:
        min_success_rate: 0.95
        max_execution_time: 60s
        max_cost_per_run: 0.25
        
        # Agent-specific criteria
        agent_criteria:
          claude-code:
            min_reasoning_quality: 0.85
          opencode:
            max_inference_time: 10s
  
  # Integration tests
  integration_tests:
    - name: end_to_end_with_real_tools
      workflow: email-triage.md
      use_real_tools: true  # Not mocked
      test_environments: [staging]
      
      validation:
        - jira_ticket_created
        - slack_message_sent
        - email_moved_to_folder
```

---

## Roadmap

### **Phase 1: Foundation (Month 1-2)**

**Core Framework**
- [x] Universal workflow parser
- [x] Agent adapter system
- [x] MCP bridge for OpenCode
- [x] Basic tool registry
- [ ] CLI implementation

**Agent Support**
- [x] Claude Code adapter
- [x] OpenCode adapter
- [ ] Aider adapter

**Tools**
- [x] Jira integration
- [x] Email (Outlook) integration
- [x] Slack integration

### **Phase 2: Production Ready (Month 3-4)**

**Automation**
- [ ] Scheduling system
- [ ] Webhook receivers
- [ ] Event triggers

**Reliability**
- [ ] Error recovery
- [ ] State management
- [ ] Rollback capabilities

**Monitoring**
- [ ] Metrics collection
- [ ] Agent comparison dashboards
- [ ] Cost tracking

### **Phase 3: Enterprise (Month 5-6)**

**Security**
- [ ] RBAC implementation
- [ ] Approval workflows
- [ ] Audit logging
- [ ] Compliance reporting

**Optimization**
- [ ] Agent auto-selection
- [ ] Cost optimization
- [ ] Performance tuning

**Ecosystem**
- [ ] Plugin marketplace
- [ ] Workflow templates
- [ ] Community tools

---

## Success Metrics

### **Technical Metrics**

```yaml
technical_kpis:
  agent_compatibility:
    target: ">= 95% workflow compatibility across agents"
    measurement: percentage of workflows running on both agents
    
  execution_reliability:
    target: ">= 99% success rate"
    measurement: successful_runs / total_runs
    
  performance:
    target: "<= 2x slowdown vs native agent execution"
    measurement: framework_overhead / native_execution_time
    
  agent_switching:
    target: "<= 5 minutes to switch primary agent"
    measurement: time_to_switch_agents
```

### **Business Metrics**

```yaml
business_kpis:
  cost_savings:
    target: ">= 40% cost reduction vs single-agent"
    measurement: multi_agent_cost / single_agent_cost
    
  vendor_independence:
    target: "Zero workflow rewrites when switching agents"
    measurement: workflows_requiring_changes / total_workflows
    
  automation_coverage:
    target: ">= 80% of manual tasks automated"
    measurement: automated_tasks / total_tasks
```

---

## Conclusion

The Unified AI Workflow Automation Framework provides the first truly agent-agnostic automation platform, enabling organizations to:

1. **Write workflows once**, run on any AI agent
2. **Switch agents freely** without code changes
3. **Optimize costs** by choosing the right agent for each task
4. **Avoid vendor lock-in** through open standards
5. **Scale confidently** with enterprise-grade security and monitoring

By treating AI coding assistants as interchangeable execution engines, organizations gain flexibility, reduce costs, and future-proof their automation investments.

---

**End of Unified PRD**
