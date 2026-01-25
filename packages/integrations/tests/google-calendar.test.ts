import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GoogleCalendarInitializer,
  GoogleCalendarActions,
} from '../src/services/google-calendar.js';

describe('Google Calendar Integration', () => {
  describe('GoogleCalendarInitializer', () => {
    it('should throw if required auth fields are missing', async () => {
      const config = { sdk: 'googleapis', auth: {} };
      await expect(GoogleCalendarInitializer.initialize(null, config as any)).rejects.toThrow(
        'Google Calendar SDK requires auth.client_id, auth.client_secret, auth.redirect_uri'
      );
    });

    it('should throw if client_id is missing', async () => {
      const config = {
        sdk: 'googleapis',
        auth: {
          client_secret: 'secret',
          redirect_uri: 'http://localhost',
        },
      };
      await expect(GoogleCalendarInitializer.initialize(null, config as any)).rejects.toThrow();
    });

    it('should throw if client_secret is missing', async () => {
      const config = {
        sdk: 'googleapis',
        auth: {
          client_id: 'id',
          redirect_uri: 'http://localhost',
        },
      };
      await expect(GoogleCalendarInitializer.initialize(null, config as any)).rejects.toThrow();
    });

    it('should throw if redirect_uri is missing', async () => {
      const config = {
        sdk: 'googleapis',
        auth: {
          client_id: 'id',
          client_secret: 'secret',
        },
      };
      await expect(GoogleCalendarInitializer.initialize(null, config as any)).rejects.toThrow();
    });

    it('should initialize with valid config', async () => {
      const config = {
        sdk: 'googleapis',
        auth: {
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          redirect_uri: 'http://localhost:3000/callback',
          refresh_token: 'test-refresh-token',
          access_token: 'test-access-token',
        },
      };

      const result = await GoogleCalendarInitializer.initialize(null, config as any);
      expect(result).toHaveProperty('client');
      expect(result).toHaveProperty('actions');
      expect((result as any).actions).toBeInstanceOf(GoogleCalendarActions);
    });
  });

  describe('GoogleCalendarActions', () => {
    let mockCalendar: any;
    let actions: GoogleCalendarActions;

    beforeEach(() => {
      mockCalendar = {
        calendarList: {
          list: vi.fn(),
        },
        calendars: {
          get: vi.fn(),
          insert: vi.fn(),
          delete: vi.fn(),
        },
        events: {
          list: vi.fn(),
          get: vi.fn(),
          insert: vi.fn(),
          patch: vi.fn(),
          delete: vi.fn(),
          quickAdd: vi.fn(),
          move: vi.fn(),
          watch: vi.fn(),
        },
        freebusy: {
          query: vi.fn(),
        },
        channels: {
          stop: vi.fn(),
        },
      };
      actions = new GoogleCalendarActions(mockCalendar);
    });

    it('should have all required methods', () => {
      expect(actions.listCalendars).toBeDefined();
      expect(actions.getCalendar).toBeDefined();
      expect(actions.listEvents).toBeDefined();
      expect(actions.getEvent).toBeDefined();
      expect(actions.createEvent).toBeDefined();
      expect(actions.updateEvent).toBeDefined();
      expect(actions.deleteEvent).toBeDefined();
      expect(actions.quickAddEvent).toBeDefined();
      expect(actions.moveEvent).toBeDefined();
      expect(actions.queryFreeBusy).toBeDefined();
      expect(actions.createCalendar).toBeDefined();
      expect(actions.deleteCalendar).toBeDefined();
      expect(actions.watchEvents).toBeDefined();
      expect(actions.stopWatching).toBeDefined();
    });

    describe('listCalendars', () => {
      it('should list all calendars', async () => {
        mockCalendar.calendarList.list.mockResolvedValue({
          data: {
            items: [
              {
                id: 'primary',
                summary: 'Primary Calendar',
                description: 'Main calendar',
                timeZone: 'America/New_York',
                accessRole: 'owner',
                primary: true,
              },
              {
                id: 'work@example.com',
                summary: 'Work Calendar',
                timeZone: 'America/Los_Angeles',
                accessRole: 'writer',
              },
            ],
          },
        });

        const result = await actions.listCalendars();
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          id: 'primary',
          summary: 'Primary Calendar',
          description: 'Main calendar',
          timeZone: 'America/New_York',
          accessRole: 'owner',
          primary: true,
        });
      });

      it('should return empty array if no calendars', async () => {
        mockCalendar.calendarList.list.mockResolvedValue({ data: {} });
        const result = await actions.listCalendars();
        expect(result).toEqual([]);
      });
    });

    describe('getCalendar', () => {
      it('should get primary calendar by default', async () => {
        mockCalendar.calendars.get.mockResolvedValue({
          data: {
            id: 'primary',
            summary: 'Primary Calendar',
            timeZone: 'America/New_York',
          },
        });

        const result = await actions.getCalendar();
        expect(mockCalendar.calendars.get).toHaveBeenCalledWith({
          calendarId: 'primary',
        });
        expect(result.id).toBe('primary');
      });

      it('should get specific calendar', async () => {
        mockCalendar.calendars.get.mockResolvedValue({
          data: {
            id: 'work@example.com',
            summary: 'Work Calendar',
            description: 'Work events',
          },
        });

        const result = await actions.getCalendar('work@example.com');
        expect(mockCalendar.calendars.get).toHaveBeenCalledWith({
          calendarId: 'work@example.com',
        });
        expect(result.id).toBe('work@example.com');
      });
    });

    describe('listEvents', () => {
      it('should list events with default options', async () => {
        mockCalendar.events.list.mockResolvedValue({
          data: {
            items: [
              {
                id: 'event1',
                summary: 'Team Meeting',
                start: { dateTime: '2026-01-25T10:00:00Z' },
                end: { dateTime: '2026-01-25T11:00:00Z' },
              },
            ],
          },
        });

        const result = await actions.listEvents();
        expect(mockCalendar.events.list).toHaveBeenCalledWith({
          calendarId: 'primary',
          maxResults: 250,
          singleEvents: true,
          showDeleted: false,
          timeMin: undefined,
          timeMax: undefined,
          orderBy: undefined,
          q: undefined,
          pageToken: undefined,
        });
        expect(result.events).toHaveLength(1);
        expect(result.events[0].summary).toBe('Team Meeting');
      });

      it('should list events with custom options', async () => {
        mockCalendar.events.list.mockResolvedValue({
          data: {
            items: [],
            nextPageToken: 'next-page',
          },
        });

        const result = await actions.listEvents('work@example.com', {
          timeMin: '2026-01-01T00:00:00Z',
          timeMax: '2026-12-31T23:59:59Z',
          maxResults: 100,
          orderBy: 'startTime',
          q: 'meeting',
        });

        expect(mockCalendar.events.list).toHaveBeenCalledWith({
          calendarId: 'work@example.com',
          timeMin: '2026-01-01T00:00:00Z',
          timeMax: '2026-12-31T23:59:59Z',
          maxResults: 100,
          orderBy: 'startTime',
          q: 'meeting',
          singleEvents: true,
          showDeleted: false,
          pageToken: undefined,
        });
        expect(result.nextPageToken).toBe('next-page');
      });
    });

    describe('getEvent', () => {
      it('should get a specific event', async () => {
        mockCalendar.events.get.mockResolvedValue({
          data: {
            id: 'event123',
            summary: 'Project Review',
            description: 'Quarterly review',
            location: 'Conference Room A',
            start: { dateTime: '2026-02-01T14:00:00Z', timeZone: 'America/New_York' },
            end: { dateTime: '2026-02-01T15:30:00Z', timeZone: 'America/New_York' },
            attendees: [
              { email: 'alice@example.com', displayName: 'Alice', responseStatus: 'accepted' },
            ],
          },
        });

        const result = await actions.getEvent('primary', 'event123');
        expect(result.id).toBe('event123');
        expect(result.summary).toBe('Project Review');
        expect(result.attendees).toHaveLength(1);
      });
    });

    describe('createEvent', () => {
      it('should create an event with required fields', async () => {
        mockCalendar.events.insert.mockResolvedValue({
          data: {
            id: 'new-event',
            summary: 'New Meeting',
            start: { dateTime: '2026-01-26T10:00:00Z' },
            end: { dateTime: '2026-01-26T11:00:00Z' },
          },
        });

        const result = await actions.createEvent('primary', {
          summary: 'New Meeting',
          start: { dateTime: '2026-01-26T10:00:00Z' },
          end: { dateTime: '2026-01-26T11:00:00Z' },
        });

        expect(mockCalendar.events.insert).toHaveBeenCalledWith({
          calendarId: 'primary',
          sendUpdates: undefined,
          conferenceDataVersion: undefined,
          requestBody: {
            summary: 'New Meeting',
            start: { dateTime: '2026-01-26T10:00:00Z' },
            end: { dateTime: '2026-01-26T11:00:00Z' },
            description: undefined,
            location: undefined,
            attendees: undefined,
            recurrence: undefined,
            reminders: undefined,
            conferenceData: undefined,
          },
        });
        expect(result.id).toBe('new-event');
      });

      it('should create event with attendees as strings', async () => {
        mockCalendar.events.insert.mockResolvedValue({
          data: {
            id: 'event-with-attendees',
            summary: 'Team Sync',
            start: { dateTime: '2026-01-27T15:00:00Z' },
            end: { dateTime: '2026-01-27T16:00:00Z' },
          },
        });

        await actions.createEvent('primary', {
          summary: 'Team Sync',
          start: { dateTime: '2026-01-27T15:00:00Z' },
          end: { dateTime: '2026-01-27T16:00:00Z' },
          attendees: ['alice@example.com', 'bob@example.com'],
          sendUpdates: 'all',
        });

        const call = mockCalendar.events.insert.mock.calls[0][0];
        expect(call.requestBody.attendees).toEqual([
          { email: 'alice@example.com' },
          { email: 'bob@example.com' },
        ]);
        expect(call.sendUpdates).toBe('all');
      });

      it('should create event with conference data', async () => {
        mockCalendar.events.insert.mockResolvedValue({
          data: {
            id: 'event-with-meet',
            summary: 'Video Call',
            start: { dateTime: '2026-01-28T09:00:00Z' },
            end: { dateTime: '2026-01-28T10:00:00Z' },
          },
        });

        await actions.createEvent('primary', {
          summary: 'Video Call',
          start: { dateTime: '2026-01-28T09:00:00Z' },
          end: { dateTime: '2026-01-28T10:00:00Z' },
          conferenceData: {
            createRequest: {
              requestId: 'random-uuid',
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        });

        const call = mockCalendar.events.insert.mock.calls[0][0];
        expect(call.conferenceDataVersion).toBe(1);
        expect(call.requestBody.conferenceData).toBeDefined();
      });
    });

    describe('updateEvent', () => {
      it('should update an event', async () => {
        mockCalendar.events.patch.mockResolvedValue({
          data: {
            id: 'event123',
            summary: 'Updated Meeting',
            start: { dateTime: '2026-01-26T11:00:00Z' },
            end: { dateTime: '2026-01-26T12:00:00Z' },
          },
        });

        const result = await actions.updateEvent('primary', 'event123', {
          summary: 'Updated Meeting',
          start: { dateTime: '2026-01-26T11:00:00Z' },
        });

        expect(mockCalendar.events.patch).toHaveBeenCalledWith({
          calendarId: 'primary',
          eventId: 'event123',
          sendUpdates: undefined,
          conferenceDataVersion: undefined,
          requestBody: expect.objectContaining({
            summary: 'Updated Meeting',
            start: { dateTime: '2026-01-26T11:00:00Z' },
          }),
        });
        expect(result.summary).toBe('Updated Meeting');
      });
    });

    describe('deleteEvent', () => {
      it('should delete an event', async () => {
        mockCalendar.events.delete.mockResolvedValue({});

        await actions.deleteEvent('primary', 'event123');
        expect(mockCalendar.events.delete).toHaveBeenCalledWith({
          calendarId: 'primary',
          eventId: 'event123',
          sendUpdates: undefined,
        });
      });

      it('should delete event with sendUpdates', async () => {
        mockCalendar.events.delete.mockResolvedValue({});

        await actions.deleteEvent('primary', 'event123', 'all');
        expect(mockCalendar.events.delete).toHaveBeenCalledWith({
          calendarId: 'primary',
          eventId: 'event123',
          sendUpdates: 'all',
        });
      });
    });

    describe('quickAddEvent', () => {
      it('should create event from natural language', async () => {
        mockCalendar.events.quickAdd.mockResolvedValue({
          data: {
            id: 'quick-event',
            summary: 'Lunch tomorrow at noon',
            start: { dateTime: '2026-01-25T12:00:00Z' },
            end: { dateTime: '2026-01-25T13:00:00Z' },
          },
        });

        const result = await actions.quickAddEvent('primary', 'Lunch tomorrow at noon');
        expect(mockCalendar.events.quickAdd).toHaveBeenCalledWith({
          calendarId: 'primary',
          text: 'Lunch tomorrow at noon',
        });
        expect(result.summary).toBe('Lunch tomorrow at noon');
      });
    });

    describe('moveEvent', () => {
      it('should move event to another calendar', async () => {
        mockCalendar.events.move.mockResolvedValue({
          data: {
            id: 'event123',
            summary: 'Moved Event',
            start: { dateTime: '2026-01-26T10:00:00Z' },
            end: { dateTime: '2026-01-26T11:00:00Z' },
          },
        });

        const result = await actions.moveEvent('primary', 'event123', 'work@example.com');
        expect(mockCalendar.events.move).toHaveBeenCalledWith({
          calendarId: 'primary',
          eventId: 'event123',
          destination: 'work@example.com',
        });
        expect(result.id).toBe('event123');
      });
    });

    describe('queryFreeBusy', () => {
      it('should query free/busy information', async () => {
        mockCalendar.freebusy.query.mockResolvedValue({
          data: {
            calendars: {
              primary: {
                busy: [
                  { start: '2026-01-25T10:00:00Z', end: '2026-01-25T11:00:00Z' },
                  { start: '2026-01-25T14:00:00Z', end: '2026-01-25T15:00:00Z' },
                ],
              },
            },
          },
        });

        const result = await actions.queryFreeBusy({
          timeMin: '2026-01-25T00:00:00Z',
          timeMax: '2026-01-25T23:59:59Z',
          items: [{ id: 'primary' }],
        });

        expect(result.calendars['primary'].busy).toHaveLength(2);
        expect(result.calendars['primary'].busy[0]).toEqual({
          start: '2026-01-25T10:00:00Z',
          end: '2026-01-25T11:00:00Z',
        });
      });

      it('should handle errors in free/busy query', async () => {
        mockCalendar.freebusy.query.mockResolvedValue({
          data: {
            calendars: {
              'invalid@example.com': {
                errors: [{ domain: 'global', reason: 'notFound' }],
              },
            },
          },
        });

        const result = await actions.queryFreeBusy({
          timeMin: '2026-01-25T00:00:00Z',
          timeMax: '2026-01-25T23:59:59Z',
          items: [{ id: 'invalid@example.com' }],
        });

        expect(result.calendars['invalid@example.com'].errors).toBeDefined();
      });
    });

    describe('createCalendar', () => {
      it('should create a new calendar', async () => {
        mockCalendar.calendars.insert.mockResolvedValue({
          data: {
            id: 'new-cal@example.com',
            summary: 'Project Calendar',
            description: 'Track project events',
            timeZone: 'America/New_York',
          },
        });

        const result = await actions.createCalendar('Project Calendar', {
          description: 'Track project events',
          timeZone: 'America/New_York',
        });

        expect(mockCalendar.calendars.insert).toHaveBeenCalledWith({
          requestBody: {
            summary: 'Project Calendar',
            description: 'Track project events',
            location: undefined,
            timeZone: 'America/New_York',
          },
        });
        expect(result.id).toBe('new-cal@example.com');
      });
    });

    describe('deleteCalendar', () => {
      it('should delete a calendar', async () => {
        mockCalendar.calendars.delete.mockResolvedValue({});

        await actions.deleteCalendar('old-cal@example.com');
        expect(mockCalendar.calendars.delete).toHaveBeenCalledWith({
          calendarId: 'old-cal@example.com',
        });
      });
    });

    describe('watchEvents', () => {
      it('should create a watch on calendar events', async () => {
        const now = Date.now();
        mockCalendar.events.watch.mockResolvedValue({
          data: {
            id: 'watch-channel-123',
            resourceId: 'resource-456',
            expiration: (now + 3600000).toString(),
          },
        });

        const result = await actions.watchEvents('primary', 'https://example.com/webhook', {
          token: 'custom-token',
          expiration: now + 3600000,
        });

        expect(mockCalendar.events.watch).toHaveBeenCalledWith({
          calendarId: 'primary',
          requestBody: {
            id: 'custom-token',
            type: 'web_hook',
            address: 'https://example.com/webhook',
            expiration: (now + 3600000).toString(),
          },
        });
        expect(result.id).toBe('watch-channel-123');
        expect(result.resourceId).toBe('resource-456');
      });

      it('should generate token if not provided', async () => {
        mockCalendar.events.watch.mockResolvedValue({
          data: {
            id: 'watch-generated',
            resourceId: 'resource-789',
            expiration: '1737824400000',
          },
        });

        await actions.watchEvents('primary', 'https://example.com/webhook');

        const call = mockCalendar.events.watch.mock.calls[0][0];
        expect(call.requestBody.id).toMatch(/^watch-\d+$/);
      });
    });

    describe('stopWatching', () => {
      it('should stop a watch channel', async () => {
        mockCalendar.channels.stop.mockResolvedValue({});

        await actions.stopWatching('channel-123', 'resource-456');
        expect(mockCalendar.channels.stop).toHaveBeenCalledWith({
          requestBody: {
            id: 'channel-123',
            resourceId: 'resource-456',
          },
        });
      });
    });
  });
});
