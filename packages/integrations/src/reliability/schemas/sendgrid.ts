/**
 * Zod input schemas for SendGrid API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const sendgridSchemas: Record<string, z.ZodTypeAny> = {
  sendEmail: z.object({
    to: z.array(z.object({
      email: z.string().email('valid email required'),
      name: z.string().optional(),
    })).min(1, 'to is required'),
    from: z.object({
      email: z.string().email('valid email required'),
      name: z.string().optional(),
    }),
    subject: z.string().min(1, 'subject is required'),
    content: z.string().min(1, 'content is required'),
  }),

  sendMultiple: z.object({
    personalizations: z.array(z.object({
      to: z.array(z.object({ email: z.string().email() })).optional(),
      cc: z.array(z.object({ email: z.string().email() })).optional(),
      bcc: z.array(z.object({ email: z.string().email() })).optional(),
      subject: z.string().optional(),
    })).min(1, 'personalizations is required'),
    from: z.object({
      email: z.string().email('valid email required'),
      name: z.string().optional(),
    }),
    subject: z.string().min(1, 'subject is required'),
    content: z.string().min(1, 'content is required'),
  }),
};
