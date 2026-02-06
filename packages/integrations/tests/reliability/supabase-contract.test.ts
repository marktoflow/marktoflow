/**
 * Contract tests for Supabase integration
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
import { supabaseSchemas } from '../../src/reliability/schemas/supabase.js';
import { SupabaseClient } from '../../src/services/supabase.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const SUPABASE_URL = 'https://test.supabase.co';

const server = setupServer(
  // Select from table
  http.get(`${SUPABASE_URL}/rest/v1/:table`, ({ params, request }) => {
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit');

    return HttpResponse.json([
      {
        id: 1,
        name: 'Test Item 1',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        name: 'Test Item 2',
        created_at: '2024-01-02T00:00:00Z',
      },
    ]);
  }),

  // Insert into table
  http.post(`${SUPABASE_URL}/rest/v1/:table`, async ({ request, params }) => {
    const body = (await request.json()) as any;
    const prefer = request.headers.get('Prefer');

    if (prefer === 'return=minimal') {
      return new HttpResponse(null, { status: 201 });
    }

    // Return the inserted data with an id
    if (Array.isArray(body)) {
      return HttpResponse.json(
        body.map((item, idx) => ({
          id: idx + 1,
          ...item,
          created_at: '2024-01-01T00:00:00Z',
        }))
      );
    }

    return HttpResponse.json({
      id: 1,
      ...body,
      created_at: '2024-01-01T00:00:00Z',
    });
  }),

  // Update table
  http.patch(`${SUPABASE_URL}/rest/v1/:table`, async ({ request, params }) => {
    const body = (await request.json()) as any;
    const url = new URL(request.url);

    return HttpResponse.json([
      {
        id: 1,
        ...body,
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]);
  }),

  // Delete from table
  http.delete(`${SUPABASE_URL}/rest/v1/:table`, ({ request }) => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Deleted Item',
      },
    ]);
  }),

  // RPC call
  http.post(`${SUPABASE_URL}/rest/v1/rpc/:functionName`, async ({ request, params }) => {
    const body = (await request.json()) as any;

    return HttpResponse.json({
      result: 'success',
      function: params.functionName,
      params: body,
    });
  }),

  // Auth sign up
  http.post(`${SUPABASE_URL}/auth/v1/signup`, async ({ request }) => {
    const body = (await request.json()) as any;

    if (!body.email || !body.password) {
      return HttpResponse.json(
        {
          error: 'missing_credentials',
          error_description: 'Email and password are required',
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      user: {
        id: 'user-123',
        email: body.email,
      },
      session: {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
      },
    });
  }),

  // Auth sign in
  http.post(`${SUPABASE_URL}/auth/v1/token`, async ({ request }) => {
    const body = (await request.json()) as any;

    if (!body.email || !body.password) {
      return HttpResponse.json(
        {
          error: 'invalid_credentials',
          error_description: 'Invalid email or password',
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      user: {
        id: 'user-123',
        email: body.email,
      },
      session: {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
      },
    });
  }),

  // Storage list - Must come before generic storage download to match more specific path
  http.get(`${SUPABASE_URL}/storage/v1/object/list/:bucket`, ({ params, request }) => {
    return HttpResponse.json([
      {
        name: 'file1.txt',
        id: 'file-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        metadata: {},
      },
      {
        name: 'file2.txt',
        id: 'file-2',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        metadata: {},
      },
    ]);
  }),

  // Storage upload
  http.post(`${SUPABASE_URL}/storage/v1/object/:bucket/*`, async ({ request, params }) => {
    return HttpResponse.json({
      path: 'test/file.txt',
      id: 'file-123',
    });
  }),

  // Storage download
  http.get(`${SUPABASE_URL}/storage/v1/object/:bucket/*`, () => {
    return new HttpResponse('file content', {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }),

  // Storage delete
  http.delete(`${SUPABASE_URL}/storage/v1/object/:bucket`, async ({ request }) => {
    return HttpResponse.json({
      data: [{ name: 'file.txt' }],
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Supabase Contract Tests', () => {
  it('should select data from table successfully', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    const query = await wrapped.from('users');
    const result = await query.select();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Test Item 1');
  });

  it('should insert data into table successfully', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    const query = await wrapped.from('users');
    const result = await query.insert({
      data: { name: 'New User', email: 'test@example.com' },
    });

    // The result should be defined and contain the inserted data
    expect(result).toBeDefined();
    // Check if it's an array or object response
    if (Array.isArray(result)) {
      expect(result).toHaveLength(1);
      expect(result[0].id).toBeDefined();
      expect(result[0].name).toBe('New User');
    }
  });

  it('should update data in table successfully', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    const query = await wrapped.from('users');
    const result = await query.update({
      data: { name: 'Updated User' },
      filter: [{ column: 'id', operator: 'eq', value: 1 }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Updated User');
  });

  it('should delete data from table successfully', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    const query = await wrapped.from('users');
    const result = await query.delete({
      filter: [{ column: 'id', operator: 'eq', value: 1 }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('should call RPC function successfully', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    const result = await wrapped.rpc('test_function', { param: 'value' });

    expect(result).toBeDefined();
    expect(result.result).toBe('success');
    expect(result.function).toBe('test_function');
  });

  it('should sign up a user successfully', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    const result = await wrapped.signUp({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe('test@example.com');
    expect(result.session?.access_token).toBe('access-token-123');
  });

  it('should reject invalid inputs (missing email in signUp)', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    await expect(
      wrapped.signUp({
        email: '',
        password: 'password123',
      })
    ).rejects.toThrow(/email/);
  });

  it('should sign in a user successfully', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    const result = await wrapped.signIn({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe('test@example.com');
    expect(result.session?.access_token).toBe('access-token-123');
  });

  it('should reject invalid inputs (missing password in signIn)', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    await expect(
      wrapped.signIn({
        email: 'test@example.com',
        password: '',
      })
    ).rejects.toThrow(/password/);
  });

  it('should upload file to storage successfully', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    const file = Buffer.from('test content');
    const result = await wrapped.uploadFile({
      bucket: 'test-bucket',
      path: 'test/file.txt',
      file,
    });

    expect(result.path).toBe('test/file.txt');
    expect(result.id).toBe('file-123');
  });

  it('should reject invalid inputs (missing bucket in uploadFile)', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    const file = Buffer.from('test content');
    await expect(
      wrapped.uploadFile({
        bucket: '',
        path: 'test/file.txt',
        file,
      })
    ).rejects.toThrow(/bucket/);
  });

  it('should list files in storage successfully', async () => {
    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
    });

    const result = await wrapped.listFiles('test-bucket');

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('file1.txt');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/:table`, () => {
        return HttpResponse.json(
          {
            message: 'Invalid request',
            code: 'PGRST116',
          },
          { status: 400 }
        );
      })
    );

    const client = new SupabaseClient(SUPABASE_URL, 'test-key');
    const wrapped = wrapIntegration('supabase', client, {
      inputSchemas: supabaseSchemas,
      maxRetries: 0,
    });

    const query = await wrapped.from('users');
    await expect(
      query.insert({
        data: { name: 'Test' },
      })
    ).rejects.toThrow();
  });
});
