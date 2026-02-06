/**
 * External Secrets Management
 *
 * Provides integration with external secret managers.
 */

export { SecretManager, SecretNotFoundError, SecretProviderError } from './secret-manager.js';

export { VaultProvider } from './providers/vault.js';
export { AWSSecretsManagerProvider } from './providers/aws.js';
export { AzureKeyVaultProvider } from './providers/azure.js';
export { EnvProvider } from './providers/env.js';

export type {
  Secret,
  SecretMetadata,
  SecretProvider,
  SecretProviderConfig,
  SecretManagerOptions,
  SecretReference,
  CachedSecret,
  VaultConfig,
  AWSSecretsManagerConfig,
  AzureKeyVaultConfig,
  GCPSecretManagerConfig,
} from './types.js';
