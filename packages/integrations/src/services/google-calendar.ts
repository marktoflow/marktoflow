/**
 * Google Calendar Integration
 *
 * Calendar and event management.
 * API Docs: https://developers.google.com/calendar/api
 */

import { google, calendar_v3 } from 'googleapis';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  creator?: { email: string; displayName?: string };
  organizer?: { email: string; displayName?: string };
  status?: string;
  htmlLink?: string;
  recurringEventId?: string;
  recurrence?: string[];
  reminders?: {
    useDefault: boolean;
    overrides?: { method: string; minutes: number }[];
  };
  conferenceData?: {
    conferenceId?: string;
    conferenceSolution?: { name: string; iconUri?: string };
    entryPoints?: { entryPointType: string; uri: string; label?: string }[];
  };
}

export interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  timeZone?: string;
  accessRole?: string;
  primary?: boolean;
}

export interface CreateEventOptions {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: string[] | { email: string; displayName?: string }[];
  recurrence?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: { method: 'email' | 'popup'; minutes: number }[];
  };
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey?: { type: string };
    };
  };
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

export interface UpdateEventOptions extends Partial<CreateEventOptions> {
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

export interface ListEventsOptions {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  orderBy?: 'startTime' | 'updated';
  q?: string;
  singleEvents?: boolean;
  showDeleted?: boolean;
  pageToken?: string;
}

export interface FreeBusyQuery {
  timeMin: string;
  timeMax: string;
  items: { id: string }[];
  timeZone?: string;
}

export interface FreeBusyResponse {
  calendars: {
    [calendarId: string]: {
      busy: { start: string; end: string }[];
      errors?: unknown[];
    };
  };
}

/**
 * Google Calendar actions for workflow integration
 */
export class GoogleCalendarActions {
  constructor(private calendar: calendar_v3.Calendar) {}

  /**
   * List user's calendars
   */
  async listCalendars(): Promise<CalendarInfo[]> {
    const response = await this.calendar.calendarList.list();
    return (
      response.data.items?.map((cal) => ({
        id: cal.id ?? '',
        summary: cal.summary ?? '',
        description: cal.description ?? undefined,
        location: cal.location ?? undefined,
        timeZone: cal.timeZone ?? undefined,
        accessRole: cal.accessRole ?? undefined,
        primary: cal.primary ?? undefined,
      })) ?? []
    );
  }

  /**
   * Get a specific calendar
   */
  async getCalendar(calendarId: string = 'primary'): Promise<CalendarInfo> {
    const response = await this.calendar.calendars.get({ calendarId });
    return {
      id: response.data.id ?? '',
      summary: response.data.summary ?? '',
      description: response.data.description ?? undefined,
      location: response.data.location ?? undefined,
      timeZone: response.data.timeZone ?? undefined,
    };
  }

  /**
   * List events from a calendar
   */
  async listEvents(
    calendarId: string = 'primary',
    options: ListEventsOptions = {}
  ): Promise<{ events: CalendarEvent[]; nextPageToken?: string }> {
    const response = await this.calendar.events.list({
      calendarId,
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      maxResults: options.maxResults ?? 250,
      orderBy: options.orderBy,
      q: options.q,
      singleEvents: options.singleEvents ?? true,
      showDeleted: options.showDeleted ?? false,
      pageToken: options.pageToken,
    });

    return {
      events: response.data.items?.map((event) => this.parseEvent(event)) ?? [],
      nextPageToken: response.data.nextPageToken ?? undefined,
    };
  }

  /**
   * Get a specific event
   */
  async getEvent(calendarId: string, eventId: string): Promise<CalendarEvent> {
    const response = await this.calendar.events.get({
      calendarId,
      eventId,
    });
    return this.parseEvent(response.data);
  }

