import { Client } from '@microsoft/microsoft-graph-client';
import { TriggerType } from '@marktoflow/core';

export interface OutlookTriggerConfig {
  token: string;
  notificationUrl: string; // Your webhook URL for receiving notifications
  changeTypes?: ('created' | 'updated' | 'deleted')[];
  resource?: string; // Default: me/mailFolders/inbox/messages
  expirationMinutes?: number; // Default: 4230 (~3 days, max allowed)
  clientState?: string; // Secret to validate notifications
  triggers: Array<{
    id: string;
    event: 'email_received' | 'email_updated' | 'email_deleted';
    handler: (payload: OutlookTriggerPayload) => Promise<void>;
  }>;
}

export interface OutlookTriggerPayload {
  type: TriggerType;
  event: 'email_received' | 'email_updated' | 'email_deleted';
  subscriptionId: string;
  changeType: string;
  resource: string;
  resourceData?: {
    id: string;
    [key: string]: unknown;
  };
  clientState?: string;
  tenantId?: string;
}

export interface GraphSubscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: string;
  clientState?: string;
}

export interface GraphNotification {
  value: Array<{
    subscriptionId: string;
    subscriptionExpirationDateTime: string;
    changeType: string;
    resource: string;
    resourceData?: {
      '@odata.type': string;
      '@odata.id': string;
      '@odata.etag': string;
      id: string;
      [key: string]: unknown;
    };
    clientState?: string;
    tenantId?: string;
  }>;
}

export interface GraphValidationRequest extends Record<string, unknown> {
  validationToken: string;
}

/**
 * Outlook trigger handler for Microsoft Graph webhook subscriptions.
 *
 * Setup requirements:
 * 1. Register an Azure AD application with Mail.Read permissions
 * 2. Set up a publicly accessible webhook endpoint
 * 3. Call subscribe() to start receiving notifications
 * 4. Handle subscription renewal before expiration (max ~3 days)
 */
export class OutlookTrigger {
  private client: Client;
  private subscription?: GraphSubscription;

  constructor(private config: OutlookTriggerConfig) {
    this.client = Client.init({
      authProvider: (done) => {
        done(null, config.token);
      },
    });
  }

  /**
   * Create a subscription to receive mail notifications.
   */
  async subscribe(): Promise<GraphSubscription> {
    const changeTypes = this.config.changeTypes ?? ['created'];
    const resource = this.config.resource ?? 'me/mailFolders/inbox/messages';
    const expirationMinutes = this.config.expirationMinutes ?? 4230;

    const expirationDateTime = new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString();

    const subscription = await this.client.api('/subscriptions').post({
      changeType: changeTypes.join(','),
      notificationUrl: this.config.notificationUrl,
      resource,
      expirationDateTime,
      clientState: this.config.clientState,
    });

    this.subscription = {
      id: subscription.id,
      resource: subscription.resource,
      changeType: subscription.changeType,
      notificationUrl: subscription.notificationUrl,
      expirationDateTime: subscription.expirationDateTime,
      clientState: subscription.clientState,
    };

    return this.subscription;
  }

  /**
   * Renew an existing subscription.
   */
  async renew(expirationMinutes?: number): Promise<GraphSubscription> {
    if (!this.subscription) {
      throw new Error('No active subscription to renew. Call subscribe() first.');
    }

    const minutes = expirationMinutes ?? this.config.expirationMinutes ?? 4230;
    const expirationDateTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    const updated = await this.client.api(`/subscriptions/${this.subscription.id}`).patch({
      expirationDateTime,
    });

    this.subscription.expirationDateTime = updated.expirationDateTime;
    return this.subscription;
  }

  /**
   * Delete the subscription (stop receiving notifications).
   */
  async unsubscribe(): Promise<void> {
    if (!this.subscription) {
      return;
    }

    await this.client.api(`/subscriptions/${this.subscription.id}`).delete();
    this.subscription = undefined;
  }

