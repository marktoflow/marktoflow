/**
 * Contract tests for Linear integration
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
import { linearSchemas } from '../../src/reliability/schemas/linear.js';
import { LinearClient } from '../../src/services/linear.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // GraphQL endpoint
  http.post('https://api.linear.app/graphql', async ({ request }) => {
    const body = await request.json() as any;
    const query = body.query as string;
    const variables = body.variables as any;

    // Create issue
    if (query.includes('issueCreate')) {
      if (!variables.input.title) {
        return HttpResponse.json({
          errors: [{ message: 'Title is required' }],
        }, { status: 400 });
      }

      return HttpResponse.json({
        data: {
          issueCreate: {
            success: true,
            issue: {
              id: 'issue-123',
              identifier: 'TEAM-1',
              title: variables.input.title,
              description: variables.input.description,
              priority: variables.input.priority || 0,
              priorityLabel: 'None',
              state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
              team: { id: variables.input.teamId, name: 'Test Team', key: 'TEAM' },
              labels: { nodes: [] },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              url: 'https://linear.app/test/issue/TEAM-1',
            },
          },
        },
      });
    }

    // Update issue
    if (query.includes('issueUpdate')) {
      return HttpResponse.json({
        data: {
          issueUpdate: {
            success: true,
            issue: {
              id: variables.id,
              identifier: 'TEAM-1',
              title: variables.input.title || 'Test Issue',
              description: variables.input.description,
              priority: variables.input.priority || 0,
              priorityLabel: 'None',
              state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
              team: { id: 'team-1', name: 'Test Team', key: 'TEAM' },
              labels: { nodes: [] },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              url: 'https://linear.app/test/issue/TEAM-1',
            },
          },
        },
      });
    }

    // List teams
    if (query.includes('teams')) {
      return HttpResponse.json({
        data: {
          teams: {
            nodes: [
              {
                id: 'team-1',
                name: 'Test Team',
                key: 'TEAM',
                description: 'Test team description',
                issueCount: 10,
              },
            ],
          },
        },
      });
    }

    // Add comment
    if (query.includes('commentCreate')) {
      if (!variables.body) {
        return HttpResponse.json({
          errors: [{ message: 'Body is required' }],
        }, { status: 400 });
      }

      return HttpResponse.json({
        data: {
          commentCreate: {
            success: true,
            comment: {
              id: 'comment-123',
              body: variables.body,
              createdAt: '2024-01-01T00:00:00Z',
            },
          },
        },
      });
    }

    // Get viewer (current user)
    if (query.includes('viewer')) {
      return HttpResponse.json({
        data: {
          viewer: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      });
    }

    return HttpResponse.json({
      errors: [{ message: 'Unknown query' }],
    }, { status: 400 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Linear Contract Tests', () => {
  it('should create an issue successfully', async () => {
    const client = new LinearClient('test-api-key');
    const wrapped = wrapIntegration('linear', client, {
      inputSchemas: linearSchemas,
    });

    const result = await wrapped.createIssue({
      title: 'Test Issue',
      teamId: 'team-1',
      description: 'This is a test',
    });

    expect(result.identifier).toBe('TEAM-1');
    expect(result.title).toBe('Test Issue');
    expect(result.team.id).toBe('team-1');
  });

  it('should reject invalid inputs (missing title)', async () => {
    const client = new LinearClient('test-api-key');
    const wrapped = wrapIntegration('linear', client, {
      inputSchemas: linearSchemas,
    });

    await expect(
      wrapped.createIssue({
        title: '',
        teamId: 'team-1',
      })
    ).rejects.toThrow(/title/);
  });

  it('should reject invalid inputs (missing teamId)', async () => {
    const client = new LinearClient('test-api-key');
    const wrapped = wrapIntegration('linear', client, {
      inputSchemas: linearSchemas,
    });

    await expect(
      wrapped.createIssue({
        title: 'Test',
        teamId: '',
      })
    ).rejects.toThrow(/teamId/);
  });

  it('should update an issue successfully', async () => {
    const client = new LinearClient('test-api-key');
    const wrapped = wrapIntegration('linear', client, {
      inputSchemas: linearSchemas,
    });

    // Linear SDK updateIssue expects (issueId, options) as separate args
    // but schema validation expects { id, ...options }
    // We need to test the actual schema validation interface
    const result = await wrapped.updateIssue('issue-123', {
      title: 'Updated Title',
      description: 'Updated description',
    });

    expect(result.id).toBe('issue-123');
    expect(result.title).toBe('Updated Title');
  });

  it('should list teams successfully', async () => {
    const client = new LinearClient('test-api-key');
    const wrapped = wrapIntegration('linear', client, {
      inputSchemas: linearSchemas,
    });

    const result = await wrapped.listTeams();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Team');
    expect(result[0].key).toBe('TEAM');
  });

  it('should add a comment successfully', async () => {
    const client = new LinearClient('test-api-key');
    const wrapped = wrapIntegration('linear', client, {
      inputSchemas: linearSchemas,
    });

    const result = await wrapped.addComment('issue-123', 'This is a comment');

    expect(result.id).toBe('comment-123');
    expect(result.body).toBe('This is a comment');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://api.linear.app/graphql', () => {
        return HttpResponse.json({
          errors: [{ message: 'Team not found' }],
        }, { status: 404 });
      })
    );

    const client = new LinearClient('test-api-key');
    const wrapped = wrapIntegration('linear', client, {
      inputSchemas: linearSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.createIssue({
        title: 'Test',
        teamId: 'nonexistent',
      })
    ).rejects.toThrow();
  });
});
