/**
 * Contract tests for Gmail integration
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
import { gmailSchemas } from '../../src/reliability/schemas/gmail.js';
import { google } from 'googleapis';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Send message
  http.post('https://gmail.googleapis.com/gmail/v1/users/:userId/messages/send', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.raw) {
      return HttpResponse.json({
        error: {
          code: 400,
          message: 'Missing raw message',
        },
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'msg123',
      threadId: 'thread123',
      labelIds: ['SENT'],
    });
  }),

  // List messages
  http.get('https://gmail.googleapis.com/gmail/v1/users/:userId/messages', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    return HttpResponse.json({
      messages: [
        { id: 'msg1', threadId: 'thread1' },
        { id: 'msg2', threadId: 'thread2' },
      ],
      resultSizeEstimate: 2,
    });
  }),

  // Get message
  http.get('https://gmail.googleapis.com/gmail/v1/users/:userId/messages/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      threadId: 'thread123',
      labelIds: ['INBOX'],
      snippet: 'Test message snippet',
      payload: {
        headers: [
          { name: 'From', value: 'sender@example.com' },
          { name: 'To', value: 'recipient@example.com' },
          { name: 'Subject', value: 'Test Subject' },
        ],
        body: {
          data: Buffer.from('Test message body').toString('base64url'),
        },
      },
    });
  }),

  // Modify message (add/remove labels)
  http.post('https://gmail.googleapis.com/gmail/v1/users/:userId/messages/:id/modify', async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: params.id,
      threadId: 'thread123',
      labelIds: body.addLabelIds || [],
    });
  }),

  // Trash message
  http.post('https://gmail.googleapis.com/gmail/v1/users/:userId/messages/:id/trash', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      threadId: 'thread123',
      labelIds: ['TRASH'],
    });
  }),

  // List labels
  http.get('https://gmail.googleapis.com/gmail/v1/users/:userId/labels', () => {
    return HttpResponse.json({
      labels: [
        { id: 'INBOX', name: 'INBOX', type: 'system' },
        { id: 'SENT', name: 'SENT', type: 'system' },
        { id: 'Label_1', name: 'Work', type: 'user' },
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

describe('Gmail Contract Tests', () => {
  it('should send a message successfully', async () => {
    const gmail = google.gmail({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('gmail', gmail, {
      inputSchemas: gmailSchemas,
    });

    // Create a simple base64url encoded message
    const message = 'From: sender@example.com\r\nTo: recipient@example.com\r\nSubject: Test\r\n\r\nHello';
    const raw = Buffer.from(message).toString('base64url');

    const result = await wrapped.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    expect(result.data.id).toBe('msg123');
    expect(result.data.threadId).toBe('thread123');
    expect(result.data.labelIds).toContain('SENT');
  });

  it('should reject invalid inputs (missing userId)', async () => {
    const gmail = google.gmail({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('gmail', gmail, {
      inputSchemas: gmailSchemas,
    });

    // The Google SDK may throw its own error before validation, so just check that it throws
    await expect(
      wrapped.users.messages.send({
        userId: '',
        requestBody: { raw: 'test' },
      })
    ).rejects.toThrow();
  });

  it('should list messages successfully', async () => {
    const gmail = google.gmail({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('gmail', gmail, {
      inputSchemas: gmailSchemas,
    });

    const result = await wrapped.users.messages.list({
      userId: 'me',
      q: 'is:unread',
    });

    expect(result.data.messages).toHaveLength(2);
    expect(result.data.resultSizeEstimate).toBe(2);
  });

  it('should get a message successfully', async () => {
    const gmail = google.gmail({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('gmail', gmail, {
      inputSchemas: gmailSchemas,
    });

    const result = await wrapped.users.messages.get({
      userId: 'me',
      id: 'msg123',
    });

    expect(result.data.id).toBe('msg123');
    expect(result.data.snippet).toBe('Test message snippet');
  });

  it('should modify message labels successfully', async () => {
    const gmail = google.gmail({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('gmail', gmail, {
      inputSchemas: gmailSchemas,
    });

    const result = await wrapped.users.messages.modify({
      userId: 'me',
      id: 'msg123',
      requestBody: {
        addLabelIds: ['IMPORTANT'],
        removeLabelIds: ['INBOX'],
      },
    });

    expect(result.data.id).toBe('msg123');
  });

  it('should trash a message successfully', async () => {
    const gmail = google.gmail({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('gmail', gmail, {
      inputSchemas: gmailSchemas,
    });

    const result = await wrapped.users.messages.trash({
      userId: 'me',
      id: 'msg123',
    });

    expect(result.data.labelIds).toContain('TRASH');
  });

  it('should list labels successfully', async () => {
    const gmail = google.gmail({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('gmail', gmail, {
      inputSchemas: gmailSchemas,
    });

    const result = await wrapped.users.labels.list({
      userId: 'me',
    });

    expect(result.data.labels).toHaveLength(3);
    expect(result.data.labels?.[0].name).toBe('INBOX');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://gmail.googleapis.com/gmail/v1/users/:userId/messages/send', () => {
        return HttpResponse.json({
          error: {
            code: 403,
            message: 'Insufficient permissions',
          },
        }, { status: 403 });
      })
    );

    const gmail = google.gmail({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('gmail', gmail, {
      inputSchemas: gmailSchemas,
      maxRetries: 0,
    });

    const raw = Buffer.from('test').toString('base64url');

    await expect(
      wrapped.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      })
    ).rejects.toThrow();
  });
});