  /**
   * Get the current subscription status.
   */
  getSubscription(): GraphSubscription | undefined {
    return this.subscription;
  }

  /**
   * Check if subscription is still active (not expired).
   */
  isSubscriptionActive(): boolean {
    if (!this.subscription) return false;
    return new Date(this.subscription.expirationDateTime) > new Date();
  }

  /**
   * Handle an incoming Graph notification.
   * Call this from your webhook endpoint after validation.
   */
  async handleNotification(notification: GraphNotification): Promise<void> {
    for (const item of notification.value) {
      // Validate client state if configured
      if (this.config.clientState && item.clientState !== this.config.clientState) {
        console.warn('Invalid client state in notification, skipping');
        continue;
      }

      // Map change type to event
      let event: 'email_received' | 'email_updated' | 'email_deleted';
      switch (item.changeType) {
        case 'created':
          event = 'email_received';
          break;
        case 'updated':
          event = 'email_updated';
          break;
        case 'deleted':
          event = 'email_deleted';
          break;
        default:
          console.warn(`Unknown change type: ${item.changeType}`);
          continue;
      }

      const payload: OutlookTriggerPayload = {
        type: TriggerType.WEBHOOK,
        event,
        subscriptionId: item.subscriptionId,
        changeType: item.changeType,
        resource: item.resource,
        resourceData: item.resourceData
          ? {
              '@odata.type': item.resourceData['@odata.type'],
              '@odata.id': item.resourceData['@odata.id'],
              '@odata.etag': item.resourceData['@odata.etag'],
              id: item.resourceData.id,
            }
          : undefined,
        clientState: item.clientState,
        tenantId: item.tenantId,
      };

      // Call matching handlers
      for (const trigger of this.config.triggers) {
        if (trigger.event === event) {
          await trigger.handler(payload);
        }
      }
    }
  }

  /**
   * Check if a request is a validation request from Graph.
   */
  static isValidationRequest(query: Record<string, unknown>): query is GraphValidationRequest {
    return typeof query.validationToken === 'string';
  }

  /**
   * Validate the notification body structure.
   */
  static validateNotification(body: unknown): body is GraphNotification {
    if (!body || typeof body !== 'object') return false;
    const notification = body as Record<string, unknown>;

    if (!Array.isArray(notification.value)) return false;

    return notification.value.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const entry = item as Record<string, unknown>;
      return (
        typeof entry.subscriptionId === 'string' &&
        typeof entry.changeType === 'string' &&
        typeof entry.resource === 'string'
      );
    });
  }
}

/**
 * Express/Fastify-compatible middleware for handling Outlook Graph webhooks.
 *
 * Handles both:
 * - Subscription validation (GET with validationToken)
 * - Notification processing (POST with notification payload)
 */
export function createOutlookWebhookHandler(trigger: OutlookTrigger) {
  return async (
    req: { method: string; query: Record<string, unknown>; body: unknown },
    res: {
      status: (code: number) => { send: (body?: string) => void };
      contentType: (type: string) => void;
    }
  ) => {
    try {
      // Handle subscription validation (Microsoft Graph sends GET with validationToken)
      if (req.method === 'GET' || OutlookTrigger.isValidationRequest(req.query)) {
        if (OutlookTrigger.isValidationRequest(req.query)) {
          res.contentType('text/plain');
          res.status(200).send(req.query.validationToken);
          return;
        }
        res.status(400).send('Missing validationToken');
        return;
      }

      // Handle notification
      if (!OutlookTrigger.validateNotification(req.body)) {
        res.status(400).send('Invalid notification format');
        return;
      }

      // Process notification asynchronously (Graph expects quick 202 response)
      setImmediate(() => {
        trigger.handleNotification(req.body as GraphNotification).catch((error) => {
          console.error('Error processing notification:', error);
        });
      });

      res.status(202).send('Accepted');
    } catch (error) {
      console.error('Outlook webhook error:', error);
      res.status(500).send('Internal error');
    }
  };
}
