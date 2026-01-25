/**
 * Google Drive Integration
 *
 * File storage and collaboration platform.
 * API Docs: https://developers.google.com/drive/api
 */

import { google, drive_v3 } from 'googleapis';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { Readable } from 'stream';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  description?: string;
  starred?: boolean;
  trashed?: boolean;
  shared?: boolean;
  owners?: { displayName?: string; emailAddress?: string }[];
  permissions?: DrivePermission[];
}

export interface DrivePermission {
  id: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  displayName?: string;
  deleted?: boolean;
}

export interface ListFilesOptions {
  q?: string;
  pageSize?: number;
  pageToken?: string;
  orderBy?: string;
  spaces?: string;
  fields?: string;
  includeItemsFromAllDrives?: boolean;
  supportsAllDrives?: boolean;
}

export interface CreateFileOptions {
  name: string;
  mimeType?: string;
  parents?: string[];
  description?: string;
  content?: string | Buffer | Readable;
  contentType?: string;
}

export interface UpdateFileOptions {
  name?: string;
  description?: string;
  starred?: boolean;
  trashed?: boolean;
  parents?: string[];
  content?: string | Buffer | Readable;
  contentType?: string;
}

export interface ShareFileOptions {
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  domain?: string;
  allowFileDiscovery?: boolean;
  sendNotificationEmail?: boolean;
  emailMessage?: string;
}

/**
 * Google Drive actions for workflow integration
 */
export class GoogleDriveActions {
  constructor(private drive: drive_v3.Drive) {}

  /**
   * List files and folders
   */
  async listFiles(
    options: ListFilesOptions = {}
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const response = await this.drive.files.list({
      q: options.q,
      pageSize: options.pageSize ?? 100,
      pageToken: options.pageToken,
      orderBy: options.orderBy,
      spaces: options.spaces,
      fields:
        options.fields ??
        'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, description, starred, trashed, shared, owners)',
      includeItemsFromAllDrives: options.includeItemsFromAllDrives,
      supportsAllDrives: options.supportsAllDrives,
    });

    return {
      files: response.data.files?.map((f) => this.parseFile(f)) ?? [],
      nextPageToken: response.data.nextPageToken ?? undefined,
    };
  }

