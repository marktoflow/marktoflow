import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TelegramInitializer, TelegramClient } from '../src/services/telegram.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Telegram Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('TelegramInitializer', () => {
    it('should throw if bot token is missing', async () => {
      const config = { sdk: 'telegram', auth: {} };
      await expect(TelegramInitializer.initialize(null, config as any)).rejects.toThrow(
        'Telegram SDK requires auth.token (bot token)'
      );
    });

    it('should initialize with valid config', async () => {
      const config = {
        sdk: 'telegram',
        auth: {
          token: 'test-bot-token',
        },
      };

      const result = await TelegramInitializer.initialize(null, config as any);
      expect(result).toHaveProperty('client');
      expect((result as any).client).toBeInstanceOf(TelegramClient);
    });
  });

  describe('TelegramClient', () => {
    let client: TelegramClient;

    beforeEach(() => {
      client = new TelegramClient('test-bot-token');
    });

    it('should have all required methods', () => {
      expect(client.sendMessage).toBeDefined();
      expect(client.sendPhoto).toBeDefined();
      expect(client.sendDocument).toBeDefined();
      expect(client.editMessageText).toBeDefined();
      expect(client.deleteMessage).toBeDefined();
      expect(client.getUpdates).toBeDefined();
      expect(client.setWebhook).toBeDefined();
      expect(client.deleteWebhook).toBeDefined();
      expect(client.getWebhookInfo).toBeDefined();
      expect(client.getMe).toBeDefined();
    });

    describe('sendMessage', () => {
      it('should send a text message', async () => {
        mockFetch.mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            result: {
              message_id: 123,
              chat: { id: 456, type: 'private' },
              date: 1737824400,
              text: 'Hello World',
            },
          }),
        });

        const result = await client.sendMessage({
          chatId: 456,
          text: 'Hello World',
        });

        // The API returns snake_case, which is what we expect
        expect((result as any).message_id).toBe(123);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/sendMessage'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    describe('getMe', () => {
      it('should get bot information', async () => {
        mockFetch.mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            result: {
              id: 123456789,
              is_bot: true,
              first_name: 'TestBot',
              username: 'test_bot',
            },
          }),
        });

        const result = await client.getMe();
        // The API returns snake_case
        expect((result as any).is_bot).toBe(true);
        expect(result.username).toBe('test_bot');
      });
    });

    describe('error handling', () => {
      it('should throw on API error', async () => {
        mockFetch.mockResolvedValueOnce({
          json: async () => ({
            ok: false,
            description: 'Bad Request: chat not found',
          }),
        });

        await expect(
          client.sendMessage({
            chatId: 999,
            text: 'Test',
          })
        ).rejects.toThrow('Telegram API error');
      });
    });
  });
});
