import { google, gmail_v1 } from 'googleapis';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: string;
  snippet: string;
  body?: string;
  bodyHtml?: string;
  labels: string[];
  isUnread: boolean;
  hasAttachments: boolean;
}

export interface GetEmailsOptions {
  query?: string;
  maxResults?: number;
  labelIds?: string[];
  includeSpamTrash?: boolean;
  pageToken?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}

export interface CreateDraftOptions {
  to: string | string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  threadId?: string;
}

export interface GmailDraft {
  id: string;
  messageId: string;
  threadId?: string;
}

export interface GetEmailsResult {
  emails: GmailEmail[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

function parseEmailAddresses(header: string | undefined): string[] {
  if (!header) return [];
  return header.split(',').map((addr) => addr.trim());
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

function decodeBase64(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

function encodeBase64(data: string): string {
  return Buffer.from(data, 'utf-8').toString('base64url');
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): {
  text?: string;
  html?: string;
} {
  if (!payload) return {};

  if (payload.body?.data) {
    const content = decodeBase64(payload.body.data);
    if (payload.mimeType === 'text/html') {
      return { html: content };
    }
    return { text: content };
  }

  if (payload.parts) {
    let text: string | undefined;
    let html: string | undefined;

    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = decodeBase64(part.body.data);
      } else if (part.parts) {
        const nested = extractBody(part);
        if (nested.text) text = nested.text;
        if (nested.html) html = nested.html;
      }
    }
    return { text, html };
  }

  return {};
}

function hasAttachments(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
  if (!payload) return false;
  if (payload.filename && payload.filename.length > 0) return true;
  if (payload.parts) {
    return payload.parts.some((p) => hasAttachments(p));
  }
  return false;
}

function buildRawEmail(options: SendEmailOptions | CreateDraftOptions): string {
  const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  const cc = options.cc
    ? Array.isArray(options.cc)
      ? options.cc.join(', ')
      : options.cc
    : undefined;
  const bcc = options.bcc
    ? Array.isArray(options.bcc)
      ? options.bcc.join(', ')
      : options.bcc
    : undefined;

  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  let headers = [`To: ${to}`, `Subject: ${options.subject}`, `MIME-Version: 1.0`];

  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (options.replyTo) headers.push(`Reply-To: ${options.replyTo}`);
  if ('inReplyTo' in options && options.inReplyTo) {
    headers.push(`In-Reply-To: ${options.inReplyTo}`);
  }
  if ('references' in options && options.references) {
    headers.push(`References: ${options.references}`);
  }

  if (options.bodyHtml) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const body = [
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      options.body,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      '',
      options.bodyHtml,
      '',
      `--${boundary}--`,
    ].join('\r\n');
    return headers.join('\r\n') + '\r\n' + body;
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    return headers.join('\r\n') + '\r\n\r\n' + options.body;
  }
}

/**
 * Gmail actions for workflow integration
 */
export class GmailActions {
  constructor(private gmail: gmail_v1.Gmail) {}

  /**
   * Get emails from Gmail with optional filtering
   */
  async getEmails(options: GetEmailsOptions = {}): Promise<GetEmailsResult> {
    const { query, maxResults = 10, labelIds, includeSpamTrash = false, pageToken } = options;

    const listResponse = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
      labelIds,
      includeSpamTrash,
      pageToken,
    });

    const messages = listResponse.data.messages ?? [];
    const emails: GmailEmail[] = [];

    for (const msg of messages) {
      if (!msg.id) continue;

      const fullMessage = await this.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const data = fullMessage.data;
      const headers = data.payload?.headers;
      const body = extractBody(data.payload);

      emails.push({
        id: data.id ?? msg.id,
        threadId: data.threadId ?? '',
        subject: getHeader(headers, 'Subject') ?? '(no subject)',
        from: getHeader(headers, 'From') ?? '',
        to: parseEmailAddresses(getHeader(headers, 'To')),
        cc: parseEmailAddresses(getHeader(headers, 'Cc')),
        bcc: parseEmailAddresses(getHeader(headers, 'Bcc')),
        date: getHeader(headers, 'Date') ?? '',
        snippet: data.snippet ?? '',
        body: body.text,
        bodyHtml: body.html,
        labels: data.labelIds ?? [],
        isUnread: data.labelIds?.includes('UNREAD') ?? false,
        hasAttachments: hasAttachments(data.payload),
      });
    }

