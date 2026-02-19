/**
 * Zod input schemas for SendGrid API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

const emailAddress = z.union([
  z.string().email('valid email required'),
  z.array(z.string().email('valid email required')).min(1),
]);

export const sendgridSchemas: Record<string, z.ZodTypeAny> = {
  sendEmail: z.object({
    to: emailAddress,
    from: z.string().email('valid sender email required'),
    subject: z.string().min(1, 'subject is required'),
    // At least one body field must be provided (enforced in sendEmail itself)
    text: z.string().optional(),
    html: z.string().optional(),
    templateId: z.string().optional(),
    dynamicTemplateData: z.record(z.unknown()).optional(),
    attachments: z.array(z.object({
      content: z.string(),
      filename: z.string(),
      type: z.string().optional(),
      disposition: z.string().optional(),
    })).optional(),
    replyTo: z.string().email().optional(),
    cc: emailAddress.optional(),
    bcc: emailAddress.optional(),
  }),

  // sendMultiple receives a plain array as args[0] — validate it directly
  sendMultiple: z.array(z.object({
    to: emailAddress,
    from: z.string().email('valid sender email required'),
    subject: z.string().min(1, 'subject is required'),
    text: z.string().optional(),
    html: z.string().optional(),
    templateId: z.string().optional(),
    dynamicTemplateData: z.record(z.unknown()).optional(),
    attachments: z.array(z.object({
      content: z.string(),
      filename: z.string(),
      type: z.string().optional(),
      disposition: z.string().optional(),
    })).optional(),
    replyTo: z.string().email().optional(),
    cc: emailAddress.optional(),
    bcc: emailAddress.optional(),
  })).min(1, 'at least one message is required'),
};
