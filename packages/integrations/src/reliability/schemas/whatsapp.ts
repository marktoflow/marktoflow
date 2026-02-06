/**
 * Zod input schemas for WhatsApp Cloud API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const whatsappSchemas: Record<string, z.ZodTypeAny> = {
  sendText: z.object({
    to: z.string().min(1, 'to is required'),
    text: z.string().min(1, 'text is required'),
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
    mediaUrl: z.string().url('mediaUrl must be a valid URL').optional(),
    mediaId: z.string().optional(),
    caption: z.string().optional(),
  }).refine(data => data.mediaUrl || data.mediaId, {
    message: 'Either mediaUrl or mediaId is required',
  }),

  sendDocument: z.object({
    to: z.string().min(1, 'to is required'),
    mediaUrl: z.string().url('mediaUrl must be a valid URL').optional(),
    mediaId: z.string().optional(),
    filename: z.string().optional(),
    caption: z.string().optional(),
  }).refine(data => data.mediaUrl || data.mediaId, {
    message: 'Either mediaUrl or mediaId is required',
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
