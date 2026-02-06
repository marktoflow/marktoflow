/**
 * Contract tests for GitLab integration
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
import { gitlabSchemas } from '../../src/reliability/schemas/gitlab.js';
import { GitLabClient } from '../../src/services/gitlab.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const BASE_URL = 'https://gitlab.com/api/v4';

const server = setupServer(
  // List projects
  http.get(`${BASE_URL}/projects`, () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Test Project',
        description: 'Test description',
        web_url: 'https://gitlab.com/org/test-project',
        path_with_namespace: 'org/test-project',
        default_branch: 'main',
        visibility: 'private',
        created_at: '2024-01-01T00:00:00Z',
        last_activity_at: '2024-01-02T00:00:00Z',
      },
    ]);
  }),

  // Get project
  http.get(`${BASE_URL}/projects/:projectId`, ({ params }) => {
    return HttpResponse.json({
      id: Number(params.projectId) || 1,
      name: 'Test Project',
      description: 'Test description',
      web_url: 'https://gitlab.com/org/test-project',
      path_with_namespace: 'org/test-project',
      default_branch: 'main',
      visibility: 'private',
      created_at: '2024-01-01T00:00:00Z',
      last_activity_at: '2024-01-02T00:00:00Z',
    });
  }),

  // Create issue
  http.post(`${BASE_URL}/projects/:projectId/issues`, async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.title) {
      return HttpResponse.json({
        message: 'title is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 100,
      iid: 1,
      project_id: Number(params.projectId) || 1,
      title: body.title,
      description: body.description || '',
      state: 'opened',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      closed_at: null,
      labels: body.labels?.split(',') || [],
      author: { id: 1, username: 'user', name: 'User' },
      assignee: null,
      web_url: `https://gitlab.com/org/project/issues/1`,
    });
  }),

  // List issues
  http.get(`${BASE_URL}/projects/:projectId/issues`, () => {
    return HttpResponse.json([
      {
        id: 100,
        iid: 1,
        project_id: 1,
        title: 'Test Issue',
        description: 'Test description',
        state: 'opened',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        closed_at: null,
        labels: ['bug'],
        author: { id: 1, username: 'user', name: 'User' },
        assignee: null,
        web_url: 'https://gitlab.com/org/project/issues/1',
      },
    ]);
  }),

  // Get issue
  http.get(`${BASE_URL}/projects/:projectId/issues/:issueIid`, ({ params }) => {
    return HttpResponse.json({
      id: 100,
      iid: Number(params.issueIid),
      project_id: Number(params.projectId) || 1,
      title: 'Test Issue',
      description: 'Test description',
      state: 'opened',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      closed_at: null,
      labels: [],
      author: { id: 1, username: 'user', name: 'User' },
      assignee: null,
      web_url: 'https://gitlab.com/org/project/issues/1',
    });
  }),

  // Update issue
  http.put(`${BASE_URL}/projects/:projectId/issues/:issueIid`, async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: 100,
      iid: Number(params.issueIid),
      project_id: Number(params.projectId) || 1,
      title: body.title || 'Test Issue',
      description: body.description || 'Test description',
      state: body.state_event === 'close' ? 'closed' : 'opened',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      closed_at: body.state_event === 'close' ? '2024-01-02T00:00:00Z' : null,
      labels: body.labels?.split(',') || [],
      author: { id: 1, username: 'user', name: 'User' },
      assignee: null,
      web_url: 'https://gitlab.com/org/project/issues/1',
    });
  }),

  // Create merge request
  http.post(`${BASE_URL}/projects/:projectId/merge_requests`, async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.source_branch || !body.target_branch || !body.title) {
      return HttpResponse.json({
        message: 'source_branch, target_branch, and title are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 200,
      iid: 1,
      project_id: Number(params.projectId) || 1,
      title: body.title,
      description: body.description || '',
      state: 'opened',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      merged_at: null,
      source_branch: body.source_branch,
      target_branch: body.target_branch,
      author: { id: 1, username: 'user', name: 'User' },
      assignee: null,
      web_url: 'https://gitlab.com/org/project/merge_requests/1',
      merge_status: 'can_be_merged',
      draft: false,
    });
  }),

  // List merge requests
  http.get(`${BASE_URL}/projects/:projectId/merge_requests`, () => {
    return HttpResponse.json([
      {
        id: 200,
        iid: 1,
        project_id: 1,
        title: 'Test MR',
        description: 'Test description',
        state: 'opened',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        merged_at: null,
        source_branch: 'feature',
        target_branch: 'main',
        author: { id: 1, username: 'user', name: 'User' },
        assignee: null,
        web_url: 'https://gitlab.com/org/project/merge_requests/1',
        merge_status: 'can_be_merged',
        draft: false,
      },
    ]);
  }),

  // Get merge request
  http.get(`${BASE_URL}/projects/:projectId/merge_requests/:mergeRequestIid`, ({ params }) => {
    return HttpResponse.json({
      id: 200,
      iid: Number(params.mergeRequestIid),
      project_id: Number(params.projectId) || 1,
      title: 'Test MR',
      description: 'Test description',
      state: 'opened',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      merged_at: null,
      source_branch: 'feature',
      target_branch: 'main',
      author: { id: 1, username: 'user', name: 'User' },
      assignee: null,
      web_url: 'https://gitlab.com/org/project/merge_requests/1',
      merge_status: 'can_be_merged',
      draft: false,
    });
  }),

  // Merge merge request
  http.put(`${BASE_URL}/projects/:projectId/merge_requests/:mergeRequestIid/merge`, ({ params }) => {
    return HttpResponse.json({
      id: 200,
      iid: Number(params.mergeRequestIid),
      project_id: Number(params.projectId) || 1,
      title: 'Test MR',
      description: 'Test description',
      state: 'merged',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      merged_at: '2024-01-02T00:00:00Z',
      source_branch: 'feature',
      target_branch: 'main',
      author: { id: 1, username: 'user', name: 'User' },
      assignee: null,
      web_url: 'https://gitlab.com/org/project/merge_requests/1',
      merge_status: 'merged',
      draft: false,
    });
  }),

  // List pipelines
  http.get(`${BASE_URL}/projects/:projectId/pipelines`, () => {
    return HttpResponse.json([
      {
        id: 300,
        project_id: 1,
        status: 'success',
        ref: 'main',
        sha: 'abc123',
        web_url: 'https://gitlab.com/org/project/pipelines/300',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:10:00Z',
        started_at: '2024-01-01T00:01:00Z',
        finished_at: '2024-01-01T00:10:00Z',
        duration: 540,
      },
    ]);
  }),

  // Get pipeline
  http.get(`${BASE_URL}/projects/:projectId/pipelines/:pipelineId`, ({ params }) => {
    return HttpResponse.json({
      id: Number(params.pipelineId),
      project_id: Number(params.projectId) || 1,
      status: 'success',
      ref: 'main',
      sha: 'abc123',
      web_url: `https://gitlab.com/org/project/pipelines/${params.pipelineId}`,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:10:00Z',
      started_at: '2024-01-01T00:01:00Z',
      finished_at: '2024-01-01T00:10:00Z',
      duration: 540,
    });
  }),

  // Create pipeline
  http.post(`${BASE_URL}/projects/:projectId/pipeline`, async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.ref) {
      return HttpResponse.json({
        message: 'ref is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 301,
      project_id: Number(params.projectId) || 1,
      status: 'created',
      ref: body.ref,
      sha: 'def456',
      web_url: 'https://gitlab.com/org/project/pipelines/301',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      started_at: null,
      finished_at: null,
      duration: null,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('GitLab Contract Tests', () => {
  it('should list projects successfully', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    const result = await wrapped.listProjects();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Project');
  });

  it('should get a project successfully', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    const result = await wrapped.getProject(1);

    expect(result.id).toBe(1);
    expect(result.name).toBe('Test Project');
  });

  it('should create an issue successfully', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    const result = await wrapped.createIssue(1, 'New Issue', {
      description: 'Issue description',
      labels: ['bug', 'critical'],
    });

    expect(result.iid).toBe(1);
    expect(result.title).toBe('New Issue');
  });

  it('should reject invalid issue (missing title)', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    await expect(
      wrapped.createIssue(1, '')
    ).rejects.toThrow();
  });

  it('should list issues successfully', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    const result = await wrapped.listIssues(1, { state: 'opened' });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Issue');
  });

  it('should update an issue successfully', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    const result = await wrapped.updateIssue(1, 1, {
      state_event: 'close',
    });

    expect(result.state).toBe('closed');
  });

  it('should create a merge request successfully', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    const result = await wrapped.createMergeRequest(1, 'feature', 'main', 'New Feature');

    expect(result.iid).toBe(1);
    expect(result.source_branch).toBe('feature');
    expect(result.target_branch).toBe('main');
  });

  it('should reject invalid MR (missing required fields)', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    await expect(
      wrapped.createMergeRequest(1, 'feature', '', 'Title')
    ).rejects.toThrow();
  });

  it('should merge a merge request successfully', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    const result = await wrapped.mergeMergeRequest(1, 1);

    expect(result.state).toBe('merged');
    expect(result.merged_at).not.toBeNull();
  });

  it('should list pipelines successfully', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    const result = await wrapped.listPipelines(1);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('success');
  });

  it('should create a pipeline successfully', async () => {
    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
    });

    const result = await wrapped.createPipeline(1, 'main', {
      VAR1: 'value1',
    });

    expect(result.id).toBe(301);
    expect(result.ref).toBe('main');
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      http.get(`${BASE_URL}/projects`, () => {
        return HttpResponse.json({
          message: 'Unauthorized',
        }, { status: 401 });
      })
    );

    const client = new GitLabClient('test-token');
    const wrapped = wrapIntegration('gitlab', client, {
      inputSchemas: gitlabSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.listProjects()
    ).rejects.toThrow();
  });
});
