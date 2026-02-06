/**
 * Contract tests for Google Drive integration
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
import { googleDriveSchemas } from '../../src/reliability/schemas/google-drive.js';
import { google } from 'googleapis';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // List files
  http.get('https://www.googleapis.com/drive/v3/files', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    return HttpResponse.json({
      files: [
        {
          id: 'file1',
          name: 'Document.pdf',
          mimeType: 'application/pdf',
          size: '102400',
          createdTime: '2024-01-15T10:00:00Z',
          modifiedTime: '2024-01-15T12:00:00Z',
          webViewLink: 'https://drive.google.com/file/d/file1/view',
        },
        {
          id: 'file2',
          name: 'Spreadsheet.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: '51200',
          createdTime: '2024-01-14T10:00:00Z',
          modifiedTime: '2024-01-14T12:00:00Z',
          webViewLink: 'https://drive.google.com/file/d/file2/view',
        },
      ],
      nextPageToken: undefined,
    });
  }),

  // Get file metadata
  http.get('https://www.googleapis.com/drive/v3/files/:fileId', ({ params, request }) => {
    if (!params.fileId || params.fileId === '') {
      return HttpResponse.json({
        error: { code: 404, message: 'File not found' },
      }, { status: 404 });
    }

    const url = new URL(request.url);
    const alt = url.searchParams.get('alt');

    // Check if this is a download request
    if (alt === 'media') {
      return new HttpResponse('File content here', {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });
    }

    return HttpResponse.json({
      id: params.fileId,
      name: 'Test File.pdf',
      mimeType: 'application/pdf',
      size: '102400',
      createdTime: '2024-01-15T10:00:00Z',
      modifiedTime: '2024-01-15T12:00:00Z',
      webViewLink: `https://drive.google.com/file/d/${params.fileId}/view`,
      webContentLink: `https://drive.google.com/uc?id=${params.fileId}`,
    });
  }),

  // Create file
  http.post('https://www.googleapis.com/upload/drive/v3/files', async ({ request }) => {
    const contentType = request.headers.get('content-type') || '';

    // For multipart upload
    if (contentType.includes('multipart')) {
      return HttpResponse.json({
        id: 'new-file-id',
        name: 'New File.txt',
        mimeType: 'text/plain',
        size: '1024',
        createdTime: '2024-01-20T10:00:00Z',
        modifiedTime: '2024-01-20T10:00:00Z',
        webViewLink: 'https://drive.google.com/file/d/new-file-id/view',
      });
    }

    // For metadata-only creation
    const body = await request.json() as any;
    return HttpResponse.json({
      id: 'new-folder-id',
      name: body.name || 'New Folder',
      mimeType: body.mimeType || 'application/vnd.google-apps.folder',
      createdTime: '2024-01-20T10:00:00Z',
      modifiedTime: '2024-01-20T10:00:00Z',
    });
  }),

  // Simple file create (no upload)
  http.post('https://www.googleapis.com/drive/v3/files', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.name) {
      return HttpResponse.json({
        error: {
          code: 400,
          message: 'Missing name',
        },
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'new-item-id',
      name: body.name,
      mimeType: body.mimeType || 'application/vnd.google-apps.folder',
      createdTime: '2024-01-20T10:00:00Z',
      modifiedTime: '2024-01-20T10:00:00Z',
      webViewLink: 'https://drive.google.com/file/d/new-item-id/view',
    });
  }),

  // Update file
  http.patch('https://www.googleapis.com/drive/v3/files/:fileId', async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: params.fileId,
      name: body.name || 'Updated File.pdf',
      mimeType: 'application/pdf',
      size: '102400',
      modifiedTime: '2024-01-20T10:00:00Z',
    });
  }),

  // Delete file
  http.delete('https://www.googleapis.com/drive/v3/files/:fileId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Copy file
  http.post('https://www.googleapis.com/drive/v3/files/:fileId/copy', async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: 'copied-file-id',
      name: body.name || 'Copy of File',
      mimeType: 'application/pdf',
      size: '102400',
      createdTime: '2024-01-20T10:00:00Z',
      modifiedTime: '2024-01-20T10:00:00Z',
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Google Drive Contract Tests', () => {
  it('should list files successfully', async () => {
    const drive = google.drive({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-drive', drive, {
      inputSchemas: googleDriveSchemas,
    });

    const result = await wrapped.files.list({});

    expect(result.data.files).toHaveLength(2);
    expect(result.data.files?.[0].name).toBe('Document.pdf');
    expect(result.data.files?.[1].mimeType).toContain('spreadsheet');
  });

  it('should get file metadata successfully', async () => {
    const drive = google.drive({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-drive', drive, {
      inputSchemas: googleDriveSchemas,
    });

    const result = await wrapped.files.get({
      fileId: 'file1',
    });

    expect(result.data.id).toBe('file1');
    expect(result.data.name).toBe('Test File.pdf');
    expect(result.data.mimeType).toBe('application/pdf');
  });


  it('should create a file successfully', async () => {
    const drive = google.drive({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-drive', drive, {
      inputSchemas: googleDriveSchemas,
    });

    const result = await wrapped.files.create({
      requestBody: {
        name: 'New Document.txt',
        mimeType: 'text/plain',
      },
    });

    expect(result.data.id).toBe('new-item-id');
    expect(result.data.name).toBe('New Document.txt');
  });

  it('should reject invalid inputs (missing name)', async () => {
    const drive = google.drive({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-drive', drive, {
      inputSchemas: googleDriveSchemas,
    });

    await expect(
      wrapped.files.create({
        requestBody: {
          name: '',
        },
      })
    ).rejects.toThrow();
  });

  it('should update a file successfully', async () => {
    const drive = google.drive({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-drive', drive, {
      inputSchemas: googleDriveSchemas,
    });

    const result = await wrapped.files.update({
      fileId: 'file1',
      requestBody: {
        name: 'Renamed File.pdf',
      },
    });

    expect(result.data.id).toBe('file1');
    expect(result.data.name).toBe('Renamed File.pdf');
  });

  it('should delete a file successfully', async () => {
    const drive = google.drive({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-drive', drive, {
      inputSchemas: googleDriveSchemas,
    });

    await expect(
      wrapped.files.delete({
        fileId: 'file1',
      })
    ).resolves.not.toThrow();
  });

  it('should copy a file successfully', async () => {
    const drive = google.drive({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-drive', drive, {
      inputSchemas: googleDriveSchemas,
    });

    const result = await wrapped.files.copy({
      fileId: 'file1',
      requestBody: {
        name: 'Copy of Document',
      },
    });

    expect(result.data.id).toBe('copied-file-id');
    expect(result.data.name).toBe('Copy of Document');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.get('https://www.googleapis.com/drive/v3/files/:fileId', () => {
        return HttpResponse.json({
          error: {
            code: 404,
            message: 'File not found',
          },
        }, { status: 404 });
      })
    );

    const drive = google.drive({ version: 'v3', auth: 'test-token' });
    const wrapped = wrapIntegration('google-drive', drive, {
      inputSchemas: googleDriveSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.files.get({
        fileId: 'nonexistent',
      })
    ).rejects.toThrow();
  });
});
