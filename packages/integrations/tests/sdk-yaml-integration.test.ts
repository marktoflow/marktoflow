/**
 * SDK YAML Integration Tests
 *
 * These tests verify that SDKs are correctly configured and work with YAML workflows.
 * Tests cover:
 * - SDK initialization from YAML config
 * - Action invocation through workflow parser
 * - Input/output mapping
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseContent, SDKRegistry, createSDKStepExecutor } from '@marktoflow/core';
import { registerIntegrations } from '../src/index.js';

describe('SDK YAML Integration', () => {
  let registry: SDKRegistry;
  let stepExecutor: ReturnType<typeof createSDKStepExecutor>;

  beforeEach(() => {
    registry = new SDKRegistry();
    registerIntegrations(registry);
    stepExecutor = createSDKStepExecutor();
  });

  describe('Slack Integration', () => {
    it('should parse Slack workflow and validate SDK initialization', async () => {
      const yaml = `
---
workflow:
  id: slack-test
  name: Test Slack

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: 'xoxb-test-token'
---

# Test Workflow

## Step 1: Post Message

\`\`\`yaml
action: slack.chat.postMessage
inputs:
  channel: "#general"
  text: "Hello World"
output_variable: result
\`\`\`
`;

      const { workflow, warnings } = parseContent(yaml.trim());

      // Validate workflow structure
      expect(workflow.metadata.id).toBe('slack-test');
      expect(workflow.tools).toBeDefined();
      expect(workflow.tools?.slack).toBeDefined();
      expect(workflow.tools?.slack.sdk).toBe('@slack/web-api');
      expect(workflow.tools?.slack.auth?.token).toBe('xoxb-test-token');

      // Validate step structure
      expect(workflow.steps).toHaveLength(1);
      expect(workflow.steps[0].action).toBe('slack.chat.postMessage');
      expect(workflow.steps[0].inputs).toEqual({
        channel: '#general',
        text: 'Hello World'
      });
      expect(workflow.steps[0].outputVariable).toBe('result');

      // Register tools
      if (workflow.tools) {
        registry.registerTools(workflow.tools);
      }

      // Verify SDK can be loaded (don't actually call Slack API)
      const mockSdk = {
        chat: {
          postMessage: vi.fn().mockResolvedValue({
            ok: true,
            channel: 'C123',
            ts: '1234567890.123456'
          })
        }
      };

      // Override the load to return our mock
      vi.spyOn(registry, 'load').mockResolvedValue(mockSdk);

      // Execute the step
      const result = await stepExecutor(workflow.steps[0], {}, registry);

      expect(mockSdk.chat.postMessage).toHaveBeenCalledWith({
        channel: '#general',
        text: 'Hello World'
      });
      expect(result).toEqual({
        ok: true,
        channel: 'C123',
        ts: '1234567890.123456'
      });
    });

    it('should handle missing auth.token', async () => {
      const yaml = `
---
workflow:
  id: slack-test
  name: Test Slack

tools:
  slack:
    sdk: '@slack/web-api'
    auth: {}
---
`;

      const { workflow, warnings } = parseContent(yaml.trim());

      if (workflow.tools) {
        registry.registerTools(workflow.tools);
      }

      // Should throw when trying to load SDK without token
      await expect(registry.load('slack')).rejects.toThrow('auth.token');
    });
  });

  describe('GitHub Integration', () => {
    it('should parse GitHub workflow and validate SDK initialization', async () => {
      const yaml = `
---
workflow:
  id: github-test
  name: Test GitHub

tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: 'ghp_test_token'
---

# Test Workflow

## Step 1: Get Repository

\`\`\`yaml
action: github.repos.get
inputs:
  owner: "marktoflow"
  repo: "marktoflow"
output_variable: repo_info
\`\`\`
`;

      const { workflow, warnings } = parseContent(yaml.trim());

      // Validate workflow structure
      expect(workflow.metadata.id).toBe('github-test');
      expect(workflow.tools?.github.sdk).toBe('@octokit/rest');
      expect(workflow.tools?.github.auth?.token).toBe('ghp_test_token');

      // Validate step
      expect(workflow.steps[0].action).toBe('github.repos.get');
      expect(workflow.steps[0].inputs).toEqual({
        owner: 'marktoflow',
        repo: 'marktoflow'
      });

      // Register and mock
      if (workflow.tools) {
        registry.registerTools(workflow.tools);
      }

      const mockSdk = {
        repos: {
          get: vi.fn().mockResolvedValue({
            data: {
              id: 123,
              name: 'marktoflow',
              full_name: 'marktoflow/marktoflow',
              private: false
            }
          })
        }
      };

      vi.spyOn(registry, 'load').mockResolvedValue(mockSdk);

      const result = await stepExecutor(workflow.steps[0], {}, registry);

      expect(mockSdk.repos.get).toHaveBeenCalledWith({
        owner: 'marktoflow',
        repo: 'marktoflow'
      });
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('name', 'marktoflow');
    });
  });

  describe('PostgreSQL Integration', () => {
    it('should parse Postgres workflow and validate SDK initialization', async () => {
      const yaml = `
---
workflow:
  id: postgres-test
  name: Test Postgres

tools:
  db:
    sdk: 'pg'
    auth:
      host: 'localhost'
      port: '5432'
      database: 'testdb'
      user: 'postgres'
      password: 'password'
---

# Test Workflow

## Step 1: Query Database

\`\`\`yaml
action: db.query
inputs:
  text: "SELECT * FROM users WHERE id = $1"
  values: [123]
output_variable: query_result
\`\`\`
`;

      const { workflow, warnings } = parseContent(yaml.trim());

      // Validate workflow structure
      expect(workflow.tools?.db.sdk).toBe('pg');
      expect(workflow.tools?.db.auth?.host).toBe('localhost');
      expect(workflow.tools?.db.auth?.port).toBe('5432');
      expect(workflow.tools?.db.auth?.database).toBe('testdb');

      // Validate step
      expect(workflow.steps[0].action).toBe('db.query');
      expect(workflow.steps[0].inputs).toEqual({
        text: 'SELECT * FROM users WHERE id = $1',
        values: [123]
      });
    });
  });

  describe('Jira Integration', () => {
    it('should parse Jira workflow and validate SDK initialization', async () => {
      const yaml = `
---
workflow:
  id: jira-test
  name: Test Jira

tools:
  jira:
    sdk: 'jira.js'
    auth:
      host: 'https://company.atlassian.net'
      email: 'user@company.com'
      api_token: 'test-api-token'
---

# Test Workflow

## Step 1: Search Issues

\`\`\`yaml
action: jira.issueSearch.searchForIssuesUsingJql
inputs:
  jql: "project = ENG AND status = 'In Progress'"
  fields: ["summary", "status", "assignee"]
  maxResults: 50
output_variable: issues
\`\`\`
`;

      const { workflow, warnings } = parseContent(yaml.trim());

      // Validate workflow structure
      expect(workflow.tools?.jira.sdk).toBe('jira.js');
      expect(workflow.tools?.jira.auth?.host).toBe('https://company.atlassian.net');
      expect(workflow.tools?.jira.auth?.email).toBe('user@company.com');
      expect(workflow.tools?.jira.auth?.api_token).toBe('test-api-token');

      // Validate step with nested action path
      expect(workflow.steps[0].action).toBe('jira.issueSearch.searchForIssuesUsingJql');
      expect(workflow.steps[0].inputs).toEqual({
        jql: "project = ENG AND status = 'In Progress'",
        fields: ['summary', 'status', 'assignee'],
        maxResults: 50
      });

      // Register and mock
      if (workflow.tools) {
        registry.registerTools(workflow.tools);
      }

      const mockSdk = {
        issueSearch: {
          searchForIssuesUsingJql: vi.fn().mockResolvedValue({
            issues: [
              { key: 'ENG-1', fields: { summary: 'Test issue' } }
            ],
            total: 1
          })
        }
      };

      vi.spyOn(registry, 'load').mockResolvedValue(mockSdk);

      const result = await stepExecutor(workflow.steps[0], {}, registry);

      expect(mockSdk.issueSearch.searchForIssuesUsingJql).toHaveBeenCalledWith({
        jql: "project = ENG AND status = 'In Progress'",
        fields: ['summary', 'status', 'assignee'],
        maxResults: 50
      });
      expect(result).toHaveProperty('issues');
      expect(result.total).toBe(1);
    });
  });

  describe('Google Sheets Integration', () => {
    it('should parse Google Sheets workflow and validate SDK initialization', async () => {
      const yaml = `
---
workflow:
  id: sheets-test
  name: Test Google Sheets

tools:
  sheets:
    sdk: 'googleapis'
    auth:
      client_id: 'client-id'
      client_secret: 'client-secret'
      refresh_token: 'refresh-token'
---

# Test Workflow

## Step 1: Read Data

\`\`\`yaml
action: sheets.spreadsheets.values.get
inputs:
  spreadsheetId: "abc123"
  range: "Sheet1!A1:D10"
output_variable: sheet_data
\`\`\`
`;

      const { workflow, warnings } = parseContent(yaml.trim());

      // Validate workflow structure
      expect(workflow.tools?.sheets.sdk).toBe('googleapis');
      expect(workflow.tools?.sheets.auth).toBeDefined();

      // Validate step with deep nesting
      expect(workflow.steps[0].action).toBe('sheets.spreadsheets.values.get');
      expect(workflow.steps[0].inputs).toEqual({
        spreadsheetId: 'abc123',
        range: 'Sheet1!A1:D10'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid action format', async () => {
      const step = {
        action: 'invalid',
        inputs: {}
      };

      await expect(
        stepExecutor(step, {}, registry)
      ).rejects.toThrow('Invalid action format');
    });

    it('should handle unregistered SDK', async () => {
      const step = {
        action: 'unknown.method',
        inputs: {}
      };

      await expect(
        stepExecutor(step, {}, registry)
      ).rejects.toThrow("SDK 'unknown' is not registered");
    });

    it('should handle non-existent method', async () => {
      const mockSdk = {
        existing: vi.fn()
      };

      vi.spyOn(registry, 'load').mockResolvedValue(mockSdk);

      registry.registerTools({
        'test': { sdk: 'test-sdk' }
      });

      const step = {
        action: 'test.nonexistent',
        inputs: {}
      };

      await expect(
        stepExecutor(step, {}, registry)
      ).rejects.toThrow('is not a function');
    });
  });

  describe('Complex Workflows', () => {
    it('should handle workflow with multiple tools', async () => {
      const yaml = `
---
workflow:
  id: multi-tool-test
  name: Test Multiple Tools

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: 'xoxb-test'

  github:
    sdk: '@octokit/rest'
    auth:
      token: 'ghp-test'
---

# Test Workflow

## Step 1: Get GitHub PR

\`\`\`yaml
action: github.pulls.get
inputs:
  owner: "test"
  repo: "test"
  pull_number: 1
output_variable: pr
\`\`\`

## Step 2: Notify Slack

\`\`\`yaml
action: slack.chat.postMessage
inputs:
  channel: "#dev"
  text: "PR #1 ready for review"
output_variable: slack_result
\`\`\`
`;

      const { workflow, warnings } = parseContent(yaml.trim());

      // Validate both tools registered
      expect(workflow.tools).toBeDefined();
      expect(workflow.tools?.slack).toBeDefined();
      expect(workflow.tools?.github).toBeDefined();

      // Validate both steps
      expect(workflow.steps).toHaveLength(2);
      expect(workflow.steps[0].action).toBe('github.pulls.get');
      expect(workflow.steps[1].action).toBe('slack.chat.postMessage');

      if (workflow.tools) {
        registry.registerTools(workflow.tools);
      }

      // Should have registered both tools
      expect(registry.has('slack')).toBe(true);
      expect(registry.has('github')).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should preserve input types from YAML', async () => {
      const yaml = `
---
workflow:
  id: types-test
  name: Test Input Types

tools:
  test:
    sdk: 'test-sdk'
---

# Test Workflow

## Step 1: Test Types

\`\`\`yaml
action: test.method
inputs:
  string_val: "text"
  number_val: 42
  boolean_val: true
  array_val: [1, 2, 3]
  object_val:
    key: value
    nested:
      deep: true
\`\`\`
`;

      const { workflow, warnings } = parseContent(yaml.trim());

      const inputs = workflow.steps[0].inputs;

      // Validate types are preserved
      expect(typeof inputs.string_val).toBe('string');
      expect(typeof inputs.number_val).toBe('number');
      expect(typeof inputs.boolean_val).toBe('boolean');
      expect(Array.isArray(inputs.array_val)).toBe(true);
      expect(typeof inputs.object_val).toBe('object');
      expect(inputs.object_val.nested.deep).toBe(true);
    });
  });
});
