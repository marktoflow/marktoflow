import { Client, PageCollection } from '@microsoft/microsoft-graph-client';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface OutlookEmail {
  id: string;
  conversationId: string;
  subject: string;
  from: string;
  fromAddress: string;
  to: { name: string; address: string }[];
  cc?: { name: string; address: string }[];
  bcc?: { name: string; address: string }[];
  receivedDateTime: string;
  sentDateTime?: string;
  bodyPreview: string;
  body?: string;
  bodyHtml?: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance: 'low' | 'normal' | 'high';
  categories: string[];
  webLink?: string;
}

export interface GetEmailsOptions {
  folder?: string;
  filter?: string;
  select?: string[];
  top?: number;
  skip?: number;
  orderBy?: string;
  search?: string;
}

export interface SendEmailOptions {
  to: string | string[] | { name?: string; address: string }[];
  subject: string;
  body: string;
  bodyType?: 'text' | 'html';
  cc?: string | string[] | { name?: string; address: string }[];
  bcc?: string | string[] | { name?: string; address: string }[];
  importance?: 'low' | 'normal' | 'high';
  saveToSentItems?: boolean;
  replyTo?: string | { name?: string; address: string }[];
}

export interface CreateDraftOptions {
  to?: string | string[] | { name?: string; address: string }[];
  subject?: string;
  body?: string;
  bodyType?: 'text' | 'html';
  cc?: string | string[] | { name?: string; address: string }[];
  bcc?: string | string[] | { name?: string; address: string }[];
  importance?: 'low' | 'normal' | 'high';
}

export interface CalendarEvent {
  id: string;
  subject: string;
  body?: string;
  bodyHtml?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: string;
  attendees: { name: string; address: string; type: string }[];
  organizer?: { name: string; address: string };
  isOnlineMeeting: boolean;
  onlineMeetingUrl?: string;
  webLink?: string;
}

export interface GetEventsOptions {
  startDateTime?: string;
  endDateTime?: string;
  top?: number;
  skip?: number;
  filter?: string;
  orderBy?: string;
}

export interface CreateEventOptions {
  subject: string;
  body?: string;
  bodyType?: 'text' | 'html';
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  location?: string;
  attendees?: (string | { name?: string; address: string })[];
  isOnlineMeeting?: boolean;
  reminderMinutesBeforeStart?: number;
}

export interface OutlookDraft {
  id: string;
  conversationId?: string;
  webLink?: string;
}

export interface GetEmailsResult {
  emails: OutlookEmail[];
  nextLink?: string;
}

function normalizeRecipients(
  recipients: string | string[] | { name?: string; address: string }[] | undefined
): { emailAddress: { name?: string; address: string } }[] {
  if (!recipients) return [];
  if (typeof recipients === 'string') {
    return [{ emailAddress: { address: recipients } }];
  }
  if (Array.isArray(recipients)) {
    return recipients.map((r) => {
      if (typeof r === 'string') {
        return { emailAddress: { address: r } };
      }
      return { emailAddress: { name: r.name, address: r.address } };
    });
  }
  return [];
}

function parseRecipient(r: { emailAddress?: { name?: string; address?: string } }): {
  name: string;
  address: string;
} {
  return {
    name: r.emailAddress?.name ?? '',
    address: r.emailAddress?.address ?? '',
  };
}

function parseMessage(msg: Record<string, unknown>): OutlookEmail {
  const from = msg.from as { emailAddress?: { name?: string; address?: string } } | undefined;
  const toRecipients = (msg.toRecipients ?? []) as {
    emailAddress?: { name?: string; address?: string };
  }[];
  const ccRecipients = (msg.ccRecipients ?? []) as {
    emailAddress?: { name?: string; address?: string };
  }[];
  const bccRecipients = (msg.bccRecipients ?? []) as {
    emailAddress?: { name?: string; address?: string };
  }[];
  const body = msg.body as { content?: string; contentType?: string } | undefined;
  const categories = (msg.categories ?? []) as string[];

  return {
    id: (msg.id as string) ?? '',
    conversationId: (msg.conversationId as string) ?? '',
    subject: (msg.subject as string) ?? '(no subject)',
    from: from?.emailAddress?.name ?? from?.emailAddress?.address ?? '',
    fromAddress: from?.emailAddress?.address ?? '',
    to: toRecipients.map(parseRecipient),
    cc: ccRecipients.length > 0 ? ccRecipients.map(parseRecipient) : undefined,
    bcc: bccRecipients.length > 0 ? bccRecipients.map(parseRecipient) : undefined,
    receivedDateTime: (msg.receivedDateTime as string) ?? '',
    sentDateTime: msg.sentDateTime as string | undefined,
    bodyPreview: (msg.bodyPreview as string) ?? '',
    body: body?.contentType === 'text' ? body.content : undefined,
    bodyHtml: body?.contentType === 'html' ? body.content : undefined,
    isRead: (msg.isRead as boolean) ?? false,
    hasAttachments: (msg.hasAttachments as boolean) ?? false,
    importance: ((msg.importance as string) ?? 'normal') as 'low' | 'normal' | 'high',
    categories,
    webLink: msg.webLink as string | undefined,
  };
}

