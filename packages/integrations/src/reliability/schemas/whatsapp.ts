/**
 * Zod input schemas for WhatsApp Cloud API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const whatsappSchemas: Record<string, z.ZodTypeAny> = {
  sendText: z.object({
    to: z.string().min(1, 'to is required'),
    body: z.string().min(1, 'body is required'),
    previewUrl: z.boolean().optional(),
  }),

  sendTemplate: z.object({
    to: z.string().min(1, 'to is required'),
    templateName: z.string().min(1, 'templateName is required'),
    languageCode: z.string().min(1, 'languageCode is required'),
    components: z.array(z.record(z.unknown())).optional(),
  }),

  sendImage: z.object({
    to: z.string().min(1, 'to is required'),
    imageUrl: z.string().url('imageUrl must be a valid URL'),
    caption: z.string().optional(),
  }),

  sendDocument: z.object({
    to: z.string().min(1, 'to is required'),
    documentUrl: z.string().url('documentUrl must be a valid URL'),
    filename: z.string().optional(),
    caption: z.string().optional(),
  }),

  sendLocation: z.object({
    to: z.string().min(1, 'to is required'),
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional(),
    address: z.string().optional(),
  }),

  markAsRead: z.object({
    messageId: z.string().min(1, 'messageId is required'),
  }),

  uploadMedia: z.object({
    file: z.unknown(),
    type: z.enum(['image', 'audio', 'video', 'document']),
  }),
};
