/**
 * Contract tests for Discord integration
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
import { discordSchemas } from '../../src/reliability/schemas/discord.js';
import { DiscordClient } from '../../src/services/discord.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Send message
  http.post('https://discord.com/api/v10/channels/:channelId/messages', async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.content && !body.embeds) {
      return HttpResponse.json({
        message: 'Either content or embeds is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'msg-123',
      channel_id: params.channelId,
      content: body.content || '',
      embeds: body.embeds || [],
      author: {
        id: 'bot-1',
        username: 'TestBot',
        discriminator: '0000',
        bot: true,
      },
      timestamp: '2024-01-01T00:00:00Z',
      mention_everyone: false,
      mentions: [],
      attachments: [],
    });
  }),

  // Edit message
  http.patch('https://discord.com/api/v10/channels/:channelId/messages/:messageId', async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: params.messageId,
      channel_id: params.channelId,
      content: body.content || '',
      embeds: body.embeds || [],
      author: {
        id: 'bot-1',
        username: 'TestBot',
        discriminator: '0000',
        bot: true,
      },
      timestamp: '2024-01-01T00:00:00Z',
      edited_timestamp: '2024-01-01T01:00:00Z',
      mention_everyone: false,
      mentions: [],
      attachments: [],
    });
  }),

  // Delete message
  http.delete('https://discord.com/api/v10/channels/:channelId/messages/:messageId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Get messages
  http.get('https://discord.com/api/v10/channels/:channelId/messages', ({ params, request }) => {
    return HttpResponse.json([
      {
        id: 'msg-1',
        channel_id: params.channelId,
        content: 'Test message 1',
        author: {
          id: 'user-1',
          username: 'TestUser',
          discriminator: '1234',
        },
        timestamp: '2024-01-01T00:00:00Z',
        mention_everyone: false,
        mentions: [],
        attachments: [],
        embeds: [],
      },
    ]);
  }),

  // Get guilds (servers)
  http.get('https://discord.com/api/v10/users/@me/guilds', () => {
    return HttpResponse.json([
      {
        id: 'guild-1',
        name: 'Test Server',
        icon: null,
        owner_id: 'user-1',
        approximate_member_count: 100,
      },
    ]);
  }),

  // Get guild channels
  http.get('https://discord.com/api/v10/guilds/:guildId/channels', ({ params }) => {
    return HttpResponse.json([
      {
        id: 'channel-1',
        type: 0,
        name: 'general',
        guild_id: params.guildId,
        position: 0,
      },
    ]);
  }),

  // Add reaction
  http.put('https://discord.com/api/v10/channels/:channelId/messages/:messageId/reactions/:emoji/@me', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Get current user
  http.get('https://discord.com/api/v10/users/@me', () => {
    return HttpResponse.json({
      id: 'bot-1',
      username: 'TestBot',
      discriminator: '0000',
      bot: true,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Discord Contract Tests', () => {
  it('should send a message successfully', async () => {
    const client = new DiscordClient('test-token', true);
    const wrapped = wrapIntegration('discord', client, {
      inputSchemas: discordSchemas,
    });

    const result = await wrapped.sendMessage('channel-1', 'Hello, Discord!');

    expect(result.id).toBe('msg-123');
    expect(result.content).toBe('Hello, Discord!');
    expect(result.channelId).toBe('channel-1');
  });

  it('should reject invalid inputs (missing channelId)', async () => {
    const client = new DiscordClient('test-token', true);
    const wrapped = wrapIntegration('discord', client, {
      inputSchemas: discordSchemas,
    });

    // sendMessage with empty channelId should fail schema validation
    await expect(
      wrapped.sendMessage('', 'Hello')
    ).rejects.toThrow();
  });

  it('should reject invalid inputs (missing content and embeds)', async () => {
    const client = new DiscordClient('test-token', true);
    const wrapped = wrapIntegration('discord', client, {
      inputSchemas: discordSchemas,
    });

    await expect(
      wrapped.sendMessage('channel-1', { content: undefined, embeds: undefined })
    ).rejects.toThrow(/content or embeds/);
  });

  it('should edit a message successfully', async () => {
    const client = new DiscordClient('test-token', true);
    const wrapped = wrapIntegration('discord', client, {
      inputSchemas: discordSchemas,
    });

    const result = await wrapped.editMessage('channel-1', 'msg-123', 'Updated content');

    expect(result.id).toBe('msg-123');
    expect(result.content).toBe('Updated content');
  });

  it('should delete a message successfully', async () => {
    const client = new DiscordClient('test-token', true);
    const wrapped = wrapIntegration('discord', client, {
      inputSchemas: discordSchemas,
    });

    await wrapped.deleteMessage('channel-1', 'msg-123');

    // If no error is thrown, the test passes
    expect(true).toBe(true);
  });

  it('should get messages successfully', async () => {
    const client = new DiscordClient('test-token', true);
    const wrapped = wrapIntegration('discord', client, {
      inputSchemas: discordSchemas,
    });

    const result = await wrapped.getMessages('channel-1', { limit: 10 });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Test message 1');
  });

  it('should get guilds successfully', async () => {
    const client = new DiscordClient('test-token', true);
    const wrapped = wrapIntegration('discord', client, {
      inputSchemas: discordSchemas,
    });

    const result = await wrapped.getGuilds();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Server');
  });

  it('should get guild channels successfully', async () => {
    const client = new DiscordClient('test-token', true);
    const wrapped = wrapIntegration('discord', client, {
      inputSchemas: discordSchemas,
    });

    const result = await wrapped.getGuildChannels('guild-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('general');
  });

  it('should add a reaction successfully', async () => {
    const client = new DiscordClient('test-token', true);
    const wrapped = wrapIntegration('discord', client, {
      inputSchemas: discordSchemas,
    });

    await wrapped.addReaction('channel-1', 'msg-123', '👍');

    // If no error is thrown, the test passes
    expect(true).toBe(true);
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://discord.com/api/v10/channels/:channelId/messages', () => {
        return HttpResponse.json({
          message: 'Unknown Channel',
          code: 10003,
        }, { status: 404 });
      })
    );

    const client = new DiscordClient('test-token', true);
    const wrapped = wrapIntegration('discord', client, {
      inputSchemas: discordSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.sendMessage('nonexistent', 'Hello')
    ).rejects.toThrow();
  });
});
