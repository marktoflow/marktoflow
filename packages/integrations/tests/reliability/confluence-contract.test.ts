/**
 * Contract tests for Confluence integration
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
import { confluenceSchemas } from '../../src/reliability/schemas/confluence.js';
import { ConfluenceClient } from '../../src/services/confluence.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // List spaces
  http.get('https://test.atlassian.net/wiki/api/v2/spaces', () => {
    return HttpResponse.json({
      results: [
        {
          id: '123',
          key: 'SPACE1',
          name: 'Test Space 1',
          type: 'global',
          status: 'current',
          _links: { webui: '/spaces/SPACE1' },
        },
        {
          id: '456',
          key: 'SPACE2',
          name: 'Test Space 2',
          type: 'personal',
          status: 'current',
          _links: { webui: '/spaces/SPACE2' },
        },
      ],
    });
  }),

  // Get space
  http.get('https://test.atlassian.net/wiki/api/v2/spaces/:spaceId', ({ params }) => {
    return HttpResponse.json({
      id: params.spaceId,
      key: 'SPACE1',
      name: 'Test Space 1',
      type: 'global',
      status: 'current',
      _links: { webui: '/spaces/SPACE1' },
    });
  }),

  // List pages
  http.get('https://test.atlassian.net/wiki/api/v2/pages', () => {
    return HttpResponse.json({
      results: [
        {
          id: 'page1',
          status: 'current',
          title: 'Test Page 1',
          spaceId: '123',
          authorId: 'user1',
          createdAt: '2024-01-01T00:00:00.000Z',
          version: { number: 1, createdAt: '2024-01-01T00:00:00.000Z' },
          _links: { webui: '/pages/page1' },
        },
      ],
    });
  }),

  // Get page
  http.get('https://test.atlassian.net/wiki/api/v2/pages/:pageId', ({ params }) => {
    return HttpResponse.json({
      id: params.pageId,
      status: 'current',
      title: 'Test Page',
      spaceId: '123',
      authorId: 'user1',
      createdAt: '2024-01-01T00:00:00.000Z',
      version: { number: 1, createdAt: '2024-01-01T00:00:00.000Z' },
      body: { storage: { value: '<p>Page content</p>' } },
      _links: { webui: '/pages/page1' },
    });
  }),

  // Create page
  http.post('https://test.atlassian.net/wiki/api/v2/pages', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.spaceId || !body.title || !body.body) {
      return HttpResponse.json({
        message: 'Missing required fields',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'newPage1',
      status: body.status || 'current',
      title: body.title,
      spaceId: body.spaceId,
      authorId: 'user1',
      createdAt: '2024-01-02T00:00:00.000Z',
      version: { number: 1, createdAt: '2024-01-02T00:00:00.000Z' },
      body: { storage: { value: body.body.value } },
      _links: { webui: '/pages/newPage1' },
    });
  }),

  // Update page
  http.put('https://test.atlassian.net/wiki/api/v2/pages/:pageId', async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.version || !body.version.number) {
      return HttpResponse.json({
        message: 'Version is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: params.pageId,
      status: body.status || 'current',
      title: body.title || 'Updated Page',
      spaceId: '123',
      authorId: 'user1',
      createdAt: '2024-01-01T00:00:00.000Z',
      version: { number: body.version.number, createdAt: '2024-01-02T00:00:00.000Z' },
      body: body.body ? { storage: { value: body.body.value } } : undefined,
      _links: { webui: `/pages/${params.pageId}` },
    });
  }),

  // Delete page
  http.delete('https://test.atlassian.net/wiki/api/v2/pages/:pageId', () => {
    return HttpResponse.json(null, { status: 204 });
  }),

  // Add comment
  http.post('https://test.atlassian.net/wiki/api/v2/pages/:pageId/footer-comments', async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.body) {
      return HttpResponse.json({
        message: 'Comment body is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'comment1',
      status: 'current',
      title: 'Comment',
      body: body.body,
      version: { number: 1, createdAt: '2024-01-02T00:00:00.000Z' },
      authorId: 'user1',
      createdAt: '2024-01-02T00:00:00.000Z',
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Confluence Contract Tests', () => {
  it('should list spaces successfully', async () => {
    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'test-token');
    const wrapped = wrapIntegration('confluence', client, {
      inputSchemas: confluenceSchemas,
    });

    const result = await wrapped.listSpaces();

    expect(result.spaces).toHaveLength(2);
    expect(result.spaces[0].name).toBe('Test Space 1');
    expect(result.spaces[1].key).toBe('SPACE2');
  });

  it('should get space successfully', async () => {
    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'test-token');
    const wrapped = wrapIntegration('confluence', client, {
      inputSchemas: confluenceSchemas,
    });

    const space = await wrapped.getSpace('123');

    expect(space.id).toBe('123');
    expect(space.name).toBe('Test Space 1');
  });

  it('should reject invalid inputs (missing title in create)', async () => {
    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'test-token');
    const wrapped = wrapIntegration('confluence', client, {
      inputSchemas: confluenceSchemas,
    });

    await expect(
      wrapped.createPage({
        spaceId: '123',
        title: '',
        body: 'Content',
      })
    ).rejects.toThrow(/title/);
  });

  it('should list pages successfully', async () => {
    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'test-token');
    const wrapped = wrapIntegration('confluence', client, {
      inputSchemas: confluenceSchemas,
    });

    const result = await wrapped.listPages();

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].title).toBe('Test Page 1');
  });

  it('should create page successfully', async () => {
    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'test-token');
    const wrapped = wrapIntegration('confluence', client, {
      inputSchemas: confluenceSchemas,
    });

    const page = await wrapped.createPage({
      spaceId: '123',
      title: 'New Page',
      body: '<p>New content</p>',
    });

    expect(page.id).toBe('newPage1');
    expect(page.title).toBe('New Page');
  });

  it('should reject invalid inputs (missing body in create)', async () => {
    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'test-token');
    const wrapped = wrapIntegration('confluence', client, {
      inputSchemas: confluenceSchemas,
    });

    await expect(
      wrapped.createPage({
        spaceId: '123',
        title: 'Test',
        body: '',
      })
    ).rejects.toThrow(/body/);
  });

  it('should update page successfully', async () => {
    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'test-token');
    const wrapped = wrapIntegration('confluence', client, {
      inputSchemas: confluenceSchemas,
    });

    const page = await wrapped.updatePage('page1', {
      title: 'Updated Title',
      body: '<p>Updated content</p>',
      version: 1,
    });

    expect(page.id).toBe('page1');
    expect(page.version.number).toBe(2); // Version increments in update
  });

  it('should delete page successfully', async () => {
    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'test-token');
    const wrapped = wrapIntegration('confluence', client, {
      inputSchemas: confluenceSchemas,
    });

    await expect(wrapped.deletePage('page1')).resolves.not.toThrow();
  });

  it('should add comment successfully', async () => {
    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'test-token');
    const wrapped = wrapIntegration('confluence', client, {
      inputSchemas: confluenceSchemas,
    });

    const comment = await wrapped.addComment('page1', 'Great page!');

    expect(comment.id).toBe('comment1');
    expect(comment.authorId).toBe('user1');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://test.atlassian.net/wiki/api/v2/pages', () => {
        return HttpResponse.json({
          message: 'Unauthorized',
        }, { status: 401 });
      })
    );

    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'test-token');
    const wrapped = wrapIntegration('confluence', client, {
      inputSchemas: confluenceSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.createPage({
        spaceId: '123',
        title: 'Test',
        body: 'Content',
      })
    ).rejects.toThrow();
  });
});
