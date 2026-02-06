/**
 * Contract tests for Airtable integration
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
import { airtableSchemas } from '../../src/reliability/schemas/airtable.js';
import { AirtableClient } from '../../src/services/airtable.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // List bases
  http.get('https://api.airtable.com/v0/meta/bases', () => {
    return HttpResponse.json({
      bases: [
        { id: 'appBase1', name: 'Test Base 1', permissionLevel: 'create' },
        { id: 'appBase2', name: 'Test Base 2', permissionLevel: 'read' },
      ],
    });
  }),

  // Get base schema
  http.get('https://api.airtable.com/v0/meta/bases/:baseId/tables', ({ params }) => {
    return HttpResponse.json({
      tables: [
        {
          id: 'tblTable1',
          name: 'Tasks',
          primaryFieldId: 'fldName',
          fields: [
            { id: 'fldName', name: 'Name', type: 'singleLineText' },
            { id: 'fldStatus', name: 'Status', type: 'singleSelect' },
          ],
          views: [{ id: 'viwGrid', name: 'Grid view', type: 'grid' }],
        },
      ],
    });
  }),

  // List records
  http.get('https://api.airtable.com/v0/:baseId/:tableId', ({ params }) => {
    return HttpResponse.json({
      records: [
        {
          id: 'recRecord1',
          createdTime: '2024-01-01T00:00:00.000Z',
          fields: { Name: 'Task 1', Status: 'In Progress' },
        },
        {
          id: 'recRecord2',
          createdTime: '2024-01-02T00:00:00.000Z',
          fields: { Name: 'Task 2', Status: 'Done' },
        },
      ],
    });
  }),

  // Get record
  http.get('https://api.airtable.com/v0/:baseId/:tableId/:recordId', ({ params }) => {
    return HttpResponse.json({
      id: params.recordId,
      createdTime: '2024-01-01T00:00:00.000Z',
      fields: { Name: 'Task 1', Status: 'In Progress' },
    });
  }),

  // Create record
  http.post('https://api.airtable.com/v0/:baseId/:tableId', async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.fields || Object.keys(body.fields).length === 0) {
      return HttpResponse.json({
        error: { type: 'INVALID_REQUEST_BODY', message: 'fields is required' },
      }, { status: 422 });
    }

    return HttpResponse.json({
      id: 'recNewRecord',
      createdTime: '2024-01-03T00:00:00.000Z',
      fields: body.fields,
    });
  }),

  // Update record
  http.patch('https://api.airtable.com/v0/:baseId/:tableId/:recordId', async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: params.recordId,
      createdTime: '2024-01-01T00:00:00.000Z',
      fields: body.fields,
    });
  }),

  // Delete record
  http.delete('https://api.airtable.com/v0/:baseId/:tableId/:recordId', ({ params }) => {
    return HttpResponse.json({
      id: params.recordId,
      deleted: true,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Airtable Contract Tests', () => {
  it('should list bases successfully', async () => {
    const client = new AirtableClient('test-token');
    const wrapped = wrapIntegration('airtable', client, {
      inputSchemas: airtableSchemas,
    });

    const bases = await wrapped.listBases();

    expect(bases).toHaveLength(2);
    expect(bases[0].name).toBe('Test Base 1');
    expect(bases[1].permissionLevel).toBe('read');
  });

  it('should get base schema successfully', async () => {
    const client = new AirtableClient('test-token', 'appBase1');
    const wrapped = wrapIntegration('airtable', client, {
      inputSchemas: airtableSchemas,
    });

    const tables = await wrapped.getBaseSchema('appBase1');

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('Tasks');
    expect(tables[0].fields).toHaveLength(2);
  });

  it('should reject invalid inputs (missing baseId)', async () => {
    const client = new AirtableClient('test-token');
    const wrapped = wrapIntegration('airtable', client, {
      inputSchemas: airtableSchemas,
    });

    await expect(
      wrapped.getBaseSchema('')
    ).rejects.toThrow(/Base ID/);
  });

  it('should list records successfully', async () => {
    const client = new AirtableClient('test-token', 'appBase1');
    const wrapped = wrapIntegration('airtable', client, {
      inputSchemas: airtableSchemas,
    });

    const result = await wrapped.listRecords('Tasks', {}, 'appBase1');

    expect(result.records).toHaveLength(2);
    expect(result.records[0].fields.Name).toBe('Task 1');
  });

  it('should reject invalid inputs (empty fields in create)', async () => {
    const client = new AirtableClient('test-token', 'appBase1');
    const wrapped = wrapIntegration('airtable', client, {
      inputSchemas: airtableSchemas,
    });

    // MSW handler will reject empty fields
    await expect(
      wrapped.createRecord('Tasks', {
        fields: {},
      }, 'appBase1')
    ).rejects.toThrow();
  });

  it('should create record successfully', async () => {
    const client = new AirtableClient('test-token', 'appBase1');
    const wrapped = wrapIntegration('airtable', client, {
      inputSchemas: airtableSchemas,
    });

    const record = await wrapped.createRecord('Tasks', {
      fields: { Name: 'New Task', Status: 'Todo' },
    }, 'appBase1');

    expect(record.id).toBe('recNewRecord');
    expect(record.fields.Name).toBe('New Task');
  });

  it('should update record successfully', async () => {
    const client = new AirtableClient('test-token', 'appBase1');
    const wrapped = wrapIntegration('airtable', client, {
      inputSchemas: airtableSchemas,
    });

    const record = await wrapped.updateRecord('Tasks', 'recRecord1', {
      fields: { Status: 'Done' },
    }, 'appBase1');

    expect(record.id).toBe('recRecord1');
    expect(record.fields.Status).toBe('Done');
  });

  it('should delete record successfully', async () => {
    const client = new AirtableClient('test-token', 'appBase1');
    const wrapped = wrapIntegration('airtable', client, {
      inputSchemas: airtableSchemas,
    });

    const result = await wrapped.deleteRecord('Tasks', 'recRecord1', 'appBase1');

    expect(result.deleted).toBe(true);
    expect(result.id).toBe('recRecord1');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://api.airtable.com/v0/:baseId/:tableId', () => {
        return HttpResponse.json({
          error: { type: 'INVALID_PERMISSIONS', message: 'Insufficient permissions' },
        }, { status: 403 });
      })
    );

    const client = new AirtableClient('test-token', 'appBase1');
    const wrapped = wrapIntegration('airtable', client, {
      inputSchemas: airtableSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.createRecord('Tasks', {
        fields: { Name: 'Test' },
      }, 'appBase1')
    ).rejects.toThrow();
  });
});
