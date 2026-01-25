import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveInitializer, GoogleDriveActions } from '../src/services/google-drive.js';

describe('Google Drive Integration', () => {
  describe('GoogleDriveInitializer', () => {
    it('should throw if required auth fields are missing', async () => {
      const config = { sdk: 'googleapis', auth: {} };
      await expect(GoogleDriveInitializer.initialize(null, config as any)).rejects.toThrow(
        'Google Drive SDK requires auth.client_id, auth.client_secret, auth.redirect_uri'
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

      const result = await GoogleDriveInitializer.initialize(null, config as any);
      expect(result).toHaveProperty('client');
      expect(result).toHaveProperty('actions');
      expect((result as any).actions).toBeInstanceOf(GoogleDriveActions);
    });
  });

  describe('GoogleDriveActions', () => {
    let mockDrive: any;
    let actions: GoogleDriveActions;

    beforeEach(() => {
      mockDrive = {
        files: {
          list: vi.fn(),
          get: vi.fn(),
          export: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          copy: vi.fn(),
        },
        permissions: {
          create: vi.fn(),
          list: vi.fn(),
          delete: vi.fn(),
        },
      };
      actions = new GoogleDriveActions(mockDrive);
    });

    it('should have all required methods', () => {
      expect(actions.listFiles).toBeDefined();
      expect(actions.getFile).toBeDefined();
      expect(actions.downloadFile).toBeDefined();
      expect(actions.exportFile).toBeDefined();
      expect(actions.createFile).toBeDefined();
      expect(actions.createFolder).toBeDefined();
      expect(actions.updateFile).toBeDefined();
      expect(actions.deleteFile).toBeDefined();
      expect(actions.copyFile).toBeDefined();
      expect(actions.moveFile).toBeDefined();
      expect(actions.shareFile).toBeDefined();
      expect(actions.listPermissions).toBeDefined();
      expect(actions.removePermission).toBeDefined();
      expect(actions.searchFiles).toBeDefined();
      expect(actions.getFilesInFolder).toBeDefined();
    });

    describe('listFiles', () => {
      it('should list files with default options', async () => {
        mockDrive.files.list.mockResolvedValue({
          data: {
            files: [
              {
                id: 'file1',
                name: 'Document.pdf',
                mimeType: 'application/pdf',
                size: '1024',
                createdTime: '2026-01-01T00:00:00Z',
              },
            ],
          },
        });

        const result = await actions.listFiles();
        expect(result.files).toHaveLength(1);
        expect(result.files[0].name).toBe('Document.pdf');
      });

      it('should list files with custom query', async () => {
        mockDrive.files.list.mockResolvedValue({
          data: {
            files: [],
            nextPageToken: 'next-page',
          },
        });

        const result = await actions.listFiles({
          q: "name contains 'report'",
          pageSize: 50,
          orderBy: 'modifiedTime desc',
        });

        expect(mockDrive.files.list).toHaveBeenCalledWith(
          expect.objectContaining({
            q: "name contains 'report'",
            pageSize: 50,
            orderBy: 'modifiedTime desc',
          })
        );
        expect(result.nextPageToken).toBe('next-page');
      });
    });

    describe('getFile', () => {
      it('should get a file by ID', async () => {
        mockDrive.files.get.mockResolvedValue({
          data: {
            id: 'file123',
            name: 'Spreadsheet.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: '2048',
          },
        });

        const result = await actions.getFile('file123');
        expect(result.id).toBe('file123');
        expect(result.name).toBe('Spreadsheet.xlsx');
      });
    });

    describe('downloadFile', () => {
      it('should download file content as buffer', async () => {
        const arrayBuffer = new ArrayBuffer(100);
        mockDrive.files.get.mockResolvedValue({
          data: arrayBuffer,
        });

        const result = await actions.downloadFile('file123');
        expect(result).toBeInstanceOf(Buffer);
        expect(mockDrive.files.get).toHaveBeenCalledWith(
          {
            fileId: 'file123',
            alt: 'media',
            supportsAllDrives: true,
          },
          { responseType: 'arraybuffer' }
        );
      });
    });

    describe('exportFile', () => {
      it('should export Google Workspace file to specified format', async () => {
        const arrayBuffer = new ArrayBuffer(200);
        mockDrive.files.export.mockResolvedValue({
          data: arrayBuffer,
        });

        const result = await actions.exportFile('doc123', 'application/pdf');
        expect(result).toBeInstanceOf(Buffer);
        expect(mockDrive.files.export).toHaveBeenCalledWith(
          {
            fileId: 'doc123',
            mimeType: 'application/pdf',
          },
          { responseType: 'arraybuffer' }
        );
      });
    });

    describe('createFile', () => {
      it('should create a file without content', async () => {
        mockDrive.files.create.mockResolvedValue({
          data: {
            id: 'new-file',
            name: 'New Document',
            mimeType: 'application/vnd.google-apps.document',
          },
        });

        const result = await actions.createFile({
          name: 'New Document',
          mimeType: 'application/vnd.google-apps.document',
        });

        expect(result.id).toBe('new-file');
        expect(mockDrive.files.create).toHaveBeenCalledWith({
          requestBody: {
            name: 'New Document',
            mimeType: 'application/vnd.google-apps.document',
            parents: undefined,
            description: undefined,
          },
          media: undefined,
          fields: expect.any(String),
          supportsAllDrives: true,
        });
      });

      it('should create a file with content', async () => {
        mockDrive.files.create.mockResolvedValue({
          data: {
            id: 'new-file-with-content',
            name: 'Data.txt',
            mimeType: 'text/plain',
          },
        });

        const result = await actions.createFile({
          name: 'Data.txt',
          content: 'Hello World',
          contentType: 'text/plain',
        });

        expect(result.id).toBe('new-file-with-content');
        const call = mockDrive.files.create.mock.calls[0][0];
        expect(call.media).toEqual({
          mimeType: 'text/plain',
          body: 'Hello World',
        });
      });
    });

    describe('createFolder', () => {
      it('should create a folder', async () => {
        mockDrive.files.create.mockResolvedValue({
          data: {
            id: 'new-folder',
            name: 'Projects',
            mimeType: 'application/vnd.google-apps.folder',
          },
        });

        const result = await actions.createFolder('Projects');
        expect(result.id).toBe('new-folder');
        expect(mockDrive.files.create).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: {
              name: 'Projects',
              mimeType: 'application/vnd.google-apps.folder',
              parents: undefined,
              description: undefined,
            },
          })
        );
      });

      it('should create a folder in a parent', async () => {
        mockDrive.files.create.mockResolvedValue({
          data: {
            id: 'new-subfolder',
            name: 'Subfolder',
            mimeType: 'application/vnd.google-apps.folder',
          },
        });

        await actions.createFolder('Subfolder', 'parent-folder-id');
        const call = mockDrive.files.create.mock.calls[0][0];
        expect(call.requestBody.parents).toEqual(['parent-folder-id']);
      });
    });

    describe('updateFile', () => {
      it('should update file metadata', async () => {
        mockDrive.files.update.mockResolvedValue({
          data: {
            id: 'file123',
            name: 'Updated Name',
            starred: true,
          },
        });

        const result = await actions.updateFile('file123', {
          name: 'Updated Name',
          starred: true,
        });

        expect(result.name).toBe('Updated Name');
        expect(mockDrive.files.update).toHaveBeenCalledWith({
          fileId: 'file123',
          requestBody: {
            name: 'Updated Name',
            description: undefined,
            starred: true,
            trashed: undefined,
          },
          media: undefined,
          fields: expect.any(String),
          supportsAllDrives: true,
        });
      });
    });

    describe('deleteFile', () => {
      it('should delete a file', async () => {
        mockDrive.files.delete.mockResolvedValue({});

        await actions.deleteFile('file123');
        expect(mockDrive.files.delete).toHaveBeenCalledWith({
          fileId: 'file123',
          supportsAllDrives: true,
        });
      });
    });

    describe('copyFile', () => {
      it('should copy a file', async () => {
        mockDrive.files.copy.mockResolvedValue({
          data: {
            id: 'copied-file',
            name: 'Copy of Document',
          },
        });

        const result = await actions.copyFile('file123', 'Copy of Document');
        expect(result.id).toBe('copied-file');
        expect(mockDrive.files.copy).toHaveBeenCalledWith({
          fileId: 'file123',
          requestBody: {
            name: 'Copy of Document',
            parents: undefined,
          },
          fields: expect.any(String),
          supportsAllDrives: true,
        });
      });
    });

    describe('moveFile', () => {
      it('should move a file to another folder', async () => {
        mockDrive.files.get.mockResolvedValue({
          data: {
            parents: ['old-parent'],
          },
        });

        mockDrive.files.update.mockResolvedValue({
          data: {
            id: 'file123',
            name: 'Moved File',
            parents: ['new-parent'],
          },
        });

        const result = await actions.moveFile('file123', 'new-parent');
        expect(result.parents).toEqual(['new-parent']);
        expect(mockDrive.files.update).toHaveBeenCalledWith({
          fileId: 'file123',
          addParents: 'new-parent',
          removeParents: 'old-parent',
          fields: expect.any(String),
          supportsAllDrives: true,
        });
      });
    });

    describe('shareFile', () => {
      it('should share a file with a user', async () => {
        mockDrive.permissions.create.mockResolvedValue({
          data: {
            id: 'perm123',
            type: 'user',
            role: 'reader',
            emailAddress: 'user@example.com',
          },
        });

        const result = await actions.shareFile('file123', {
          type: 'user',
          role: 'reader',
          emailAddress: 'user@example.com',
        });

        expect(result.id).toBe('perm123');
        expect(result.type).toBe('user');
        expect(mockDrive.permissions.create).toHaveBeenCalledWith({
          fileId: 'file123',
          requestBody: {
            type: 'user',
            role: 'reader',
            emailAddress: 'user@example.com',
            domain: undefined,
            allowFileDiscovery: undefined,
          },
          sendNotificationEmail: true,
          emailMessage: undefined,
          supportsAllDrives: true,
        });
      });

      it('should share a file with anyone', async () => {
        mockDrive.permissions.create.mockResolvedValue({
          data: {
            id: 'perm-public',
            type: 'anyone',
            role: 'reader',
          },
        });

        await actions.shareFile('file123', {
          type: 'anyone',
          role: 'reader',
          sendNotificationEmail: false,
        });

        const call = mockDrive.permissions.create.mock.calls[0][0];
        expect(call.sendNotificationEmail).toBe(false);
      });
    });

    describe('listPermissions', () => {
      it('should list file permissions', async () => {
        mockDrive.permissions.list.mockResolvedValue({
          data: {
            permissions: [
              {
                id: 'perm1',
                type: 'user',
                role: 'owner',
                emailAddress: 'owner@example.com',
              },
              {
                id: 'perm2',
                type: 'user',
                role: 'writer',
                emailAddress: 'writer@example.com',
              },
            ],
          },
        });

        const result = await actions.listPermissions('file123');
        expect(result).toHaveLength(2);
        expect(result[0].role).toBe('owner');
      });
    });

    describe('removePermission', () => {
      it('should remove a permission', async () => {
        mockDrive.permissions.delete.mockResolvedValue({});

        await actions.removePermission('file123', 'perm456');
        expect(mockDrive.permissions.delete).toHaveBeenCalledWith({
          fileId: 'file123',
          permissionId: 'perm456',
          supportsAllDrives: true,
        });
      });
    });

    describe('searchFiles', () => {
      it('should search files by query', async () => {
        mockDrive.files.list.mockResolvedValue({
          data: {
            files: [
              {
                id: 'search-result-1',
                name: 'Report 2026.pdf',
                mimeType: 'application/pdf',
              },
            ],
          },
        });

        const result = await actions.searchFiles("name contains 'Report'");
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Report 2026.pdf');
      });
    });

    describe('getFilesInFolder', () => {
      it('should get files in a specific folder', async () => {
        mockDrive.files.list.mockResolvedValue({
          data: {
            files: [
              { id: 'file1', name: 'File1.txt', mimeType: 'text/plain' },
              { id: 'file2', name: 'File2.txt', mimeType: 'text/plain' },
            ],
          },
        });

        const result = await actions.getFilesInFolder('folder123');
        expect(result).toHaveLength(2);
        expect(mockDrive.files.list).toHaveBeenCalledWith(
          expect.objectContaining({
            q: "'folder123' in parents and trashed=false",
          })
        );
      });
    });
  });
});
