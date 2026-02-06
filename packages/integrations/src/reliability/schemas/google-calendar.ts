/**
 * Zod input schemas for Google Calendar API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const googleCalendarSchemas: Record<string, z.ZodTypeAny> = {
  'listCalendars': z.object({}).optional().default({}),

  'listEvents': z.object({
    calendarId: z.string().min(1, 'calendarId is required'),
    timeMin: z.string().optional(),
    timeMax: z.string().optional(),
    maxResults: z.number().int().min(1).optional(),
  }),

  'getEvent': z.object({
    calendarId: z.string().min(1, 'calendarId is required'),
    eventId: z.string().min(1, 'eventId is required'),
  }),

  'createEvent': z.object({
    calendarId: z.string().min(1, 'calendarId is required'),
    summary: z.string().min(1, 'summary is required'),
    start: z.object({
      dateTime: z.string().optional(),
      date: z.string().optional(),
      timeZone: z.string().optional(),
    }).optional(),
    end: z.object({
      dateTime: z.string().optional(),
      date: z.string().optional(),
      timeZone: z.string().optional(),
    }).optional(),
    description: z.string().optional(),
    location: z.string().optional(),
  }),

  'updateEvent': z.object({
    calendarId: z.string().min(1, 'calendarId is required'),
    eventId: z.string().min(1, 'eventId is required'),
    summary: z.string().optional(),
    start: z.object({
      dateTime: z.string().optional(),
      date: z.string().optional(),
      timeZone: z.string().optional(),
    }).optional(),
    end: z.object({
      dateTime: z.string().optional(),
      date: z.string().optional(),
      timeZone: z.string().optional(),
    }).optional(),
  }),

  'deleteEvent': z.object({
    calendarId: z.string().min(1, 'calendarId is required'),
    eventId: z.string().min(1, 'eventId is required'),
  }),

  'quickAddEvent': z.object({
    calendarId: z.string().min(1, 'calendarId is required'),
    text: z.string().min(1, 'text is required'),
  }),
};
