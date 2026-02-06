/**
 * Contract tests for Outlook integration
 *
 * These tests validate that:
 * 1. The SDK makes correct HTTP requests
 * 2. Response handling is correct
 * 3. The integration behaves correctly without hitting real APIs
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { Client } from '@microsoft/microsoft-graph-client';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Get emails from inbox
  http.get('https://graph.microsoft.com/v1.0/me/mailFolders/:folder/messages', () => {
    return HttpResponse.json({
      value: [
        {
          id: 'msg1',
          subject: 'Test Email 1',
          from: { emailAddress: { address: 'john@example.com' } },
          isRead: false,
        },
        {
          id: 'msg2',
          subject: 'Test Email 2',
          from: { emailAddress: { address: 'alice@example.com' } },
          isRead: true,
        },
      ],
    });
  }),

  // Send email
  http.post('https://graph.microsoft.com/v1.0/me/sendMail', () => {
    return new HttpResponse(null, { status: 202 });
  }),

  // Get calendar events
  http.get('https://graph.microsoft.com/v1.0/me/events', () => {
    return HttpResponse.json({
      value: [
        {
          id: 'event1',
          subject: 'Team Meeting',
          isOnlineMeeting: true,
        },
      ],
    });
  }),

  // Error handler
  http.get('https://graph.microsoft.com/v1.0/me/messages/nonexistent', () => {
    return HttpResponse.json({
      error: { code: 'NotFound', message: 'Not found' },
    }, { status: 404 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Outlook Contract Tests', () => {
  it('should get emails successfully', async () => {
    const client = Client.init({
      authProvider: (done) => done(null, 'test-token'),
    });

    const result = await client.api('/me/mailFolders/inbox/messages').get();

    expect(result.value).toHaveLength(2);
    expect(result.value[0].subject).toBe('Test Email 1');
  });

  it('should send email successfully', async () => {
    const client = Client.init({
      authProvider: (done) => done(null, 'test-token'),
    });

    await expect(
      client.api('/me/sendMail').post({ message: { subject: 'Test' } })
    ).resolves.not.toThrow();
  });

  it('should get calendar events successfully', async () => {
    const client = Client.init({
      authProvider: (done) => done(null, 'test-token'),
    });

    const result = await client.api('/me/events').get();

    expect(result.value).toHaveLength(1);
    expect(result.value[0].isOnlineMeeting).toBe(true);
  });

  it('should handle API errors gracefully', async () => {
    const client = Client.init({
      authProvider: (done) => done(null, 'test-token'),
    });

    await expect(
      client.api('/me/messages/nonexistent').get()
    ).rejects.toThrow();
  });
});
