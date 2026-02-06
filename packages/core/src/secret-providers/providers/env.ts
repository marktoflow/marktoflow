/**
 * Environment Variable Provider
 *
 * Simple provider that reads secrets from environment variables.
 * Useful for local development and simple deployments.
 */

import type { SecretProvider, Secret } from '../types.js';

export class EnvProvider implements SecretProvider {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  async initialize(): Promise<void> {
    // No initialization needed
  }

  /**
   * Get a secret from environment variables
   * Path format: VAR_NAME or prefix_VAR_NAME if prefix is set
   */
  async getSecret(path: string): Promise<Secret> {
    const envVar = this.prefix ? `${this.prefix}_${path}` : path;
    const value = process.env[envVar];

    if (value === undefined) {
      throw new Error(`Environment variable not found: ${envVar}`);
    }

    // Try to parse as JSON
    let parsedValue: string | Record<string, unknown> = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Not JSON, use as string
    }

    return {
      value: parsedValue,
    };
  }

  /**
   * Check if an environment variable exists
   */
  async exists(path: string): Promise<boolean> {
    const envVar = this.prefix ? `${this.prefix}_${path}` : path;
    return process.env[envVar] !== undefined;
  }

  /**
   * List all environment variables with the prefix
   */
  async listSecrets(): Promise<string[]> {
    if (!this.prefix) {
      // Return all env vars if no prefix
      return Object.keys(process.env);
    }

    // Return only vars with the prefix
    const prefixWithUnderscore = `${this.prefix}_`;
    return Object.keys(process.env)
      .filter((key) => key.startsWith(prefixWithUnderscore))
      .map((key) => key.slice(prefixWithUnderscore.length));
  }
}
