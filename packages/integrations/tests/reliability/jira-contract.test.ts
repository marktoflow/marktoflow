/**
 * Contract tests for Jira integration
 *
 * These tests validate that:
 * 1. The SDK makes correct HTTP requests
 * 2. Input validation schemas work as expected
 * 3. Response handling is correct
 * 4. The integration behaves correctly without hitting real APIs
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { jiraSchemas } from '../../src/reliability/schemas/jira.js';
import { Version3Client } from 'jira.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Create issue
  http.post('https://test.atlassian.net/rest/api/3/issue', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.fields?.summary) {
      return HttpResponse.json({
        errorMessages: [],
        errors: { summary: 'Summary is required' },
      }, { status: 400 });
    }

    if (!body.fields?.project) {
      return HttpResponse.json({
        errorMessages: [],
        errors: { project: 'Project is required' },
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: '10000',
      key: 'TEST-123',
      self: 'https://test.atlassian.net/rest/api/3/issue/10000',
    });
  }),

  // Get issue
  http.get('https://test.atlassian.net/rest/api/3/issue/:issueKey', ({ params }) => {
    return HttpResponse.json({
      id: '10000',
      key: params.issueKey,
      self: 'https://test.atlassian.net/rest/api/3/issue/10000',
      fields: {
        summary: 'Test Issue',
        description: 'This is a test issue',
        status: { name: 'To Do' },
        issuetype: { name: 'Task' },
        project: { key: 'TEST' },
      },
    });
  }),

  // Edit issue
  http.put('https://test.atlassian.net/rest/api/3/issue/:issueKey', async ({ params }) => {
    return HttpResponse.json({}, { status: 204 });
  }),

  // Search issues (GET with query params)
  http.get('https://test.atlassian.net/rest/api/3/search', ({ request }) => {
    const url = new URL(request.url);
    const jql = url.searchParams.get('jql');

    if (!jql) {
      return HttpResponse.json({
        errorMessages: ['JQL query is required'],
      }, { status: 400 });
    }

    return HttpResponse.json({
      expand: 'schema,names',
      startAt: 0,
      maxResults: 50,
      total: 1,
      issues: [
        {
          id: '10000',
          key: 'TEST-123',
          fields: {
            summary: 'Test Issue',
            status: { name: 'To Do' },
          },
        },
      ],
    });
  }),

  // Get all projects
  http.get('https://test.atlassian.net/rest/api/3/project/search', () => {
    return HttpResponse.json({
      values: [
        {
          id: '10000',
          key: 'TEST',
          name: 'Test Project',
          projectTypeKey: 'software',
        },
      ],
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Jira Contract Tests', () => {
  it('should create an issue successfully', async () => {
    const client = new Version3Client({
      host: 'https://test.atlassian.net',
      authentication: {
        basic: {
          email: 'test@example.com',
          apiToken: 'test-token',
        },
      },
    });
    const wrapped = wrapIntegration('jira', client, {
      inputSchemas: jiraSchemas,
    });

    const result = await wrapped.issues.createIssue({
      fields: {
        project: { key: 'TEST' },
        summary: 'Test Issue',
        issuetype: { name: 'Task' },
      },
    });

    expect(result.key).toBe('TEST-123');
    expect(result.id).toBe('10000');
  });

  it('should reject invalid inputs (missing summary)', async () => {
    const client = new Version3Client({
      host: 'https://test.atlassian.net',
      authentication: {
        basic: {
          email: 'test@example.com',
          apiToken: 'test-token',
        },
      },
    });
    const wrapped = wrapIntegration('jira', client, {
      inputSchemas: jiraSchemas,
    });

    await expect(
      wrapped.issues.createIssue({
        fields: {
          project: { key: 'TEST' },
          summary: '',
          issuetype: { name: 'Task' },
        },
      })
    ).rejects.toThrow(/summary/);
  });

  it('should reject invalid inputs (missing project key)', async () => {
    const client = new Version3Client({
      host: 'https://test.atlassian.net',
      authentication: {
        basic: {
          email: 'test@example.com',
          apiToken: 'test-token',
        },
      },
    });
    const wrapped = wrapIntegration('jira', client, {
      inputSchemas: jiraSchemas,
    });

    await expect(
      wrapped.issues.createIssue({
        fields: {
          project: { key: '' },
          summary: 'Test',
          issuetype: { name: 'Task' },
        },
      })
    ).rejects.toThrow();
  });

  it('should get an issue successfully', async () => {
    const client = new Version3Client({
      host: 'https://test.atlassian.net',
      authentication: {
        basic: {
          email: 'test@example.com',
          apiToken: 'test-token',
        },
      },
    });
    const wrapped = wrapIntegration('jira', client, {
      inputSchemas: jiraSchemas,
    });

    const result = await wrapped.issues.getIssue({
      issueIdOrKey: 'TEST-123',
    });

    expect(result.key).toBe('TEST-123');
    expect(result.fields.summary).toBe('Test Issue');
  });

  it('should edit an issue successfully', async () => {
    const client = new Version3Client({
      host: 'https://test.atlassian.net',
      authentication: {
        basic: {
          email: 'test@example.com',
          apiToken: 'test-token',
        },
      },
    });
    const wrapped = wrapIntegration('jira', client, {
      inputSchemas: jiraSchemas,
    });

    await wrapped.issues.editIssue({
      issueIdOrKey: 'TEST-123',
      fields: {
        summary: 'Updated Test Issue',
      },
    });

    // If no error is thrown, the test passes
    expect(true).toBe(true);
  });

  it('should search issues successfully', async () => {
    const client = new Version3Client({
      host: 'https://test.atlassian.net',
      authentication: {
        basic: {
          email: 'test@example.com',
          apiToken: 'test-token',
        },
      },
    });
    const wrapped = wrapIntegration('jira', client, {
      inputSchemas: jiraSchemas,
    });

    const result = await wrapped.issueSearch.searchForIssuesUsingJql({
      jql: 'project = TEST',
      maxResults: 50,
    });

    expect(result.total).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].key).toBe('TEST-123');
  });

  it('should reject invalid JQL search (empty query)', async () => {
    const client = new Version3Client({
      host: 'https://test.atlassian.net',
      authentication: {
        basic: {
          email: 'test@example.com',
          apiToken: 'test-token',
        },
      },
    });
    const wrapped = wrapIntegration('jira', client, {
      inputSchemas: jiraSchemas,
    });

    await expect(
      wrapped.issueSearch.searchForIssuesUsingJql({
        jql: '',
      })
    ).rejects.toThrow(/JQL/);
  });

  it('should get all projects successfully', async () => {
    const client = new Version3Client({
      host: 'https://test.atlassian.net',
      authentication: {
        basic: {
          email: 'test@example.com',
          apiToken: 'test-token',
        },
      },
    });
    const wrapped = wrapIntegration('jira', client, {
      inputSchemas: jiraSchemas,
    });

    const result = await wrapped.projects.searchProjects({});

    expect(result.values).toHaveLength(1);
    expect(result.values[0].key).toBe('TEST');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://test.atlassian.net/rest/api/3/issue', () => {
        return HttpResponse.json({
          errorMessages: ['Project not found'],
        }, { status: 404 });
      })
    );

    const client = new Version3Client({
      host: 'https://test.atlassian.net',
      authentication: {
        basic: {
          email: 'test@example.com',
          apiToken: 'test-token',
        },
      },
    });
    const wrapped = wrapIntegration('jira', client, {
      inputSchemas: jiraSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.issues.createIssue({
        fields: {
          project: { key: 'NONEXISTENT' },
          summary: 'Test',
          issuetype: { name: 'Task' },
        },
      })
    ).rejects.toThrow();
  });
});