function parseEvent(evt: Record<string, unknown>): CalendarEvent {
  const body = evt.body as { content?: string; contentType?: string } | undefined;
  const start = evt.start as { dateTime?: string; timeZone?: string } | undefined;
  const end = evt.end as { dateTime?: string; timeZone?: string } | undefined;
  const location = evt.location as { displayName?: string } | undefined;
  const attendees = (evt.attendees ?? []) as {
    emailAddress?: { name?: string; address?: string };
    type?: string;
  }[];
  const organizer = evt.organizer as
    | { emailAddress?: { name?: string; address?: string } }
    | undefined;

  return {
    id: (evt.id as string) ?? '',
    subject: (evt.subject as string) ?? '',
    body: body?.contentType === 'text' ? body.content : undefined,
    bodyHtml: body?.contentType === 'html' ? body.content : undefined,
    start: {
      dateTime: start?.dateTime ?? '',
      timeZone: start?.timeZone ?? 'UTC',
    },
    end: {
      dateTime: end?.dateTime ?? '',
      timeZone: end?.timeZone ?? 'UTC',
    },
    location: location?.displayName,
    attendees: attendees.map((a) => ({
      name: a.emailAddress?.name ?? '',
      address: a.emailAddress?.address ?? '',
      type: a.type ?? 'required',
    })),
    organizer: organizer?.emailAddress
      ? {
          name: organizer.emailAddress.name ?? '',
          address: organizer.emailAddress.address ?? '',
        }
      : undefined,
    isOnlineMeeting: (evt.isOnlineMeeting as boolean) ?? false,
    onlineMeetingUrl: evt.onlineMeetingUrl as string | undefined,
    webLink: evt.webLink as string | undefined,
  };
}

/**
 * Outlook actions for workflow integration (Email + Calendar)
 */
export class OutlookActions {
  constructor(private client: Client) {}

  /**
   * Get emails from Outlook mailbox
   */
  async getEmails(options: GetEmailsOptions = {}): Promise<GetEmailsResult> {
    const {
      folder = 'inbox',
      filter,
      select = [
        'id',
        'conversationId',
        'subject',
        'from',
        'toRecipients',
        'ccRecipients',
        'receivedDateTime',
        'bodyPreview',
        'body',
        'isRead',
        'hasAttachments',
        'importance',
        'categories',
        'webLink',
      ],
      top = 10,
      skip,
      orderBy = 'receivedDateTime desc',
      search,
    } = options;

    let request = this.client.api(`/me/mailFolders/${folder}/messages`).select(select).top(top);

    if (orderBy) request = request.orderby(orderBy);
    if (filter) request = request.filter(filter);
    if (skip) request = request.skip(skip);
    if (search) request = request.search(search);

    const response = (await request.get()) as PageCollection;
    const emails: OutlookEmail[] = (response.value ?? []).map((msg: Record<string, unknown>) =>
      parseMessage(msg)
    );

    return {
      emails,
      nextLink: response['@odata.nextLink'],
    };
  }

  /**
   * Get a specific email by ID
   */
  async getEmail(id: string): Promise<OutlookEmail> {
    const msg = await this.client
      .api(`/me/messages/${id}`)
      .select([
        'id',
        'conversationId',
        'subject',
        'from',
        'toRecipients',
        'ccRecipients',
        'bccRecipients',
        'receivedDateTime',
        'sentDateTime',
        'bodyPreview',
        'body',
        'isRead',
        'hasAttachments',
        'importance',
        'categories',
        'webLink',
      ])
      .get();

    return parseMessage(msg);
  }

