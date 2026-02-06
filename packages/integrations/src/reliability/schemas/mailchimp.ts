/**
 * Zod input schemas for Mailchimp API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const mailchimpSchemas: Record<string, z.ZodTypeAny> = {
  getLists: z.object({
    count: z.number().int().min(1).max(1000).optional(),
    offset: z.number().int().min(0).optional(),
  }).optional().default({}),

  getList: z.object({
    listId: z.string().min(1, 'listId is required'),
  }),

  getListMembers: z.object({
    listId: z.string().min(1, 'listId is required'),
    count: z.number().int().min(1).max(1000).optional(),
    offset: z.number().int().min(0).optional(),
  }),

  getMember: z.object({
    listId: z.string().min(1, 'listId is required'),
    subscriberHash: z.string().min(1, 'subscriberHash is required'),
  }),

  addMember: z.object({
    listId: z.string().min(1, 'listId is required'),
    emailAddress: z.string().email('valid email required').min(1, 'emailAddress is required'),
    status: z.enum(['subscribed', 'unsubscribed', 'cleaned', 'pending']),
    mergeFields: z.record(z.unknown()).optional(),
  }),

  updateMember: z.object({
    listId: z.string().min(1, 'listId is required'),
    subscriberHash: z.string().min(1, 'subscriberHash is required'),
    status: z.enum(['subscribed', 'unsubscribed', 'cleaned', 'pending']).optional(),
    mergeFields: z.record(z.unknown()).optional(),
  }),

  deleteMember: z.object({
    listId: z.string().min(1, 'listId is required'),
    subscriberHash: z.string().min(1, 'subscriberHash is required'),
  }),

  getCampaigns: z.object({
    count: z.number().int().min(1).max(1000).optional(),
    offset: z.number().int().min(0).optional(),
  }).optional().default({}),

  createCampaign: z.object({
    type: z.enum(['regular', 'plaintext', 'absplit', 'rss']),
    recipients: z.object({
      listId: z.string().min(1, 'listId in recipients is required'),
    }),
    settings: z.object({
      subjectLine: z.string().min(1, 'subjectLine is required'),
      fromName: z.string().min(1, 'fromName is required'),
      replyTo: z.string().min(1, 'replyTo is required'),
    }),
  }),

  sendCampaign: z.object({
    campaignId: z.string().min(1, 'campaignId is required'),
  }),
};
