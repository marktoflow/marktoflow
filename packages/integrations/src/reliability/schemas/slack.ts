/**
 * Zod input schemas for Slack Web API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const slackSchemas: Record<string, z.ZodTypeAny> = {
  'chat.postMessage': z.object({
    channel: z.string().min(1, 'channel is required'),
    text: z.string().optional(),
    blocks: z.array(z.record(z.unknown())).optional(),
    thread_ts: z.string().optional(),
    mrkdwn: z.boolean().optional(),
    unfurl_links: z.boolean().optional(),
    unfurl_media: z.boolean().optional(),
  }).refine((d) => d.text || d.blocks, {
    message: 'Either text or blocks is required',
  }),

  'chat.update': z.object({
    channel: z.string().min(1, 'channel is required'),
    ts: z.string().min(1, 'ts (message timestamp) is required'),
    text: z.string().optional(),
    blocks: z.array(z.record(z.unknown())).optional(),
  }),

  'chat.delete': z.object({
    channel: z.string().min(1, 'channel is required'),
    ts: z.string().min(1, 'ts (message timestamp) is required'),
  }),

  'conversations.list': z.object({
    types: z.string().optional(),
    limit: z.number().int().min(1).max(1000).optional(),
    cursor: z.string().optional(),
    exclude_archived: z.boolean().optional(),
  }).optional().default({}),

  'conversations.history': z.object({
    channel: z.string().min(1, 'channel is required'),
    limit: z.number().int().min(1).max(1000).optional(),
    cursor: z.string().optional(),
    oldest: z.string().optional(),
    latest: z.string().optional(),
  }),

  'conversations.info': z.object({
    channel: z.string().min(1, 'channel is required'),
  }),

  'reactions.add': z.object({
    channel: z.string().min(1, 'channel is required'),
    timestamp: z.string().min(1, 'timestamp is required'),
    name: z.string().min(1, 'reaction name is required'),
  }),

  'users.list': z.object({
    limit: z.number().int().min(1).max(1000).optional(),
    cursor: z.string().optional(),
  }).optional().default({}),

  'users.info': z.object({
    user: z.string().min(1, 'user ID is required'),
  }),

  'files.upload': z.object({
    channels: z.string().optional(),
    content: z.string().optional(),
    file: z.unknown().optional(),
    filename: z.string().optional(),
    title: z.string().optional(),
    initial_comment: z.string().optional(),
  }),

  'auth.test': z.object({}).optional().default({}),
};
