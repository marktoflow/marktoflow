/**
 * Zod input schemas for Zendesk API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const zendeskSchemas: Record<string, z.ZodTypeAny> = {
  listTickets: z.object({
    page: z.number().int().min(1).optional(),
    perPage: z.number().int().min(1).max(100).optional(),
  }).optional().default({}),

  getTicket: z.object({
    ticketId: z.union([z.string(), z.number()]).transform(String),
  }),

  createTicket: z.object({
    subject: z.string().min(1, 'subject is required'),
    description: z.string().min(1, 'description is required'),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    type: z.enum(['problem', 'incident', 'question', 'task']).optional(),
    status: z.enum(['new', 'open', 'pending', 'hold', 'solved', 'closed']).optional(),
    assigneeId: z.union([z.string(), z.number()]).optional(),
  }),

  updateTicket: z.object({
    ticketId: z.union([z.string(), z.number()]).transform(String),
    subject: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['new', 'open', 'pending', 'hold', 'solved', 'closed']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  }),

  deleteTicket: z.object({
    ticketId: z.union([z.string(), z.number()]).transform(String),
  }),

  addComment: z.object({
    ticketId: z.union([z.string(), z.number()]).transform(String),
    body: z.string().min(1, 'body is required'),
    public: z.boolean().optional(),
  }),

  listUsers: z.object({
    page: z.number().int().min(1).optional(),
    perPage: z.number().int().min(1).max(100).optional(),
  }).optional().default({}),

  getUser: z.object({
    userId: z.union([z.string(), z.number()]).transform(String),
  }),

  createUser: z.object({
    name: z.string().min(1, 'name is required'),
    email: z.string().email('email must be a valid email address'),
  }),

  search: z.object({
    query: z.string().min(1, 'query is required'),
    page: z.number().int().min(1).optional(),
  }),
};
