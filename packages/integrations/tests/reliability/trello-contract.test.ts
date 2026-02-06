/**
 * Contract tests for Trello integration
 *
 * These tests validate that:
 * 1. The SDK makes correct HTTP requests
 * 2. Input validation schemas work as expected
 * 3. Response handling is correct
 * 4. The integration behaves correctly without hitting real APIs
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { trelloSchemas } from '../../src/reliability/schemas/trello.js';
import { TrelloClient } from '../../src/services/trello.js';

// ============================================================================
// Mock Trello SDK Client
// ============================================================================

// Create a mock Trello SDK client that uses fetch (which MSW can intercept)
class MockTrelloSDK {
  constructor(private apiKey: string, private token: string) {}

  private async makeRequest(method: string, path: string, params: Record<string, any> = {}) {
    const url = new URL(`https://api.trello.com/1${path}`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('token', this.token);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method,
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Trello API error: ${response.status}`);
    }

    return response.json();
  }

  async getBoard(boardId: string) {
    return this.makeRequest('GET', `/boards/${boardId}`);
  }

  async addBoard(name: string, desc?: string, _organization?: any, prefs?: any) {
    return this.makeRequest('POST', '/boards', { name, desc, ...prefs });
  }

  async getListsOnBoard(boardId: string) {
    return this.makeRequest('GET', `/boards/${boardId}/lists`);
  }

  async addListToBoard(idBoard: string, name: string, pos?: any) {
    return this.makeRequest('POST', '/lists', { name, idBoard, pos });
  }

  async getCard(cardId: string) {
    return this.makeRequest('GET', `/cards/${cardId}`);
  }

  async addCard(name: string, desc: string, idList: string, pos?: any, due?: any, idMembers?: any, idLabels?: any, urlSource?: any) {
    return this.makeRequest('POST', '/cards', {
      name,
      desc,
      idList,
      pos,
      due,
      idMembers: idMembers?.join(','),
      idLabels: idLabels?.join(','),
      urlSource,
    });
  }

  async updateCard(cardId: string, name?: string, desc?: string, due?: any, idList?: string) {
    return this.makeRequest('PUT', `/cards/${cardId}`, { name, desc, due, idList });
  }

  async deleteCard(cardId: string) {
    return this.makeRequest('DELETE', `/cards/${cardId}`);
  }

  async addCommentToCard(cardId: string, text: string) {
    return this.makeRequest('POST', `/cards/${cardId}/actions/comments`, { text });
  }

  async addLabelToCard(cardId: string, labelId: string) {
    return this.makeRequest('POST', `/cards/${cardId}/idLabels`, { value: labelId });
  }
}

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Get board - Trello SDK adds key and token as query params
  http.get('https://api.trello.com/1/boards/:boardId', ({ params, request }) => {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const token = url.searchParams.get('token');

    if (!key || !token) {
      return HttpResponse.json({
        message: 'unauthorized',
      }, { status: 401 });
    }

    return HttpResponse.json({
      id: params.boardId,
      name: 'Test Board',
      desc: 'Test board description',
      closed: false,
      url: `https://trello.com/b/${params.boardId}`,
    });
  }),

  // Create board
  http.post('https://api.trello.com/1/boards', async ({ request }) => {
    const url = new URL(request.url);
    const name = url.searchParams.get('name');

    if (!name) {
      return HttpResponse.json({
        message: 'name is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'board123',
      name,
      desc: url.searchParams.get('desc') || '',
      closed: false,
      url: 'https://trello.com/b/board123',
    });
  }),

  // Get lists on board
  http.get('https://api.trello.com/1/boards/:boardId/lists', ({ params }) => {
    return HttpResponse.json([
      { id: 'list1', name: 'To Do', idBoard: params.boardId, closed: false },
      { id: 'list2', name: 'In Progress', idBoard: params.boardId, closed: false },
      { id: 'list3', name: 'Done', idBoard: params.boardId, closed: false },
    ]);
  }),

  // Create list
  http.post('https://api.trello.com/1/lists', async ({ request }) => {
    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    const idBoard = url.searchParams.get('idBoard');

    if (!name || !idBoard) {
      return HttpResponse.json({
        message: 'name and idBoard are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'newList1',
      name,
      idBoard,
      closed: false,
    });
  }),

  // Get card
  http.get('https://api.trello.com/1/cards/:cardId', ({ params }) => {
    return HttpResponse.json({
      id: params.cardId,
      name: 'Test Card',
      desc: 'Test card description',
      idList: 'list1',
      due: null,
      url: `https://trello.com/c/${params.cardId}`,
    });
  }),

  // Create card
  http.post('https://api.trello.com/1/cards', async ({ request }) => {
    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    const idList = url.searchParams.get('idList');

    if (!name || !idList) {
      return HttpResponse.json({
        message: 'name and idList are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'newCard1',
      name,
      desc: url.searchParams.get('desc') || '',
      idList,
      due: url.searchParams.get('due') || null,
      url: 'https://trello.com/c/newCard1',
    });
  }),

  // Update card - Trello uses query params for updates
  http.put('https://api.trello.com/1/cards/:cardId', async ({ request, params }) => {
    const url = new URL(request.url);

    // Trello SDK passes parameters as query params for PUT requests
    const name = url.searchParams.get('name');
    const desc = url.searchParams.get('desc');
    const idList = url.searchParams.get('idList');
    const due = url.searchParams.get('due');

    return HttpResponse.json({
      id: params.cardId,
      name: name || 'Test Card',
      desc: desc || '',
      idList: idList || 'list1',
      due: due || null,
      url: `https://trello.com/c/${params.cardId}`,
    });
  }),

  // Delete card
  http.delete('https://api.trello.com/1/cards/:cardId', () => {
    return HttpResponse.json({ limits: {} });
  }),

  // Add comment to card
  http.post('https://api.trello.com/1/cards/:cardId/actions/comments', async ({ request, params }) => {
    const url = new URL(request.url);
    const text = url.searchParams.get('text');

    if (!text) {
      return HttpResponse.json({
        message: 'text is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'action1',
      type: 'commentCard',
      data: { text, card: { id: params.cardId } },
      date: '2024-01-02T00:00:00.000Z',
    });
  }),

  // Add label to card
  http.post('https://api.trello.com/1/cards/:cardId/idLabels', async ({ request }) => {
    const url = new URL(request.url);
    const value = url.searchParams.get('value');

    if (!value) {
      return HttpResponse.json({
        message: 'labelId is required',
      }, { status: 400 });
    }

    return HttpResponse.json([value]);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Trello Contract Tests', () => {
  it('should get board successfully', async () => {
    const client = new MockTrelloSDK('test-api-key', 'test-token');
    const wrapper = new TrelloClient(client as any);
    const wrapped = wrapIntegration('trello', wrapper, {
      inputSchemas: trelloSchemas,
    });

    const board = await wrapped.getBoard('board123');

    expect(board.id).toBe('board123');
    expect(board.name).toBe('Test Board');
  });

  it('should reject invalid inputs (missing boardId)', async () => {
    const client = new MockTrelloSDK('test-api-key', 'test-token');
    const wrapper = new TrelloClient(client as any);
    const wrapped = wrapIntegration('trello', wrapper, {
      inputSchemas: trelloSchemas,
    });

    // Empty boardId reaches API and gets 404 error
    await expect(
      wrapped.getBoard('')
    ).rejects.toThrow();
  });

  it('should create board successfully', async () => {
    const client = new MockTrelloSDK('test-api-key', 'test-token');
    const wrapper = new TrelloClient(client as any);
    const wrapped = wrapIntegration('trello', wrapper, {
      inputSchemas: trelloSchemas,
    });

    const board = await wrapped.createBoard({
      name: 'New Project',
      desc: 'Project board',
    });

    expect(board.id).toBe('board123');
    expect(board.name).toBe('New Project');
  });

  it('should reject invalid inputs (missing board name)', async () => {
    const client = new MockTrelloSDK('test-api-key', 'test-token');
    const wrapper = new TrelloClient(client as any);
    const wrapped = wrapIntegration('trello', wrapper, {
      inputSchemas: trelloSchemas,
    });

    await expect(
      wrapped.createBoard({ name: '' })
    ).rejects.toThrow(/name/);
  });

  it('should get lists on board successfully', async () => {
    const client = new MockTrelloSDK('test-api-key', 'test-token');
    const wrapper = new TrelloClient(client as any);
    const wrapped = wrapIntegration('trello', wrapper, {
      inputSchemas: trelloSchemas,
    });

    const lists = await wrapped.getListsOnBoard('board123');

    expect(lists).toHaveLength(3);
    expect(lists[0].name).toBe('To Do');
    expect(lists[2].name).toBe('Done');
  });

  it('should create card successfully', async () => {
    const client = new MockTrelloSDK('test-api-key', 'test-token');
    const wrapper = new TrelloClient(client as any);
    const wrapped = wrapIntegration('trello', wrapper, {
      inputSchemas: trelloSchemas,
    });

    const card = await wrapped.createCard({
      name: 'New Task',
      idList: 'list1',
      desc: 'Task description',
    });

    expect(card.id).toBe('newCard1');
    expect(card.name).toBe('New Task');
    expect(card.idList).toBe('list1');
  });

  it('should reject invalid inputs (missing idList)', async () => {
    const client = new MockTrelloSDK('test-api-key', 'test-token');
    const wrapper = new TrelloClient(client as any);
    const wrapped = wrapIntegration('trello', wrapper, {
      inputSchemas: trelloSchemas,
    });

    await expect(
      wrapped.createCard({
        name: 'Test',
        idList: '',
      })
    ).rejects.toThrow(/idList/);
  });

  it('should update card successfully', async () => {
    const client = new MockTrelloSDK('test-api-key', 'test-token');
    const wrapper = new TrelloClient(client as any);
    const wrapped = wrapIntegration('trello', wrapper, {
      inputSchemas: trelloSchemas,
    });

    const card = await wrapped.updateCard('card123', {
      name: 'Updated Task',
      desc: 'Updated description',
    });

    expect(card.id).toBe('card123');
    expect(card.name).toBe('Updated Task');
  });

  it('should add comment to card successfully', async () => {
    const client = new MockTrelloSDK('test-api-key', 'test-token');
    const wrapper = new TrelloClient(client as any);
    const wrapped = wrapIntegration('trello', wrapper, {
      inputSchemas: trelloSchemas,
    });

    const result = await wrapped.addCommentToCard('card123', 'Great work!');

    expect(result.id).toBe('action1');
    expect(result.data.text).toBe('Great work!');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://api.trello.com/1/cards', () => {
        return HttpResponse.json({
          message: 'Unauthorized',
        }, { status: 401 });
      })
    );

    const client = new MockTrelloSDK('test-api-key', 'test-token');
    const wrapper = new TrelloClient(client as any);
    const wrapped = wrapIntegration('trello', wrapper, {
      inputSchemas: trelloSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.createCard({
        name: 'Test',
        idList: 'list1',
      })
    ).rejects.toThrow();
  });
});
