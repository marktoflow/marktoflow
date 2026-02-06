/**
 * External Secrets Management Types
 *
 * Provides integration with external secret managers like HashiCorp Vault,
 * AWS Secrets Manager, Azure Key Vault, etc.
 */

export interface SecretMetadata {
  version?: string;
  createdAt?: Date;
  updatedAt?: Date;
  expiresAt?: Date;
  tags?: Record<string, string>;
}

export interface Secret {
  value: string | Record<string, unknown>;
  metadata?: SecretMetadata;
}

export interface SecretProviderConfig {
  // Common config
  type: 'vault' | 'aws' | 'azure' | 'gcp' | 'env';

  // Caching
  cacheEnabled?: boolean;
  cacheTTL?: number; // seconds

  // Provider-specific config
  config?: Record<string, unknown>;
}

export interface VaultConfig {
  address: string;
  token?: string;
  namespace?: string;

  // AppRole authentication
  roleId?: string;
  secretId?: string;

  // KV engine settings
  kvVersion?: 1 | 2;
  mountPath?: string;
}

export interface AWSSecretsManagerConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;

  // Use IAM role if no explicit credentials
  useIAMRole?: boolean;
}

export interface AzureKeyVaultConfig {
  vaultUrl: string;

  // Service principal auth
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;

  // Managed identity
  useManagedIdentity?: boolean;
}

export interface GCPSecretManagerConfig {
  projectId: string;

  // Service account key
  credentials?: string | Record<string, unknown>;

  // Use application default credentials
  useADC?: boolean;
}

/**
 * Secret Provider Interface
 *
 * All secret managers must implement this interface
 */
export interface SecretProvider {
  /**
   * Get a secret by path/name
   */
  getSecret(path: string): Promise<Secret>;

  /**
   * Check if a secret exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * List secrets at a path (optional)
   */
  listSecrets?(path: string): Promise<string[]>;

  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;

  /**
   * Clean up resources
   */
  destroy?(): Promise<void>;
}

/**
 * Secret Cache Entry
 */
export interface CachedSecret {
  value: Secret;
  fetchedAt: Date;
  expiresAt: Date;
}

/**
 * Secret Manager Options
 */
export interface SecretManagerOptions {
  providers: SecretProviderConfig[];

  // Default TTL for cached secrets (seconds)
  defaultCacheTTL?: number;

  // Prefix for secret references (default: 'secret:')
  referencePrefix?: string;

  // Fail on secret not found vs return empty string
  throwOnNotFound?: boolean;
}

/**
 * Parse result for secret references
 */
export interface SecretReference {
  raw: string; // Full reference: ${secret:vault://path}
  provider: string; // Provider type: vault, aws, azure
  path: string; // Secret path: path/to/secret
  key?: string; // Optional key for JSON secrets: secret.key
}
