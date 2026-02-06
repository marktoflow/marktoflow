/**
 * Contract tests for Intercom integration
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
import { intercomSchemas } from '../../src/reliability/schemas/intercom.js';
import { IntercomClient } from '../../src/services/intercom.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const BASE_URL = 'https://api.intercom.io';

const server = setupServer(
  // Create contact
  http.post(`${BASE_URL}/contacts`, async ({ request }) => {
    const body = await request.json() as any;

    if (!body.role || !body.email) {
      return HttpResponse.json({
        type: 'error.list',
        errors: [{ message: 'role and email are required' }],
      }, { status: 400 });
    }

    if (body.role !== 'user' && body.role !== 'lead') {
      return HttpResponse.json({
        type: 'error.list',
        errors: [{ message: 'role must be user or lead' }],
      }, { status: 400 });
    }

    return HttpResponse.json({
      type: 'contact',
      id: 'contact-123',
      external_id: body.external_id,
      email: body.email,
      name: body.name,
      role: body.role,
      created_at: 1609459200,
      updated_at: 1609459200,
      custom_attributes: body.custom_attributes || {},
    });
  }),

  // Get contact
  http.get(`${BASE_URL}/contacts/:contactId`, ({ params }) => {
    return HttpResponse.json({
      type: 'contact',
      id: params.contactId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      created_at: 1609459200,
      updated_at: 1609459200,
    });
  }),

  // List contacts
  http.get(`${BASE_URL}/contacts`, () => {
    return HttpResponse.json({
      data: [
        {
          type: 'contact',
          id: 'contact-1',
          email: 'user1@example.com',
          name: 'User One',
          role: 'user',
          created_at: 1609459200,
          updated_at: 1609459200,
        },
      ],
      pages: { page: 1, per_page: 50, total_pages: 1 },
    });
  }),

  // Update contact
  http.put(`${BASE_URL}/contacts/:contactId`, async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      type: 'contact',
      id: params.contactId,
      email: body.email || 'test@example.com',
      name: body.name || 'Test User',
      phone: body.phone,
      role: 'user',
      created_at: 1609459200,
      updated_at: 1609545600,
      custom_attributes: body.custom_attributes || {},
    });
  }),

  // Search contacts
  http.post(`${BASE_URL}/contacts/search`, async ({ request }) => {
    return HttpResponse.json({
      data: [
        {
          type: 'contact',
          id: 'contact-1',
          email: 'search@example.com',
          name: 'Search Result',
          role: 'user',
          created_at: 1609459200,
          updated_at: 1609459200,
        },
      ],
      total_count: 1,
    });
  }),

  // Create conversation
  http.post(`${BASE_URL}/conversations`, async ({ request }) => {
    const body = await request.json() as any;

    if (!body.from || !body.body) {
      return HttpResponse.json({
        type: 'error.list',
        errors: [{ message: 'from and body are required' }],
      }, { status: 400 });
    }

    return HttpResponse.json({
      type: 'conversation',
      id: 'conv-123',
      created_at: 1609459200,
      updated_at: 1609459200,
      source: {
        type: 'conversation',
        id: 'conv-123',
        delivered_as: 'operator_initiated',
        subject: '',
        body: body.body,
      },
      contacts: { contacts: [] },
      state: 'open',
      read: false,
      priority: 'not_priority',
    });
  }),

  // Get conversation
  http.get(`${BASE_URL}/conversations/:conversationId`, ({ params }) => {
    return HttpResponse.json({
      type: 'conversation',
      id: params.conversationId,
      created_at: 1609459200,
      updated_at: 1609459200,
      source: {
        type: 'conversation',
        id: params.conversationId,
        delivered_as: 'operator_initiated',
        subject: '',
        body: 'Test conversation',
      },
      contacts: { contacts: [] },
      state: 'open',
      read: false,
      priority: 'not_priority',
    });
  }),

  // List conversations
  http.get(`${BASE_URL}/conversations`, () => {
    return HttpResponse.json({
      conversations: [
        {
          type: 'conversation',
          id: 'conv-1',
          created_at: 1609459200,
          updated_at: 1609459200,
          source: {
            type: 'conversation',
            id: 'conv-1',
            delivered_as: 'operator_initiated',
            subject: '',
            body: 'Test',
          },
          contacts: { contacts: [] },
          state: 'open',
          read: false,
          priority: 'not_priority',
        },
      ],
      pages: { page: 1, per_page: 50, total_pages: 1 },
    });
  }),

  // Reply to conversation
  http.post(`${BASE_URL}/conversations/:conversationId/reply`, async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      type: 'conversation',
      id: params.conversationId,
      created_at: 1609459200,
      updated_at: 1609545600,
      source: {
        type: 'conversation',
        id: params.conversationId,
        delivered_as: 'operator_initiated',
        subject: '',
        body: body.body,
      },
      contacts: { contacts: [] },
      state: 'open',
      read: false,
      priority: 'not_priority',
    });
  }),

  // Close conversation
  http.post(`${BASE_URL}/conversations/:conversationId/parts`, async ({ params }) => {
    return HttpResponse.json({
      type: 'conversation',
      id: params.conversationId,
      created_at: 1609459200,
      updated_at: 1609545600,
      source: {
        type: 'conversation',
        id: params.conversationId,
        delivered_as: 'operator_initiated',
        subject: '',
        body: 'Conversation closed',
      },
      contacts: { contacts: [] },
      state: 'closed',
      read: true,
      priority: 'not_priority',
    });
  }),

  // Send message
  http.post(`${BASE_URL}/messages`, async ({ request }) => {
    const body = await request.json() as any;

    if (!body.from || !body.to || !body.body) {
      return HttpResponse.json({
        type: 'error.list',
        errors: [{ message: 'from, to, and body are required' }],
      }, { status: 400 });
    }

    return HttpResponse.json({
      type: 'message',
      id: 'msg-123',
      created_at: 1609459200,
      body: body.body,
      message_type: body.message_type,
    });
  }),

  // List tags
  http.get(`${BASE_URL}/tags`, () => {
    return HttpResponse.json({
      data: [
        {
          type: 'tag',
          id: 'tag-1',
          name: 'VIP',
        },
      ],
    });
  }),

  // Create tag
  http.post(`${BASE_URL}/tags`, async ({ request }) => {
    const body = await request.json() as any;

    if (!body.name) {
      return HttpResponse.json({
        type: 'error.list',
        errors: [{ message: 'name is required' }],
      }, { status: 400 });
    }

    return HttpResponse.json({
      type: 'tag',
      id: 'tag-new',
      name: body.name,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Intercom Contract Tests', () => {
  it('should create a contact successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.createContact('user', 'test@example.com', {
      name: 'Test User',
    });

    expect(result.id).toBe('contact-123');
    expect(result.email).toBe('test@example.com');
  });

  it('should reject invalid contact (missing role)', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    await expect(
      wrapped.createContact('invalid' as any, 'test@example.com')
    ).rejects.toThrow();
  });

  it('should get a contact successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.getContact('contact-123');

    expect(result.id).toBe('contact-123');
    expect(result.email).toBe('test@example.com');
  });

  it('should list contacts successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.listContacts({ per_page: 50 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].email).toBe('user1@example.com');
  });

  it('should update a contact successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.updateContact('contact-123', {
      name: 'Updated Name',
    });

    expect(result.id).toBe('contact-123');
    expect(result.name).toBe('Updated Name');
  });

  it('should search contacts successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.searchContacts({
      field: 'email',
      operator: '=',
      value: 'search@example.com',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].email).toBe('search@example.com');
  });

  it('should create a conversation successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.createConversation({
      from: { type: 'user', id: 'user-123' },
      body: 'Hello, support!',
    });

    expect(result.id).toBe('conv-123');
    expect(result.state).toBe('open');
  });

  it('should reply to a conversation successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.replyToConversation({
      conversationId: 'conv-123',
      body: 'Reply message',
      type: 'comment',
    });

    expect(result.id).toBe('conv-123');
  });

  it('should close a conversation successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.closeConversation('conv-123');

    expect(result.state).toBe('closed');
  });

  it('should send a message successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.sendMessage({
      from: { type: 'admin', id: 'admin-1' },
      to: { type: 'user', id: 'user-123' },
      body: 'Hello!',
      messageType: 'email',
    });

    expect(result.id).toBe('msg-123');
  });

  it('should list tags successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.listTags();

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('VIP');
  });

  it('should create a tag successfully', async () => {
    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
    });

    const result = await wrapped.createTag('New Tag');

    expect(result.id).toBe('tag-new');
    expect(result.name).toBe('New Tag');
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      http.post(`${BASE_URL}/contacts`, () => {
        return HttpResponse.json({
          type: 'error.list',
          errors: [{ message: 'Unauthorized' }],
        }, { status: 401 });
      })
    );

    const client = new IntercomClient('test-token');
    const wrapped = wrapIntegration('intercom', client, {
      inputSchemas: intercomSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.createContact('user', 'test@example.com')
    ).rejects.toThrow();
  });
});
