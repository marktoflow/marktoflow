/**
 * Zod input schemas for Gmail actions.
 *
 * Note: Schema keys match googleapis SDK method paths
 * (e.g., gmail.users.messages.list -> 'users.messages.list')
 */

import { z } from 'zod';

export const gmailSchemas: Record<string, z.ZodTypeAny> = {
  'users.messages.list': z.object({
    userId: z.string().min(1, 'userId is required'),
    q: z.string().optional(),
    maxResults: z.number().int().min(1).max(500).optional(),
    labelIds: z.array(z.string()).optional(),
    pageToken: z.string().optional(),
  }),

  'users.messages.get': z.object({
    userId: z.string().min(1, 'userId is required'),
    id: z.string().min(1, 'id is required'),
    format: z.enum(['full', 'metadata', 'minimal', 'raw']).optional(),
  }),

  'users.messages.send': z.object({
    userId: z.string().min(1, 'userId is required'),
    requestBody: z.object({
      raw: z.string().optional(),
      threadId: z.string().optional(),
    }).passthrough(), // Allow additional fields
  }),

  'users.messages.modify': z.object({
    userId: z.string().min(1, 'userId is required'),
    id: z.string().min(1, 'id is required'),
    requestBody: z.object({
      addLabelIds: z.array(z.string()).optional(),
      removeLabelIds: z.array(z.string()).optional(),
    }).passthrough(),
  }),

  'users.messages.trash': z.object({
    userId: z.string().min(1, 'userId is required'),
    id: z.string().min(1, 'id is required'),
  }),

  'users.messages.delete': z.object({
    userId: z.string().min(1, 'userId is required'),
    id: z.string().min(1, 'id is required'),
  }),

  'users.drafts.create': z.object({
    userId: z.string().min(1, 'userId is required'),
    requestBody: z.object({
      message: z.object({
        raw: z.string().optional(),
      }).passthrough(),
    }).passthrough(),
  }),

  'users.labels.list': z.object({
    userId: z.string().min(1, 'userId is required'),
  }),

  'users.getProfile': z.object({
    userId: z.string().min(1, 'userId is required'),
  }),
};
