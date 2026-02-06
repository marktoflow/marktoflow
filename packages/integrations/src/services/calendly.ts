/**
 * Calendly Integration
 *
 * Scheduling & Support platform.
 * API Docs: https://developer.calendly.com/api-docs
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { BaseApiClient } from './base-client.js';
import { wrapIntegration } from '../reliability/wrapper.js';
import { calendlySchemas } from '../reliability/schemas/calendly.js';

const CALENDLY_API_URL = 'https://api.calendly.com';

export interface CalendlyUser {
  uri: string;
  name: string;
  slug: string;
  email: string;
  scheduling_url: string;
  timezone: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface CalendlyEvent {
  uri: string;
  name: string;
  status: 'active' | 'canceled';
  start_time: string;
  end_time: string;
  event_type: string;
  location: { type: string; location?: string };
  invitees_counter: { total: number; active: number; limit: number };
  created_at: string;
  updated_at: string;
  event_memberships: Array<{ user: string }>;
  event_guests: Array<{ email: string }>;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  active: boolean;
  slug: string;
  scheduling_url: string;
  duration: number;
  kind: 'solo' | 'group';
  pooling_type: string;
  type: 'StandardEventType' | 'CustomEventType';
  color: string;
  created_at: string;
  updated_at: string;
  internal_note: string;
  description_plain: string;
  description_html: string;
}

export interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: 'active' | 'canceled';
  timezone: string;
  event: string;
  created_at: string;
  updated_at: string;
  cancel_url: string;
  reschedule_url: string;
}

export interface CalendlySchedulingLink {
  booking_url: string;
  owner: string;
  owner_type: string;
}

/**
 * Calendly API client for workflow integration
 */
export class CalendlyClient extends BaseApiClient {
  constructor(token: string) {
    super({
      baseUrl: CALENDLY_API_URL,
      authType: 'bearer',
      authValue: token,
      serviceName: 'Calendly',
    });
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<{ resource: CalendlyUser }> {
    return this.get('/users/me');
  }

  /**
   * List scheduled events
   */
  async listEvents(user: string, options?: {
    count?: number;
    page_token?: string;
    status?: 'active' | 'canceled';
  }): Promise<{ collection: CalendlyEvent[]; pagination: { count: number; next_page_token?: string } }> {
    const params: Record<string, string> = { user };
    if (options?.count) params.count = String(options.count);
    if (options?.page_token) params.page_token = options.page_token;
    if (options?.status) params.status = options.status;

    return this.get('/scheduled_events', { params });
  }

  /**
   * Get a scheduled event
   */
  async getEvent(eventUuid: string): Promise<{ resource: CalendlyEvent }> {
    return this.get(`/scheduled_events/${eventUuid}`);
  }

  /**
   * Cancel a scheduled event
   */
  async cancelEvent(eventUuid: string, reason?: string): Promise<{ resource: CalendlyEvent }> {
    return this.post(`/scheduled_events/${eventUuid}/cancellation`, {
      reason: reason || 'Canceled via API',
    });
  }

  /**
   * List event types
   */
  async listEventTypes(user: string, options?: {
    count?: number;
    page_token?: string;
    active?: boolean;
  }): Promise<{ collection: CalendlyEventType[]; pagination: { count: number; next_page_token?: string } }> {
    const params: Record<string, string> = { user };
    if (options?.count) params.count = String(options.count);
    if (options?.page_token) params.page_token = options.page_token;
    if (options?.active !== undefined) params.active = String(options.active);

    return this.get('/event_types', { params });
  }

  /**
   * Get an event type
   */
  async getEventType(eventTypeUuid: string): Promise<{ resource: CalendlyEventType }> {
    return this.get(`/event_types/${eventTypeUuid}`);
  }

  /**
   * List invitees for an event
   */
  async listInvitees(eventUuid: string, options?: {
    count?: number;
    page_token?: string;
    status?: 'active' | 'canceled';
  }): Promise<{ collection: CalendlyInvitee[]; pagination: { count: number; next_page_token?: string } }> {
    const params: Record<string, string> = {};
    if (options?.count) params.count = String(options.count);
    if (options?.page_token) params.page_token = options.page_token;
    if (options?.status) params.status = options.status;

    return this.get(`/scheduled_events/${eventUuid}/invitees`, { params });
  }

  /**
   * Create a scheduling link
   */
  async createSchedulingLink(
    maxEventCount: number,
    owner: string,
    ownerType: 'EventType' | 'User'
  ): Promise<{ resource: CalendlySchedulingLink }> {
    return this.post('/scheduling_links', {
      max_event_count: maxEventCount,
      owner,
      owner_type: ownerType,
    });
  }
}

export const CalendlyInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;

    if (!token) {
      throw new Error('Calendly SDK requires auth.token');
    }

    const client = new CalendlyClient(token);
    const wrapped = wrapIntegration('calendly', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: calendlySchemas,
    });
    return {
      client: wrapped,
      actions: wrapped,
    };
  },
};
