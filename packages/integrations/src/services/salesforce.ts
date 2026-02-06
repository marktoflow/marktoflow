/**
 * Salesforce Integration
 *
 * CRM & Sales platform.
 * API Docs: https://developer.salesforce.com/docs/apis
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { BaseApiClient } from './base-client.js';
import { wrapIntegration } from '../reliability/wrapper.js';
import { salesforceSchemas } from '../reliability/schemas/salesforce.js';

export interface SalesforceQueryResult<T = Record<string, unknown>> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

export interface SalesforceRecord {
  Id: string;
  attributes: {
    type: string;
    url: string;
  };
  [key: string]: unknown;
}

export interface SalesforceObjectDescription {
  name: string;
  label: string;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    length?: number;
    required: boolean;
  }>;
  createable: boolean;
  updateable: boolean;
  deleteable: boolean;
}

export interface CreateRecordInput {
  objectType: string;
  fields: Record<string, unknown>;
}

/**
 * Salesforce API client for workflow integration
 */
export class SalesforceClient extends BaseApiClient {
  constructor(instanceUrl: string, accessToken: string) {
    const baseUrl = `${instanceUrl}/services/data/v59.0`;
    super({
      baseUrl,
      authType: 'bearer',
      authValue: accessToken,
      serviceName: 'Salesforce',
    });
  }

  /**
   * Execute a SOQL query
   */
  async query<T = Record<string, unknown>>(soql: string): Promise<SalesforceQueryResult<T>> {
    return this.get('/query', { params: { q: soql } });
  }

  /**
   * Create a record
   */
  async createRecord(objectType: string, fields: Record<string, unknown>): Promise<{ id: string; success: boolean; errors: unknown[] }> {
    return this.post(`/sobjects/${objectType}`, fields);
  }

  /**
   * Get a record by ID
   */
  async getRecord(objectType: string, id: string, fields?: string[]): Promise<SalesforceRecord> {
    const path = fields
      ? `/sobjects/${objectType}/${id}?fields=${fields.join(',')}`
      : `/sobjects/${objectType}/${id}`;
    return this.get(path);
  }

  /**
   * Update a record
   */
  async updateRecord(objectType: string, id: string, fields: Record<string, unknown>): Promise<void> {
    return this.patch(`/sobjects/${objectType}/${id}`, fields);
  }

  /**
   * Delete a record
   */
  async deleteRecord(objectType: string, id: string): Promise<void> {
    return this.delete(`/sobjects/${objectType}/${id}`);
  }

  /**
   * Describe an object (get metadata)
   */
  async describeObject(options: { objectType: string }): Promise<SalesforceObjectDescription> {
    return this.get(`/sobjects/${options.objectType}/describe`);
  }
}

export const SalesforceInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const instanceUrl = config.auth?.['instance_url'] as string | undefined;
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!instanceUrl) {
      throw new Error('Salesforce SDK requires auth.instance_url (e.g., https://yourinstance.salesforce.com)');
    }
    if (!accessToken) {
      throw new Error('Salesforce SDK requires auth.access_token');
    }

    const client = new SalesforceClient(instanceUrl, accessToken);
    const wrapped = wrapIntegration('salesforce', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: salesforceSchemas,
    });
    return {
      client: wrapped,
      actions: wrapped,
    };
  },
};