  /**
   * Create a new event
   */
  async createEvent(
    calendarId: string = 'primary',
    options: CreateEventOptions
  ): Promise<CalendarEvent> {
    const attendees = options.attendees?.map((a) => (typeof a === 'string' ? { email: a } : a));

    const response = await this.calendar.events.insert({
      calendarId,
      sendUpdates: options.sendUpdates,
      conferenceDataVersion: options.conferenceData ? 1 : undefined,
      requestBody: {
        summary: options.summary,
        description: options.description,
        location: options.location,
        start: options.start,
        end: options.end,
        attendees,
        recurrence: options.recurrence,
        reminders: options.reminders,
        conferenceData: options.conferenceData,
      },
    });

    return this.parseEvent(response.data);
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    options: UpdateEventOptions
  ): Promise<CalendarEvent> {
    const attendees = options.attendees?.map((a) => (typeof a === 'string' ? { email: a } : a));

    const response = await this.calendar.events.patch({
      calendarId,
      eventId,
      sendUpdates: options.sendUpdates,
      conferenceDataVersion: options.conferenceData ? 1 : undefined,
      requestBody: {
        summary: options.summary,
        description: options.description,
        location: options.location,
        start: options.start,
        end: options.end,
        attendees,
        recurrence: options.recurrence,
        reminders: options.reminders,
        conferenceData: options.conferenceData,
      },
    });

    return this.parseEvent(response.data);
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    calendarId: string,
    eventId: string,
    sendUpdates?: 'all' | 'externalOnly' | 'none'
  ): Promise<void> {
    await this.calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates,
    });
  }

  /**
   * Quick add event using natural language
   */
  async quickAddEvent(calendarId: string = 'primary', text: string): Promise<CalendarEvent> {
    const response = await this.calendar.events.quickAdd({
      calendarId,
      text,
    });
    return this.parseEvent(response.data);
  }

  /**
   * Move event to another calendar
   */
  async moveEvent(
    sourceCalendarId: string,
    eventId: string,
    destinationCalendarId: string
  ): Promise<CalendarEvent> {
    const response = await this.calendar.events.move({
      calendarId: sourceCalendarId,
      eventId,
      destination: destinationCalendarId,
    });
    return this.parseEvent(response.data);
  }

  /**
   * Query free/busy information
   */
  async queryFreeBusy(query: FreeBusyQuery): Promise<FreeBusyResponse> {
    const response = await this.calendar.freebusy.query({
      requestBody: query,
    });

    return {
      calendars: Object.entries(response.data.calendars ?? {}).reduce(
        (acc, [id, data]) => {
          acc[id] = {
            busy:
              (data as { busy?: { start?: string; end?: string }[] }).busy?.map((b) => ({
                start: b.start ?? '',
                end: b.end ?? '',
              })) ?? [],
            errors: (data as { errors?: unknown[] }).errors,
          };
          return acc;
        },
        {} as FreeBusyResponse['calendars']
      ),
    };
  }

  /**
   * Create a calendar
   */
  async createCalendar(
    summary: string,
    options?: { description?: string; location?: string; timeZone?: string }
  ): Promise<CalendarInfo> {
    const response = await this.calendar.calendars.insert({
      requestBody: {
        summary,
        description: options?.description,
        location: options?.location,
        timeZone: options?.timeZone,
      },
    });

    return {
      id: response.data.id ?? '',
      summary: response.data.summary ?? '',
      description: response.data.description ?? undefined,
      location: response.data.location ?? undefined,
      timeZone: response.data.timeZone ?? undefined,
    };
  }

  /**
   * Delete a calendar
   */
  async deleteCalendar(calendarId: string): Promise<void> {
    await this.calendar.calendars.delete({ calendarId });
  }

  /**
   * Watch for changes to a calendar
   */
  async watchEvents(
    calendarId: string,
    webhookUrl: string,
    options?: { token?: string; expiration?: number }
  ): Promise<{ id: string; resourceId: string; expiration: string }> {
    const response = await this.calendar.events.watch({
      calendarId,
      requestBody: {
        id: options?.token ?? `watch-${Date.now()}`,
        type: 'web_hook',
        address: webhookUrl,
        expiration: options?.expiration?.toString(),
      },
    });

    return {
      id: response.data.id ?? '',
      resourceId: response.data.resourceId ?? '',
      expiration: response.data.expiration ?? '',
    };
  }

  /**
   * Stop watching for changes
   */
  async stopWatching(channelId: string, resourceId: string): Promise<void> {
    await this.calendar.channels.stop({
      requestBody: {
        id: channelId,
        resourceId,
      },
    });
  }

  /**
   * Parse calendar event from API response
   */
  private parseEvent(event: calendar_v3.Schema$Event): CalendarEvent {
    return {
      id: event.id ?? '',
      summary: event.summary ?? '',
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      start: {
        dateTime: event.start?.dateTime ?? undefined,
        date: event.start?.date ?? undefined,
        timeZone: event.start?.timeZone ?? undefined,
      },
      end: {
        dateTime: event.end?.dateTime ?? undefined,
        date: event.end?.date ?? undefined,
        timeZone: event.end?.timeZone ?? undefined,
      },
      attendees: event.attendees?.map((a) => ({
        email: a.email ?? '',
        displayName: a.displayName ?? undefined,
        responseStatus: a.responseStatus ?? undefined,
      })),
      creator: event.creator
        ? {
            email: event.creator.email ?? '',
            displayName: event.creator.displayName ?? undefined,
          }
        : undefined,
      organizer: event.organizer
        ? {
            email: event.organizer.email ?? '',
            displayName: event.organizer.displayName ?? undefined,
          }
        : undefined,
      status: event.status ?? undefined,
      htmlLink: event.htmlLink ?? undefined,
      recurringEventId: event.recurringEventId ?? undefined,
      recurrence: event.recurrence ?? undefined,
      reminders: event.reminders
        ? {
            useDefault: event.reminders.useDefault ?? false,
            overrides: event.reminders.overrides?.map((o) => ({
              method: o.method ?? '',
              minutes: o.minutes ?? 0,
            })),
          }
        : undefined,
      conferenceData: event.conferenceData
        ? {
            conferenceId: event.conferenceData.conferenceId ?? undefined,
            conferenceSolution: event.conferenceData.conferenceSolution
              ? {
                  name: event.conferenceData.conferenceSolution.name ?? '',
                  iconUri: event.conferenceData.conferenceSolution.iconUri ?? undefined,
                }
              : undefined,
            entryPoints: event.conferenceData.entryPoints?.map((ep) => ({
              entryPointType: ep.entryPointType ?? '',
              uri: ep.uri ?? '',
              label: ep.label ?? undefined,
            })),
          }
        : undefined,
    };
  }
}

export const GoogleCalendarInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const clientId = config.auth?.['client_id'] as string | undefined;
    const clientSecret = config.auth?.['client_secret'] as string | undefined;
    const redirectUri = config.auth?.['redirect_uri'] as string | undefined;
    const refreshToken = config.auth?.['refresh_token'] as string | undefined;
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Google Calendar SDK requires auth.client_id, auth.client_secret, auth.redirect_uri'
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    return {
      client: calendar,
      actions: new GoogleCalendarActions(calendar),
    };
  },
};
