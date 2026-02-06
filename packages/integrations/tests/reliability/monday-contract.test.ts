/**
 * Contract tests for Monday.com integration
 *
 * These tests validate that:
 * 1. The SDK makes correct HTTP requests (GraphQL)
 * 2. Input validation schemas work as expected
 * 3. Response handling is correct
 * 4. The integration behaves correctly without hitting real APIs
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { mondaySchemas } from '../../src/reliability/schemas/monday.js';
import { MondayClient } from '../../src/services/monday.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const BASE_URL = 'https://api.monday.com/v2';

const server = setupServer(
  // GraphQL endpoint - parses query to determine response
  http.post(BASE_URL, async ({ request }) => {
    const body = await request.json() as any;
    const query = body.query as string;

    // List boards
    if (query.includes('query') && query.includes('boards') && !query.includes('boards(ids:')) {
      return HttpResponse.json({
        data: {
          boards: [
            {
              id: '123',
              name: 'Test Board',
              description: 'Test description',
              state: 'active',
              board_kind: 'public',
              permissions: 'everyone',
            },
          ],
        },
      });
    }

    // List items (check BEFORE get board - both match "boards(ids:")
    if (query.includes('query') && query.includes('items_page')) {
      return HttpResponse.json({
        data: {
          boards: [
            {
              items_page: {
                items: [
                  {
                    id: 'item-1',
                    name: 'Test Item',
                    state: 'active',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                    creator_id: 'user-1',
                    board: { id: body.variables.boardIds[0] },
                    group: { id: 'group-1', title: 'Group 1' },
                  },
                ],
              },
            },
          ],
        },
      });
    }

    // List updates (check BEFORE get item - both have items(ids:))
    if (query.includes('query') && query.includes('updates')) {
      return HttpResponse.json({
        data: {
          items: [
            {
              updates: [
                {
                  id: 'update-1',
                  body: 'Test update',
                  created_at: '2024-01-01T00:00:00Z',
                  creator_id: 'user-1',
                  item_id: body.variables.itemIds[0],
                  text_body: 'Test update',
                },
              ],
            },
          ],
        },
      });
    }

    // Get item
    if (query.includes('query') && query.includes('items(ids:')) {
      return HttpResponse.json({
        data: {
          items: [
            {
              id: body.variables.itemIds[0],
              name: 'Test Item',
              state: 'active',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              creator_id: 'user-1',
              board: { id: 'board-1' },
              group: { id: 'group-1', title: 'Group 1' },
              column_values: [
                { id: 'status', text: 'Done', value: '{"label":"Done"}' },
              ],
            },
          ],
        },
      });
    }

    // Create item
    if (query.includes('mutation') && query.includes('create_item')) {
      return HttpResponse.json({
        data: {
          create_item: {
            id: 'item-new',
            name: body.variables.itemName,
            state: 'active',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            creator_id: 'user-1',
            board: { id: body.variables.boardId },
            group: { id: body.variables.groupId || 'default', title: 'Default' },
          },
        },
      });
    }

    // Update item
    if (query.includes('mutation') && query.includes('change_multiple_column_values')) {
      return HttpResponse.json({
        data: {
          change_multiple_column_values: {
            id: body.variables.itemId,
            name: 'Test Item',
            state: 'active',
            column_values: [
              { id: 'status', text: 'In Progress', value: '{"label":"In Progress"}' },
            ],
          },
        },
      });
    }

    // Delete item
    if (query.includes('mutation') && query.includes('delete_item')) {
      return HttpResponse.json({
        data: {
          delete_item: {
            id: body.variables.itemId,
          },
        },
      });
    }

    // Create group
    if (query.includes('mutation') && query.includes('create_group')) {
      return HttpResponse.json({
        data: {
          create_group: {
            id: 'group-new',
            title: body.variables.groupName,
            color: '#0086c0',
            position: '1',
          },
        },
      });
    }

    // Create update
    if (query.includes('mutation') && query.includes('create_update')) {
      return HttpResponse.json({
        data: {
          create_update: {
            id: 'update-new',
            body: body.variables.body,
            created_at: '2024-01-01T00:00:00Z',
            creator_id: 'user-1',
            item_id: body.variables.itemId,
            text_body: body.variables.body,
          },
        },
      });
    }

    // Get board (checked after items_page since both have boards)
    if (query.includes('query') && query.includes('boards(ids:') && !query.includes('items_page')) {
      return HttpResponse.json({
        data: {
          boards: [
            {
              id: body.variables.boardIds[0],
              name: 'Test Board',
              description: 'Test description',
              state: 'active',
              board_kind: 'public',
              permissions: 'everyone',
            },
          ],
        },
      });
    }

    // Create board
    if (query.includes('mutation') && query.includes('create_board')) {
      return HttpResponse.json({
        data: {
          create_board: {
            id: 'new-board-123',
            name: body.variables.boardName,
            description: '',
            state: 'active',
            board_kind: body.variables.boardKind,
            permissions: 'everyone',
          },
        },
      });
    }

    // Default error for unknown query
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

describe('Monday.com Contract Tests', () => {
  it('should list boards successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.listBoards(10);

    expect(result.boards).toHaveLength(1);
    expect(result.boards[0].name).toBe('Test Board');
  });

  it('should get a board successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.getBoard('123');

    expect(result.boards).toHaveLength(1);
    expect(result.boards[0].id).toBe('123');
  });

  it('should create a board successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.createBoard({ boardName: 'New Board', boardKind: 'public' });

    expect(result.create_board.id).toBe('new-board-123');
    expect(result.create_board.name).toBe('New Board');
  });

  it('should list items successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.listItems({ boardId: '123', limit: 10 });

    expect(result.boards[0].items_page.items).toHaveLength(1);
    expect(result.boards[0].items_page.items[0].name).toBe('Test Item');
  });

  it('should get an item successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.getItem('item-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('item-1');
  });

  it('should create an item successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.createItem({ boardId: '123', itemName: 'New Item', groupId: 'group-1' });

    expect(result.create_item.id).toBe('item-new');
    expect(result.create_item.name).toBe('New Item');
  });

  it('should reject invalid item (missing itemName)', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    await expect(
      wrapped.createItem({ boardId: '123', itemName: '' })
    ).rejects.toThrow();
  });

  it('should update an item successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.updateItem({
      boardId: '123',
      itemId: 'item-1',
      columnValues: { status: { label: 'In Progress' } },
    });

    expect(result.change_multiple_column_values.id).toBe('item-1');
  });

  it('should delete an item successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.deleteItem('item-1');

    expect(result.delete_item.id).toBe('item-1');
  });

  it('should create a group successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.createGroup({ boardId: '123', groupName: 'New Group' });

    expect(result.create_group.id).toBe('group-new');
    expect(result.create_group.title).toBe('New Group');
  });

  it('should create an update successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.createUpdate({ itemId: 'item-1', body: 'This is a comment' });

    expect(result.create_update.id).toBe('update-new');
    expect(result.create_update.body).toBe('This is a comment');
  });

  it('should list updates successfully', async () => {
    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
    });

    const result = await wrapped.listUpdates({ itemId: 'item-1' });

    expect(result.items[0].updates).toHaveLength(1);
    expect(result.items[0].updates[0].body).toBe('Test update');
  });

  it('should handle GraphQL errors gracefully', async () => {
    server.use(
      http.post(BASE_URL, () => {
        return HttpResponse.json({
          errors: [{ message: 'Unauthorized' }],
        }, { status: 401 });
      })
    );

    const client = new MondayClient('test-token');
    const wrapped = wrapIntegration('monday', client, {
      inputSchemas: mondaySchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.listBoards()
    ).rejects.toThrow();
  });
});
