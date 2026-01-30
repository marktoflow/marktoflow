import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from '../src/engine.js';
import { parseContent } from '../src/parser.js';
import { SDKRegistry } from '../src/sdk-registry.js';
import { WorkflowStatus, StepStatus } from '../src/models.js';

describe('End-to-End Workflow Tests', () => {
  describe('Slack to Jira Integration', () => {
    it('should create Jira issue from Slack message', async () => {
      const workflowContent = `---
workflow:
  id: slack-to-jira
  name: "Slack to Jira"
  description: "Create Jira issues from Slack messages"

tools:
  slack:
    sdk: "@slack/web-api"
    auth:
      token: "\${SLACK_TOKEN}"
  
  jira:
    sdk: "jira.js"
    auth:
      host: "company.atlassian.net"
      email: "\${JIRA_EMAIL}"
      token: "\${JIRA_API_TOKEN}"

inputs:
  channel:
    type: string
    required: true
  message_ts:
    type: string
    required: true

steps:
  - id: get_message
    action: slack.conversations.history
    inputs:
      channel: "{{inputs.channel}}"
      latest: "{{inputs.message_ts}}"
      limit: 1
    output_variable: slack_message
  
  - id: create_issue
    action: jira.issues.createIssue
    inputs:
      fields:
        project:
          key: "SUP"
        summary: "Support Request from Slack"
        description: "{{slack_message.messages[0].text}}"
        issuetype:
          name: "Task"
    output_variable: jira_issue
  
  - id: notify_slack
    action: slack.chat.postMessage
    inputs:
      channel: "{{inputs.channel}}"
      thread_ts: "{{inputs.message_ts}}"
      text: "Created Jira issue: {{jira_issue.key}}"
---

# Slack to Jira Workflow

This workflow monitors Slack messages and creates Jira issues.
`;

      const { workflow } = parseContent(workflowContent);

      const mockSlackMessage = {
        messages: [
          {
            text: 'Bug: Login page is broken',
            user: 'U123456',
            ts: '1234567890.123456',
          },
        ],
      };

      const mockJiraIssue = {
        id: '10001',
        key: 'SUP-123',
        self: 'https://company.atlassian.net/rest/api/2/issue/10001',
      };

      const mockSlackResponse = {
        ok: true,
        ts: '1234567891.123457',
      };

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockSlackMessage)
        .mockResolvedValueOnce(mockJiraIssue)
        .mockResolvedValueOnce(mockSlackResponse);

      const mockSDKRegistry = new SDKRegistry({
        async load() {
          return {};
        },
      });

      const engine = new WorkflowEngine();
      const result = await engine.execute(
        workflow,
        { channel: 'C123456', message_ts: '1234567890.123456' },
        mockSDKRegistry,
        mockExecutor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(3);
      expect((result.output.jira_issue as any).key).toBe('SUP-123');

      // Verify the notification included the Jira issue key
      expect(mockExecutor).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          inputs: expect.objectContaining({
            text: 'Created Jira issue: SUP-123',
          }),
        }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('GitHub PR Review Workflow', () => {
    it('should post PR review results to Slack', async () => {
      const workflowContent = `---
workflow:
  id: pr-review-notification
  name: "PR Review Notification"

tools:
  github:
    sdk: "@octokit/rest"
    auth:
      token: "\${GITHUB_TOKEN}"
  
  slack:
    sdk: "@slack/web-api"
    auth:
      token: "\${SLACK_TOKEN}"

inputs:
  repo_owner:
    type: string
    required: true
  repo_name:
    type: string
    required: true
  pr_number:
    type: number
    required: true

steps:
  - id: get_pr
    action: github.pulls.get
    inputs:
      owner: "{{inputs.repo_owner}}"
      repo: "{{inputs.repo_name}}"
      pull_number: "{{inputs.pr_number}}"
    output_variable: pr_data
  
  - id: get_reviews
    action: github.pulls.listReviews
    inputs:
      owner: "{{inputs.repo_owner}}"
      repo: "{{inputs.repo_name}}"
      pull_number: "{{inputs.pr_number}}"
    output_variable: reviews
  
  - id: notify_slack
    action: slack.chat.postMessage
    inputs:
      channel: "#dev-team"
      text: "PR #{{pr_data.number}}: {{pr_data.title}} has {{reviews.length}} reviews"
      blocks:
        - type: "section"
          text:
            type: "mrkdwn"
            text: "*<{{pr_data.html_url}}|PR #{{pr_data.number}}>*: {{pr_data.title}}"
---
`;

      const { workflow } = parseContent(workflowContent);

      const mockPR = {
        number: 42,
        title: 'Add new feature',
        html_url: 'https://github.com/test/repo/pull/42',
        state: 'open',
      };

      const mockReviews = [
        { id: 1, user: { login: 'reviewer1' }, state: 'APPROVED' },
        { id: 2, user: { login: 'reviewer2' }, state: 'CHANGES_REQUESTED' },
      ];

      const mockSlackResponse = {
        ok: true,
        ts: '1234567890.123456',
      };

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockPR)
        .mockResolvedValueOnce(mockReviews)
        .mockResolvedValueOnce(mockSlackResponse);

      const mockSDKRegistry = new SDKRegistry({
        async load() {
          return {};
        },
      });

      const engine = new WorkflowEngine();
      const result = await engine.execute(
        workflow,
        { repo_owner: 'test', repo_name: 'repo', pr_number: 42 },
        mockSDKRegistry,
        mockExecutor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(3);
      expect(mockExecutor).toHaveBeenCalledTimes(3);
    });
  });

  describe('Email Processing Workflow', () => {
    it('should process Gmail messages and create tasks', async () => {
      const workflowContent = `---
workflow:
  id: email-to-tasks
  name: "Email to Tasks"

tools:
  gmail:
    sdk: "googleapis"
    auth:
      type: "oauth2"
      credentials: "\${GMAIL_CREDENTIALS}"
  
  linear:
    sdk: "linear"
    auth:
      api_key: "\${LINEAR_API_KEY}"

inputs:
  label:
    type: string
    default: "INBOX"

steps:
  - id: fetch_emails
    action: gmail.users.messages.list
    inputs:
      userId: "me"
      labelIds: ["{{inputs.label}}"]
      maxResults: 10
    output_variable: emails
  
  - id: create_tasks
    action: linear.createIssue
    inputs:
      teamId: "TEAM123"
      title: "Process email: {{emails.messages[0].snippet}}"
      description: "From Gmail message ID: {{emails.messages[0].id}}"
      priority: 2
    output_variable: task
    conditions:
      - "emails.messages.length > 0"
---
`;

      const { workflow } = parseContent(workflowContent);

      const mockEmails = {
        messages: [
          {
            id: 'msg123',
            threadId: 'thread123',
            snippet: 'Important client request...',
          },
        ],
        resultSizeEstimate: 1,
      };

      const mockTask = {
        id: 'task-456',
        title: 'Process email: Important client request...',
        identifier: 'TASK-1',
      };

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockEmails)
        .mockResolvedValueOnce(mockTask);

      const mockSDKRegistry = new SDKRegistry({
        async load() {
          return {};
        },
      });

      const engine = new WorkflowEngine();
      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[1].status).toBe(StepStatus.COMPLETED);
    });

    it('should skip task creation when no emails found', async () => {
      const workflowContent = `---
workflow:
  id: email-to-tasks-empty
  name: "Email to Tasks (Empty)"

tools:
  gmail:
    sdk: "googleapis"
  linear:
    sdk: "linear"

steps:
  - id: fetch_emails
    action: gmail.users.messages.list
    inputs:
      userId: "me"
    output_variable: emails
  
  - id: create_task
    action: linear.createIssue
    inputs:
      title: "New task"
    conditions:
      - "emails.messages.length > 0"
---
`;

      const { workflow } = parseContent(workflowContent);

      const mockEmptyEmails = {
        messages: [],
        resultSizeEstimate: 0,
      };

      const mockExecutor = vi.fn().mockResolvedValueOnce(mockEmptyEmails);

      const mockSDKRegistry = new SDKRegistry({
        async load() {
          return {};
        },
      });

      const engine = new WorkflowEngine();
      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults[1].status).toBe(StepStatus.SKIPPED);
      expect(mockExecutor).toHaveBeenCalledOnce();
    });
  });

  describe('Multi-Service Orchestration', () => {
    it('should orchestrate across 4 different services', async () => {
      const workflowContent = `---
workflow:
  id: multi-service
  name: "Multi-Service Orchestration"

tools:
  slack:
    sdk: "@slack/web-api"
  github:
    sdk: "@octokit/rest"
  jira:
    sdk: "jira.js"
  notion:
    sdk: "notion"

inputs:
  incident_title:
    type: string
    required: true

steps:
  - id: notify_slack
    action: slack.chat.postMessage
    inputs:
      channel: "#incidents"
      text: "🚨 New incident: {{inputs.incident_title}}"
    output_variable: slack_msg
  
  - id: create_github_issue
    action: github.issues.create
    inputs:
      owner: "company"
      repo: "incidents"
      title: "{{inputs.incident_title}}"
      labels: ["incident", "urgent"]
    output_variable: gh_issue
  
  - id: create_jira_ticket
    action: jira.issues.createIssue
    inputs:
      fields:
        project: { key: "INC" }
        summary: "{{inputs.incident_title}}"
        description: "GitHub: {{gh_issue.html_url}}"
        issuetype: { name: "Bug" }
        priority: { name: "Highest" }
    output_variable: jira_ticket
  
  - id: log_to_notion
    action: notion.pages.create
    inputs:
      parent:
        database_id: "db123"
      properties:
        Title:
          title:
            - text:
                content: "{{inputs.incident_title}}"
        Status:
          select:
            name: "In Progress"
        GitHub:
          url: "{{gh_issue.html_url}}"
        Jira:
          rich_text:
            - text:
                content: "{{jira_ticket.key}}"
    output_variable: notion_page
---
`;

      const { workflow } = parseContent(workflowContent);

      const mockSlackMsg = { ok: true, ts: '123.456' };
      const mockGHIssue = {
        number: 789,
        html_url: 'https://github.com/company/incidents/issues/789',
      };
      const mockJiraTicket = { key: 'INC-123', id: '10001' };
      const mockNotionPage = { id: 'page-456', url: 'https://notion.so/page-456' };

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce(mockSlackMsg)
        .mockResolvedValueOnce(mockGHIssue)
        .mockResolvedValueOnce(mockJiraTicket)
        .mockResolvedValueOnce(mockNotionPage);

      const mockSDKRegistry = new SDKRegistry({
        async load() {
          return {};
        },
      });

      const engine = new WorkflowEngine();
      const result = await engine.execute(
        workflow,
        { incident_title: 'Database connection failing' },
        mockSDKRegistry,
        mockExecutor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(4);
      expect(result.stepResults.every((s) => s.status === StepStatus.COMPLETED)).toBe(true);

      // Verify all services were called
      expect(mockExecutor).toHaveBeenCalledTimes(4);

      // Verify data passed between services
      expect(mockExecutor).toHaveBeenNthCalledWith(
        3, // Jira step
        expect.objectContaining({
          inputs: expect.objectContaining({
            fields: expect.objectContaining({
              description: 'GitHub: https://github.com/company/incidents/issues/789',
            }),
          }),
        }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle partial failures and continue', async () => {
      const workflowContent = `---
workflow:
  id: error-recovery
  name: "Error Recovery"

steps:
  - id: step1
    action: test.action1
    output_variable: result1
  
  - id: step2_risky
    action: test.riskyAction
    error_handling:
      action: continue
      max_retries: 1
  
  - id: step3_fallback
    action: test.fallback
    conditions:
      - "step2_risky.status == 'failed'"
  
  - id: step4_final
    action: test.final
---
`;

      const { workflow } = parseContent(workflowContent);

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce({ ok: true }) // step1
        .mockRejectedValueOnce(new Error('Step 2 failed')) // step2 attempt 1
        .mockRejectedValueOnce(new Error('Step 2 failed')) // step2 attempt 2
        .mockResolvedValueOnce({ fallback: true }) // step3
        .mockResolvedValueOnce({ complete: true }); // step4

      const mockSDKRegistry = new SDKRegistry({
        async load() {
          return {};
        },
      });

      const engine = new WorkflowEngine();
      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults[0].status).toBe(StepStatus.COMPLETED);
      expect(result.stepResults[1].status).toBe(StepStatus.FAILED);
      expect(result.stepResults[2].status).toBe(StepStatus.COMPLETED); // fallback executed
      expect(result.stepResults[3].status).toBe(StepStatus.COMPLETED);
    });
  });
});
