import { google, gmail_v1 } from 'googleapis';
import { TriggerType } from '@marktoflow/core';

export interface GmailTriggerConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
  accessToken?: string;
  topicName: string; // Google Cloud Pub/Sub topic name
  labelIds?: string[]; // Labels to watch (e.g., ['INBOX'])
  triggers: Array<{
    id: string;
    event: 'email_received';
    handler: (payload: GmailTriggerPayload) => Promise<void>;
  }>;
}

export interface GmailTriggerPayload {
  type: TriggerType;
  event: 'email_received';
  historyId: string;
  emailAddress: string;
  messages?: gmail_v1.Schema$Message[];
}

export interface GmailPubSubMessage {
  message: {
    data: string; // Base64 encoded JSON: { emailAddress: string, historyId: string }
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

/**
 * Gmail trigger handler for Pub/Sub push notifications.
 *
 * Setup requirements:
 * 1. Create a Google Cloud Pub/Sub topic
 * 2. Create a push subscription pointing to your webhook URL
 * 3. Grant Gmail API watch permissions on your account
 * 4. Call watch() to start receiving notifications
 */
export class GmailTrigger {
  private gmail?: gmail_v1.Gmail;
  private watchExpiration?: number;
  private lastHistoryId?: string;

  constructor(private config: GmailTriggerConfig) {}

  /**
   * Initialize the Gmail client
   */
  private getClient(): gmail_v1.Gmail {
    if (!this.gmail) {
      const oauth2Client = new google.auth.OAuth2(
        this.config.clientId,
        this.config.clientSecret,
        this.config.redirectUri
      );
      oauth2Client.setCredentials({
        refresh_token: this.config.refreshToken,
        access_token: this.config.accessToken,
      });
      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    }
    return this.gmail;
  }

  /**
   * Start watching for email notifications via Pub/Sub.
   * This needs to be called initially and periodically (watch expires after ~7 days).
   */
  async watch(): Promise<{ historyId: string; expiration: number }> {
    const gmail = this.getClient();

    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: this.config.topicName,
        labelIds: this.config.labelIds ?? ['INBOX'],
        labelFilterBehavior: 'include',
      },
    });

    this.lastHistoryId = response.data.historyId ?? undefined;
    this.watchExpiration = parseInt(response.data.expiration ?? '0', 10);

    return {
      historyId: this.lastHistoryId ?? '',
      expiration: this.watchExpiration,
    };
  }

  /**
   * Stop watching for email notifications.
   */
  async stop(): Promise<void> {
    const gmail = this.getClient();
    await gmail.users.stop({ userId: 'me' });
    this.watchExpiration = undefined;
    this.lastHistoryId = undefined;
  }

  /**
   * Check if the watch is still active.
   */
  isWatchActive(): boolean {
    if (!this.watchExpiration) return false;
    return Date.now() < this.watchExpiration;
  }

  /**
   * Handle an incoming Pub/Sub push notification.
   * Call this from your webhook endpoint.
   */
  async handlePubSubNotification(notification: GmailPubSubMessage): Promise<void> {
    // Decode the Pub/Sub message data
    const data = JSON.parse(
      Buffer.from(notification.message.data, 'base64').toString('utf-8')
    ) as { emailAddress: string; historyId: string };

    const { emailAddress, historyId } = data;

    // Fetch new messages since the last history ID
    let messages: gmail_v1.Schema$Message[] = [];

    if (this.lastHistoryId) {
      try {
        messages = await this.fetchNewMessages(this.lastHistoryId);
      } catch (error) {
        // History may have expired, just notify with empty messages
        console.warn('Failed to fetch history, may have expired:', error);
      }
    }

    // Update last history ID
    this.lastHistoryId = historyId;

    // Create payload
    const payload: GmailTriggerPayload = {
      type: TriggerType.WEBHOOK,
      event: 'email_received',
      historyId,
      emailAddress,
      messages: messages.length > 0 ? messages : undefined,
    };

    // Call all registered handlers
    for (const trigger of this.config.triggers) {
      if (trigger.event === 'email_received') {
        await trigger.handler(payload);
      }
    }
  }

  /**
   * Fetch new messages since a given history ID.
   */
  private async fetchNewMessages(startHistoryId: string): Promise<gmail_v1.Schema$Message[]> {
    const gmail = this.getClient();

    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
    });

    const messageIds = new Set<string>();
    for (const history of historyResponse.data.history ?? []) {
      for (const added of history.messagesAdded ?? []) {
        if (added.message?.id) {
          messageIds.add(added.message.id);
        }
      }
    }

    const messages: gmail_v1.Schema$Message[] = [];
    for (const id of messageIds) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'To', 'Date'],
      });
      messages.push(msg.data);
    }

    return messages;
  }

  /**
   * Validate a Pub/Sub push request (basic validation).
   * For production, you should verify the token in the subscription.
   */
  static validatePubSubRequest(body: unknown): body is GmailPubSubMessage {
    if (!body || typeof body !== 'object') return false;
    const msg = body as Record<string, unknown>;

    if (!msg.message || typeof msg.message !== 'object') return false;
    const message = msg.message as Record<string, unknown>;

    return (
      typeof message.data === 'string' &&
      typeof message.messageId === 'string'
    );
  }
}

/**
 * Express/Fastify-compatible middleware for handling Gmail Pub/Sub webhooks.
 */
export function createGmailWebhookHandler(trigger: GmailTrigger) {
  return async (req: { body: unknown }, res: { status: (code: number) => { send: (body?: string) => void } }) => {
    try {
      if (!GmailTrigger.validatePubSubRequest(req.body)) {
        res.status(400).send('Invalid Pub/Sub message');
        return;
      }

      await trigger.handlePubSubNotification(req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Gmail webhook error:', error);
      res.status(500).send('Internal error');
    }
  };
}
