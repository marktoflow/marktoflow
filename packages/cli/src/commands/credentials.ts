/**
 * `marktoflow credentials` commands — Credential management.
 */

import chalk from 'chalk';
import { join } from 'node:path';
import {
  createCredentialManager,
  getAvailableBackends,
  EncryptionBackend,
} from '@marktoflow/core';

export interface CredentialsListOptions {
  stateDir?: string;
  backend?: string;
  tag?: string;
  showExpired?: boolean;
}

export function executeCredentialsList(options: CredentialsListOptions): void {
  try {
    const stateDir = options.stateDir ?? join('.marktoflow', 'credentials');
    const backend = (options.backend as EncryptionBackend) ?? undefined;
    const manager = createCredentialManager({ stateDir, backend });
    const credentials = manager.list(options.tag, options.showExpired);

    if (credentials.length === 0) {
      console.log(chalk.yellow('No credentials found.'));
      return;
    }

    console.log(chalk.bold(`Credentials (${credentials.length}):\n`));
    for (const cred of credentials) {
      const expired = cred.expiresAt && cred.expiresAt < new Date();
      const status = expired ? chalk.red(' [EXPIRED]') : '';
      console.log(`  ${chalk.cyan(cred.name)}${status}`);
      console.log(`    Type: ${cred.credentialType}`);
      if (cred.description) {
        console.log(`    Description: ${cred.description}`);
      }
      console.log(`    Created: ${cred.createdAt.toISOString()}`);
      console.log(`    Updated: ${cred.updatedAt.toISOString()}`);
      if (cred.expiresAt) {
        console.log(`    Expires: ${cred.expiresAt.toISOString()}`);
      }
      if (cred.tags.length > 0) {
        console.log(`    Tags: ${cred.tags.join(', ')}`);
      }
      console.log();
    }
  } catch (error) {
    console.log(chalk.red(`Failed to list credentials: ${error}`));
    process.exit(1);
  }
}

export interface CredentialsVerifyOptions {
  stateDir?: string;
  backend?: string;
}

export function executeCredentialsVerify(options: CredentialsVerifyOptions): void {
  try {
    const stateDir = options.stateDir ?? join('.marktoflow', 'credentials');
    const backend = (options.backend as EncryptionBackend) ?? undefined;

    console.log(chalk.bold('Credential Encryption Verification\n'));

    // Show available backends
    const backends = getAvailableBackends();
    console.log(chalk.bold('Available backends:'));
    for (const b of backends) {
      const isDefault = b === EncryptionBackend.AES_256_GCM;
      const marker = isDefault ? chalk.green(' (default)') : '';
      const selected = (backend ?? EncryptionBackend.AES_256_GCM) === b ? chalk.cyan(' <-- selected') : '';
      console.log(`  ${chalk.cyan(b)}${marker}${selected}`);
    }
    console.log();

    // Test encrypt/decrypt round-trip
    const manager = createCredentialManager({ stateDir, backend });
    const testValue = `verify-test-${Date.now()}`;
    const testName = `__verify_test_${Date.now()}`;

    console.log('Testing encrypt/decrypt round-trip...');
    manager.set({ name: testName, value: testValue, tags: ['__test'] });
    const decrypted = manager.get(testName);

    if (decrypted === testValue) {
      console.log(chalk.green('  Round-trip: PASS'));
    } else {
      console.log(chalk.red('  Round-trip: FAIL'));
      console.log(chalk.red(`    Expected: ${testValue}`));
      console.log(chalk.red(`    Got: ${decrypted}`));
      process.exit(1);
    }

    // Verify stored value is encrypted (not plain text)
    const raw = manager.get(testName, false);
    if (raw !== testValue) {
      console.log(chalk.green('  Encryption: PASS (stored value is encrypted)'));
    } else {
      console.log(chalk.red('  Encryption: FAIL (stored value is plain text)'));
      process.exit(1);
    }

    // Cleanup test credential
    manager.delete(testName);
    console.log(chalk.green('\n  All checks passed.'));

    // Show credential count
    const credentials = manager.list();
    console.log(`\n  Stored credentials: ${credentials.length}`);
  } catch (error) {
    console.log(chalk.red(`Verification failed: ${error}`));
    process.exit(1);
  }
}
