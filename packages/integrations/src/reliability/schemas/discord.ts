/**
 * Zod input schemas for Discord API actions.
 */

import { z } from 'zod';

export const discordSchemas: Record<string, z.ZodTypeAny> = {
  sendMessage: z.object({
    channelId: z.string().min(1, 'channelId is required'),
    content: z.string().optional(),
    embeds: z.array(z.record(z.unknown())).optional(),
    tts: z.boolean().optional(),
  }).refine((d) => d.content || d.embeds, {
    message: 'Either content or embeds is required',
  }),

  editMessage: z.object({
    channelId: z.string().min(1, 'channelId is required'),
    messageId: z.string().min(1, 'messageId is required'),
    content: z.string().optional(),
    embeds: z.array(z.record(z.unknown())).optional(),
  }),

  deleteMessage: z.object({
    channelId: z.string().min(1, 'channelId is required'),
    messageId: z.string().min(1, 'messageId is required'),
  }),

  getMessages: z.object({
    channelId: z.string().min(1, 'channelId is required'),
    limit: z.number().int().min(1).max(100).optional(),
    before: z.string().optional(),
    after: z.string().optional(),
  }),

  getChannels: z.object({
    guildId: z.string().min(1, 'guildId is required'),
  }),

  getGuilds: z.object({}).optional().default({}),

  addReaction: z.object({
    channelId: z.string().min(1, 'channelId is required'),
    messageId: z.string().min(1, 'messageId is required'),
    emoji: z.string().min(1, 'emoji is required'),
  }),
};
