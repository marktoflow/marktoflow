/**
 * Zod input schemas for Microsoft Outlook API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const outlookSchemas: Record<string, z.ZodTypeAny> = {
  getEmails: z.object({
    top: z.number().int().min(1).max(250).optional(),
    skip: z.number().int().min(0).optional(),
    filter: z.string().optional(),
  }).optional().default({}),

  getEmail: z.object({
    messageId: z.string().min(1, 'messageId is required'),
  }),

  sendEmail: z.object({
    subject: z.string().min(1, 'subject is required'),
    body: z.string().min(1, 'body is required'),
    toRecipients: z.array(z.string().email('valid email required in toRecipients')).min(1, 'toRecipients is required'),
    ccRecipients: z.array(z.string().email('valid email required in ccRecipients')).optional(),
  }),

  createDraft: z.object({
    subject: z.string().min(1, 'subject is required'),
    body: z.string().min(1, 'body is required'),
    toRecipients: z.array(z.string().email('valid email required in toRecipients')).min(1, 'toRecipients is required'),
  }),

  reply: z.object({
    messageId: z.string().min(1, 'messageId is required'),
    comment: z.string().min(1, 'comment is required'),
  }),

  markAsRead: z.object({
    messageId: z.string().min(1, 'messageId is required'),
  }),

  listFolders: z.object({}).optional().default({}),

  getEvents: z.object({
    startDateTime: z.string().optional(),
    endDateTime: z.string().optional(),
  }).optional().default({}),

  createEvent: z.object({
    subject: z.string().min(1, 'subject is required'),
    start: z.string().min(1, 'start is required'),
    end: z.string().min(1, 'end is required'),
    body: z.string().optional(),
    location: z.string().optional(),
    attendees: z.array(z.object({ emailAddress: z.object({ address: z.string().email() }) })).optional(),
  }),

  deleteEvent: z.object({
    eventId: z.string().min(1, 'eventId is required'),
  }),
};
