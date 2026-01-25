import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDocsInitializer, GoogleDocsActions } from '../src/services/google-docs.js';

describe('Google Docs Integration', () => {
  describe('GoogleDocsInitializer', () => {
    it('should throw if required auth fields are missing', async () => {
      const config = { sdk: 'googleapis', auth: {} };
      await expect(GoogleDocsInitializer.initialize(null, config as any)).rejects.toThrow(
        'Google Docs SDK requires auth.client_id, auth.client_secret, auth.redirect_uri'
      );
    });

    it('should initialize with valid config', async () => {
      const config = {
        sdk: 'googleapis',
        auth: {
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          redirect_uri: 'http://localhost:3000/callback',
          refresh_token: 'test-refresh-token',
        },
      };

      const result = await GoogleDocsInitializer.initialize(null, config as any);
      expect(result).toHaveProperty('client');
      expect(result).toHaveProperty('actions');
      expect((result as any).actions).toBeInstanceOf(GoogleDocsActions);
    });
  });

  describe('GoogleDocsActions', () => {
    let mockDocs: any;
    let actions: GoogleDocsActions;

    beforeEach(() => {
      mockDocs = {
        documents: {
          get: vi.fn(),
          create: vi.fn(),
          batchUpdate: vi.fn(),
        },
      };
      actions = new GoogleDocsActions(mockDocs);
    });

    it('should have all required methods', () => {
      expect(actions.getDocument).toBeDefined();
      expect(actions.createDocument).toBeDefined();
      expect(actions.insertText).toBeDefined();
      expect(actions.appendText).toBeDefined();
      expect(actions.deleteContent).toBeDefined();
      expect(actions.replaceAllText).toBeDefined();
      expect(actions.formatText).toBeDefined();
      expect(actions.insertPageBreak).toBeDefined();
      expect(actions.insertTable).toBeDefined();
      expect(actions.insertImage).toBeDefined();
      expect(actions.batchUpdate).toBeDefined();
    });

    describe('getDocument', () => {
      it('should get a document', async () => {
        mockDocs.documents.get.mockResolvedValue({
          data: {
            documentId: 'doc123',
            title: 'My Document',
            body: {
              content: [],
            },
          },
        });

        const result = await actions.getDocument('doc123');
        expect(result.documentId).toBe('doc123');
        expect(result.title).toBe('My Document');
      });
    });

    describe('createDocument', () => {
      it('should create a document', async () => {
        mockDocs.documents.create.mockResolvedValue({
          data: {
            documentId: 'new-doc',
            title: 'New Document',
          },
        });

        const result = await actions.createDocument({ title: 'New Document' });
        expect(mockDocs.documents.create).toHaveBeenCalledWith({
          requestBody: {
            title: 'New Document',
          },
        });
        expect(result.documentId).toBe('new-doc');
      });
    });

    describe('insertText', () => {
      it('should insert text at index', async () => {
        mockDocs.documents.batchUpdate.mockResolvedValue({
          data: {
            documentId: 'doc123',
          },
        });

        await actions.insertText('doc123', { text: 'Hello World', index: 1 });
        expect(mockDocs.documents.batchUpdate).toHaveBeenCalledWith({
          documentId: 'doc123',
          requestBody: {
            requests: [
              {
                insertText: {
                  text: 'Hello World',
                  location: { index: 1 },
                },
              },
            ],
          },
        });
      });
    });

    describe('deleteContent', () => {
      it('should delete content range', async () => {
        mockDocs.documents.batchUpdate.mockResolvedValue({
          data: {
            documentId: 'doc123',
          },
        });

        await actions.deleteContent('doc123', { startIndex: 1, endIndex: 10 });
        expect(mockDocs.documents.batchUpdate).toHaveBeenCalledWith({
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
      });
    });

    describe('formatText', () => {
      it('should format text with bold', async () => {
        mockDocs.documents.batchUpdate.mockResolvedValue({
          data: {},
        });

        await actions.formatText('doc123', {
          startIndex: 1,
          endIndex: 10,
          bold: true,
        });
        const call = mockDocs.documents.batchUpdate.mock.calls[0][0];
        expect(call.requestBody.requests[0].updateTextStyle.textStyle.bold).toBe(true);
      });
    });

    describe('insertPageBreak', () => {
      it('should insert a page break', async () => {
        mockDocs.documents.batchUpdate.mockResolvedValue({
          data: {},
        });

        await actions.insertPageBreak('doc123', 100);
        expect(mockDocs.documents.batchUpdate).toHaveBeenCalledWith({
          documentId: 'doc123',
          requestBody: {
            requests: [
              {
                insertPageBreak: {
                  location: { index: 100 },
                },
              },
            ],
          },
        });
      });
    });

    describe('insertTable', () => {
      it('should insert a table', async () => {
        mockDocs.documents.batchUpdate.mockResolvedValue({
          data: {},
        });

        await actions.insertTable('doc123', { rows: 3, columns: 4, index: 50 });
        const call = mockDocs.documents.batchUpdate.mock.calls[0][0];
        expect(call.requestBody.requests[0].insertTable.rows).toBe(3);
        expect(call.requestBody.requests[0].insertTable.columns).toBe(4);
      });
    });

    describe('insertImage', () => {
      it('should insert an image', async () => {
        mockDocs.documents.batchUpdate.mockResolvedValue({
          data: {},
        });

        await actions.insertImage('doc123', 'https://example.com/image.jpg', 75);
        const call = mockDocs.documents.batchUpdate.mock.calls[0][0];
        expect(call.requestBody.requests[0].insertInlineImage.uri).toBe(
          'https://example.com/image.jpg'
        );
      });
    });

    describe('batchUpdate', () => {
      it('should execute multiple requests', async () => {
        mockDocs.documents.batchUpdate.mockResolvedValue({
          data: {
            documentId: 'doc123',
            replies: [{}, {}],
          },
        });

        const requests = [
          { insertText: { text: 'Hello', location: { index: 1 } } },
          { insertText: { text: ' World', location: { index: 6 } } },
        ];

        await actions.batchUpdate('doc123', requests);
        expect(mockDocs.documents.batchUpdate).toHaveBeenCalledWith({
          documentId: 'doc123',
          requestBody: { requests },
        });
      });
    });
  });
});
