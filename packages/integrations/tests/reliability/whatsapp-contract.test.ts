/**
 * Contract tests for WhatsApp integration
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
import { whatsappSchemas } from '../../src/reliability/schemas/whatsapp.js';
import { WhatsAppClient } from '../../src/services/whatsapp.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // All /messages endpoints - handle based on request body type
  http.post('https://graph.facebook.com/v18.0/123456789/messages', async ({ request }) => {
    const body = await request.json() as any;

    // Mark as read
    if (body.status === 'read') {
      if (!body.message_id) {
        return HttpResponse.json({
          error: {
            message: 'message_id is required',
            type: 'OAuthException',
            code: 100,
          },
        }, { status: 400 });
      }

      return HttpResponse.json({
        success: true,
      });
    }

    // Send text message
    if (body.type === 'text') {
      if (!body.to || !body.text) {
        return HttpResponse.json({
          error: {
            message: 'to and text are required',
            type: 'OAuthException',
            code: 100,
          },
        }, { status: 400 });
      }

      return HttpResponse.json({
        messaging_product: 'whatsapp',
        contacts: [{ input: body.to, wa_id: body.to }],
        messages: [{ id: 'wamid.msg123' }],
      });
    }

    // Send template
    if (body.type === 'template') {
      if (!body.template?.name || !body.template?.language) {
        return HttpResponse.json({
          error: {
            message: 'template name and language are required',
            type: 'OAuthException',
            code: 100,
          },
        }, { status: 400 });
      }

      return HttpResponse.json({
        messaging_product: 'whatsapp',
        contacts: [{ input: body.to, wa_id: body.to }],
        messages: [{ id: 'wamid.template123' }],
      });
    }

    // Send image/video/document/audio/location - generic response
    if (body.type === 'image' || body.type === 'video' || body.type === 'document' || body.type === 'audio' || body.type === 'location') {
      if (!body.to) {
        return HttpResponse.json({
          error: {
            message: 'to is required',
            type: 'OAuthException',
            code: 100,
          },
        }, { status: 400 });
      }

      return HttpResponse.json({
        messaging_product: 'whatsapp',
        contacts: [{ input: body.to, wa_id: body.to }],
        messages: [{ id: `wamid.${body.type}123` }],
      });
    }

    // Default response for unknown types
    return HttpResponse.json({
      messaging_product: 'whatsapp',
      contacts: [{ input: body.to, wa_id: body.to }],
      messages: [{ id: 'wamid.default123' }],
    });
  }),

  // Get media URL
  http.get('https://graph.facebook.com/v18.0/:mediaId', ({ params }) => {
    return HttpResponse.json({
      url: `https://example.com/media/${params.mediaId}`,
      mime_type: 'image/jpeg',
      sha256: 'abc123',
      file_size: 12345,
    });
  }),

  // Upload media
  http.post('https://graph.facebook.com/v18.0/123456789/media', () => {
    return HttpResponse.json({
      id: 'media123',
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('WhatsApp Contract Tests', () => {
  it('should send text message successfully', async () => {
    const client = new WhatsAppClient('123456789', 'test-token');
    const wrapped = wrapIntegration('whatsapp', client, {
      inputSchemas: whatsappSchemas,
    });

    const result = await wrapped.sendText({
      to: '1234567890',
      text: 'Hello, world!',
    });

    expect(result.messaging_product).toBe('whatsapp');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe('wamid.msg123');
  });

  it('should reject invalid inputs (missing to)', async () => {
    const client = new WhatsAppClient('123456789', 'test-token');
    const wrapped = wrapIntegration('whatsapp', client, {
      inputSchemas: whatsappSchemas,
    });

    await expect(
      wrapped.sendText({
        to: '',
        text: 'Hello',
      })
    ).rejects.toThrow(/to/);
  });

  it('should reject invalid inputs (missing text)', async () => {
    const client = new WhatsAppClient('123456789', 'test-token');
    const wrapped = wrapIntegration('whatsapp', client, {
      inputSchemas: whatsappSchemas,
    });

    await expect(
      wrapped.sendText({
        to: '1234567890',
        text: '',
      })
    ).rejects.toThrow(/text/);
  });

  it('should send template message successfully', async () => {
    const client = new WhatsAppClient('123456789', 'test-token');
    const wrapped = wrapIntegration('whatsapp', client, {
      inputSchemas: whatsappSchemas,
    });

    const result = await wrapped.sendTemplate({
      to: '1234567890',
      templateName: 'hello_world',
      languageCode: 'en',
    });

    expect(result.messaging_product).toBe('whatsapp');
    expect(result.messages).toHaveLength(1);
  });

  it('should reject invalid inputs (missing templateName)', async () => {
    const client = new WhatsAppClient('123456789', 'test-token');
    const wrapped = wrapIntegration('whatsapp', client, {
      inputSchemas: whatsappSchemas,
    });

    await expect(
      wrapped.sendTemplate({
        to: '1234567890',
        templateName: '',
        languageCode: 'en',
      })
    ).rejects.toThrow(/templateName/);
  });

  it('should send image successfully', async () => {
    const client = new WhatsAppClient('123456789', 'test-token');
    const wrapped = wrapIntegration('whatsapp', client, {
      inputSchemas: whatsappSchemas,
    });

    const result = await wrapped.sendImage({
      to: '1234567890',
      mediaUrl: 'https://example.com/image.jpg',
      caption: 'Check this out!',
    });

    expect(result.messaging_product).toBe('whatsapp');
    expect(result.messages).toHaveLength(1);
  });

  it('should send location successfully', async () => {
    const client = new WhatsAppClient('123456789', 'test-token');
    const wrapped = wrapIntegration('whatsapp', client, {
      inputSchemas: whatsappSchemas,
    });

    const result = await wrapped.sendLocation({
      to: '1234567890',
      latitude: 37.7749,
      longitude: -122.4194,
      name: 'San Francisco',
      address: 'CA, USA',
    });

    expect(result.messaging_product).toBe('whatsapp');
    expect(result.messages).toHaveLength(1);
  });

  it('should mark message as read successfully', async () => {
    const client = new WhatsAppClient('123456789', 'test-token');
    const wrapped = wrapIntegration('whatsapp', client, {
      inputSchemas: whatsappSchemas,
    });

    const result = await wrapped.markAsRead('wamid.msg123');

    expect(result.success).toBe(true);
  });

  it('should get media URL successfully', async () => {
    const client = new WhatsAppClient('123456789', 'test-token');
    const wrapped = wrapIntegration('whatsapp', client, {
      inputSchemas: whatsappSchemas,
    });

    const mediaInfo = await wrapped.getMediaUrl('media123');

    expect(mediaInfo.url).toContain('media123');
    expect(mediaInfo.mimeType).toBe('image/jpeg');
    expect(mediaInfo.fileSize).toBe(12345);
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://graph.facebook.com/v18.0/123456789/messages', () => {
        return HttpResponse.json({
          error: {
            message: 'Invalid OAuth access token',
            type: 'OAuthException',
            code: 190,
          },
        }, { status: 401 });
      })
    );

    const client = new WhatsAppClient('123456789', 'test-token');
    const wrapped = wrapIntegration('whatsapp', client, {
      inputSchemas: whatsappSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.sendText({
        to: '1234567890',
        text: 'Hello',
      })
    ).rejects.toThrow();
  });
});
