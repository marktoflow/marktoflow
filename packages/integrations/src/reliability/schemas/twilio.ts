/**
 * Zod input schemas for Twilio API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const twilioSchemas: Record<string, z.ZodTypeAny> = {
  sendSMS: z.object({
    to: z.string().min(1, 'to is required'),
    from: z.string().min(1, 'from is required'),
    body: z.string().min(1, 'body is required'),
  }),

  getMessage: z.object({
    messageSid: z.string().min(1, 'messageSid is required'),
  }),

  listMessages: z.object({
    to: z.string().optional(),
    from: z.string().optional(),
    limit: z.number().int().min(1).optional(),
  }).optional().default({}),

  makeCall: z.object({
    to: z.string().min(1, 'to is required'),
    from: z.string().min(1, 'from is required'),
    url: z.string().url('url must be a valid URL'),
  }),

  getCall: z.object({
    callSid: z.string().min(1, 'callSid is required'),
  }),

  sendWhatsApp: z.object({
    to: z.string().min(1, 'to is required'),
    from: z.string().min(1, 'from is required'),
    body: z.string().min(1, 'body is required'),
  }),

  sendVerification: z.object({
    to: z.string().min(1, 'to is required'),
    channel: z.enum(['sms', 'call', 'email']),
  }),

  checkVerification: z.object({
    to: z.string().min(1, 'to is required'),
    code: z.string().min(1, 'code is required'),
  }),
};
