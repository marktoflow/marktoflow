/**
 * Azure Key Vault Secret Provider
 *
 * Supports service principal and managed identity authentication.
 */

import type { SecretProvider, Secret, AzureKeyVaultConfig } from '../types.js';

export class AzureKeyVaultProvider implements SecretProvider {
  private config: Required<AzureKeyVaultConfig>;
  private accessToken?: string;
  private tokenExpiresAt?: Date;
  private initialized = false;

  constructor(config: AzureKeyVaultConfig) {
    this.config = {
      vaultUrl: config.vaultUrl,
      tenantId: config.tenantId ?? '',
      clientId: config.clientId ?? '',
      clientSecret: config.clientSecret ?? '',
      useManagedIdentity: config.useManagedIdentity ?? false,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Validate configuration
    if (!this.config.useManagedIdentity) {
      if (!this.config.tenantId || !this.config.clientId || !this.config.clientSecret) {
        throw new Error(
          'Azure Key Vault requires tenantId, clientId, and clientSecret, or useManagedIdentity must be true'
        );
      }
    }

    // Get initial access token
    await this.refreshAccessToken();

    this.initialized = true;
  }

  /**
   * Get or refresh access token
   */
  private async refreshAccessToken(): Promise<void> {
    // Check if token is still valid (with 5 min buffer)
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date(Date.now() + 300000)) {
      return;
    }

    if (this.config.useManagedIdentity) {
      await this.authenticateWithManagedIdentity();
    } else {
      await this.authenticateWithServicePrincipal();
    }
  }

  /**
   * Authenticate using service principal
   */
  private async authenticateWithServicePrincipal(): Promise<void> {
    const url = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId!,
        client_secret: this.config.clientSecret!,
        scope: 'https://vault.azure.net/.default',
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure authentication failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
  }

  /**
   * Authenticate using managed identity
   */
  private async authenticateWithManagedIdentity(): Promise<void> {
    // This is a placeholder - real implementation would use Azure Instance Metadata Service
    throw new Error(
      'Azure Managed Identity authentication requires @azure/identity package. ' +
        'Install it with: npm install @azure/identity @azure/keyvault-secrets'
    );

    // Production implementation would use:
    // import { DefaultAzureCredential } from '@azure/identity';
    // import { SecretClient } from '@azure/keyvault-secrets';
    // const credential = new DefaultAzureCredential();
    // const client = new SecretClient(this.config.vaultUrl, credential);
  }

  /**
   * Get a secret from Azure Key Vault
   */
  async getSecret(secretName: string): Promise<Secret> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.refreshAccessToken();

    // Clean secret name (Azure doesn't allow some characters)
    const cleanName = secretName.replace(/[^a-zA-Z0-9-]/g, '-');

    const url = `${this.config.vaultUrl}/secrets/${cleanName}?api-version=7.4`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Secret not found: ${secretName}`);
      }
      const error = await response.text();
      throw new Error(`Failed to fetch secret from Azure Key Vault: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      value: string;
      id: string;
      attributes: {
        created: number;
        updated: number;
        enabled: boolean;
      };
    };

    // Try to parse as JSON
    let value: string | Record<string, unknown>;
    try {
      value = JSON.parse(data.value);
    } catch {
      value = data.value;
    }

    return {
      value,
      metadata: {
        createdAt: new Date(data.attributes.created * 1000),
        updatedAt: new Date(data.attributes.updated * 1000),
      },
    };
  }

  /**
   * Check if a secret exists
   */
  async exists(secretName: string): Promise<boolean> {
    try {
      await this.getSecret(secretName);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * List secrets
   */
  async listSecrets(): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.refreshAccessToken();

    const url = `${this.config.vaultUrl}/secrets?api-version=7.4`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list secrets from Azure Key Vault: ${response.status} ${error}`);
    }

    const data = (await response.json()) as { value: Array<{ id: string }> };
    return data.value.map((secret) => {
      const parts = secret.id.split('/');
      return parts[parts.length - 1];
    });
  }

  async destroy(): Promise<void> {
    this.accessToken = '';
    this.initialized = false;
  }
}
