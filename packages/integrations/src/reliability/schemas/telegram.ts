/**
 * Zod input schemas for Telegram Bot API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const telegramSchemas: Record<string, z.ZodTypeAny> = {
  sendMessage: z.object({
    chatId: z.union([z.string(), z.number()]).transform(String),
    text: z.string().min(1, 'text is required'),
    parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
    replyMarkup: z.record(z.unknown()).optional(),
  }),

  sendPhoto: z.object({
    chatId: z.union([z.string(), z.number()]).transform(String),
    photo: z.string().min(1, 'photo is required'),
    caption: z.string().optional(),
  }),

  sendDocument: z.object({
    chatId: z.union([z.string(), z.number()]).transform(String),
    document: z.string().min(1, 'document is required'),
    caption: z.string().optional(),
  }),

  editMessageText: z.object({
    chatId: z.union([z.string(), z.number()]).transform(String),
    messageId: z.union([z.string(), z.number()]).transform(String),
    text: z.string().min(1, 'text is required'),
  }),

  deleteMessage: z.object({
    chatId: z.union([z.string(), z.number()]).transform(String),
    messageId: z.union([z.string(), z.number()]).transform(String),
  }),

  forwardMessage: z.object({
    chatId: z.union([z.string(), z.number()]).transform(String),
    fromChatId: z.union([z.string(), z.number()]).transform(String),
    messageId: z.union([z.string(), z.number()]).transform(String),
  }),

  getUpdates: z.object({
    offset: z.number().int().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    timeout: z.number().int().optional(),
  }).optional().default({}),

  setWebhook: z.object({
    url: z.string().url('url must be a valid URL'),
  }),

  getChat: z.object({
    chatId: z.union([z.string(), z.number()]).transform(String),
  }),

  answerCallbackQuery: z.object({
    callbackQueryId: z.string().min(1, 'callbackQueryId is required'),
    text: z.string().optional(),
  }),
};
