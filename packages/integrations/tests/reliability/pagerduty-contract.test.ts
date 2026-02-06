/**
 * Contract tests for PagerDuty integration
 *
 * These tests validate that:
 * 1. The SDK makes correct HTTP requests
 * 2. Input validation schemas work as expected
 * 3. Response handling is correct
 * 4. The integration behaves correctly without hitting real APIs
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { pagerdutySchemas } from '../../src/reliability/schemas/pagerduty.js';
import { PagerDutyClient } from '../../src/services/pagerduty.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // List incidents
  http.get('https://api.pagerduty.com/incidents', () => {
    return HttpResponse.json({
      incidents: [
        {
          id: 'inc-123',
          incident_number: 1,
          title: 'Database connection issue',
          description: 'Production DB unreachable',
          status: 'triggered',
          urgency: 'high',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          service: { id: 'svc-1', summary: 'Production API' },
          assignments: [],
          escalation_policy: { id: 'ep-1', summary: 'Default' },
        },
      ],
      limit: 25,
      offset: 0,
      total: 1,
      more: false,
    });
  }),

  // Get incident
  http.get('https://api.pagerduty.com/incidents/:incidentId', ({ params }) => {
    return HttpResponse.json({
      incident: {
        id: params.incidentId,
        incident_number: 1,
        title: 'Test Incident',
        description: 'Test Description',
        status: 'triggered',
        urgency: 'high',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        service: { id: 'svc-1', summary: 'Test Service' },
        assignments: [],
        escalation_policy: { id: 'ep-1', summary: 'Default' },
      },
    });
  }),

  // Create incident
  http.post('https://api.pagerduty.com/incidents', async ({ request }) => {
    const body = await request.json() as any;
    const incident = body.incident;

    if (!incident.title || !incident.service?.id) {
      return HttpResponse.json({
        error: 'title and serviceId are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      incident: {
        id: 'inc-new',
        incident_number: 2,
        title: incident.title,
        description: incident.body?.details || '',
        status: 'triggered',
        urgency: incident.urgency || 'high',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        service: { id: incident.service.id, summary: 'Test Service' },
        assignments: [],
        escalation_policy: incident.escalation_policy || { id: 'ep-1', summary: 'Default' },
      },
    });
  }),

  // Update incident (including resolve and acknowledge)
  http.put('https://api.pagerduty.com/incidents/:incidentId', async ({ request, params }) => {
    const body = await request.json() as any;
    const incident = body.incident;

    return HttpResponse.json({
      incident: {
        id: params.incidentId,
        incident_number: 1,
        title: incident.title || 'Test Incident',
        description: 'Test Description',
        status: incident.status || 'triggered',
        urgency: incident.urgency || 'high',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        service: { id: 'svc-1', summary: 'Test Service' },
        assignments: [],
        escalation_policy: { id: 'ep-1', summary: 'Default' },
      },
    });
  }),

  // List services
  http.get('https://api.pagerduty.com/services', () => {
    return HttpResponse.json({
      services: [
        {
          id: 'svc-1',
          name: 'Production API',
          description: 'Main production API service',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          escalation_policy: { id: 'ep-1', summary: 'Default' },
        },
      ],
      limit: 25,
      offset: 0,
      total: 1,
      more: false,
    });
  }),

  // Get service
  http.get('https://api.pagerduty.com/services/:serviceId', ({ params }) => {
    return HttpResponse.json({
      service: {
        id: params.serviceId,
        name: 'Test Service',
        description: 'Test service description',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        escalation_policy: { id: 'ep-1', summary: 'Default' },
      },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('PagerDuty Contract Tests', () => {
  it('should list incidents successfully', async () => {
    const client = new PagerDutyClient('test-api-key');
    const wrapped = wrapIntegration('pagerduty', client, {
      inputSchemas: pagerdutySchemas,
    });

    const result = await wrapped.listIncidents();

    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0].title).toBe('Database connection issue');
  });

  it('should get an incident successfully', async () => {
    const client = new PagerDutyClient('test-api-key');
    const wrapped = wrapIntegration('pagerduty', client, {
      inputSchemas: pagerdutySchemas,
    });

    const result = await wrapped.getIncident('inc-123');

    expect(result.incident.id).toBe('inc-123');
    expect(result.incident.title).toBe('Test Incident');
  });

  it('should create an incident successfully', async () => {
    const client = new PagerDutyClient('test-api-key');
    const wrapped = wrapIntegration('pagerduty', client, {
      inputSchemas: pagerdutySchemas,
    });

    const result = await wrapped.createIncident({
      title: 'New Incident',
      serviceId: 'svc-1',
      escalationPolicyId: 'ep-1',
      fromEmail: 'user@example.com',
    });

    expect(result.incident.id).toBe('inc-new');
    expect(result.incident.title).toBe('New Incident');
  });

  it('should reject invalid incident (missing required fields)', async () => {
    const client = new PagerDutyClient('test-api-key');
    const wrapped = wrapIntegration('pagerduty', client, {
      inputSchemas: pagerdutySchemas,
    });

    await expect(
      wrapped.createIncident({ title: 'Test' } as any)
    ).rejects.toThrow();
  });

  it('should update an incident successfully', async () => {
    const client = new PagerDutyClient('test-api-key');
    const wrapped = wrapIntegration('pagerduty', client, {
      inputSchemas: pagerdutySchemas,
    });

    const result = await wrapped.updateIncident('inc-123', {
      title: 'Updated Incident',
    }, 'user@example.com');

    expect(result.incident.id).toBe('inc-123');
    expect(result.incident.title).toBe('Updated Incident');
  });

  it('should resolve an incident successfully', async () => {
    const client = new PagerDutyClient('test-api-key');
    const wrapped = wrapIntegration('pagerduty', client, {
      inputSchemas: pagerdutySchemas,
    });

    const result = await wrapped.resolveIncident('inc-123', 'user@example.com');

    expect(result.incident.id).toBe('inc-123');
    expect(result.incident.status).toBe('resolved');
  });

  it('should acknowledge an incident successfully', async () => {
    const client = new PagerDutyClient('test-api-key');
    const wrapped = wrapIntegration('pagerduty', client, {
      inputSchemas: pagerdutySchemas,
    });

    const result = await wrapped.acknowledgeIncident('inc-123', 'user@example.com');

    expect(result.incident.id).toBe('inc-123');
    expect(result.incident.status).toBe('acknowledged');
  });

  it('should list services successfully', async () => {
    const client = new PagerDutyClient('test-api-key');
    const wrapped = wrapIntegration('pagerduty', client, {
      inputSchemas: pagerdutySchemas,
    });

    const result = await wrapped.listServices();

    expect(result.services).toHaveLength(1);
    expect(result.services[0].name).toBe('Production API');
  });

  it('should get a service successfully', async () => {
    const client = new PagerDutyClient('test-api-key');
    const wrapped = wrapIntegration('pagerduty', client, {
      inputSchemas: pagerdutySchemas,
    });

    const result = await wrapped.getService('svc-1');

    expect(result.service.id).toBe('svc-1');
    expect(result.service.name).toBe('Test Service');
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      http.get('https://api.pagerduty.com/incidents', () => {
        return HttpResponse.json({
          error: 'Unauthorized',
        }, { status: 401 });
      })
    );

    const client = new PagerDutyClient('test-api-key');
    const wrapped = wrapIntegration('pagerduty', client, {
      inputSchemas: pagerdutySchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.listIncidents()
    ).rejects.toThrow();
  });
});
