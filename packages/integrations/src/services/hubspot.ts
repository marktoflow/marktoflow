/**
 * HubSpot Integration
 *
 * CRM & Sales platform.
 * API Docs: https://developers.hubspot.com/docs/api/overview
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { BaseApiClient } from './base-client.js';
import { wrapIntegration } from '../reliability/wrapper.js';
import { hubspotSchemas } from '../reliability/schemas/hubspot.js';

const HUBSPOT_API_URL = 'https://api.hubapi.com';

export interface HubSpotContact {
  id: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotDeal {
  id: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotCompany {
  id: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotTicket {
  id: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface CreateContactInput {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  [key: string]: unknown;
}

export interface CreateDealInput {
  dealname: string;
  pipeline: string;
  dealstage: string;
  amount?: number;
  closedate?: string;
  [key: string]: unknown;
}

export interface SearchContactsInput {
  filterGroups: Array<{
    filters: Array<{
      propertyName: string;
      operator: string;
      value: string;
    }>;
  }>;
  sorts?: Array<{ propertyName: string; direction: 'ASCENDING' | 'DESCENDING' }>;
  query?: string;
  limit?: number;
  after?: string;
}

/**
 * HubSpot API client for workflow integration
 */
export class HubSpotClient extends BaseApiClient {
  constructor(token: string) {
    super({
      baseUrl: HUBSPOT_API_URL,
      authType: 'bearer',
      authValue: token,
      serviceName: 'HubSpot',
    });
  }

  /**
   * Create a contact
   */
  async createContact(properties: CreateContactInput): Promise<HubSpotContact> {
    return this.post('/crm/v3/objects/contacts', { properties });
  }

  /**
   * Get a contact by ID
   */
  async getContact(contactId: string, properties?: string[]): Promise<HubSpotContact> {
    const params = properties ? { properties: properties.join(',') } : undefined;
    return this.get(`/crm/v3/objects/contacts/${contactId}`, { params: params as Record<string, string> });
  }

  /**
   * List contacts
   */
  async listContacts(limit?: number, after?: string, properties?: string[]): Promise<{ results: HubSpotContact[]; paging?: { next?: { after: string } } }> {
    const params: Record<string, string | number> = {};
    if (limit) params.limit = limit;
    if (after) params.after = after;
    if (properties) params.properties = properties.join(',');
    return this.get('/crm/v3/objects/contacts', { params });
  }

  /**
   * Update a contact
   */
  async updateContact(contactId: string, properties: Record<string, unknown>): Promise<HubSpotContact> {
    return this.patch(`/crm/v3/objects/contacts/${contactId}`, { properties });
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId: string): Promise<void> {
    return this.delete(`/crm/v3/objects/contacts/${contactId}`);
  }

  /**
   * Search contacts
   */
  async searchContacts(input: SearchContactsInput): Promise<{ results: HubSpotContact[]; paging?: { next?: { after: string } } }> {
    return this.post('/crm/v3/objects/contacts/search', input);
  }

  /**
   * Create a deal
   */
  async createDeal(properties: CreateDealInput): Promise<HubSpotDeal> {
    return this.post('/crm/v3/objects/deals', { properties });
  }

  /**
   * Get a deal by ID
   */
  async getDeal(dealId: string, properties?: string[]): Promise<HubSpotDeal> {
    const params = properties ? { properties: properties.join(',') } : undefined;
    return this.get(`/crm/v3/objects/deals/${dealId}`, { params: params as Record<string, string> });
  }

  /**
   * List deals
   */
  async listDeals(limit?: number, after?: string, properties?: string[]): Promise<{ results: HubSpotDeal[]; paging?: { next?: { after: string } } }> {
    const params: Record<string, string | number> = {};
    if (limit) params.limit = limit;
    if (after) params.after = after;
    if (properties) params.properties = properties.join(',');
    return this.get('/crm/v3/objects/deals', { params });
  }

  /**
   * Update a deal
   */
  async updateDeal(dealId: string, properties: Record<string, unknown>): Promise<HubSpotDeal> {
    return this.patch(`/crm/v3/objects/deals/${dealId}`, { properties });
  }

  /**
   * Create a company
   */
  async createCompany(properties: Record<string, unknown> & { name: string }): Promise<HubSpotCompany> {
    return this.post('/crm/v3/objects/companies', { properties });
  }

  /**
   * Get a company by ID
   */
  async getCompany(companyId: string, properties?: string[]): Promise<HubSpotCompany> {
    const params = properties ? { properties: properties.join(',') } : undefined;
    return this.get(`/crm/v3/objects/companies/${companyId}`, { params: params as Record<string, string> });
  }

  /**
   * List companies
   */
  async listCompanies(limit?: number, after?: string, properties?: string[]): Promise<{ results: HubSpotCompany[]; paging?: { next?: { after: string } } }> {
    const params: Record<string, string | number> = {};
    if (limit) params.limit = limit;
    if (after) params.after = after;
    if (properties) params.properties = properties.join(',');
    return this.get('/crm/v3/objects/companies', { params });
  }

  /**
   * Create a ticket
   */
  async createTicket(properties: Record<string, unknown> & { subject: string; hs_pipeline: string; hs_pipeline_stage: string }): Promise<HubSpotTicket> {
    return this.post('/crm/v3/objects/tickets', { properties });
  }

  /**
   * Get a ticket by ID
   */
  async getTicket(ticketId: string, properties?: string[]): Promise<HubSpotTicket> {
    const params = properties ? { properties: properties.join(',') } : undefined;
    return this.get(`/crm/v3/objects/tickets/${ticketId}`, { params: params as Record<string, string> });
  }

  /**
   * List tickets
   */
  async listTickets(limit?: number, after?: string, properties?: string[]): Promise<{ results: HubSpotTicket[]; paging?: { next?: { after: string } } }> {
    const params: Record<string, string | number> = {};
    if (limit) params.limit = limit;
    if (after) params.after = after;
    if (properties) params.properties = properties.join(',');
    return this.get('/crm/v3/objects/tickets', { params });
  }
}

export const HubSpotInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;

    if (!token) {
      throw new Error('HubSpot SDK requires auth.token');
    }

    const client = new HubSpotClient(token);
    const wrapped = wrapIntegration('hubspot', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: hubspotSchemas,
    });
    return {
      client: wrapped,
      actions: wrapped,
    };
  },
};