  /**
   * Send an email via Outlook
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    const message = {
      subject: options.subject,
      body: {
        contentType: options.bodyType ?? 'text',
        content: options.body,
      },
      toRecipients: normalizeRecipients(options.to),
      ccRecipients: normalizeRecipients(options.cc),
      bccRecipients: normalizeRecipients(options.bcc),
      importance: options.importance ?? 'normal',
      replyTo: options.replyTo ? normalizeRecipients(options.replyTo) : undefined,
    };

    await this.client.api('/me/sendMail').post({
      message,
      saveToSentItems: options.saveToSentItems ?? true,
    });
  }

  /**
   * Create a draft email in Outlook
   */
  async createDraft(options: CreateDraftOptions): Promise<OutlookDraft> {
    const draft = {
      subject: options.subject,
      body: options.body
        ? {
            contentType: options.bodyType ?? 'text',
            content: options.body,
          }
        : undefined,
      toRecipients: normalizeRecipients(options.to),
      ccRecipients: normalizeRecipients(options.cc),
      bccRecipients: normalizeRecipients(options.bcc),
      importance: options.importance ?? 'normal',
    };

    const response = await this.client.api('/me/messages').post(draft);

    return {
      id: response.id,
      conversationId: response.conversationId,
      webLink: response.webLink,
    };
  }

  /**
   * Reply to an email
   */
  async reply(
    messageId: string,
    body: string,
    bodyType: 'text' | 'html' = 'text',
    replyAll: boolean = false
  ): Promise<void> {
    const endpoint = replyAll
      ? `/me/messages/${messageId}/replyAll`
      : `/me/messages/${messageId}/reply`;

    await this.client.api(endpoint).post({
      message: {
        body: {
          contentType: bodyType,
          content: body,
        },
      },
    });
  }

  /**
   * Forward an email
   */
  async forward(
    messageId: string,
    to: string | string[] | { name?: string; address: string }[],
    comment?: string
  ): Promise<void> {
    await this.client.api(`/me/messages/${messageId}/forward`).post({
      toRecipients: normalizeRecipients(to),
      comment,
    });
  }

  /**
   * Mark an email as read
   */
  async markAsRead(id: string): Promise<void> {
    await this.client.api(`/me/messages/${id}`).patch({
      isRead: true,
    });
  }

  /**
   * Mark an email as unread
   */
  async markAsUnread(id: string): Promise<void> {
    await this.client.api(`/me/messages/${id}`).patch({
      isRead: false,
    });
  }

  /**
   * Move an email to a folder
   */
  async moveToFolder(messageId: string, destinationFolderId: string): Promise<void> {
    await this.client.api(`/me/messages/${messageId}/move`).post({
      destinationId: destinationFolderId,
    });
  }

  /**
   * Delete an email (move to deleted items)
   */
  async delete(id: string): Promise<void> {
    await this.client.api(`/me/messages/${id}`).delete();
  }

  /**
   * List mail folders
   */
  async listFolders(): Promise<{ id: string; displayName: string; totalItemCount: number }[]> {
    const response = await this.client
      .api('/me/mailFolders')
      .select(['id', 'displayName', 'totalItemCount'])
      .get();

    return (response.value ?? []).map(
      (f: { id?: string; displayName?: string; totalItemCount?: number }) => ({
        id: f.id ?? '',
        displayName: f.displayName ?? '',
        totalItemCount: f.totalItemCount ?? 0,
      })
    );
  }

  // Calendar methods

  /**
   * Get calendar events
   */
  async getEvents(options: GetEventsOptions = {}): Promise<CalendarEvent[]> {
    const {
      startDateTime,
      endDateTime,
      top = 10,
      skip,
      filter,
      orderBy = 'start/dateTime',
    } = options;

    let request = this.client
      .api('/me/events')
      .select([
        'id',
        'subject',
        'body',
        'start',
        'end',
        'location',
        'attendees',
        'organizer',
        'isOnlineMeeting',
        'onlineMeetingUrl',
        'webLink',
      ])
      .top(top)
      .orderby(orderBy);

    if (filter) request = request.filter(filter);
    if (skip) request = request.skip(skip);

    // Use calendarView for date range queries
    if (startDateTime && endDateTime) {
      request = this.client
        .api('/me/calendarView')
        .query({
          startDateTime,
          endDateTime,
        })
        .select([
          'id',
          'subject',
          'body',
          'start',
          'end',
          'location',
          'attendees',
          'organizer',
          'isOnlineMeeting',
          'onlineMeetingUrl',
          'webLink',
        ])
        .top(top)
        .orderby(orderBy);
    }

    const response = await request.get();
    return (response.value ?? []).map((evt: Record<string, unknown>) => parseEvent(evt));
  }

