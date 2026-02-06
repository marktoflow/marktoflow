/**
 * Contract tests for Dropbox integration
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
import { dropboxSchemas } from '../../src/reliability/schemas/dropbox.js';
import { DropboxClient } from '../../src/services/dropbox.js';
import { Dropbox } from 'dropbox';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Upload file
  http.post('https://content.dropboxapi.com/2/files/upload', async ({ request }) => {
    const apiArgs = request.headers.get('Dropbox-API-Arg');
    if (!apiArgs) {
      return HttpResponse.json(
        {
          error_summary: 'missing_arg',
          error: { '.tag': 'invalid_arg' },
        },
        { status: 400 }
      );
    }

    const args = JSON.parse(apiArgs);
    if (!args.path) {
      return HttpResponse.json(
        {
          error_summary: 'path is required',
          error: { '.tag': 'path' },
        },
        { status: 409 }
      );
    }

    return HttpResponse.json({
      name: 'test.txt',
      path_display: args.path,
      id: 'id:test123',
      client_modified: '2024-01-01T00:00:00Z',
      server_modified: '2024-01-01T00:00:00Z',
      size: 1024,
    });
  }),

  // Download file
  http.post('https://content.dropboxapi.com/2/files/download', async ({ request }) => {
    const apiArgs = request.headers.get('Dropbox-API-Arg');
    if (!apiArgs) {
      return HttpResponse.json(
        {
          error_summary: 'missing_arg',
          error: { '.tag': 'invalid_arg' },
        },
        { status: 400 }
      );
    }

    const args = JSON.parse(apiArgs);
    if (!args.path) {
      return HttpResponse.json(
        {
          error_summary: 'path is required',
          error: { '.tag': 'path' },
        },
        { status: 409 }
      );
    }

    // Return file content with metadata in headers
    return new HttpResponse('file content', {
      headers: {
        'Dropbox-API-Result': JSON.stringify({
          name: 'test.txt',
          path_display: args.path,
          id: 'id:test123',
        }),
      },
    });
  }),

  // Get metadata
  http.post('https://api.dropboxapi.com/2/files/get_metadata', async ({ request }) => {
    const body = (await request.json()) as any;

    if (!body.path) {
      return HttpResponse.json(
        {
          error_summary: 'path is required',
          error: { '.tag': 'path' },
        },
        { status: 409 }
      );
    }

    return HttpResponse.json({
      '.tag': 'file',
      name: 'test.txt',
      path_display: body.path,
      id: 'id:test123',
      client_modified: '2024-01-01T00:00:00Z',
      server_modified: '2024-01-01T00:00:00Z',
      size: 1024,
    });
  }),

  // List folder
  http.post('https://api.dropboxapi.com/2/files/list_folder', async ({ request }) => {
    const body = (await request.json()) as any;

    return HttpResponse.json({
      entries: [
        {
          '.tag': 'file',
          name: 'file1.txt',
          path_display: `${body.path}/file1.txt`,
          id: 'id:file1',
        },
        {
          '.tag': 'folder',
          name: 'folder1',
          path_display: `${body.path}/folder1`,
          id: 'id:folder1',
        },
      ],
      cursor: 'cursor123',
      has_more: false,
    });
  }),

  // Create folder
  http.post('https://api.dropboxapi.com/2/files/create_folder_v2', async ({ request }) => {
    const body = (await request.json()) as any;

    if (!body.path) {
      return HttpResponse.json(
        {
          error_summary: 'path is required',
          error: { '.tag': 'path' },
        },
        { status: 409 }
      );
    }

    return HttpResponse.json({
      metadata: {
        '.tag': 'folder',
        name: body.path.split('/').pop(),
        path_display: body.path,
        id: 'id:folder123',
      },
    });
  }),

  // Search
  http.post('https://api.dropboxapi.com/2/files/search_v2', async ({ request }) => {
    const body = (await request.json()) as any;

    if (!body.query) {
      return HttpResponse.json(
        {
          error_summary: 'query is required',
          error: { '.tag': 'invalid_arg' },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      matches: [
        {
          metadata: {
            '.tag': 'metadata',
            metadata: {
              '.tag': 'file',
              name: 'search-result.txt',
              path_display: '/search-result.txt',
              id: 'id:search123',
            },
          },
        },
      ],
      has_more: false,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Dropbox Contract Tests', () => {
  it('should upload a file successfully', async () => {
    const client = new Dropbox({ accessToken: 'test-token' });
    const wrapper = new DropboxClient(client);
    const wrapped = wrapIntegration('dropbox', wrapper, {
      inputSchemas: dropboxSchemas,
    });

    const result = await wrapped.uploadFile({
      path: '/test.txt',
      contents: 'Hello, world!',
    });

    expect(result).toBeDefined();
    expect((result as any).result?.name).toBe('test.txt');
    expect((result as any).result?.path_display).toBe('/test.txt');
  });

  it('should reject invalid inputs (missing path)', async () => {
    const client = new Dropbox({ accessToken: 'test-token' });
    const wrapper = new DropboxClient(client);
    const wrapped = wrapIntegration('dropbox', wrapper, {
      inputSchemas: dropboxSchemas,
    });

    await expect(
      wrapped.uploadFile({
        path: '',
        contents: 'Hello',
      })
    ).rejects.toThrow(/path/);
  });

  it('should download a file successfully', async () => {
    const client = new Dropbox({ accessToken: 'test-token' });
    const wrapper = new DropboxClient(client);
    const wrapped = wrapIntegration('dropbox', wrapper, {
      inputSchemas: dropboxSchemas,
    });

    const result = await wrapped.downloadFile({
      path: '/test.txt',
    });

    expect(result).toBeDefined();
    expect((result as any).result?.name).toBe('test.txt');
  });

  it('should get file metadata successfully', async () => {
    const client = new Dropbox({ accessToken: 'test-token' });
    const wrapper = new DropboxClient(client);
    const wrapped = wrapIntegration('dropbox', wrapper, {
      inputSchemas: dropboxSchemas,
    });

    const result = await wrapped.getMetadata('/test.txt');

    expect(result).toBeDefined();
    expect((result as any).result?.name).toBe('test.txt');
    expect((result as any).result?.path_display).toBe('/test.txt');
  });

  it('should reject invalid inputs (missing path in getMetadata)', async () => {
    const client = new Dropbox({ accessToken: 'test-token' });
    const wrapper = new DropboxClient(client);
    const wrapped = wrapIntegration('dropbox', wrapper, {
      inputSchemas: dropboxSchemas,
    });

    await expect(wrapped.getMetadata('')).rejects.toThrow();
  });

  it('should list folder contents successfully', async () => {
    const client = new Dropbox({ accessToken: 'test-token' });
    const wrapper = new DropboxClient(client);
    const wrapped = wrapIntegration('dropbox', wrapper, {
      inputSchemas: dropboxSchemas,
    });

    const result = await wrapped.listFolder('/test-folder');

    expect(result).toBeDefined();
    expect((result as any).result?.entries).toHaveLength(2);
    expect((result as any).result?.entries[0].name).toBe('file1.txt');
  });

  it('should create a folder successfully', async () => {
    const client = new Dropbox({ accessToken: 'test-token' });
    const wrapper = new DropboxClient(client);
    const wrapped = wrapIntegration('dropbox', wrapper, {
      inputSchemas: dropboxSchemas,
    });

    const result = await wrapped.createFolder('/new-folder');

    expect(result).toBeDefined();
    expect((result as any).result?.metadata.path_display).toBe('/new-folder');
  });

  it('should search files successfully', async () => {
    const client = new Dropbox({ accessToken: 'test-token' });
    const wrapper = new DropboxClient(client);
    const wrapped = wrapIntegration('dropbox', wrapper, {
      inputSchemas: dropboxSchemas,
    });

    const result = await wrapped.search({
      query: 'test',
    });

    expect(result).toBeDefined();
    expect((result as any).result?.matches).toHaveLength(1);
  });

  it('should reject invalid inputs (missing query in search)', async () => {
    const client = new Dropbox({ accessToken: 'test-token' });
    const wrapper = new DropboxClient(client);
    const wrapped = wrapIntegration('dropbox', wrapper, {
      inputSchemas: dropboxSchemas,
    });

    await expect(
      wrapped.search({
        query: '',
      })
    ).rejects.toThrow(/query/);
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://content.dropboxapi.com/2/files/upload', () => {
        return HttpResponse.json(
          {
            error_summary: 'path/not_found',
            error: { '.tag': 'path', path: { '.tag': 'not_found' } },
          },
          { status: 409 }
        );
      })
    );

    const client = new Dropbox({ accessToken: 'test-token' });
    const wrapper = new DropboxClient(client);
    const wrapped = wrapIntegration('dropbox', wrapper, {
      inputSchemas: dropboxSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.uploadFile({
        path: '/nonexistent/test.txt',
        contents: 'Hello',
      })
    ).rejects.toThrow();
  });
});
