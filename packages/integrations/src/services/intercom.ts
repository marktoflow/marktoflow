/**
 * Intercom Integration
 *
 * Scheduling & Support - Customer messaging platform.
 * API Docs: https://developers.intercom.com/docs/references/rest-api
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { BaseApiClient } from './base-client.js';
import { wrapIntegration } from '../reliability/wrapper.js';
import { intercomSchemas } from '../reliability/schemas/intercom.js';

const INTERCOM_API_URL = 'https://api.intercom.io';

export interface IntercomContact {
  type: 'contact';
  id: string;
  external_id?: string;
  email?: string;
  phone?: string;
  name?: string;
  avatar?: string;
  role: 'user' | 'lead';
  created_at: number;
  updated_at: number;
  signed_up_at?: number;
  last_seen_at?: number;
  last_contacted_at?: number;
  custom_attributes?: Record<string, unknown>;
  tags?: { tags: Array<{ id: string; name: string }> };
}

export interface IntercomConversation {
  type: 'conversation';
  id: string;
  created_at: number;
  updated_at: number;
  waiting_since?: number;
  snoozed_until?: number;
  source: {
    type: string;
    id: string;
    delivered_as: string;
    subject: string;
    body: string;
  };
  contacts: { contacts: IntercomContact[] };
  state: 'open' | 'closed' | 'snoozed';
  read: boolean;
  priority: 'priority' | 'not_priority';
  statistics?: Record<string, unknown>;
}

export interface IntercomMessage {
  type: 'message';
  id: string;
  created_at: number;
  subject?: string;
  body: string;
  message_type: 'email' | 'inapp' | 'chat';
}

export interface IntercomTag {
  type: 'tag';
  id: string;
  name: string;
}

/**
 * Intercom API client for workflow integration
 */
export class IntercomClient extends BaseApiClient {
  constructor(token: string) {
    super({
      baseUrl: INTERCOM_API_URL,
      authType: 'bearer',
      authValue: token,
      serviceName: 'Intercom',
      headers: {
        'Intercom-Version': '2.11',
      },
    });
  }

  /**
   * Create a contact
   */
  async createContact(role: 'user' | 'lead', email: string, options?: {
    external_id?: string;
    phone?: string;
    name?: string;
    signed_up_at?: number;
    custom_attributes?: Record<string, unknown>;
  }): Promise<IntercomContact> {
    return this.post('/contacts', {
      role,
      email,
      ...options,
    });
  }

  /**
   * Get a contact by ID
   */
  async getContact(contactId: string): Promise<IntercomContact> {
    return this.get(`/contacts/${contactId}`);
  }

  /**
   * List contacts
   */
  async listContacts(options?: {
    per_page?: number;
    page?: number;
  }): Promise<{ data: IntercomContact[]; pages: { page: number; per_page: number; total_pages: number } }> {
    const params: Record<string, string> = {};
    if (options?.per_page) params.per_page = String(options.per_page);
    if (options?.page) params.page = String(options.page);

    return this.get('/contacts', { params });
  }

  /**
   * Update a contact
   */
  async updateContact(contactId: string, updates: {
    email?: string;
    name?: string;
    phone?: string;
    custom_attributes?: Record<string, unknown>;
  }): Promise<IntercomContact> {
    return this.put(`/contacts/${contactId}`, updates);
  }

  /**
   * Search contacts
   */
  async searchContacts(query: {
    field: string;
    operator: string;
    value: string | number;
  }): Promise<{ data: IntercomContact[]; total_count: number }> {
    return this.post('/contacts/search', {
      query: {
        field: query.field,
        operator: query.operator,
        value: query.value,
      },
    });
  }

  /**
   * Create a conversation
   */
  async createConversation(options: { from: { type: 'user' | 'lead'; id: string }; body: string }): Promise<IntercomConversation> {
    return this.post('/conversations', {
      from: options.from,
      body: options.body,
    });
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(conversationId: string): Promise<IntercomConversation> {
    return this.get(`/conversations/${conversationId}`);
  }

  /**
   * List conversations
   */
  async listConversations(options?: {
    per_page?: number;
    page?: number;
  }): Promise<{ conversations: IntercomConversation[]; pages: { page: number; per_page: number; total_pages: number } }> {
    const params: Record<string, string> = {};
    if (options?.per_page) params.per_page = String(options.per_page);
    if (options?.page) params.page = String(options.page);

    return this.get('/conversations', { params });
  }

  /**
   * Reply to a conversation
   */
  async replyToConversation(options: { conversationId: string; body: string; type: 'comment' | 'note' }): Promise<IntercomConversation> {
    return this.post(`/conversations/${options.conversationId}/reply`, {
      message_type: options.type,
      type: 'admin',
      body: options.body,
    });
  }

  /**
   * Close a conversation
   */
  async closeConversation(conversationId: string): Promise<IntercomConversation> {
    return this.post(`/conversations/${conversationId}/parts`, {
      message_type: 'close',
      type: 'admin',
      body: 'Conversation closed',
    });
  }

  /**
   * Send a message
   */
  async sendMessage(options: { from: { type: 'admin'; id: string }; to: { type: 'user' | 'contact'; id: string }; body: string; messageType: 'email' | 'inapp' }): Promise<IntercomMessage> {
    return this.post('/messages', {
      message_type: options.messageType,
      from: options.from,
      to: options.to,
      body: options.body,
    });
  }

  /**
   * List tags
   */
  async listTags(): Promise<{ data: IntercomTag[] }> {
    return this.get('/tags');
  }

  /**
   * Create a tag
   */
  async createTag(name: string): Promise<IntercomTag> {
    return this.post('/tags', { name });
  }
}

export const IntercomInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;

    if (!token) {
      throw new Error('Intercom SDK requires auth.token');
    }

    const client = new IntercomClient(token);
    const wrapped = wrapIntegration('intercom', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: intercomSchemas,
    });
    return {
      client: wrapped,
      actions: wrapped,
    };
  },
};
