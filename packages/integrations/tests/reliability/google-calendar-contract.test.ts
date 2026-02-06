/**
 * Contract tests for Google Calendar integration
 *
 * These tests validate that:
 * 1. The SDK makes correct HTTP requests
 * 2. Input validation schemas work as expected
 * 3. Response handling is correct
 * 4. The integration behaves correctly without hitting real APIs
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { googleCalendarSchemas } from '../../src/reliability/schemas/google-calendar.js';
import { google } from 'googleapis';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // List calendars
  http.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', () => {
    return HttpResponse.json({
      items: [
        {
          id: 'primary',
          summary: 'Primary Calendar',
          description: 'Primary calendar',
          timeZone: 'America/New_York',
          primary: true,
          accessRole: 'owner',
        },
        {
          id: 'cal2',
          summary: 'Work Calendar',
          timeZone: 'America/New_York',
          accessRole: 'owner',
        },
      ],
    });
  }),

  // List events
  http.get('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events', ({ params }) => {
    return HttpResponse.json({
      items: [
        {
          id: 'event1',
          summary: 'Team Meeting',
          description: 'Weekly team sync',
          start: { dateTime: '2024-01-15T10:00:00Z', timeZone: 'UTC' },
          end: { dateTime: '2024-01-15T11:00:00Z', timeZone: 'UTC' },
          status: 'confirmed',
        },
        {
          id: 'event2',
          summary: 'Lunch',
          start: { dateTime: '2024-01-15T12:00:00Z', timeZone: 'UTC' },
          end: { dateTime: '2024-01-15T13:00:00Z', timeZone: 'UTC' },
          status: 'confirmed',
        },
      ],
    });
  }),

  // Get event
  http.get('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/:eventId', ({ params }) => {
    if (!params.eventId || params.eventId === '') {
      return HttpResponse.json({
        error: {
          code: 404,
          message: 'Event not found',
        },
      }, { status: 404 });
    }

    return HttpResponse.json({
      id: params.eventId,
      summary: 'Team Meeting',
      description: 'Weekly team sync',
      location: 'Conference Room A',
      start: { dateTime: '2024-01-15T10:00:00Z', timeZone: 'UTC' },
      end: { dateTime: '2024-01-15T11:00:00Z', timeZone: 'UTC' },
      status: 'confirmed',
      attendees: [
        { email: 'user1@example.com', displayName: 'User One', responseStatus: 'accepted' },
        { email: 'user2@example.com', displayName: 'User Two', responseStatus: 'needsAction' },
      ],
    });
  }),

  // Create event
  http.post('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events', async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.summary) {
      return HttpResponse.json({
        error: {
          code: 400,
          message: 'Missing summary',
        },
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'new-event-id',
      summary: body.summary,
      description: body.description,
      location: body.location,
      start: body.start || { dateTime: '2024-01-20T10:00:00Z', timeZone: 'UTC' },
      end: body.end || { dateTime: '2024-01-20T11:00:00Z', timeZone: 'UTC' },
      status: 'confirmed',
      htmlLink: `https://calendar.google.com/event?eid=new-event-id`,
    });
  }),

  // Update event
  http.patch('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/:eventId', async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: params.eventId,
      summary: body.summary || 'Updated Event',
      description: body.description,
      start: body.start || { dateTime: '2024-01-15T10:00:00Z', timeZone: 'UTC' },
      end: body.end || { dateTime: '2024-01-15T11:00:00Z', timeZone: 'UTC' },
      status: 'confirmed',
    });
  }),

  // Delete event
  http.delete('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/:eventId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Quick add event
  http.post('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/quickAdd', async ({ request }) => {
    const url = new URL(request.url);
    const text = url.searchParams.get('text');

    if (!text) {
      return HttpResponse.json({
        error: {
          code: 400,
          message: 'Missing text parameter',
        },
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'quick-event-id',
      summary: text,
      start: { dateTime: '2024-01-20T15:00:00Z', timeZone: 'UTC' },
      end: { dateTime: '2024-01-20T16:00:00Z', timeZone: 'UTC' },
      status: 'confirmed',
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Google Calendar Contract Tests', () => {
  it('should list calendars successfully', async () => {
    const calendar = google.calendar({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-calendar', calendar, {
      inputSchemas: googleCalendarSchemas,
    });

    const result = await wrapped.calendarList.list({});

    expect(result.data.items).toHaveLength(2);
    expect(result.data.items?.[0].summary).toBe('Primary Calendar');
    expect(result.data.items?.[0].primary).toBe(true);
  });

  it('should list events successfully', async () => {
    const calendar = google.calendar({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-calendar', calendar, {
      inputSchemas: googleCalendarSchemas,
    });

    const result = await wrapped.events.list({
      calendarId: 'primary',
    });

    expect(result.data.items).toHaveLength(2);
    expect(result.data.items?.[0].summary).toBe('Team Meeting');
  });

  it('should reject invalid inputs (missing calendarId)', async () => {
    const calendar = google.calendar({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-calendar', calendar, {
      inputSchemas: googleCalendarSchemas,
    });

    // The Google SDK doesn't validate empty calendarId at the client level
    await expect(
      wrapped.events.list({
        calendarId: '',
      })
    ).rejects.toThrow();
  });

  it('should get an event successfully', async () => {
    const calendar = google.calendar({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-calendar', calendar, {
      inputSchemas: googleCalendarSchemas,
    });

    const result = await wrapped.events.get({
      calendarId: 'primary',
      eventId: 'event1',
    });

    expect(result.data.id).toBe('event1');
    expect(result.data.summary).toBe('Team Meeting');
    expect(result.data.attendees).toHaveLength(2);
  });


  it('should create an event successfully', async () => {
    const calendar = google.calendar({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-calendar', calendar, {
      inputSchemas: googleCalendarSchemas,
    });

    const result = await wrapped.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: 'New Meeting',
        description: 'A new test meeting',
        start: { dateTime: '2024-01-20T10:00:00Z' },
        end: { dateTime: '2024-01-20T11:00:00Z' },
      },
    });

    expect(result.data.id).toBe('new-event-id');
    expect(result.data.summary).toBe('New Meeting');
  });

  it('should update an event successfully', async () => {
    const calendar = google.calendar({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-calendar', calendar, {
      inputSchemas: googleCalendarSchemas,
    });

    const result = await wrapped.events.patch({
      calendarId: 'primary',
      eventId: 'event1',
      requestBody: {
        summary: 'Updated Meeting',
      },
    });

    expect(result.data.id).toBe('event1');
    expect(result.data.summary).toBe('Updated Meeting');
  });

  it('should delete an event successfully', async () => {
    const calendar = google.calendar({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-calendar', calendar, {
      inputSchemas: googleCalendarSchemas,
    });

    await expect(
      wrapped.events.delete({
        calendarId: 'primary',
        eventId: 'event1',
      })
    ).resolves.not.toThrow();
  });

  it('should quick add event successfully', async () => {
    const calendar = google.calendar({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-calendar', calendar, {
      inputSchemas: googleCalendarSchemas,
    });

    const result = await wrapped.events.quickAdd({
      calendarId: 'primary',
      text: 'Coffee with John tomorrow at 3pm',
    });

    expect(result.data.id).toBe('quick-event-id');
    expect(result.data.summary).toBe('Coffee with John tomorrow at 3pm');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.get('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/:eventId', () => {
        return HttpResponse.json({
          error: {
            code: 404,
            message: 'Event not found',
          },
        }, { status: 404 });
      })
    );

    const calendar = google.calendar({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-calendar', calendar, {
      inputSchemas: googleCalendarSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.events.get({
        calendarId: 'primary',
        eventId: 'nonexistent',
      })
    ).rejects.toThrow();
  });
});
