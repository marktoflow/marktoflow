import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WhatsAppInitializer, WhatsAppClient } from '../src/services/whatsapp.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('WhatsApp Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WhatsAppInitializer', () => {
    it('should throw if required auth fields are missing', async () => {
      const config = { sdk: 'whatsapp', auth: {} };
      await expect(WhatsAppInitializer.initialize(null, config as any)).rejects.toThrow(
        'WhatsApp SDK requires auth.phone_number_id and auth.access_token'
      );
    });

    it('should throw if access_token is missing', async () => {
      const config = {
        sdk: 'whatsapp',
        auth: {
          phone_number_id: 'phone123',
        },
      };
      await expect(WhatsAppInitializer.initialize(null, config as any)).rejects.toThrow();
    });

    it('should initialize with valid config', async () => {
      const config = {
        sdk: 'whatsapp',
        auth: {
          access_token: 'test-token',
          phone_number_id: 'phone123',
        },
      };

      const result = await WhatsAppInitializer.initialize(null, config as any);
      expect(result).toHaveProperty('client');
      expect((result as any).client).toBeInstanceOf(WhatsAppClient);
    });
  });

  describe('WhatsAppClient', () => {
    let client: WhatsAppClient;

    beforeEach(() => {
      client = new WhatsAppClient('test-token', 'phone123');
    });

    it('should have all required methods', () => {
      expect(client.sendText).toBeDefined();
      expect(client.sendTemplate).toBeDefined();
      expect(client.sendImage).toBeDefined();
      expect(client.sendVideo).toBeDefined();
      expect(client.sendDocument).toBeDefined();
      expect(client.sendAudio).toBeDefined();
      expect(client.sendLocation).toBeDefined();
      expect(client.sendInteractive).toBeDefined();
      expect(client.uploadMedia).toBeDefined();
      expect(client.getMediaUrl).toBeDefined();
      expect(client.downloadMedia).toBeDefined();
    });

    describe('sendText', () => {
      it('should send a text message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            messages: [{ id: 'wamid.123' }],
          }),
        });

        const result = await client.sendText({
          to: '1234567890',
          text: 'Hello World',
        });

        expect(result.messages[0].id).toBe('wamid.123');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/messages'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    describe('sendTemplate', () => {
      it('should send a template message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            messages: [{ id: 'wamid.125' }],
          }),
        });

        const result = await client.sendTemplate({
          to: '1234567890',
          templateName: 'hello_world',
          languageCode: 'en',
        });

        expect(result.messages[0].id).toBe('wamid.125');
      });
    });

    describe('error handling', () => {
      it('should throw on API error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Bad Request',
        });

        await expect(
          client.sendText({
            to: '999',
            text: 'Test',
          })
        ).rejects.toThrow('WhatsApp API error');
      });
    });
  });
});
