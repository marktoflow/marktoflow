/**
 * Zod input schemas for Intercom API actions.
 */

import { z } from 'zod';

export const intercomSchemas: Record<string, z.ZodTypeAny> = {
  createContact: z.object({
    role: z.enum(['user', 'lead'], {
      errorMap: () => ({ message: 'role must be user or lead' }),
    }),
    email: z.string().email('Valid email is required'),
    external_id: z.string().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
    signed_up_at: z.number().optional(),
    custom_attributes: z.record(z.unknown()).optional(),
  }),

  getContact: z.object({
    contactId: z.string().min(1, 'contactId is required'),
  }),

  listContacts: z.object({
    per_page: z.number().int().min(1).max(150).optional(),
    page: z.number().int().min(1).optional(),
  }).optional().default({}),

  updateContact: z.object({
    contactId: z.string().min(1, 'contactId is required'),
    updates: z.object({
      email: z.string().email().optional(),
      name: z.string().optional(),
      phone: z.string().optional(),
      custom_attributes: z.record(z.unknown()).optional(),
    }),
  }),

  searchContacts: z.object({
    field: z.string().min(1, 'field is required'),
    operator: z.string().min(1, 'operator is required'),
    value: z.union([z.string(), z.number()]),
  }),

  createConversation: z.object({
    from: z.object({
      type: z.enum(['user', 'lead']),
      id: z.string().min(1, 'id is required'),
    }),
    body: z.string().min(1, 'body is required'),
  }),

  getConversation: z.object({
    conversationId: z.string().min(1, 'conversationId is required'),
  }),

  listConversations: z.object({
    per_page: z.number().int().min(1).max(150).optional(),
    page: z.number().int().min(1).optional(),
  }).optional().default({}),

  replyToConversation: z.object({
    conversationId: z.string().min(1, 'conversationId is required'),
    body: z.string().min(1, 'body is required'),
    type: z.enum(['comment', 'note'], {
      errorMap: () => ({ message: 'type must be comment or note' }),
    }),
  }),

  closeConversation: z.object({
    conversationId: z.string().min(1, 'conversationId is required'),
  }),

  sendMessage: z.object({
    from: z.object({
      type: z.literal('admin'),
      id: z.string().min(1, 'admin id is required'),
    }),
    to: z.object({
      type: z.enum(['user', 'contact']),
      id: z.string().min(1, 'recipient id is required'),
    }),
    body: z.string().min(1, 'body is required'),
    messageType: z.enum(['email', 'inapp'], {
      errorMap: () => ({ message: 'messageType must be email or inapp' }),
    }),
  }),

  listTags: z.object({}).optional().default({}),

  createTag: z.object({
    name: z.string().min(1, 'name is required'),
  }),
};
