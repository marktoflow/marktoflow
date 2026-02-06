/**
 * Zod input schemas for Calendly API actions.
 */

import { z } from 'zod';

export const calendlySchemas: Record<string, z.ZodTypeAny> = {
  getCurrentUser: z.object({}).optional().default({}),

  listEvents: z.object({
    user: z.string().min(1, 'user URI is required'),
    count: z.number().int().min(1).max(100).optional(),
    page_token: z.string().optional(),
    status: z.enum(['active', 'canceled']).optional(),
  }),

  getEvent: z.object({
    eventUuid: z.string().min(1, 'eventUuid is required'),
  }),

  cancelEvent: z.object({
    eventUuid: z.string().min(1, 'eventUuid is required'),
    reason: z.string().optional(),
  }),

  listEventTypes: z.object({
    user: z.string().min(1, 'user URI is required'),
    count: z.number().int().min(1).max(100).optional(),
    page_token: z.string().optional(),
    active: z.boolean().optional(),
  }),

  getEventType: z.object({
    eventTypeUuid: z.string().min(1, 'eventTypeUuid is required'),
  }),

  listInvitees: z.object({
    eventUuid: z.string().min(1, 'eventUuid is required'),
    count: z.number().int().min(1).max(100).optional(),
    page_token: z.string().optional(),
    status: z.enum(['active', 'canceled']).optional(),
  }),

  createSchedulingLink: z.object({
    maxEventCount: z.number().int().min(1, 'maxEventCount must be at least 1'),
    owner: z.string().min(1, 'owner URI is required'),
    ownerType: z.enum(['EventType', 'User'], {
      errorMap: () => ({ message: 'ownerType must be EventType or User' }),
    }),
  }),
};