  /**
   * Get a file by ID
   */
  async getFile(fileId: string, fields?: string): Promise<DriveFile> {
    const response = await this.drive.files.get({
      fileId,
      fields:
        fields ??
        'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, description, starred, trashed, shared, owners',
      supportsAllDrives: true,
    });

    return this.parseFile(response.data);
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    const response = await this.drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  /**
   * Export Google Workspace file to another format
   */
  async exportFile(fileId: string, mimeType: string): Promise<Buffer> {
    const response = await this.drive.files.export(
      {
        fileId,
        mimeType,
      },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  /**
   * Create a file or folder
   */
  async createFile(options: CreateFileOptions): Promise<DriveFile> {
    const metadata: drive_v3.Schema$File = {
      name: options.name,
      mimeType: options.mimeType,
      parents: options.parents,
      description: options.description,
    };

    let media: { mimeType?: string; body: string | Buffer | Readable } | undefined;

    if (options.content) {
      media = {
        mimeType: options.contentType,
        body: options.content,
      };
    }

    const response = await this.drive.files.create({
      requestBody: metadata,
      media,
      fields:
        'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    return this.parseFile(response.data);
  }

  /**
   * Create a folder
   */
  async createFolder(name: string, parentId?: string): Promise<DriveFile> {
    return this.createFile({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    });
  }

  /**
   * Update a file
   */
  async updateFile(fileId: string, options: UpdateFileOptions): Promise<DriveFile> {
    const metadata: drive_v3.Schema$File = {
      name: options.name,
      description: options.description,
      starred: options.starred,
      trashed: options.trashed,
    };

    let media: { mimeType?: string; body: string | Buffer | Readable } | undefined;

    if (options.content) {
      media = {
        mimeType: options.contentType,
        body: options.content,
      };
    }

    const response = await this.drive.files.update({
      fileId,
      requestBody: metadata,
      media,
      fields:
        'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    return this.parseFile(response.data);
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
  }

  /**
   * Copy a file
   */
  async copyFile(fileId: string, name: string, parents?: string[]): Promise<DriveFile> {
    const response = await this.drive.files.copy({
      fileId,
      requestBody: {
        name,
        parents,
      },
      fields:
        'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    return this.parseFile(response.data);
  }

  /**
   * Move a file
   */
  async moveFile(fileId: string, newParentId: string): Promise<DriveFile> {
    // Get current parents
    const file = await this.drive.files.get({
      fileId,
      fields: 'parents',
      supportsAllDrives: true,
    });

    const previousParents = file.data.parents?.join(',');

    const response = await this.drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: previousParents,
      fields:
        'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    return this.parseFile(response.data);
  }

  /**
   * Share a file
   */
  async shareFile(fileId: string, options: ShareFileOptions): Promise<DrivePermission> {
    const response = await this.drive.permissions.create({
      fileId,
      requestBody: {
        type: options.type,
        role: options.role,
        emailAddress: options.emailAddress,
        domain: options.domain,
        allowFileDiscovery: options.allowFileDiscovery,
      },
      sendNotificationEmail: options.sendNotificationEmail ?? true,
      emailMessage: options.emailMessage,
      supportsAllDrives: true,
    });

    return {
      id: response.data.id ?? '',
      type: (response.data.type as DrivePermission['type']) ?? 'user',
      role: (response.data.role as DrivePermission['role']) ?? 'reader',
      emailAddress: response.data.emailAddress ?? undefined,
      displayName: response.data.displayName ?? undefined,
      deleted: response.data.deleted ?? undefined,
    };
  }

  /**
   * List permissions for a file
   */
  async listPermissions(fileId: string): Promise<DrivePermission[]> {
    const response = await this.drive.permissions.list({
      fileId,
      fields: 'permissions(id, type, role, emailAddress, displayName, deleted)',
      supportsAllDrives: true,
    });

    return (
      response.data.permissions?.map((p) => ({
        id: p.id ?? '',
        type: (p.type as DrivePermission['type']) ?? 'user',
        role: (p.role as DrivePermission['role']) ?? 'reader',
        emailAddress: p.emailAddress ?? undefined,
        displayName: p.displayName ?? undefined,
        deleted: p.deleted ?? undefined,
      })) ?? []
    );
  }

  /**
   * Remove a permission
   */
  async removePermission(fileId: string, permissionId: string): Promise<void> {
    await this.drive.permissions.delete({
      fileId,
      permissionId,
      supportsAllDrives: true,
    });
  }

  /**
   * Search files
   */
  async searchFiles(
    query: string,
    options: Omit<ListFilesOptions, 'q'> = {}
  ): Promise<DriveFile[]> {
    const result = await this.listFiles({ ...options, q: query });
    return result.files;
  }

  /**
   * Get files in a folder
   */
  async getFilesInFolder(folderId: string): Promise<DriveFile[]> {
    return this.searchFiles(`'${folderId}' in parents and trashed=false`);
  }

  /**
   * Parse file from API response
   */
  private parseFile(file: drive_v3.Schema$File): DriveFile {
    return {
      id: file.id ?? '',
      name: file.name ?? '',
      mimeType: file.mimeType ?? '',
      parents: file.parents ?? undefined,
      size: file.size ?? undefined,
      createdTime: file.createdTime ?? undefined,
      modifiedTime: file.modifiedTime ?? undefined,
      webViewLink: file.webViewLink ?? undefined,
      webContentLink: file.webContentLink ?? undefined,
      description: file.description ?? undefined,
      starred: file.starred ?? undefined,
      trashed: file.trashed ?? undefined,
      shared: file.shared ?? undefined,
      owners: file.owners?.map((o) => ({
        displayName: o.displayName ?? undefined,
        emailAddress: o.emailAddress ?? undefined,
      })),
    };
  }
}

export const GoogleDriveInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const clientId = config.auth?.['client_id'] as string | undefined;
    const clientSecret = config.auth?.['client_secret'] as string | undefined;
    const redirectUri = config.auth?.['redirect_uri'] as string | undefined;
    const refreshToken = config.auth?.['refresh_token'] as string | undefined;
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Google Drive SDK requires auth.client_id, auth.client_secret, auth.redirect_uri'
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    return {
      client: drive,
      actions: new GoogleDriveActions(drive),
    };
  },
};
