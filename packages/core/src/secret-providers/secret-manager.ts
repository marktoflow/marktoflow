/**
 * Secret Manager
 *
 * Coordinates access to external secret managers with caching support.
 */

import type {
  SecretProvider,
  SecretManagerOptions,
  CachedSecret,
  Secret,
  SecretReference,
} from './types.js';

export class SecretNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretNotFoundError';
  }
}

export class SecretProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretProviderError';
  }
}

export class SecretManager {
  private providers = new Map<string, SecretProvider>();
  private cache = new Map<string, CachedSecret>();
  private options: Required<SecretManagerOptions>;

  constructor(options: SecretManagerOptions) {
    this.options = {
      providers: options.providers,
      defaultCacheTTL: options.defaultCacheTTL ?? 300, // 5 minutes
      referencePrefix: options.referencePrefix ?? 'secret:',
      throwOnNotFound: options.throwOnNotFound ?? true,
    };
  }

  /**
   * Register a secret provider
   */
  registerProvider(type: string, provider: SecretProvider): void {
    this.providers.set(type, provider);
  }

  /**
   * Initialize all configured providers
   */
  async initialize(): Promise<void> {
    for (const [type, provider] of this.providers.entries()) {
      try {
        await provider.initialize();
      } catch (error) {
        throw new SecretProviderError(
          `Failed to initialize ${type} provider: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Get a secret from the appropriate provider
   */
  async getSecret(reference: string): Promise<Secret> {
    const parsed = this.parseReference(reference);

    // Check cache first
    if (this.options.providers.find((p) => p.cacheEnabled !== false)) {
      const cached = this.getCached(reference);
      if (cached) {
        return cached;
      }
    }

    // Get provider
    const provider = this.providers.get(parsed.provider);
    if (!provider) {
      throw new SecretProviderError(`Provider '${parsed.provider}' not configured`);
    }

    // Fetch secret
    try {
      const secret = await provider.getSecret(parsed.path);

      // Extract key if specified
      if (parsed.key && typeof secret.value === 'object') {
        const keyValue = this.extractKey(secret.value, parsed.key);
        secret.value = keyValue;
      }

      // Cache the secret
      this.cacheSecret(reference, secret);

      return secret;
    } catch (error) {
      if (this.options.throwOnNotFound) {
        throw new SecretNotFoundError(
          `Secret not found: ${reference} - ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      // Return empty secret if not throwing
      return { value: '' };
    }
  }

  /**
   * Parse a secret reference
   * Formats:
   *   ${secret:vault://path/to/secret}
   *   ${secret:aws://secret-name}
   *   ${secret:azure://secret-name}
   *   ${secret:vault://path/to/secret#key}
   */
  parseReference(reference: string): SecretReference {
    // Remove ${secret: and } if present
    let cleaned = reference.trim();
    if (cleaned.startsWith('${')) {
      cleaned = cleaned.slice(2, -1);
    }
    if (cleaned.startsWith(this.options.referencePrefix)) {
      cleaned = cleaned.slice(this.options.referencePrefix.length);
    }

    // Parse provider://path#key format
    const match = cleaned.match(/^([^:]+):\/\/([^#]+)(#(.+))?$/);
    if (!match) {
      throw new SecretProviderError(`Invalid secret reference format: ${reference}`);
    }

    return {
      raw: reference,
      provider: match[1],
      path: match[2],
      key: match[4],
    };
  }

  /**
   * Extract a key from a JSON secret
   */
  private extractKey(value: Record<string, unknown>, key: string): string {
    const parts = key.split('.');
    let current: unknown = value;

    for (const part of parts) {
      if (typeof current === 'object' && current !== null && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        throw new SecretNotFoundError(`Key '${key}' not found in secret`);
      }
    }

    if (typeof current === 'string') {
      return current;
    }
    if (typeof current === 'number' || typeof current === 'boolean') {
      return String(current);
    }
    return JSON.stringify(current);
  }

  /**
   * Get secret from cache if not expired
   */
  private getCached(reference: string): Secret | null {
    const cached = this.cache.get(reference);
    if (!cached) return null;

    if (cached.expiresAt < new Date()) {
      this.cache.delete(reference);
      return null;
    }

    return cached.value;
  }

  /**
   * Cache a secret
   */
  private cacheSecret(reference: string, secret: Secret): void {
    const now = new Date();
    const ttl = this.options.defaultCacheTTL * 1000; // Convert to ms
    const expiresAt = new Date(now.getTime() + ttl);

    this.cache.set(reference, {
      value: secret,
      fetchedAt: now,
      expiresAt,
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = new Date();
    for (const [key, cached] of this.cache.entries()) {
      if (cached.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Check if a reference looks like a secret reference
   */
  static isSecretReference(value: string): boolean {
    return value.includes('secret:') && value.includes('://');
  }

  /**
   * Replace secret references in a string
   */
  async resolveSecrets(value: string): Promise<string> {
    // Find all secret references
    const regex = /\$\{secret:[^}]+\}/g;
    const matches = value.match(regex);

    if (!matches) {
      return value;
    }

    let result = value;
    for (const match of matches) {
      try {
        const secret = await this.getSecret(match);
        const secretValue = typeof secret.value === 'string' ? secret.value : JSON.stringify(secret.value);
        result = result.replace(match, secretValue);
      } catch (error) {
        if (this.options.throwOnNotFound) {
          throw error;
        }
        // Replace with empty string if not throwing
        result = result.replace(match, '');
      }
    }

    return result;
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider.destroy) {
        await provider.destroy();
      }
    }
    this.providers.clear();
    this.cache.clear();
  }
}
