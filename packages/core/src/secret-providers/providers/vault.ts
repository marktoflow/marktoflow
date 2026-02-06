/**
 * HashiCorp Vault Secret Provider
 *
 * Supports KV v1 and v2 engines with token and AppRole authentication.
 */

import type { SecretProvider, Secret, VaultConfig } from '../types.js';

export class VaultProvider implements SecretProvider {
  private config: Required<VaultConfig>;
  private token?: string;
  private initialized = false;

  constructor(config: VaultConfig) {
    this.config = {
      address: config.address,
      token: config.token ?? '',
      namespace: config.namespace ?? '',
      roleId: config.roleId ?? '',
      secretId: config.secretId ?? '',
      kvVersion: config.kvVersion ?? 2,
      mountPath: config.mountPath ?? 'secret',
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // If using AppRole, authenticate to get token
    if (this.config.roleId && this.config.secretId) {
      await this.authenticateAppRole();
    } else if (!this.config.token) {
      throw new Error('Vault provider requires either token or AppRole credentials');
    } else {
      this.token = this.config.token;
    }

    this.initialized = true;
  }

  /**
   * Authenticate using AppRole
   */
  private async authenticateAppRole(): Promise<void> {
    const url = `${this.config.address}/v1/auth/approle/login`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.namespace) {
      headers['X-Vault-Namespace'] = this.config.namespace;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        role_id: this.config.roleId,
        secret_id: this.config.secretId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vault AppRole authentication failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as { auth: { client_token: string } };
    this.token = data.auth.client_token;
  }

  /**
   * Get a secret from Vault
   */
  async getSecret(path: string): Promise<Secret> {
    if (!this.initialized) {
      await this.initialize();
    }

    const url = this.buildSecretUrl(path);
    const headers: Record<string, string> = {
      'X-Vault-Token': this.token!,
    };

    if (this.config.namespace) {
      headers['X-Vault-Namespace'] = this.config.namespace;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Secret not found: ${path}`);
      }
      const error = await response.text();
      throw new Error(`Failed to fetch secret from Vault: ${response.status} ${error}`);
    }

    const data = await response.json() as Record<string, unknown>;

    // Handle KV v1 vs v2 response format
    if (this.config.kvVersion === 2) {
      const secretData = data.data as { data: Record<string, unknown>; metadata: Record<string, unknown> };
      const metadata: { version: string; createdAt?: Date } = {
        version: String(secretData.metadata.version),
      };

      if (secretData.metadata.created_time) {
        metadata.createdAt = new Date(secretData.metadata.created_time as string);
      }

      return {
        value: secretData.data,
        metadata,
      };
    } else {
      // KV v1
      const secretData = data.data as Record<string, unknown>;
      return {
        value: secretData,
      };
    }
  }

  /**
   * Check if a secret exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.getSecret(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List secrets at a path
   */
  async listSecrets(path: string): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const url = this.buildListUrl(path);
    const headers: Record<string, string> = {
      'X-Vault-Token': this.token!,
    };

    if (this.config.namespace) {
      headers['X-Vault-Namespace'] = this.config.namespace;
    }

    const response = await fetch(url, {
      method: 'LIST',
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      const error = await response.text();
      throw new Error(`Failed to list secrets from Vault: ${response.status} ${error}`);
    }

    const data = (await response.json()) as { data: { keys: string[] } };
    return data.data.keys || [];
  }

  /**
   * Build URL for secret access
   */
  private buildSecretUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    if (this.config.kvVersion === 2) {
      // KV v2: /v1/{mount}/data/{path}
      return `${this.config.address}/v1/${this.config.mountPath}/data/${cleanPath}`;
    } else {
      // KV v1: /v1/{mount}/{path}
      return `${this.config.address}/v1/${this.config.mountPath}/${cleanPath}`;
    }
  }

  /**
   * Build URL for listing secrets
   */
  private buildListUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    if (this.config.kvVersion === 2) {
      // KV v2: /v1/{mount}/metadata/{path}
      return `${this.config.address}/v1/${this.config.mountPath}/metadata/${cleanPath}`;
    } else {
      // KV v1: /v1/{mount}/{path}
      return `${this.config.address}/v1/${this.config.mountPath}/${cleanPath}`;
    }
  }

  async destroy(): Promise<void> {
    this.token = '';
    this.initialized = false;
  }
}
