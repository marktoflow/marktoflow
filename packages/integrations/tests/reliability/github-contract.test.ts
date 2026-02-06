/**
 * Contract tests for GitHub integration
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
import { githubSchemas } from '../../src/reliability/schemas/github.js';
import { Octokit } from '@octokit/rest';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Create issue
  http.post('https://api.github.com/repos/:owner/:repo/issues', async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.title) {
      return HttpResponse.json({
        message: 'Validation Failed',
        errors: [{ field: 'title', code: 'missing_field' }],
      }, { status: 422 });
    }

    return HttpResponse.json({
      id: 1,
      number: 123,
      title: body.title,
      body: body.body,
      state: 'open',
      html_url: `https://github.com/${params.owner}/${params.repo}/issues/123`,
    });
  }),

  // Get issue
  http.get('https://api.github.com/repos/:owner/:repo/issues/:issue_number', ({ params }) => {
    return HttpResponse.json({
      id: 1,
      number: parseInt(params.issue_number as string, 10),
      title: 'Test Issue',
      body: 'This is a test issue',
      state: 'open',
      html_url: `https://github.com/${params.owner}/${params.repo}/issues/${params.issue_number}`,
    });
  }),

  // Update issue
  http.patch('https://api.github.com/repos/:owner/:repo/issues/:issue_number', async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: 1,
      number: parseInt(params.issue_number as string, 10),
      title: body.title || 'Test Issue',
      body: body.body,
      state: body.state || 'open',
      html_url: `https://github.com/${params.owner}/${params.repo}/issues/${params.issue_number}`,
    });
  }),

  // Create pull request
  http.post('https://api.github.com/repos/:owner/:repo/pulls', async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.title || !body.head || !body.base) {
      return HttpResponse.json({
        message: 'Validation Failed',
        errors: [{ field: 'title', code: 'missing_field' }],
      }, { status: 422 });
    }

    return HttpResponse.json({
      id: 1,
      number: 456,
      title: body.title,
      body: body.body,
      state: 'open',
      head: { ref: body.head },
      base: { ref: body.base },
      html_url: `https://github.com/${params.owner}/${params.repo}/pull/456`,
    });
  }),

  // List repositories
  http.get('https://api.github.com/user/repos', () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'repo1',
        full_name: 'user/repo1',
        private: false,
      },
      {
        id: 2,
        name: 'repo2',
        full_name: 'user/repo2',
        private: true,
      },
    ]);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('GitHub Contract Tests', () => {
  it('should create an issue successfully', async () => {
    const octokit = new Octokit({ auth: 'ghp_test_token' });
    const wrapped = wrapIntegration('github', octokit, {
      inputSchemas: githubSchemas,
    });

    const result = await wrapped.rest.issues.create({
      owner: 'testuser',
      repo: 'testrepo',
      title: 'Test Issue',
      body: 'This is a test',
    });

    expect(result.data.number).toBe(123);
    expect(result.data.title).toBe('Test Issue');
    expect(result.data.state).toBe('open');
  });

  it('should reject invalid inputs (missing owner)', async () => {
    const octokit = new Octokit({ auth: 'ghp_test_token' });
    const wrapped = wrapIntegration('github', octokit, {
      inputSchemas: githubSchemas,
    });

    await expect(
      wrapped.rest.issues.create({
        owner: '',
        repo: 'testrepo',
        title: 'Test',
      })
    ).rejects.toThrow(/owner/);
  });

  it('should reject invalid inputs (missing title)', async () => {
    const octokit = new Octokit({ auth: 'ghp_test_token' });
    const wrapped = wrapIntegration('github', octokit, {
      inputSchemas: githubSchemas,
    });

    await expect(
      wrapped.rest.issues.create({
        owner: 'testuser',
        repo: 'testrepo',
        title: '',
      })
    ).rejects.toThrow(/title/);
  });

  it('should get an issue successfully', async () => {
    const octokit = new Octokit({ auth: 'ghp_test_token' });
    const wrapped = wrapIntegration('github', octokit, {
      inputSchemas: githubSchemas,
    });

    const result = await wrapped.rest.issues.get({
      owner: 'testuser',
      repo: 'testrepo',
      issue_number: 123,
    });

    expect(result.data.number).toBe(123);
    expect(result.data.title).toBe('Test Issue');
  });

  it('should update an issue successfully', async () => {
    const octokit = new Octokit({ auth: 'ghp_test_token' });
    const wrapped = wrapIntegration('github', octokit, {
      inputSchemas: githubSchemas,
    });

    const result = await wrapped.rest.issues.update({
      owner: 'testuser',
      repo: 'testrepo',
      issue_number: 123,
      state: 'closed',
    });

    expect(result.data.number).toBe(123);
    expect(result.data.state).toBe('closed');
  });

  it('should create a pull request successfully', async () => {
    const octokit = new Octokit({ auth: 'ghp_test_token' });
    const wrapped = wrapIntegration('github', octokit, {
      inputSchemas: githubSchemas,
    });

    const result = await wrapped.rest.pulls.create({
      owner: 'testuser',
      repo: 'testrepo',
      title: 'Test PR',
      head: 'feature-branch',
      base: 'main',
    });

    expect(result.data.number).toBe(456);
    expect(result.data.title).toBe('Test PR');
    expect(result.data.head.ref).toBe('feature-branch');
  });

  it('should list repositories successfully', async () => {
    const octokit = new Octokit({ auth: 'ghp_test_token' });
    const wrapped = wrapIntegration('github', octokit, {
      inputSchemas: githubSchemas,
    });

    const result = await wrapped.rest.repos.listForAuthenticatedUser({});

    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('repo1');
    expect(result.data[1].private).toBe(true);
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://api.github.com/repos/:owner/:repo/issues', () => {
        return HttpResponse.json({
          message: 'Not Found',
        }, { status: 404 });
      })
    );

    const octokit = new Octokit({ auth: 'ghp_test_token' });
    const wrapped = wrapIntegration('github', octokit, {
      inputSchemas: githubSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.rest.issues.create({
        owner: 'nonexistent',
        repo: 'testrepo',
        title: 'Test',
      })
    ).rejects.toThrow();
  });
});
