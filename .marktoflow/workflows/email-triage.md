---
# Workflow Metadata
workflow:
  id: email-triage
  version: "1.0.0"
  name: "Intelligent Email Triage"
  description: "Automatically categorize and route incoming emails"
  author: "marktoflow"

# Agent Compatibility
compatibility:
  min_version: "1.0.0"
  agents:
    - claude-code: recommended
    - opencode: supported
    - aider: partial

# Requirements
requirements:
  tools: [outlook, jira, slack]
  permissions: [email:read, email:write, jira:write, slack:write]
  features:
    - tool_calling: required
    - reasoning: recommended

# Execution Settings
execution:
  timeout: 300s
  max_retries: 3
  error_handling: continue

risk_level: low
estimated_duration: 2-5min
---

# Intelligent Email Triage Automation

Automatically categorizes, prioritizes, and routes customer emails using AI-powered analysis.

## Overview

This workflow processes incoming customer emails, categorizes them based on content and urgency, creates appropriate Jira tickets, and sends notifications to relevant teams.

---

## Trigger Configuration

```yaml
triggers:
  - type: schedule
    schedule: "*/30 9-17 * * 1-5"
    timezone: America/Chicago
    enabled: true
    
  - type: manual
    enabled: true
```

---

## Input Parameters

```yaml
inputs:
  inbox_folder:
    type: string
    default: "Inbox"
    description: Outlook folder to process
    
  max_emails:
    type: integer
    default: 50
    min: 1
    max: 100
    description: Maximum emails to process per run
    
  confidence_threshold:
    type: float
    default: 0.75
    description: Minimum confidence for automated actions
```

---

## Step 1: Fetch Unread Emails

**Objective**: Retrieve unread emails from Outlook inbox

```yaml
action: outlook.get_emails
inputs:
  folder: "{inputs.inbox_folder}"
  filters:
    unread: true
  limit: "{inputs.max_emails}"
  order_by: received_desc
  
output_variable: emails_list

on_error:
  - error_code: 401
    action: refresh_credentials
    retry: true
  - error_code: default
    action: log_and_continue
```

---

## Step 2: Categorize Emails

**Objective**: Analyze and categorize each email using AI

```yaml
action: agent.analyze
task: categorize_emails

categories:
  urgent_bug: "Production issues, critical failures, security incidents"
  feature_request: "New feature suggestions, enhancements"
  question: "Customer inquiries, clarifications needed"
  spam: "Marketing, unsolicited emails"
  escalation: "Complaints, legal matters"
  other: "Requires human review"

prompt_template: |
  Analyze the following email and categorize it.
  
  Subject: {email.subject}
  From: {email.from.name} <{email.from.email}>
  Body: {email.body}
  
  Determine:
  1. Category (from the list above)
  2. Urgency Score (1-10)
  3. Confidence (0.0-1.0)
  4. Brief reasoning

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
    reasoning:
      type: string

output_variable: categorized_emails
```

---

## Step 3: Handle Urgent Bugs

**Objective**: Create Jira tickets for urgent issues

```yaml
action: jira.create_issue
inputs:
  project: ENG
  issue_type: Bug
  priority: High
  summary: "{email.subject}"
  description: |
    ## Customer Report
    **From**: {email.from.name} ({email.from.email})
    **Received**: {email.received}
    **Urgency**: {email.urgency_score}/10
    
    ## Original Email
    {email.body}
    
  labels:
    - email-reported
    - auto-triaged

conditions:
  - email.category == "urgent_bug"
  - email.confidence >= 0.75

output_variable: jira_ticket
```

---

## Step 3.1: Notify Team

**Objective**: Send Slack notification for urgent bugs

```yaml
action: slack.send_message
inputs:
  channel: "#on-call"
  message: |
    :rotating_light: **Urgent Bug Reported**
    
    **Jira**: {jira_ticket.url}
    **Subject**: {email.subject}
    **Customer**: {email.from.email}
    **Urgency**: {email.urgency_score}/10

conditions:
  - email.urgency_score >= 7
  - jira_ticket.created == true
```

---

## Step 4: Handle Feature Requests

**Objective**: Create product backlog items

```yaml
action: jira.create_issue
inputs:
  project: PRODUCT
  issue_type: Story
  priority: Medium
  summary: "[Feature Request] {email.subject}"
  description: |
    ## Feature Request
    **From**: {email.from.name}
    **Date**: {email.received}
    
    ### Description
    {email.body}
    
  labels:
    - feature-request
    - email-source

conditions:
  - email.category == "feature_request"
```

---

## Step 5: Handle Questions

**Objective**: Draft responses for customer questions

```yaml
action: agent.generate_response
task: answer_question

inputs:
  question: "{email.subject}"
  context: "{email.body}"
  
  guidelines:
    - Answer directly and completely
    - Provide relevant resources
    - Keep concise (under 300 words)
    - Use professional tone

output_variable: answer_draft

conditions:
  - email.category == "question"
```

---

## Step 5.1: Create Draft Reply

```yaml
action: outlook.create_draft
inputs:
  reply_to: "{email.id}"
  body: "{answer_draft}"
  subject: "Re: {email.subject}"

conditions:
  - email.category == "question"
```

---

## Step 6: Archive Processed Emails

**Objective**: Move processed emails to appropriate folders

```yaml
action: outlook.move_email
inputs:
  email_id: "{email.id}"
  destination_folder: "Processed/{email.category}"
```

---

## Step 7: Generate Report

**Objective**: Create execution summary

```yaml
action: agent.generate_report
task: execution_summary

inputs:
  execution_data: "{workflow_context}"
  analysis_depth: standard
  
  include:
    - processing_statistics
    - categorization_breakdown
    - error_summary

output_file: ".marktoflow/state/execution-logs/{run_id}.md"
format: markdown
```

---

## Success Criteria

```yaml
success_conditions:
  - emails_processed >= emails_fetched * 0.95
  - errors_critical == 0
  - execution_time < timeout
```
