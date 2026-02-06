/**
 * Contract tests for HubSpot integration
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
import { hubspotSchemas } from '../../src/reliability/schemas/hubspot.js';
import { HubSpotClient } from '../../src/services/hubspot.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Create contact
  http.post('https://api.hubapi.com/crm/v3/objects/contacts', async ({ request }) => {
    const body = await request.json() as any;
    const props = body.properties;

    if (!props.email) {
      return HttpResponse.json({
        message: 'email is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'contact-123',
      properties: props,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      archived: false,
    });
  }),

  // Get contact
  http.get('https://api.hubapi.com/crm/v3/objects/contacts/:contactId', ({ params }) => {
    return HttpResponse.json({
      id: params.contactId,
      properties: {
        email: 'test@example.com',
        firstname: 'Test',
        lastname: 'User',
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      archived: false,
    });
  }),

  // List contacts
  http.get('https://api.hubapi.com/crm/v3/objects/contacts', () => {
    return HttpResponse.json({
      results: [
        {
          id: 'contact-1',
          properties: { email: 'user1@example.com', firstname: 'User', lastname: 'One' },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          archived: false,
        },
      ],
      paging: {},
    });
  }),

  // Update contact
  http.patch('https://api.hubapi.com/crm/v3/objects/contacts/:contactId', async ({ request, params }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      id: params.contactId,
      properties: body.properties,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      archived: false,
    });
  }),

  // Delete contact
  http.delete('https://api.hubapi.com/crm/v3/objects/contacts/:contactId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Search contacts
  http.post('https://api.hubapi.com/crm/v3/objects/contacts/search', async ({ request }) => {
    return HttpResponse.json({
      results: [
        {
          id: 'contact-1',
          properties: { email: 'search@example.com', firstname: 'Search', lastname: 'Result' },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          archived: false,
        },
      ],
      paging: {},
    });
  }),

  // Create deal
  http.post('https://api.hubapi.com/crm/v3/objects/deals', async ({ request }) => {
    const body = await request.json() as any;
    const props = body.properties;

    if (!props.dealname || !props.pipeline || !props.dealstage) {
      return HttpResponse.json({
        message: 'dealname, pipeline, and dealstage are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'deal-123',
      properties: props,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      archived: false,
    });
  }),

  // Get deal
  http.get('https://api.hubapi.com/crm/v3/objects/deals/:dealId', ({ params }) => {
    return HttpResponse.json({
      id: params.dealId,
      properties: {
        dealname: 'Test Deal',
        pipeline: 'default',
        dealstage: 'qualifiedtobuy',
        amount: '10000',
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      archived: false,
    });
  }),

  // List deals
  http.get('https://api.hubapi.com/crm/v3/objects/deals', () => {
    return HttpResponse.json({
      results: [
        {
          id: 'deal-1',
          properties: { dealname: 'Deal One', pipeline: 'default', dealstage: 'qualifiedtobuy' },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          archived: false,
        },
      ],
      paging: {},
    });
  }),

  // Update deal
  http.patch('https://api.hubapi.com/crm/v3/objects/deals/:dealId', async ({ request, params }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      id: params.dealId,
      properties: body.properties,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      archived: false,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('HubSpot Contract Tests', () => {
  it('should create a contact successfully', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    const result = await wrapped.createContact({
      email: 'test@example.com',
      firstname: 'Test',
      lastname: 'User',
    });

    expect(result.id).toBe('contact-123');
    expect(result.properties.email).toBe('test@example.com');
  });

  it('should reject invalid contact (missing email)', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    await expect(
      wrapped.createContact({ firstname: 'Test' } as any)
    ).rejects.toThrow();
  });

  it('should get a contact successfully', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    const result = await wrapped.getContact('contact-123');

    expect(result.id).toBe('contact-123');
    expect(result.properties.email).toBe('test@example.com');
  });

  it('should list contacts successfully', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    const result = await wrapped.listContacts(10);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].properties.email).toBe('user1@example.com');
  });

  it('should update a contact successfully', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    const result = await wrapped.updateContact('contact-123', {
      firstname: 'Updated',
    });

    expect(result.id).toBe('contact-123');
    expect(result.properties.firstname).toBe('Updated');
  });

  it('should delete a contact successfully', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    await wrapped.deleteContact('contact-123');
    expect(true).toBe(true);
  });

  it('should search contacts successfully', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    const result = await wrapped.searchContacts({
      filterGroups: [
        {
          filters: [
            { propertyName: 'email', operator: 'EQ', value: 'search@example.com' },
          ],
        },
      ],
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].properties.email).toBe('search@example.com');
  });

  it('should create a deal successfully', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    const result = await wrapped.createDeal({
      dealname: 'New Deal',
      pipeline: 'default',
      dealstage: 'qualifiedtobuy',
      amount: 50000,
    });

    expect(result.id).toBe('deal-123');
    expect(result.properties.dealname).toBe('New Deal');
  });

  it('should reject invalid deal (missing required fields)', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    await expect(
      wrapped.createDeal({ dealname: 'Test' } as any)
    ).rejects.toThrow();
  });

  it('should get a deal successfully', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    const result = await wrapped.getDeal('deal-123');

    expect(result.id).toBe('deal-123');
    expect(result.properties.dealname).toBe('Test Deal');
  });

  it('should list deals successfully', async () => {
    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
    });

    const result = await wrapped.listDeals(10);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].properties.dealname).toBe('Deal One');
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      http.post('https://api.hubapi.com/crm/v3/objects/contacts', () => {
        return HttpResponse.json({
          message: 'Unauthorized',
        }, { status: 401 });
      })
    );

    const client = new HubSpotClient('test-token');
    const wrapped = wrapIntegration('hubspot', client, {
      inputSchemas: hubspotSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.createContact({ email: 'test@example.com' })
    ).rejects.toThrow();
  });
});
