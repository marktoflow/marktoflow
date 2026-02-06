/**
 * Contract tests for Telegram integration
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
import { telegramSchemas } from '../../src/reliability/schemas/telegram.js';
import { TelegramClient } from '../../src/services/telegram.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Get bot info
  http.post('https://api.telegram.org/bottest-token/getMe', () => {
    return HttpResponse.json({
      ok: true,
      result: {
        id: 123456789,
        isBot: true,
        firstName: 'Test Bot',
        username: 'testbot',
      },
    });
  }),

  // Send message
  http.post('https://api.telegram.org/bottest-token/sendMessage', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.chat_id || !body.text) {
      return HttpResponse.json({
        ok: false,
        description: 'Bad Request: chat_id and text are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      ok: true,
      result: {
        messageId: 1001,
        from: { id: 123456789, isBot: true, firstName: 'Test Bot' },
        chat: { id: body.chat_id, type: 'private' },
        date: 1704067200,
        text: body.text,
      },
    });
  }),

  // Send photo
  http.post('https://api.telegram.org/bottest-token/sendPhoto', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.chat_id || !body.photo) {
      return HttpResponse.json({
        ok: false,
        description: 'Bad Request: chat_id and photo are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      ok: true,
      result: {
        messageId: 1002,
        from: { id: 123456789, isBot: true, firstName: 'Test Bot' },
        chat: { id: body.chat_id, type: 'private' },
        date: 1704067200,
        photo: [{ fileId: 'photo123', width: 800, height: 600 }],
        caption: body.caption,
      },
    });
  }),

  // Send document
  http.post('https://api.telegram.org/bottest-token/sendDocument', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.chat_id || !body.document) {
      return HttpResponse.json({
        ok: false,
        description: 'Bad Request: chat_id and document are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      ok: true,
      result: {
        messageId: 1003,
        from: { id: 123456789, isBot: true, firstName: 'Test Bot' },
        chat: { id: body.chat_id, type: 'private' },
        date: 1704067200,
        document: { fileId: 'doc123', fileName: 'test.pdf' },
        caption: body.caption,
      },
    });
  }),

  // Edit message text
  http.post('https://api.telegram.org/bottest-token/editMessageText', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.chat_id || !body.message_id || !body.text) {
      return HttpResponse.json({
        ok: false,
        description: 'Bad Request: chat_id, message_id, and text are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      ok: true,
      result: {
        messageId: body.message_id,
        from: { id: 123456789, isBot: true, firstName: 'Test Bot' },
        chat: { id: body.chat_id, type: 'private' },
        date: 1704067200,
        text: body.text,
        editDate: 1704067300,
      },
    });
  }),

  // Delete message
  http.post('https://api.telegram.org/bottest-token/deleteMessage', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.chat_id || !body.message_id) {
      return HttpResponse.json({
        ok: false,
        description: 'Bad Request: chat_id and message_id are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      ok: true,
      result: true,
    });
  }),

  // Get updates
  http.post('https://api.telegram.org/bottest-token/getUpdates', () => {
    return HttpResponse.json({
      ok: true,
      result: [
        {
          updateId: 1,
          message: {
            messageId: 100,
            from: { id: 987654321, isBot: false, firstName: 'User' },
            chat: { id: 987654321, type: 'private' },
            date: 1704067200,
            text: 'Hello bot',
          },
        },
      ],
    });
  }),

  // Get chat
  http.post('https://api.telegram.org/bottest-token/getChat', async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      ok: true,
      result: {
        id: body.chat_id,
        type: 'private',
        firstName: 'Test User',
      },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Telegram Contract Tests', () => {
  it('should get bot info successfully', async () => {
    const client = new TelegramClient('test-token');
    const wrapped = wrapIntegration('telegram', client, {
      inputSchemas: telegramSchemas,
    });

    const botInfo = await wrapped.getMe();

    expect(botInfo.isBot).toBe(true);
    expect(botInfo.firstName).toBe('Test Bot');
    expect(botInfo.username).toBe('testbot');
  });

  it('should send message successfully', async () => {
    const client = new TelegramClient('test-token');
    const wrapped = wrapIntegration('telegram', client, {
      inputSchemas: telegramSchemas,
    });

    const message = await wrapped.sendMessage({
      chatId: 12345,
      text: 'Hello, world!',
    });

    expect(message.messageId).toBe(1001);
    expect(message.text).toBe('Hello, world!');
  });

  it('should reject invalid inputs (missing chatId)', async () => {
    const client = new TelegramClient('test-token');
    const wrapped = wrapIntegration('telegram', client, {
      inputSchemas: telegramSchemas,
    });

    await expect(
      wrapped.sendMessage({
        chatId: '',
        text: 'Hello',
      })
    ).rejects.toThrow();
  });

  it('should reject invalid inputs (missing text)', async () => {
    const client = new TelegramClient('test-token');
    const wrapped = wrapIntegration('telegram', client, {
      inputSchemas: telegramSchemas,
    });

    await expect(
      wrapped.sendMessage({
        chatId: 12345,
        text: '',
      })
    ).rejects.toThrow(/text/);
  });

  it('should send photo successfully', async () => {
    const client = new TelegramClient('test-token');
    const wrapped = wrapIntegration('telegram', client, {
      inputSchemas: telegramSchemas,
    });

    const message = await wrapped.sendPhoto({
      chatId: 12345,
      photo: 'https://example.com/photo.jpg',
      caption: 'Check this out!',
    });

    expect(message.messageId).toBe(1002);
    expect(message.caption).toBe('Check this out!');
  });

  it('should send document successfully', async () => {
    const client = new TelegramClient('test-token');
    const wrapped = wrapIntegration('telegram', client, {
      inputSchemas: telegramSchemas,
    });

    const message = await wrapped.sendDocument({
      chatId: 12345,
      document: 'https://example.com/doc.pdf',
      caption: 'Important document',
    });

    expect(message.messageId).toBe(1003);
    expect(message.document?.fileName).toBe('test.pdf');
  });

  it('should edit message text successfully', async () => {
    const client = new TelegramClient('test-token');
    const wrapped = wrapIntegration('telegram', client, {
      inputSchemas: telegramSchemas,
    });

    const message = await wrapped.editMessageText(
      12345,
      1001,
      'Updated text'
    );

    expect(message.text).toBe('Updated text');
    expect(message.editDate).toBe(1704067300);
  });

  it('should delete message successfully', async () => {
    const client = new TelegramClient('test-token');
    const wrapped = wrapIntegration('telegram', client, {
      inputSchemas: telegramSchemas,
    });

    const result = await wrapped.deleteMessage(12345, 1001);

    expect(result).toBe(true);
  });

  it('should get updates successfully', async () => {
    const client = new TelegramClient('test-token');
    const wrapped = wrapIntegration('telegram', client, {
      inputSchemas: telegramSchemas,
    });

    const updates = await wrapped.getUpdates();

    expect(updates).toHaveLength(1);
    expect(updates[0].message?.text).toBe('Hello bot');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://api.telegram.org/bottest-token/sendMessage', () => {
        return HttpResponse.json({
          ok: false,
          description: 'Forbidden: bot was blocked by the user',
        }, { status: 403 });
      })
    );

    const client = new TelegramClient('test-token');
    const wrapped = wrapIntegration('telegram', client, {
      inputSchemas: telegramSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.sendMessage({
        chatId: 12345,
        text: 'Hello',
      })
    ).rejects.toThrow();
  });
});