    return {
      emails,
      nextPageToken: listResponse.data.nextPageToken ?? undefined,
      resultSizeEstimate: listResponse.data.resultSizeEstimate ?? emails.length,
    };
  }

  /**
   * Send an email via Gmail
   */
  async sendEmail(options: SendEmailOptions): Promise<{ id: string; threadId: string }> {
    const raw = buildRawEmail(options);
    const encodedMessage = encodeBase64(raw);

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      id: response.data.id ?? '',
      threadId: response.data.threadId ?? '',
    };
  }

  /**
   * Create a draft email in Gmail
   */
  async createDraft(options: CreateDraftOptions): Promise<GmailDraft> {
    const raw = buildRawEmail(options);
    const encodedMessage = encodeBase64(raw);

    const response = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedMessage,
          threadId: options.threadId,
        },
      },
    });

    return {
      id: response.data.id ?? '',
      messageId: response.data.message?.id ?? '',
      threadId: response.data.message?.threadId ?? undefined,
    };
  }

  /**
   * Get a specific email by ID
   */
  async getEmail(id: string): Promise<GmailEmail> {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    });

    const data = response.data;
    const headers = data.payload?.headers;
    const body = extractBody(data.payload);

    return {
      id: data.id ?? id,
      threadId: data.threadId ?? '',
      subject: getHeader(headers, 'Subject') ?? '(no subject)',
      from: getHeader(headers, 'From') ?? '',
      to: parseEmailAddresses(getHeader(headers, 'To')),
      cc: parseEmailAddresses(getHeader(headers, 'Cc')),
      bcc: parseEmailAddresses(getHeader(headers, 'Bcc')),
      date: getHeader(headers, 'Date') ?? '',
      snippet: data.snippet ?? '',
      body: body.text,
      bodyHtml: body.html,
      labels: data.labelIds ?? [],
      isUnread: data.labelIds?.includes('UNREAD') ?? false,
      hasAttachments: hasAttachments(data.payload),
    };
  }

  /**
   * Mark an email as read
   */
  async markAsRead(id: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  /**
   * Mark an email as unread
   */
  async markAsUnread(id: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: {
        addLabelIds: ['UNREAD'],
      },
    });
  }

  /**
   * Add labels to an email
   */
  async addLabels(id: string, labelIds: string[]): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: {
        addLabelIds: labelIds,
      },
    });
  }

  /**
   * Remove labels from an email
   */
  async removeLabels(id: string, labelIds: string[]): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: {
        removeLabelIds: labelIds,
      },
    });
  }

  /**
   * Trash an email
   */
  async trash(id: string): Promise<void> {
    await this.gmail.users.messages.trash({
      userId: 'me',
      id,
    });
  }

  /**
   * Delete an email permanently
   */
  async delete(id: string): Promise<void> {
    await this.gmail.users.messages.delete({
      userId: 'me',
      id,
    });
  }

  /**
   * Get list of labels
   */
  async listLabels(): Promise<{ id: string; name: string; type: string }[]> {
    const response = await this.gmail.users.labels.list({
      userId: 'me',
    });

    return (response.data.labels ?? []).map((label) => ({
      id: label.id ?? '',
      name: label.name ?? '',
      type: label.type ?? '',
    }));
  }
}

export const GmailInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const clientId = config.auth?.['client_id'] as string | undefined;
    const clientSecret = config.auth?.['client_secret'] as string | undefined;
    const redirectUri = config.auth?.['redirect_uri'] as string | undefined;
    const refreshToken = config.auth?.['refresh_token'] as string | undefined;
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Gmail SDK requires auth.client_id, auth.client_secret, auth.redirect_uri');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    return {
      client: gmail,
      actions: new GmailActions(gmail),
    };
  },
};
