/**
 * Zod input schemas for Microsoft Teams API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const teamsSchemas: Record<string, z.ZodTypeAny> = {
  listTeams: z.object({}).optional().default({}),

  listChannels: z.object({
    teamId: z.string().min(1, 'teamId is required'),
  }),

  createChannel: z.object({
    teamId: z.string().min(1, 'teamId is required'),
    displayName: z.string().min(1, 'displayName is required'),
    description: z.string().optional(),
  }),

  sendMessage: z.object({
    teamId: z.string().min(1, 'teamId is required'),
    channelId: z.string().min(1, 'channelId is required'),
    content: z.string().min(1, 'content is required'),
  }),

  listMessages: z.object({
    teamId: z.string().min(1, 'teamId is required'),
    channelId: z.string().min(1, 'channelId is required'),
    top: z.number().int().min(1).max(50).optional(),
  }),

  replyToMessage: z.object({
    teamId: z.string().min(1, 'teamId is required'),
    channelId: z.string().min(1, 'channelId is required'),
    messageId: z.string().min(1, 'messageId is required'),
    content: z.string().min(1, 'content is required'),
  }),

  listChats: z.object({}).optional().default({}),

  sendChatMessage: z.object({
    chatId: z.string().min(1, 'chatId is required'),
    content: z.string().min(1, 'content is required'),
  }),

  createMeeting: z.object({
    subject: z.string().min(1, 'subject is required'),
    startDateTime: z.string().min(1, 'startDateTime is required'),
    endDateTime: z.string().min(1, 'endDateTime is required'),
    attendees: z.array(z.object({ emailAddress: z.object({ address: z.string().email() }) })).optional(),
  }),
};
