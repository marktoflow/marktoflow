/**
 * Dropbox Integration
 *
 * Cloud file storage and collaboration.
 * API Docs: https://www.dropbox.com/developers/documentation/http/overview
 * SDK: https://github.com/dropbox/dropbox-sdk-js
 */

import { Dropbox } from 'dropbox';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface DropboxFileMetadata {
  name: string;
  path_display?: string;
  id?: string;
  client_modified?: string;
  server_modified?: string;
  size?: number;
}

export interface DropboxFolderMetadata {
  name: string;
  path_display?: string;
  id?: string;
}

export interface UploadOptions {
  path: string;
  contents: string | Buffer;
  mode?: 'add' | 'overwrite' | 'update';
  autorename?: boolean;
  mute?: boolean;
}

export interface DownloadOptions {
  path: string;
}

export interface SearchOptions {
  query: string;
  max_results?: number;
}

export interface ShareOptions {
  path: string;
  settings?: {
    requested_visibility?: 'public' | 'team_only' | 'password';
    audience?: 'public' | 'team' | 'no_one';
    access?: 'viewer' | 'editor';
  };
}

/**
 * Dropbox client wrapper for workflow integration
 */
export class DropboxClient {
  constructor(private client: Dropbox) {}

  // ==================== Files ====================

  /**
   * Upload file
   */
  async uploadFile(options: UploadOptions) {
    return await this.client.filesUpload({
      path: options.path,
      contents: options.contents,
      mode: options.mode ? { '.tag': options.mode } as any : { '.tag': 'add' },
      autorename: options.autorename ?? false,
      mute: options.mute ?? false,
    });
  }

  /**
   * Download file
   */
  async downloadFile(options: DownloadOptions) {
    return await this.client.filesDownload({ path: options.path });
  }

  /**
   * Get file metadata
   */
  async getMetadata(path: string) {
    return await this.client.filesGetMetadata({ path });
  }

  /**
   * List folder contents
   */
  async listFolder(path: string, options?: { recursive?: boolean; limit?: number }) {
    return await this.client.filesListFolder({
      path: path || '',
      recursive: options?.recursive ?? false,
      limit: options?.limit,
    });
  }

  /**
   * Continue listing folder (pagination)
   */
  async listFolderContinue(cursor: string) {
    return await this.client.filesListFolderContinue({ cursor });
  }

  /**
   * Create folder
   */
  async createFolder(path: string, autorename?: boolean) {
    return await this.client.filesCreateFolderV2({
      path,
      autorename: autorename ?? false,
    });
  }

  /**
   * Delete file or folder
   */
  async delete(path: string) {
    return await this.client.filesDeleteV2({ path });
  }

  /**
   * Move file or folder
   */
  async move(fromPath: string, toPath: string, autorename?: boolean) {
    return await this.client.filesMoveV2({
      from_path: fromPath,
      to_path: toPath,
      autorename: autorename ?? false,
    });
  }

  /**
   * Copy file or folder
   */
  async copy(fromPath: string, toPath: string, autorename?: boolean) {
    return await this.client.filesCopyV2({
      from_path: fromPath,
      to_path: toPath,
      autorename: autorename ?? false,
    });
  }

  // ==================== Search ====================

  /**
   * Search files
   */
  async search(options: SearchOptions) {
    return await this.client.filesSearchV2({
      query: options.query,
      options: {
        max_results: options.max_results ?? 100,
      },
    });
  }

  // ==================== Sharing ====================

  /**
   * Create shared link
   */
  async createSharedLink(options: ShareOptions) {
    return await this.client.sharingCreateSharedLinkWithSettings({
      path: options.path,
      settings: options.settings as any,
    });
  }

  /**
   * List shared links
   */
  async listSharedLinks(path?: string) {
    return await this.client.sharingListSharedLinks({
      path: path || '',
    });
  }

  /**
   * Revoke shared link
   */
  async revokeSharedLink(url: string) {
    return await this.client.sharingRevokeSharedLink({ url });
  }

  /**
   * Share folder
   */
  async shareFolder(path: string, options?: { member_policy?: 'team' | 'anyone'; acl_update_policy?: 'owner' | 'editors' }) {
    return await this.client.sharingShareFolder({
      path,
      member_policy: options?.member_policy ? { '.tag': options.member_policy } : undefined,
      acl_update_policy: options?.acl_update_policy ? { '.tag': options.acl_update_policy } : undefined,
    });
  }

  /**
   * Add folder member
   */
  async addFolderMember(
    sharedFolderId: string,
    members: Array<{ email: string; access_level?: 'owner' | 'editor' | 'viewer' | 'viewer_no_comment' }>,
  ) {
    return await this.client.sharingAddFolderMember({
      shared_folder_id: sharedFolderId,
      members: members.map((m) => ({
        member: { '.tag': 'email', email: m.email },
        access_level: m.access_level ? { '.tag': m.access_level } : { '.tag': 'viewer' },
      })),
    });
  }

  /**
   * Remove folder member
   */
  async removeFolderMember(sharedFolderId: string, memberEmail: string, leaveACopy?: boolean) {
    return await this.client.sharingRemoveFolderMember({
      shared_folder_id: sharedFolderId,
      member: { '.tag': 'email', email: memberEmail },
      leave_a_copy: leaveACopy ?? false,
    });
  }

  // ==================== Account ====================

  /**
   * Get current account info
   */
  async getCurrentAccount() {
    return await this.client.usersGetCurrentAccount();
  }

  /**
   * Get space usage
   */
  async getSpaceUsage() {
    return await this.client.usersGetSpaceUsage();
  }
}

export const DropboxInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!accessToken) {
      throw new Error('Dropbox SDK requires auth.access_token');
    }

    const client = new Dropbox({ accessToken });
    const wrapper = new DropboxClient(client);

    return {
      client: wrapper,
      actions: wrapper,
      rawClient: client,
    };
  },
};
