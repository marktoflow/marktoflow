/**
 * Contract tests for Sentry integration
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
import { sentrySchemas } from '../../src/reliability/schemas/sentry.js';
import { SentryClient } from '../../src/services/sentry.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const BASE_URL = 'https://sentry.io/api/0';
const ORG = 'test-org';

const server = setupServer(
  // List issues
  http.get(`${BASE_URL}/organizations/${ORG}/issues/`, ({ request }) => {
    const url = new URL(request.url);
    const project = url.searchParams.get('project');

    if (!project) {
      return HttpResponse.json({
        detail: 'project parameter is required',
      }, { status: 400 });
    }

    return HttpResponse.json([
      {
        id: 'issue-123',
        shortId: 'PROJ-1',
        title: 'TypeError: Cannot read property',
        culprit: 'app/main.js in handleClick',
        permalink: 'https://sentry.io/organizations/test-org/issues/123/',
        logger: 'javascript',
        level: 'error',
        status: 'unresolved',
        statusDetails: {},
        isPublic: false,
        platform: 'javascript',
        project: { id: '1', name: 'frontend', slug: 'frontend' },
        type: 'error',
        metadata: {},
        numComments: 0,
        assignedTo: null,
        isBookmarked: false,
        isSubscribed: false,
        hasSeen: false,
        count: '42',
        userCount: 12,
        firstSeen: '2024-01-01T00:00:00Z',
        lastSeen: '2024-01-02T00:00:00Z',
      },
    ]);
  }),

  // Get issue
  http.get(`${BASE_URL}/issues/:issueId/`, ({ params }) => {
    return HttpResponse.json({
      id: params.issueId,
      shortId: 'PROJ-1',
      title: 'Test Issue',
      culprit: 'app/main.js',
      permalink: `https://sentry.io/organizations/test-org/issues/${params.issueId}/`,
      logger: 'javascript',
      level: 'error',
      status: 'unresolved',
      statusDetails: {},
      isPublic: false,
      platform: 'javascript',
      project: { id: '1', name: 'frontend', slug: 'frontend' },
      type: 'error',
      metadata: {},
      numComments: 0,
      assignedTo: null,
      isBookmarked: false,
      isSubscribed: false,
      hasSeen: false,
      count: '10',
      userCount: 5,
      firstSeen: '2024-01-01T00:00:00Z',
      lastSeen: '2024-01-01T12:00:00Z',
    });
  }),

  // Update issue
  http.put(`${BASE_URL}/issues/:issueId/`, async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: params.issueId,
      shortId: 'PROJ-1',
      title: 'Test Issue',
      culprit: 'app/main.js',
      permalink: `https://sentry.io/organizations/test-org/issues/${params.issueId}/`,
      logger: 'javascript',
      level: 'error',
      status: body.status || 'unresolved',
      statusDetails: {},
      isPublic: false,
      platform: 'javascript',
      project: { id: '1', name: 'frontend', slug: 'frontend' },
      type: 'error',
      metadata: {},
      numComments: 0,
      assignedTo: body.assignedTo ? { id: body.assignedTo, name: 'User', email: 'user@example.com' } : null,
      isBookmarked: body.isBookmarked || false,
      isSubscribed: false,
      hasSeen: body.hasSeen || false,
      count: '10',
      userCount: 5,
      firstSeen: '2024-01-01T00:00:00Z',
      lastSeen: '2024-01-01T12:00:00Z',
    });
  }),

  // Delete issue
  http.delete(`${BASE_URL}/issues/:issueId/`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // List projects
  http.get(`${BASE_URL}/organizations/${ORG}/projects/`, () => {
    return HttpResponse.json([
      {
        id: '1',
        slug: 'frontend',
        name: 'Frontend App',
        platform: 'javascript',
        dateCreated: '2024-01-01T00:00:00Z',
        isBookmarked: false,
        isMember: true,
        features: ['releases', 'minidump'],
        firstEvent: '2024-01-01T00:00:00Z',
        hasAccess: true,
        status: 'active',
      },
    ]);
  }),

  // Get project
  http.get(`${BASE_URL}/projects/${ORG}/:projectSlug/`, ({ params }) => {
    return HttpResponse.json({
      id: '1',
      slug: params.projectSlug,
      name: 'Test Project',
      platform: 'javascript',
      dateCreated: '2024-01-01T00:00:00Z',
      isBookmarked: false,
      isMember: true,
      features: ['releases'],
      firstEvent: '2024-01-01T00:00:00Z',
      hasAccess: true,
      status: 'active',
    });
  }),

  // List releases
  http.get(`${BASE_URL}/organizations/${ORG}/releases/`, () => {
    return HttpResponse.json([
      {
        version: 'v1.0.0',
        shortVersion: '1.0.0',
        ref: 'main',
        url: 'https://github.com/org/repo/releases/v1.0.0',
        dateCreated: '2024-01-01T00:00:00Z',
        dateReleased: '2024-01-01T12:00:00Z',
        newGroups: 0,
        commitCount: 10,
        lastCommit: null,
        deployCount: 1,
        lastDeploy: null,
        authors: [{ name: 'Dev', email: 'dev@example.com' }],
        projects: [{ slug: 'frontend', name: 'Frontend App' }],
      },
    ]);
  }),

  // Create release
  http.post(`${BASE_URL}/organizations/${ORG}/releases/`, async ({ request }) => {
    const body = await request.json() as any;

    if (!body.version || !body.projects || body.projects.length === 0) {
      return HttpResponse.json({
        error: 'version and projects are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      version: body.version,
      shortVersion: body.version,
      ref: body.ref || null,
      url: body.url || null,
      dateCreated: '2024-01-01T00:00:00Z',
      dateReleased: body.dateReleased || null,
      newGroups: 0,
      commitCount: 0,
      lastCommit: null,
      deployCount: 0,
      lastDeploy: null,
      authors: [],
      projects: body.projects.map((slug: string) => ({ slug, name: slug })),
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Sentry Contract Tests', () => {
  it('should list issues successfully', async () => {
    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
    });

    const result = await wrapped.listIssues('frontend');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('TypeError: Cannot read property');
  });

  it('should reject invalid list issues (missing project)', async () => {
    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
    });

    await expect(
      wrapped.listIssues('')
    ).rejects.toThrow();
  });

  it('should get an issue successfully', async () => {
    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
    });

    const result = await wrapped.getIssue('issue-123');

    expect(result.id).toBe('issue-123');
    expect(result.title).toBe('Test Issue');
  });

  it('should update an issue successfully', async () => {
    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
    });

    const result = await wrapped.updateIssue('issue-123', {
      status: 'resolved',
    });

    expect(result.id).toBe('issue-123');
    expect(result.status).toBe('resolved');
  });

  it('should delete an issue successfully', async () => {
    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
    });

    await wrapped.deleteIssue('issue-123');
    expect(true).toBe(true);
  });

  it('should list projects successfully', async () => {
    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
    });

    const result = await wrapped.listProjects();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Frontend App');
  });

  it('should get a project successfully', async () => {
    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
    });

    const result = await wrapped.getProject('frontend');

    expect(result.slug).toBe('frontend');
    expect(result.name).toBe('Test Project');
  });

  it('should list releases successfully', async () => {
    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
    });

    const result = await wrapped.listReleases();

    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('v1.0.0');
  });

  it('should create a release successfully', async () => {
    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
    });

    const result = await wrapped.createRelease('v2.0.0', ['frontend']);

    expect(result.version).toBe('v2.0.0');
    expect(result.projects).toHaveLength(1);
  });

  it('should reject invalid release (missing projects)', async () => {
    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
    });

    await expect(
      wrapped.createRelease('v2.0.0', [])
    ).rejects.toThrow();
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      http.get(`${BASE_URL}/organizations/${ORG}/issues/`, () => {
        return HttpResponse.json({
          error: 'Unauthorized',
        }, { status: 401 });
      })
    );

    const client = new SentryClient('test-token', ORG);
    const wrapped = wrapIntegration('sentry', client, {
      inputSchemas: sentrySchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.listIssues('frontend')
    ).rejects.toThrow();
  });
});