  /**
   * Get a specific calendar event by ID
   */
  async getEvent(id: string): Promise<CalendarEvent> {
    const evt = await this.client
      .api(`/me/events/${id}`)
      .select([
        'id',
        'subject',
        'body',
        'start',
        'end',
        'location',
        'attendees',
        'organizer',
        'isOnlineMeeting',
        'onlineMeetingUrl',
        'webLink',
      ])
      .get();

    return parseEvent(evt);
  }

  /**
   * Create a calendar event
   */
  async createEvent(options: CreateEventOptions): Promise<CalendarEvent> {
    const attendees = options.attendees?.map((a) => {
      if (typeof a === 'string') {
        return {
          emailAddress: { address: a },
          type: 'required',
        };
      }
      return {
        emailAddress: { name: a.name, address: a.address },
        type: 'required',
      };
    });

    const event = {
      subject: options.subject,
      body: options.body
        ? {
            contentType: options.bodyType ?? 'text',
            content: options.body,
          }
        : undefined,
      start: {
        dateTime: options.start.dateTime,
        timeZone: options.start.timeZone ?? 'UTC',
      },
      end: {
        dateTime: options.end.dateTime,
        timeZone: options.end.timeZone ?? 'UTC',
      },
      location: options.location ? { displayName: options.location } : undefined,
      attendees,
      isOnlineMeeting: options.isOnlineMeeting ?? false,
      reminderMinutesBeforeStart: options.reminderMinutesBeforeStart ?? 15,
    };

    const response = await this.client.api('/me/events').post(event);
    return parseEvent(response);
  }

  /**
   * Update a calendar event
   */
  async updateEvent(id: string, updates: Partial<CreateEventOptions>): Promise<CalendarEvent> {
    const patch: Record<string, unknown> = {};

    if (updates.subject !== undefined) patch.subject = updates.subject;
    if (updates.body !== undefined) {
      patch.body = {
        contentType: updates.bodyType ?? 'text',
        content: updates.body,
      };
    }
    if (updates.start !== undefined) {
      patch.start = {
        dateTime: updates.start.dateTime,
        timeZone: updates.start.timeZone ?? 'UTC',
      };
    }
    if (updates.end !== undefined) {
      patch.end = {
        dateTime: updates.end.dateTime,
        timeZone: updates.end.timeZone ?? 'UTC',
      };
    }
    if (updates.location !== undefined) {
      patch.location = { displayName: updates.location };
    }
    if (updates.isOnlineMeeting !== undefined) {
      patch.isOnlineMeeting = updates.isOnlineMeeting;
    }

    const response = await this.client.api(`/me/events/${id}`).patch(patch);
    return parseEvent(response);
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(id: string): Promise<void> {
    await this.client.api(`/me/events/${id}`).delete();
  }

  /**
   * Accept a meeting invitation
   */
  async acceptEvent(id: string, comment?: string, sendResponse: boolean = true): Promise<void> {
    await this.client.api(`/me/events/${id}/accept`).post({
      comment,
      sendResponse,
    });
  }

  /**
   * Decline a meeting invitation
   */
  async declineEvent(id: string, comment?: string, sendResponse: boolean = true): Promise<void> {
    await this.client.api(`/me/events/${id}/decline`).post({
      comment,
      sendResponse,
    });
  }

  /**
   * Tentatively accept a meeting invitation
   */
  async tentativelyAcceptEvent(
    id: string,
    comment?: string,
    sendResponse: boolean = true
  ): Promise<void> {
    await this.client.api(`/me/events/${id}/tentativelyAccept`).post({
      comment,
      sendResponse,
    });
  }
}

export const OutlookInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;
    if (!token) {
      throw new Error('Outlook SDK requires auth.token');
    }

    const client = Client.init({
      authProvider: (done) => {
        done(null, token);
      },
    });

    return {
      client,
      actions: new OutlookActions(client),
    };
  },
};
