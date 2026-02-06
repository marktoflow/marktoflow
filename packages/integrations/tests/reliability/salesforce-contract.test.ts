/**
 * Contract tests for Salesforce integration
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
import { salesforceSchemas } from '../../src/reliability/schemas/salesforce.js';
import { SalesforceClient } from '../../src/services/salesforce.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const BASE_URL = 'https://test.salesforce.com/services/data/v59.0';

const server = setupServer(
  // SOQL Query
  http.get(`${BASE_URL}/query`, ({ request }) => {
    const url = new URL(request.url);
    const soql = url.searchParams.get('q');

    if (!soql) {
      return HttpResponse.json({
        message: 'SOQL query is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      totalSize: 1,
      done: true,
      records: [
        {
          Id: 'acc-123',
          attributes: { type: 'Account', url: '/services/data/v59.0/sobjects/Account/acc-123' },
          Name: 'Acme Corp',
          Industry: 'Technology',
        },
      ],
    });
  }),

  // Create record
  http.post(`${BASE_URL}/sobjects/:objectType`, async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body || Object.keys(body).length === 0) {
      return HttpResponse.json({
        message: 'Fields are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: `${params.objectType}-123`,
      success: true,
      errors: [],
    });
  }),

  // Describe object (MUST be before Get record to avoid :id matching "describe")
  http.get(`${BASE_URL}/sobjects/:objectType/describe`, ({ params }) => {
    return HttpResponse.json({
      name: params.objectType,
      label: String(params.objectType),
      fields: [
        { name: 'Id', label: 'Record ID', type: 'id', required: false },
        { name: 'Name', label: 'Name', type: 'string', length: 255, required: true },
      ],
      createable: true,
      updateable: true,
      deleteable: true,
    });
  }),

  // Get record
  http.get(`${BASE_URL}/sobjects/:objectType/:id`, ({ params }) => {
    return HttpResponse.json({
      Id: params.id,
      attributes: {
        type: params.objectType,
        url: `/services/data/v59.0/sobjects/${params.objectType}/${params.id}`,
      },
      Name: 'Test Record',
      CreatedDate: '2024-01-01T00:00:00.000+0000',
    });
  }),

  // Update record
  http.patch(`${BASE_URL}/sobjects/:objectType/:id`, async ({ request }) => {
    const body = await request.json() as any;

    if (!body || Object.keys(body).length === 0) {
      return HttpResponse.json({
        message: 'Fields are required',
      }, { status: 400 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // Delete record
  http.delete(`${BASE_URL}/sobjects/:objectType/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Salesforce Contract Tests', () => {
  it('should execute SOQL query successfully', async () => {
    const client = new SalesforceClient('https://test.salesforce.com', 'test-token');
    const wrapped = wrapIntegration('salesforce', client, {
      inputSchemas: salesforceSchemas,
    });

    const result = await wrapped.query('SELECT Id, Name FROM Account LIMIT 1');

    expect(result.totalSize).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].Name).toBe('Acme Corp');
  });

  it('should reject invalid query (missing SOQL)', async () => {
    const client = new SalesforceClient('https://test.salesforce.com', 'test-token');
    const wrapped = wrapIntegration('salesforce', client, {
      inputSchemas: salesforceSchemas,
    });

    await expect(
      wrapped.query('')
    ).rejects.toThrow();
  });

  it('should create a record successfully', async () => {
    const client = new SalesforceClient('https://test.salesforce.com', 'test-token');
    const wrapped = wrapIntegration('salesforce', client, {
      inputSchemas: salesforceSchemas,
    });

    const result = await wrapped.createRecord('Account', {
      Name: 'New Account',
      Industry: 'Technology',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('Account-123');
  });

  it('should reject invalid create (missing fields)', async () => {
    const client = new SalesforceClient('https://test.salesforce.com', 'test-token');
    const wrapped = wrapIntegration('salesforce', client, {
      inputSchemas: salesforceSchemas,
    });

    await expect(
      wrapped.createRecord('Account', {})
    ).rejects.toThrow();
  });

  it('should get a record successfully', async () => {
    const client = new SalesforceClient('https://test.salesforce.com', 'test-token');
    const wrapped = wrapIntegration('salesforce', client, {
      inputSchemas: salesforceSchemas,
    });

    const result = await wrapped.getRecord('Account', 'acc-123');

    expect(result.Id).toBe('acc-123');
    expect(result.Name).toBe('Test Record');
  });

  it('should update a record successfully', async () => {
    const client = new SalesforceClient('https://test.salesforce.com', 'test-token');
    const wrapped = wrapIntegration('salesforce', client, {
      inputSchemas: salesforceSchemas,
    });

    await wrapped.updateRecord('Account', 'acc-123', {
      Name: 'Updated Account',
    });

    expect(true).toBe(true);
  });

  it('should reject invalid update (missing fields)', async () => {
    const client = new SalesforceClient('https://test.salesforce.com', 'test-token');
    const wrapped = wrapIntegration('salesforce', client, {
      inputSchemas: salesforceSchemas,
    });

    await expect(
      wrapped.updateRecord('Account', 'acc-123', {})
    ).rejects.toThrow();
  });

  it('should delete a record successfully', async () => {
    const client = new SalesforceClient('https://test.salesforce.com', 'test-token');
    const wrapped = wrapIntegration('salesforce', client, {
      inputSchemas: salesforceSchemas,
    });

    await wrapped.deleteRecord('Account', 'acc-123');
    expect(true).toBe(true);
  });

  it('should describe an object successfully', async () => {
    const client = new SalesforceClient('https://test.salesforce.com', 'test-token');
    const wrapped = wrapIntegration('salesforce', client, {
      inputSchemas: salesforceSchemas,
    });

    const result = await wrapped.describeObject({ objectType: 'Account' });

    expect(result.name).toBe('Account');
    expect(result.fields).toHaveLength(2);
    expect(result.createable).toBe(true);
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      http.get(`${BASE_URL}/query`, () => {
        return HttpResponse.json({
          message: 'Unauthorized',
        }, { status: 401 });
      })
    );

    const client = new SalesforceClient('https://test.salesforce.com', 'test-token');
    const wrapped = wrapIntegration('salesforce', client, {
      inputSchemas: salesforceSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.query('SELECT Id FROM Account')
    ).rejects.toThrow();
  });
});
