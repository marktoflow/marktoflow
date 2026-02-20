/**
 * PagerDuty Integration
 *
 * DevOps & Monitoring platform.
 * API Docs: https://developer.pagerduty.com/api-reference/
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { BaseApiClient } from './base-client.js';
import { wrapIntegration } from '../reliability/wrapper.js';
import { pagerdutySchemas } from '../reliability/schemas/pagerduty.js';

const PAGERDUTY_API_URL = 'https://api.pagerduty.com';

export interface PagerDutyIncident {
  id: string;
  incident_number: number;
  title: string;
  description: string;
  status: 'triggered' | 'acknowledged' | 'resolved';
  urgency: 'high' | 'low';
  created_at: string;
  updated_at: string;
  service: { id: string; summary: string };
  assignments: Array<{ assignee: { id: string; summary: string } }>;
  escalation_policy: { id: string; summary: string };
}

export interface PagerDutyService {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'disabled' | 'maintenance' | 'warning' | 'critical';
  created_at: string;
  updated_at: string;
  escalation_policy: { id: string; summary: string };
}

export interface CreateIncidentInput {
  title: string;
  serviceId: string;
  escalationPolicyId?: string;
  urgency?: 'high' | 'low';
  body?: {
    type: 'incident_body';
    details: string;
  };
  incidentKey?: string;
}

/**
 * PagerDuty API client for workflow integration
 */
export class PagerDutyClient extends BaseApiClient {
  constructor(apiKey: string) {
    super({
      baseUrl: PAGERDUTY_API_URL,
      authType: 'custom',
      authValue: `Token token=${apiKey}`,
      serviceName: 'PagerDuty',
      headers: {
        'Accept': 'application/vnd.pagerduty+json;version=2',
      },
    });
  }

  /**
   * List incidents
   *
   * PagerDuty expects multi-value array parameters as repeated query-string
   * entries (e.g. `statuses[]=triggered&statuses[]=acknowledged`), NOT as a
   * single comma-joined value.  The previous implementation used
   * `options.statuses.join(',')` which produced `statuses[]=triggered,acknowledged`
   * — an invalid value that the API silently ignores, so filtering never worked.
   *
   * We build the query string with URLSearchParams (which supports repeated keys
   * via `.append()`) and attach it directly to the path so that BaseApiClient's
   * single-value `params` map is not used for the array fields.
   */
  async listIncidents(options?: {
    statuses?: string[];
    serviceIds?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ incidents: PagerDutyIncident[]; limit: number; offset: number; total: number; more: boolean }> {
    const qs = new URLSearchParams();

    for (const status of options?.statuses ?? []) {
      qs.append('statuses[]', status);
    }
    for (const id of options?.serviceIds ?? []) {
      qs.append('service_ids[]', id);
    }
    if (options?.limit != null) qs.set('limit', String(options.limit));
    if (options?.offset != null) qs.set('offset', String(options.offset));

    const queryString = qs.toString();
    const path = queryString ? `/incidents?${queryString}` : '/incidents';

    return this.get(path);
  }

  /**
   * Get an incident by ID
   */
  async getIncident(incidentId: string): Promise<{ incident: PagerDutyIncident }> {
    return this.get(`/incidents/${incidentId}`);
  }

  /**
   * Create an incident
   */
  async createIncident(input: CreateIncidentInput, fromEmail: string): Promise<{ incident: PagerDutyIncident }> {
    const body = {
      incident: {
        type: 'incident',
        title: input.title,
        service: {
          id: input.serviceId,
          type: 'service_reference',
        },
        urgency: input.urgency ?? 'high',
        body: input.body,
        incident_key: input.incidentKey,
      },
    };

    if (input.escalationPolicyId) {
      (body.incident as any).escalation_policy = {
        id: input.escalationPolicyId,
        type: 'escalation_policy_reference',
      };
    }

    return this.post('/incidents', body, {
      headers: { 'From': fromEmail },
    });
  }

  /**
   * Update an incident
   */
  async updateIncident(incidentId: string, updates: { title?: string; urgency?: 'high' | 'low'; status?: string }, fromEmail: string): Promise<{ incident: PagerDutyIncident }> {
    return this.put(`/incidents/${incidentId}`, {
      incident: {
        type: 'incident',
        ...updates,
      },
    }, {
      headers: { 'From': fromEmail },
    });
  }

  /**
   * Resolve an incident
   */
  async resolveIncident(incidentId: string, fromEmail: string): Promise<{ incident: PagerDutyIncident }> {
    return this.put(`/incidents/${incidentId}`, {
      incident: {
        type: 'incident',
        status: 'resolved',
      },
    }, {
      headers: { 'From': fromEmail },
    });
  }

  /**
   * Acknowledge an incident
   */
  async acknowledgeIncident(incidentId: string, fromEmail: string): Promise<{ incident: PagerDutyIncident }> {
    return this.put(`/incidents/${incidentId}`, {
      incident: {
        type: 'incident',
        status: 'acknowledged',
      },
    }, {
      headers: { 'From': fromEmail },
    });
  }

  /**
   * List services
   */
  async listServices(limit?: number, offset?: number): Promise<{ services: PagerDutyService[]; limit: number; offset: number; total: number; more: boolean }> {
    const params: Record<string, string> = {};
    if (limit) params.limit = String(limit);
    if (offset) params.offset = String(offset);

    return this.get('/services', { params });
  }

  /**
   * Get a service by ID
   */
  async getService(serviceId: string): Promise<{ service: PagerDutyService }> {
    return this.get(`/services/${serviceId}`);
  }
}

export const PagerDutyInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const apiKey = config.auth?.['api_key'] as string | undefined;

    if (!apiKey) {
      throw new Error('PagerDuty SDK requires auth.api_key');
    }

    const client = new PagerDutyClient(apiKey);
    const wrapped = wrapIntegration('pagerduty', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: pagerdutySchemas,
    });
    return {
      client: wrapped,
      actions: wrapped,
    };
  },
};
