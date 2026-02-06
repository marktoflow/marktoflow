/**
 * Contract tests for Google Docs integration
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
import { googleDocsSchemas } from '../../src/reliability/schemas/google-docs.js';
import { google } from 'googleapis';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Get document
  http.get('https://docs.googleapis.com/v1/documents/:documentId', ({ params }) => {
    return HttpResponse.json({
      documentId: params.documentId,
      title: 'Test Document',
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 13,
            paragraph: {
              elements: [
                {
                  startIndex: 1,
                  endIndex: 13,
                  textRun: {
                    content: 'Hello World\n',
                    textStyle: {},
                  },
                },
              ],
            },
          },
        ],
      },
      revisionId: 'rev123',
    });
  }),

  // Create document
  http.post('https://docs.googleapis.com/v1/documents', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.title) {
      return HttpResponse.json({
        error: {
          code: 400,
          message: 'Missing title',
        },
      }, { status: 400 });
    }

    return HttpResponse.json({
      documentId: 'new-doc-id',
      title: body.title,
      revisionId: 'rev1',
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 2,
            paragraph: {
              elements: [
                {
                  startIndex: 1,
                  endIndex: 2,
                  textRun: {
                    content: '\n',
                  },
                },
              ],
            },
          },
        ],
      },
    });
  }),

  // Batch update (note: the URL uses :batchUpdate suffix)
  http.post('https://docs.googleapis.com/v1/documents/*', async ({ request }) => {
    const url = new URL(request.url);
    if (!url.pathname.includes(':batchUpdate')) {
      return; // Not a batchUpdate request
    }

    const documentId = url.pathname.split('/')[3].split(':')[0];
    const body = await request.json() as any;
    const requests = body.requests || [];

    // Check for insertText request
    const insertTextRequest = requests.find((r: any) => r.insertText);
    if (insertTextRequest) {
      return HttpResponse.json({
        documentId,
        replies: [{}],
      });
    }

    // Check for deleteContentRange request
    const deleteRequest = requests.find((r: any) => r.deleteContentRange);
    if (deleteRequest) {
      return HttpResponse.json({
        documentId,
        replies: [{}],
      });
    }

    // Check for replaceAllText request
    const replaceRequest = requests.find((r: any) => r.replaceAllText);
    if (replaceRequest) {
      return HttpResponse.json({
        documentId,
        replies: [
          {
            replaceAllText: {
              occurrencesChanged: 3,
            },
          },
        ],
      });
    }

    // Check for updateTextStyle request
    const styleRequest = requests.find((r: any) => r.updateTextStyle);
    if (styleRequest) {
      return HttpResponse.json({
        documentId,
        replies: [{}],
      });
    }

    // Check for insertTable request
    const tableRequest = requests.find((r: any) => r.insertTable);
    if (tableRequest) {
      return HttpResponse.json({
        documentId,
        replies: [{}],
      });
    }

    // Default response
    return HttpResponse.json({
      documentId,
      replies: [{}],
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Google Docs Contract Tests', () => {
  it('should get a document successfully', async () => {
    const docs = google.docs({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('google-docs', docs, {
      inputSchemas: googleDocsSchemas,
    });

    const result = await wrapped.documents.get({
      documentId: 'doc123',
    });

    expect(result.data.documentId).toBe('doc123');
    expect(result.data.title).toBe('Test Document');
    expect(result.data.body?.content).toBeDefined();
  });

  it('should reject invalid inputs (missing documentId)', async () => {
    const docs = google.docs({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('google-docs', docs, {
      inputSchemas: googleDocsSchemas,
    });

    await expect(
      wrapped.documents.get({
        documentId: '',
      })
    ).rejects.toThrow();
  });

  it('should create a document successfully', async () => {
    const docs = google.docs({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('google-docs', docs, {
      inputSchemas: googleDocsSchemas,
    });

    const result = await wrapped.documents.create({
      requestBody: {
        title: 'New Document',
      },
    });

    expect(result.data.documentId).toBe('new-doc-id');
    expect(result.data.title).toBe('New Document');
  });

  it('should reject invalid inputs (missing title)', async () => {
    const docs = google.docs({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('google-docs', docs, {
      inputSchemas: googleDocsSchemas,
    });

    await expect(
      wrapped.documents.create({
        requestBody: {
          title: '',
        },
      })
    ).rejects.toThrow();
  });

  it('should insert text successfully', async () => {
    const docs = google.docs({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('google-docs', docs, {
      inputSchemas: googleDocsSchemas,
    });

    const result = await wrapped.documents.batchUpdate({
      documentId: 'doc123',
      requestBody: {
        requests: [
          {
            insertText: {
              text: 'Hello, World!',
              location: { index: 1 },
            },
          },
        ],
      },
    });

    expect(result.data.documentId).toBe('doc123');
    expect(result.data.replies).toBeDefined();
  });

  it('should delete content successfully', async () => {
    const docs = google.docs({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('google-docs', docs, {
      inputSchemas: googleDocsSchemas,
    });

    const result = await wrapped.documents.batchUpdate({
      documentId: 'doc123',
      requestBody: {
        requests: [
          {
            deleteContentRange: {
              range: {
                startIndex: 1,
                endIndex: 10,
              },
            },
          },
        ],
      },
    });

    expect(result.data.documentId).toBe('doc123');
  });

  it('should replace all text successfully', async () => {
    const docs = google.docs({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('google-docs', docs, {
      inputSchemas: googleDocsSchemas,
    });

    const result = await wrapped.documents.batchUpdate({
      documentId: 'doc123',
      requestBody: {
        requests: [
          {
            replaceAllText: {
              containsText: { text: 'old' },
              replaceText: 'new',
            },
          },
        ],
      },
    });

    expect(result.data.documentId).toBe('doc123');
    expect(result.data.replies?.[0]?.replaceAllText?.occurrencesChanged).toBe(3);
  });

  it('should format text successfully', async () => {
    const docs = google.docs({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('google-docs', docs, {
      inputSchemas: googleDocsSchemas,
    });

    const result = await wrapped.documents.batchUpdate({
      documentId: 'doc123',
      requestBody: {
        requests: [
          {
            updateTextStyle: {
              range: {
                startIndex: 1,
                endIndex: 10,
              },
              textStyle: {
                bold: true,
                italic: true,
              },
              fields: 'bold,italic',
            },
          },
        ],
      },
    });

    expect(result.data.documentId).toBe('doc123');
  });

  it('should insert table successfully', async () => {
    const docs = google.docs({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('google-docs', docs, {
      inputSchemas: googleDocsSchemas,
    });

    const result = await wrapped.documents.batchUpdate({
      documentId: 'doc123',
      requestBody: {
        requests: [
          {
            insertTable: {
              rows: 3,
              columns: 2,
              location: { index: 1 },
            },
          },
        ],
      },
    });

    expect(result.data.documentId).toBe('doc123');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.get('https://docs.googleapis.com/v1/documents/:documentId', () => {
        return HttpResponse.json({
          error: {
            code: 404,
            message: 'Document not found',
          },
        }, { status: 404 });
      })
    );

    const docs = google.docs({ version: 'v1', auth: 'test-token' });
    const wrapped = wrapIntegration('google-docs', docs, {
      inputSchemas: googleDocsSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.documents.get({
        documentId: 'nonexistent',
      })
    ).rejects.toThrow();
  });
});
