/**
 * Zod input schemas for Gmail actions.
 */

import { z } from 'zod';

export const gmailSchemas: Record<string, z.ZodTypeAny> = {
  getEmails: z.object({
    query: z.string().optional(),
    maxResults: z.number().int().min(1).max(500).optional(),
    labelIds: z.array(z.string()).optional(),
    pageToken: z.string().optional(),
  }).optional().default({}),

  getEmail: z.object({
    id: z.string().min(1, 'email id is required'),
    format: z.enum(['full', 'metadata', 'minimal', 'raw']).optional(),
  }),

  sendEmail: z.object({
    to: z.string().min(1, 'to is required'),
    subject: z.string().min(1, 'subject is required'),
    body: z.string().min(1, 'body is required'),
    cc: z.string().optional(),
    bcc: z.string().optional(),
    replyTo: z.string().optional(),
    isHtml: z.boolean().optional(),
  }),

  createDraft: z.object({
    to: z.string().min(1, 'to is required'),
    subject: z.string().min(1, 'subject is required'),
    body: z.string().min(1, 'body is required'),
    cc: z.string().optional(),
    bcc: z.string().optional(),
    isHtml: z.boolean().optional(),
  }),

  deleteEmail: z.object({
    id: z.string().min(1, 'email id is required'),
  }),

  modifyLabels: z.object({
    id: z.string().min(1, 'email id is required'),
    addLabelIds: z.array(z.string()).optional(),
    removeLabelIds: z.array(z.string()).optional(),
  }),

  getLabels: z.object({}).optional().default({}),

  getProfile: z.object({}).optional().default({}),
};
