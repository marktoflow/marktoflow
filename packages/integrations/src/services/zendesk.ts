/**
 * Zendesk Integration
 *
 * Customer support and ticketing platform.
 * API Docs: https://developer.zendesk.com/api-reference/
 * SDK: https://github.com/blakmatrix/node-zendesk
 */

import zendesk from 'node-zendesk';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface ZendeskTicket {
  id?: number;
  subject: string;
  comment: {
    body: string;
    html_body?: string;
    public?: boolean;
  };
  requester_id?: number;
  submitter_id?: number;
  assignee_id?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  tags?: string[];
  type?: 'problem' | 'incident' | 'question' | 'task';
}

export interface ZendeskUser {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  role?: 'end-user' | 'agent' | 'admin';
  verified?: boolean;
  tags?: string[];
}

export interface SearchOptions {
  query: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/**
 * Zendesk client wrapper for workflow integration
 */
export class ZendeskClient {
  constructor(private client: any) {}

  // ==================== Tickets ====================

  /**
   * List tickets
   */
  async listTickets(options?: { per_page?: number; page?: number }) {
    return await this.client.tickets.list(options);
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId: number) {
    return await this.client.tickets.show(ticketId);
  }

  /**
   * Create ticket
   */
  async createTicket(ticket: ZendeskTicket) {
    return await this.client.tickets.create({ ticket });
  }

  /**
   * Update ticket
   */
  async updateTicket(ticketId: number, ticket: Partial<ZendeskTicket>) {
    return await this.client.tickets.update(ticketId, { ticket });
  }

  /**
   * Delete ticket
   */
  async deleteTicket(ticketId: number) {
    return await this.client.tickets.delete(ticketId);
  }

  /**
   * Add comment to ticket
   */
  async addComment(ticketId: number, comment: { body: string; public?: boolean }) {
    return await this.client.tickets.update(ticketId, {
      ticket: {
        comment,
      },
    });
  }

  // ==================== Users ====================

  /**
   * List users
   */
  async listUsers(options?: { per_page?: number; page?: number; role?: string }) {
    return await this.client.users.list(options);
  }

  /**
   * Get user by ID
   */
  async getUser(userId: number) {
    return await this.client.users.show(userId);
  }

  /**
   * Create user
   */
  async createUser(user: ZendeskUser) {
    return await this.client.users.create({ user });
  }

  /**
   * Update user
   */
  async updateUser(userId: number, user: Partial<ZendeskUser>) {
    return await this.client.users.update(userId, { user });
  }

  /**
   * Delete user
   */
  async deleteUser(userId: number) {
    return await this.client.users.delete(userId);
  }

  /**
   * Search users
   */
  async searchUsers(query: string) {
    return await this.client.search.query(query, 'user');
  }

  // ==================== Search ====================

  /**
   * Search across Zendesk
   */
  async search(options: SearchOptions) {
    return await this.client.search.query(options.query, undefined, options.sort_by, options.sort_order);
  }

  // ==================== Organizations ====================

  /**
   * List organizations
   */
  async listOrganizations(options?: { per_page?: number; page?: number }) {
    return await this.client.organizations.list(options);
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: number) {
    return await this.client.organizations.show(orgId);
  }

  /**
   * Create organization
   */
  async createOrganization(organization: { name: string; tags?: string[] }) {
    return await this.client.organizations.create({ organization });
  }

  /**
   * Update organization
   */
  async updateOrganization(orgId: number, organization: Partial<{ name: string; tags?: string[] }>) {
    return await this.client.organizations.update(orgId, { organization });
  }
}

export const ZendeskInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const subdomain = config.auth?.['subdomain'] as string | undefined;
    const email = config.auth?.['email'] as string | undefined;
    const token = config.auth?.['token'] as string | undefined;

    if (!subdomain || !email || !token) {
      throw new Error('Zendesk SDK requires auth.subdomain, auth.email, and auth.token');
    }

    const client = zendesk.createClient({
      username: email,
      token: token,
      subdomain: subdomain,
    });

    const wrapper = new ZendeskClient(client);

    return {
      client: wrapper,
      actions: wrapper,
    };
  },
};
