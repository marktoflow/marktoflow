/**
 * Contract tests for Notion integration
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
import { notionSchemas } from '../../src/reliability/schemas/notion.js';
import { NotionClient } from '../../src/services/notion.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Create page
  http.post('https://api.notion.com/v1/pages', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.parent) {
      return HttpResponse.json({
        message: 'Parent is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'page-123',
      url: 'https://notion.so/page-123',
      object: 'page',
      created_time: '2024-01-01T00:00:00Z',
      last_edited_time: '2024-01-01T00:00:00Z',
      created_by: { id: 'user-1' },
      last_edited_by: { id: 'user-1' },
      parent: body.parent,
      properties: body.properties,
      icon: body.icon,
      cover: body.cover,
      archived: false,
    });
  }),

  // Get page
  http.get('https://api.notion.com/v1/pages/:pageId', ({ params }) => {
    return HttpResponse.json({
      id: params.pageId,
      url: `https://notion.so/${params.pageId}`,
      object: 'page',
      created_time: '2024-01-01T00:00:00Z',
      last_edited_time: '2024-01-01T00:00:00Z',
      created_by: { id: 'user-1' },
      last_edited_by: { id: 'user-1' },
      parent: { type: 'database_id', database_id: 'db-1' },
      properties: {
        title: { title: [{ plain_text: 'Test Page' }] },
      },
      archived: false,
    });
  }),

  // Update page
  http.patch('https://api.notion.com/v1/pages/:pageId', async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: params.pageId,
      url: `https://notion.so/${params.pageId}`,
      object: 'page',
      created_time: '2024-01-01T00:00:00Z',
      last_edited_time: '2024-01-01T00:00:00Z',
      created_by: { id: 'user-1' },
      last_edited_by: { id: 'user-1' },
      parent: { type: 'database_id', database_id: 'db-1' },
      properties: body.properties || { title: { title: [{ plain_text: 'Test Page' }] } },
      archived: body.archived || false,
    });
  }),

  // Query database
  http.post('https://api.notion.com/v1/databases/:databaseId/query', async ({ request, params }) => {
    return HttpResponse.json({
      object: 'list',
      results: [
        {
          id: 'page-1',
          url: 'https://notion.so/page-1',
          object: 'page',
          created_time: '2024-01-01T00:00:00Z',
          last_edited_time: '2024-01-01T00:00:00Z',
          created_by: { id: 'user-1' },
          last_edited_by: { id: 'user-1' },
          parent: { type: 'database_id', database_id: params.databaseId },
          properties: {
            title: { title: [{ plain_text: 'Page 1' }] },
          },
          archived: false,
        },
      ],
      has_more: false,
      next_cursor: null,
    });
  }),

  // Get database
  http.get('https://api.notion.com/v1/databases/:databaseId', ({ params }) => {
    return HttpResponse.json({
      id: params.databaseId,
      url: `https://notion.so/${params.databaseId}`,
      object: 'database',
      title: [{ plain_text: 'Test Database' }],
      description: [],
      properties: {
        Name: { id: 'title', type: 'title', name: 'Name' },
      },
      created_time: '2024-01-01T00:00:00Z',
      last_edited_time: '2024-01-01T00:00:00Z',
      archived: false,
    });
  }),

  // Search
  http.post('https://api.notion.com/v1/search', async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      object: 'list',
      results: [
        {
          id: 'page-1',
          url: 'https://notion.so/page-1',
          object: 'page',
          created_time: '2024-01-01T00:00:00Z',
          last_edited_time: '2024-01-01T00:00:00Z',
          created_by: { id: 'user-1' },
          last_edited_by: { id: 'user-1' },
          parent: { type: 'database_id', database_id: 'db-1' },
          properties: {
            title: { title: [{ plain_text: 'Test Page' }], type: 'title' },
          },
          archived: false,
        },
      ],
      has_more: false,
      next_cursor: null,
    });
  }),

  // Get current user
  http.get('https://api.notion.com/v1/users/me', () => {
    return HttpResponse.json({
      id: 'user-1',
      name: 'Test User',
      type: 'person',
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Notion Contract Tests', () => {
  it('should create a page successfully', async () => {
    const client = new NotionClient('test-token');
    const wrapped = wrapIntegration('notion', client, {
      inputSchemas: notionSchemas,
    });

    const result = await wrapped.createPage({
      parentDatabaseId: 'db-1',
      title: 'Test Page',
    });

    expect(result.id).toBe('page-123');
    expect(result.title).toBe('Test Page');
  });

  it('should reject invalid inputs (missing title)', async () => {
    const client = new NotionClient('test-token');
    const wrapped = wrapIntegration('notion', client, {
      inputSchemas: notionSchemas,
    });

    await expect(
      wrapped.createPage({
        parentDatabaseId: 'db-1',
        title: '',
      })
    ).rejects.toThrow(/title/);
  });

  it('should reject invalid inputs (missing parent)', async () => {
    const client = new NotionClient('test-token');
    const wrapped = wrapIntegration('notion', client, {
      inputSchemas: notionSchemas,
    });

    await expect(
      wrapped.createPage({
        title: 'Test',
      })
    ).rejects.toThrow(/parent/);
  });

  it('should get a page successfully', async () => {
    const client = new NotionClient('test-token');
    const wrapped = wrapIntegration('notion', client, {
      inputSchemas: notionSchemas,
    });

    const result = await wrapped.getPage('page-123');

    expect(result.id).toBe('page-123');
    // Title extraction depends on properties.title having type: 'title'
    expect(result.title).toBeDefined();
  });

  it('should update a page successfully', async () => {
    const client = new NotionClient('test-token');
    const wrapped = wrapIntegration('notion', client, {
      inputSchemas: notionSchemas,
    });

    const result = await wrapped.updatePage('page-123', {
      archived: true,
    });

    expect(result.id).toBe('page-123');
    expect(result.archived).toBe(true);
  });

  it('should query a database successfully', async () => {
    const client = new NotionClient('test-token');
    const wrapped = wrapIntegration('notion', client, {
      inputSchemas: notionSchemas,
    });

    const result = await wrapped.queryDatabase('db-1', {});

    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe('page-1');
    expect(result.hasMore).toBe(false);
  });

  it('should get a database successfully', async () => {
    const client = new NotionClient('test-token');
    const wrapped = wrapIntegration('notion', client, {
      inputSchemas: notionSchemas,
    });

    const result = await wrapped.getDatabase('db-1');

    expect(result.id).toBe('db-1');
    expect(result.title).toBe('Test Database');
  });

  it('should search successfully', async () => {
    const client = new NotionClient('test-token');
    const wrapped = wrapIntegration('notion', client, {
      inputSchemas: notionSchemas,
    });

    const result = await wrapped.search({ query: 'test' });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe('page-1');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://api.notion.com/v1/pages', () => {
        return HttpResponse.json({
          message: 'Database not found',
        }, { status: 404 });
      })
    );

    const client = new NotionClient('test-token');
    const wrapped = wrapIntegration('notion', client, {
      inputSchemas: notionSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.createPage({
        parentDatabaseId: 'nonexistent',
        title: 'Test',
      })
    ).rejects.toThrow();
  });
});
