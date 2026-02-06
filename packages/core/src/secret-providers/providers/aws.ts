/**
 * AWS Secrets Manager Provider
 *
 * Supports IAM authentication and explicit credentials.
 */

import type { SecretProvider, Secret, AWSSecretsManagerConfig } from '../types.js';

export class AWSSecretsManagerProvider implements SecretProvider {
  private config: Required<AWSSecretsManagerConfig>;
  private initialized = false;

  constructor(config: AWSSecretsManagerConfig) {
    this.config = {
      region: config.region ?? process.env.AWS_REGION ?? 'us-east-1',
      accessKeyId: config.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: config.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? '',
      sessionToken: config.sessionToken ?? process.env.AWS_SESSION_TOKEN ?? '',
      useIAMRole: config.useIAMRole ?? false,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // If using IAM role, credentials will be fetched automatically by AWS SDK
    if (!this.config.useIAMRole) {
      if (!this.config.accessKeyId || !this.config.secretAccessKey) {
        throw new Error(
          'AWS Secrets Manager requires accessKeyId and secretAccessKey, or useIAMRole must be true'
        );
      }
    }

    this.initialized = true;
  }

  /**
   * Get a secret from AWS Secrets Manager
   */
  async getSecret(secretName: string): Promise<Secret> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Use AWS SDK v3 style API call via fetch
      const result = await this.callAWSAPI('GetSecretValue', { SecretId: secretName });

      const secretString = String(result.SecretString || '');
      let value: string | Record<string, unknown>;

      // Try to parse as JSON
      try {
        value = JSON.parse(secretString);
      } catch {
        value = secretString;
      }

      const metadata: { version?: string; createdAt?: Date } = {};
      if (result.VersionId) {
        metadata.version = String(result.VersionId);
      }
      if (result.CreatedDate && typeof result.CreatedDate === 'string') {
        metadata.createdAt = new Date(result.CreatedDate);
      }

      return {
        value,
        metadata,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('ResourceNotFoundException')) {
        throw new Error(`Secret not found: ${secretName}`);
      }
      throw error;
    }
  }

  /**
   * Check if a secret exists
   */
  async exists(secretName: string): Promise<boolean> {
    try {
      await this.callAWSAPI('DescribeSecret', { SecretId: secretName });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('ResourceNotFoundException')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * List secrets (returns secret ARNs)
   */
  async listSecrets(): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await this.callAWSAPI('ListSecrets', {});
      const secretList = result.SecretList as Array<{ Name: string }> | undefined;
      return secretList?.map((s) => s.Name) || [];
    } catch (error) {
      throw new Error(`Failed to list secrets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call AWS Secrets Manager API
   *
   * This is a simplified implementation. In production, use @aws-sdk/client-secrets-manager
   */
  private async callAWSAPI(_action: string, _params: Record<string, unknown>): Promise<Record<string, unknown>> {
    // This is a placeholder - real implementation would use AWS SDK
    // For now, throw an error indicating AWS SDK is needed
    throw new Error(
      `AWS Secrets Manager integration requires @aws-sdk/client-secrets-manager package. ` +
        `Install it with: npm install @aws-sdk/client-secrets-manager`
    );

    // Production implementation would use:
    // import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
    // const client = new SecretsManagerClient({ region: this.config.region, credentials: this.credentials });
    // const command = new GetSecretValueCommand({ SecretId: secretName });
    // const response = await client.send(command);
  }

  async destroy(): Promise<void> {
    this.initialized = false;
  }
}
