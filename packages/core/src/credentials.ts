/**
 * Credential encryption and management.
 *
 * Provides secure credential storage with encryption support for:
 * - Age encryption (external binary)
 * - GPG encryption (external binary)
 * - Fernet encryption (built-in via Node crypto)
 */

import { randomBytes, createCipheriv, createDecipheriv, createHmac, scryptSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

export enum EncryptionBackend {
  AGE = 'age',
  GPG = 'gpg',
  FERNET = 'fernet',
  AES_256_GCM = 'aes-256-gcm',
}

export enum CredentialType {
  API_KEY = 'api_key',
  TOKEN = 'token',
  PASSWORD = 'password',
  CERTIFICATE = 'certificate',
  SSH_KEY = 'ssh_key',
  SECRET = 'secret',
  OAUTH_TOKEN = 'oauth_token',
  CUSTOM = 'custom',
}

export interface Credential {
  name: string;
  credentialType: CredentialType;
  value: string;
  description?: string | undefined;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | undefined;
  tags: string[];
}

export class EncryptionError extends Error {}
export class KeyNotFoundError extends Error {}
export class CredentialNotFoundError extends Error {}

export interface Encryptor {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
  isAvailable(): boolean;
  generateKey(): string;
}

/**
 * Fernet-compatible encryption using Node's built-in crypto.
 *
 * Fernet format:
 * - Version (1 byte): 0x80
 * - Timestamp (8 bytes): big-endian seconds since epoch
 * - IV (16 bytes): random initialization vector
 * - Ciphertext: AES-128-CBC encrypted, PKCS7 padded
 * - HMAC (32 bytes): SHA256 HMAC of version || timestamp || iv || ciphertext
 *
 * Key format: URL-safe base64 encoded 32 bytes (16 bytes signing key + 16 bytes encryption key)
 */
export class FernetEncryptor implements Encryptor {
  private signingKey: Buffer | null = null;
  private encryptionKey: Buffer | null = null;

  constructor(key?: string, keyFile?: string) {
    if (key) {
      this.setKey(key);
    } else if (keyFile && existsSync(keyFile)) {
      this.setKey(readFileSync(keyFile, 'utf8').trim());
    }
  }

  private decodeKey(key: string): { signingKey: Buffer; encryptionKey: Buffer } {
    // Handle URL-safe base64
    const base64 = key.replace(/-/g, '+').replace(/_/g, '/');
    const keyBuffer = Buffer.from(base64, 'base64');

    if (keyBuffer.length !== 32) {
      throw new KeyNotFoundError(`Invalid Fernet key length: expected 32 bytes, got ${keyBuffer.length}`);
    }

    return {
      signingKey: keyBuffer.subarray(0, 16),
      encryptionKey: keyBuffer.subarray(16, 32),
    };
  }

  setKey(key: string): void {
    const { signingKey, encryptionKey } = this.decodeKey(key);
    this.signingKey = signingKey;
    this.encryptionKey = encryptionKey;
  }

  encrypt(plaintext: string): string {
    if (!this.signingKey || !this.encryptionKey) {
      throw new KeyNotFoundError('No Fernet key configured');
    }

    const version = Buffer.from([0x80]);
    const timestamp = Buffer.alloc(8);
    const now = BigInt(Math.floor(Date.now() / 1000));
    timestamp.writeBigUInt64BE(now);

    const iv = randomBytes(16);

    // Encrypt with AES-128-CBC
    const cipher = createCipheriv('aes-128-cbc', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Create token without HMAC
    const tokenWithoutHmac = Buffer.concat([version, timestamp, iv, ciphertext]);

    // Calculate HMAC
    const hmac = createHmac('sha256', this.signingKey)
      .update(tokenWithoutHmac)
      .digest();

    // Final token
    const token = Buffer.concat([tokenWithoutHmac, hmac]);

    // Return URL-safe base64
    return token.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  decrypt(ciphertext: string): string {
    if (!this.signingKey || !this.encryptionKey) {
      throw new KeyNotFoundError('No Fernet key configured');
    }

    try {
      // Decode URL-safe base64
      const base64 = ciphertext.replace(/-/g, '+').replace(/_/g, '/');
      const token = Buffer.from(base64, 'base64');

      if (token.length < 57) {
        // 1 + 8 + 16 + 16 (min ciphertext) + 32 (hmac) = 73, but can be less with small plaintext
        throw new EncryptionError('Token too short');
      }

      // Parse token
      const version = token[0];
      if (version !== 0x80) {
        throw new EncryptionError(`Invalid Fernet version: ${version}`);
      }

      const hmacOffset = token.length - 32;
      const tokenWithoutHmac = token.subarray(0, hmacOffset);
      const providedHmac = token.subarray(hmacOffset);

      // Verify HMAC
      const expectedHmac = createHmac('sha256', this.signingKey)
        .update(tokenWithoutHmac)
        .digest();

      if (!providedHmac.equals(expectedHmac)) {
        throw new EncryptionError('HMAC verification failed');
      }

      // Extract IV and ciphertext
      const iv = token.subarray(9, 25);
      const encryptedData = token.subarray(25, hmacOffset);

      // Decrypt
      const decipher = createDecipheriv('aes-128-cbc', this.encryptionKey, iv);
      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      if (error instanceof EncryptionError || error instanceof KeyNotFoundError) {
        throw error;
      }
      throw new EncryptionError(`Decryption failed: ${String(error)}`);
    }
  }

  isAvailable(): boolean {
    return true;
  }

  generateKey(): string {
    // Generate 32 random bytes and encode as URL-safe base64
    const key = randomBytes(32);
    return key.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }
}

/**
 * AES-256-GCM encryption using Node.js built-in crypto.
 *
 * Uses scrypt for key derivation from a passphrase/env key.
 * Each encryption produces a random 12-byte IV (nonce).
 * Stores ciphertext as: iv:authTag:ciphertext (all base64-encoded).
 *
 * Key source priority:
 *   1. Explicit key passed to constructor
 *   2. MARKTOFLOW_ENCRYPTION_KEY environment variable
 *   3. Key file at keyFilePath (default: ~/.marktoflow/.key)
 *   4. Auto-generate and store at keyFilePath on first use
 */
export class AES256GCMEncryptor implements Encryptor {
  private derivedKey: Buffer | null = null;
  private keyFilePath: string;
  private salt: Buffer;

  constructor(options?: {
    key?: string;
    keyFilePath?: string;
    salt?: Buffer;
  }) {
    this.keyFilePath = options?.keyFilePath ?? join(homedir(), '.marktoflow', '.key');
    // Use a fixed salt per installation (derived from the key file path).
    // Users can override with an explicit salt for testing.
    this.salt = options?.salt ?? Buffer.from('marktoflow-aes256gcm-salt', 'utf8');

    const rawKey = options?.key ?? process.env.MARKTOFLOW_ENCRYPTION_KEY ?? this.loadOrGenerateKeyFile();
    if (rawKey) {
      this.deriveKey(rawKey);
    }
  }

  private loadOrGenerateKeyFile(): string | null {
    if (existsSync(this.keyFilePath)) {
      return readFileSync(this.keyFilePath, 'utf8').trim();
    }
    // Auto-generate key on first run
    const generated = this.generateKey();
    const dir = this.keyFilePath.substring(0, this.keyFilePath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.keyFilePath, generated, { mode: 0o600 });
    return generated;
  }

  private deriveKey(passphrase: string): void {
    // scrypt: derive a 32-byte key (256 bits) for AES-256
    this.derivedKey = scryptSync(passphrase, this.salt, 32, { N: 16384, r: 8, p: 1 });
  }

  encrypt(plaintext: string): string {
    if (!this.derivedKey) {
      throw new KeyNotFoundError('No AES-256-GCM key configured');
    }

    const iv = randomBytes(12); // 96-bit nonce recommended for GCM
    const cipher = createCipheriv('aes-256-gcm', this.derivedKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag(); // 16 bytes

    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    if (!this.derivedKey) {
      throw new KeyNotFoundError('No AES-256-GCM key configured');
    }

    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new EncryptionError('Invalid AES-256-GCM ciphertext format: expected iv:authTag:ciphertext');
      }

      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const encrypted = Buffer.from(parts[2], 'base64');

      if (iv.length !== 12) {
        throw new EncryptionError(`Invalid IV length: expected 12, got ${iv.length}`);
      }
      if (authTag.length !== 16) {
        throw new EncryptionError(`Invalid auth tag length: expected 16, got ${authTag.length}`);
      }

      const decipher = createDecipheriv('aes-256-gcm', this.derivedKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      if (error instanceof EncryptionError || error instanceof KeyNotFoundError) {
        throw error;
      }
      throw new EncryptionError(`AES-256-GCM decryption failed: ${String(error)}`);
    }
  }

  isAvailable(): boolean {
    return true; // Uses only Node.js built-in crypto
  }

  generateKey(): string {
    // Generate a 64-character hex key (256 bits of entropy)
    return randomBytes(32).toString('hex');
  }
}

export class AgeEncryptor implements Encryptor {
  constructor(
    private recipient?: string,
    private identityFile?: string,
    private passphrase?: string
  ) {}

  private findBinary(name: string): string {
    const paths = (process.env.PATH || '').split(':');
    for (const p of paths) {
      const full = join(p, name);
      if (existsSync(full)) return full;
    }
    throw new EncryptionError(`${name} binary not found`);
  }

  encrypt(plaintext: string): string {
    const agePath = this.findBinary('age');
    const args = ['--armor'];
    if (this.passphrase) {
      args.push('--passphrase');
    } else if (this.recipient) {
      args.push('--recipient', this.recipient);
    } else {
      throw new EncryptionError('No recipient or passphrase configured for age');
    }

    const env = { ...process.env };
    if (this.passphrase) env.AGE_PASSPHRASE = this.passphrase;

    const result = spawnSync(agePath, args, { input: plaintext, env, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new EncryptionError(`age encryption failed: ${result.stderr || ''}`.trim());
    }
    return result.stdout;
  }

  decrypt(ciphertext: string): string {
    const agePath = this.findBinary('age');
    const args = ['--decrypt'];
    if (this.identityFile) {
      args.push('--identity', this.identityFile);
    }

    const env = { ...process.env };
    if (this.passphrase) env.AGE_PASSPHRASE = this.passphrase;

    const result = spawnSync(agePath, args, { input: ciphertext, env, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new EncryptionError(`age decryption failed: ${result.stderr || ''}`.trim());
    }
    return result.stdout;
  }

  isAvailable(): boolean {
    try {
      this.findBinary('age');
      return true;
    } catch {
      return false;
    }
  }

  generateKey(): string {
    const keygenPath = this.findBinary('age-keygen');
    const result = spawnSync(keygenPath, [], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new EncryptionError(`age-keygen failed: ${result.stderr || ''}`.trim());
    }
    return result.stdout;
  }

  static extractPublicKey(identityContent: string): string {
    for (const line of identityContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# public key:')) {
        return trimmed.split(':', 2)[1]?.trim() ?? '';
      }
      if (trimmed.startsWith('age1') && !trimmed.startsWith('AGE-SECRET-KEY')) {
        return trimmed;
      }
    }
    throw new EncryptionError('Could not extract public key from identity');
  }
}

export class GPGEncryptor implements Encryptor {
  constructor(
    private recipient?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _keyId?: string,
    private passphrase?: string,
    private symmetric: boolean = false
  ) {}

  private findBinary(): string {
    const paths = (process.env.PATH || '').split(':');
    for (const name of ['gpg2', 'gpg']) {
      for (const p of paths) {
        const full = join(p, name);
        if (existsSync(full)) return full;
      }
    }
    throw new EncryptionError('GPG binary not found. Install gnupg.');
  }

  encrypt(plaintext: string): string {
    const gpgPath = this.findBinary();
    const args = ['--armor', '--batch', '--yes'];
    if (this.symmetric) {
      args.push('--symmetric');
      if (this.passphrase) {
        args.push('--passphrase', this.passphrase);
      }
    } else {
      if (!this.recipient) {
        throw new EncryptionError('No recipient configured for GPG encryption');
      }
      args.push('--encrypt', '--recipient', this.recipient);
    }

    const result = spawnSync(gpgPath, args, { input: plaintext, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new EncryptionError(`GPG encryption failed: ${result.stderr || ''}`.trim());
    }
    return result.stdout;
  }

  decrypt(ciphertext: string): string {
    const gpgPath = this.findBinary();
    const args = ['--decrypt', '--batch', '--yes'];
    if (this.passphrase) {
      args.push('--passphrase', this.passphrase);
    }

    const result = spawnSync(gpgPath, args, { input: ciphertext, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new EncryptionError(`GPG decryption failed: ${result.stderr || ''}`.trim());
    }
    return result.stdout;
  }

  isAvailable(): boolean {
    try {
      this.findBinary();
      return true;
    } catch {
      return false;
    }
  }

  generateKey(): string {
    return `Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: AI Workflow
Name-Email: marktoflow@localhost
Expire-Date: 1y
%no-protection
%commit`;
  }
}

export interface CredentialStore {
  save(credential: Credential): void;
  get(name: string): Credential | null;
  delete(name: string): boolean;
  list(tag?: string): Credential[];
  exists(name: string): boolean;
}

export class InMemoryCredentialStore implements CredentialStore {
  private credentials = new Map<string, Credential>();

  save(credential: Credential): void {
    credential.updatedAt = new Date();
    this.credentials.set(credential.name, credential);
  }

  get(name: string): Credential | null {
    return this.credentials.get(name) ?? null;
  }

  delete(name: string): boolean {
    return this.credentials.delete(name);
  }

  list(tag?: string): Credential[] {
    const values = Array.from(this.credentials.values());
    if (!tag) return values;
    return values.filter((c) => c.tags.includes(tag));
  }

  exists(name: string): boolean {
    return this.credentials.has(name);
  }
}

export class SQLiteCredentialStore implements CredentialStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        name TEXT PRIMARY KEY,
        credential_type TEXT NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        tags TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(credential_type);
    `);
  }

  save(credential: Credential): void {
    const now = new Date();
    credential.updatedAt = now;
    this.db.prepare(
      `INSERT OR REPLACE INTO credentials
      (name, credential_type, value, description, metadata, created_at, updated_at, expires_at, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      credential.name,
      credential.credentialType,
      credential.value,
      credential.description ?? '',
      JSON.stringify(credential.metadata ?? {}),
      credential.createdAt.toISOString(),
      credential.updatedAt.toISOString(),
      credential.expiresAt ? credential.expiresAt.toISOString() : null,
      JSON.stringify(credential.tags ?? [])
    );
  }

  get(name: string): Credential | null {
    const row = this.db
      .prepare('SELECT * FROM credentials WHERE name = ?')
      .get(name) as
      | {
          name: string;
          credential_type: string;
          value: string;
          description: string | null;
          metadata: string | null;
          created_at: string;
          updated_at: string;
          expires_at: string | null;
          tags: string | null;
        }
      | undefined;

    if (!row) return null;
    return {
      name: row.name,
      credentialType: row.credential_type as CredentialType,
      value: row.value,
      description: row.description ?? '',
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : [],
    };
  }

  delete(name: string): boolean {
    const res = this.db.prepare('DELETE FROM credentials WHERE name = ?').run(name);
    return res.changes > 0;
  }

  list(tag?: string): Credential[] {
    const rows = this.db.prepare('SELECT * FROM credentials ORDER BY name').all() as Array<{
      name: string;
      credential_type: string;
      value: string;
      description: string | null;
      metadata: string | null;
      created_at: string;
      updated_at: string;
      expires_at: string | null;
      tags: string | null;
    }>;
    const creds = rows.map((row) => ({
      name: row.name,
      credentialType: row.credential_type as CredentialType,
      value: row.value,
      description: row.description ?? '',
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : [],
    }));
    if (!tag) return creds;
    return creds.filter((c) => c.tags.includes(tag));
  }

  exists(name: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM credentials WHERE name = ?').get(name);
    return Boolean(row);
  }
}

export class CredentialManager {
  constructor(
    public store: CredentialStore,
    public encryptor: Encryptor
  ) {}

  set(params: {
    name: string;
    value: string;
    credentialType?: CredentialType;
    description?: string;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
    tags?: string[];
  }): Credential {
    const encryptedValue = this.encryptor.encrypt(params.value);
    const now = new Date();
    const credential: Credential = {
      name: params.name,
      credentialType: params.credentialType ?? CredentialType.SECRET,
      value: encryptedValue,
      description: params.description ?? '',
      metadata: params.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      expiresAt: params.expiresAt,
      tags: params.tags ?? [],
    };
    this.store.save(credential);
    return credential;
  }

  get(name: string, decrypt: boolean = true): string {
    const credential = this.store.get(name);
    if (!credential) {
      throw new CredentialNotFoundError(`Credential '${name}' not found`);
    }
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      throw new CredentialNotFoundError(`Credential '${name}' has expired`);
    }
    return decrypt ? this.encryptor.decrypt(credential.value) : credential.value;
  }

  getCredential(name: string): Credential | null {
    return this.store.get(name);
  }

  delete(name: string): boolean {
    return this.store.delete(name);
  }

  exists(name: string): boolean {
    return this.store.exists(name);
  }

  list(tag?: string, includeExpired: boolean = false): Credential[] {
    const creds = this.store.list(tag);
    if (includeExpired) return creds;
    return creds.filter((c) => !c.expiresAt || c.expiresAt >= new Date());
  }

  rotate(name: string, newValue: string): Credential {
    const existing = this.store.get(name);
    if (!existing) {
      throw new CredentialNotFoundError(`Credential '${name}' not found`);
    }
    return this.set({
      name,
      value: newValue,
      credentialType: existing.credentialType,
      ...(existing.description !== undefined && { description: existing.description }),
      ...(existing.metadata !== undefined && { metadata: existing.metadata }),
      ...(existing.expiresAt !== undefined && { expiresAt: existing.expiresAt }),
      ...(existing.tags !== undefined && { tags: existing.tags }),
    });
  }

  /**
   * Check if an OAuth token is expired or will expire soon
   */
  isTokenExpired(name: string, bufferMinutes: number = 5): boolean {
    const credential = this.store.get(name);
    if (!credential || !credential.expiresAt) {
      return false; // No expiration set
    }

    const now = new Date();
    const bufferMs = bufferMinutes * 60 * 1000;
    const expiryWithBuffer = new Date(credential.expiresAt.getTime() - bufferMs);

    return expiryWithBuffer <= now;
  }

  /**
   * Update OAuth access token after refresh
   */
  updateOAuthToken(name: string, newAccessToken: string, expiresIn?: number): Credential {
    const existing = this.store.get(name);
    if (!existing) {
      throw new CredentialNotFoundError(`Credential '${name}' not found`);
    }

    // Calculate new expiration time if provided
    let newExpiresAt = existing.expiresAt;
    if (expiresIn) {
      newExpiresAt = new Date(Date.now() + expiresIn * 1000);
    }

    const params: {
      name: string;
      value: string;
      credentialType?: CredentialType;
      description?: string;
      metadata?: Record<string, unknown>;
      expiresAt?: Date;
      tags?: string[];
    } = {
      name,
      value: newAccessToken,
      credentialType: existing.credentialType,
    };

    if (existing.description) params.description = existing.description;
    if (existing.metadata) params.metadata = existing.metadata;
    if (newExpiresAt) params.expiresAt = newExpiresAt;
    if (existing.tags && existing.tags.length > 0) params.tags = existing.tags;

    return this.set(params);
  }

  /**
   * Get OAuth tokens with automatic expiration checking
   */
  getOAuthTokens(name: string): {
    accessToken: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    isExpired: boolean;
  } {
    const credential = this.store.get(name);
    if (!credential) {
      throw new CredentialNotFoundError(`Credential '${name}' not found`);
    }

    const accessToken = this.encryptor.decrypt(credential.value);
    const metadata = credential.metadata || {};

    const result: {
      accessToken: string;
      refreshToken?: string;
      clientId?: string;
      clientSecret?: string;
      isExpired: boolean;
    } = {
      accessToken,
      isExpired: this.isTokenExpired(name),
    };

    if (metadata.refresh_token) result.refreshToken = metadata.refresh_token as string;
    if (metadata.client_id) result.clientId = metadata.client_id as string;
    if (metadata.client_secret) result.clientSecret = metadata.client_secret as string;

    return result;
  }

  export(name: string): Record<string, unknown> {
    const credential = this.store.get(name);
    if (!credential) {
      throw new CredentialNotFoundError(`Credential '${name}' not found`);
    }
    return {
      name: credential.name,
      credential_type: credential.credentialType,
      value: credential.value,
      description: credential.description ?? '',
      metadata: credential.metadata ?? {},
      created_at: credential.createdAt.toISOString(),
      updated_at: credential.updatedAt.toISOString(),
      expires_at: credential.expiresAt ? credential.expiresAt.toISOString() : null,
      tags: credential.tags ?? [],
    };
  }

  /**
   * Migrate existing plain-text (or differently-encrypted) credentials to
   * the current encryptor. Reads each credential's raw stored value, decrypts
   * it with the provided `oldEncryptor` (or treats it as plain text if null),
   * then re-encrypts with the current encryptor and saves.
   *
   * Returns the number of credentials migrated.
   */
  migrateToEncrypted(oldEncryptor?: Encryptor | null): number {
    const credentials = this.store.list();
    let migrated = 0;
    for (const cred of credentials) {
      try {
        // Decrypt with old encryptor, or use raw value if none
        const plaintext = oldEncryptor ? oldEncryptor.decrypt(cred.value) : cred.value;
        // Re-encrypt with current encryptor
        const encrypted = this.encryptor.encrypt(plaintext);
        cred.value = encrypted;
        cred.updatedAt = new Date();
        this.store.save(cred);
        migrated++;
      } catch {
        // Skip credentials that fail to decrypt (already encrypted with current key, etc.)
        continue;
      }
    }
    return migrated;
  }

  importCredential(data: Record<string, unknown>): Credential {
    const now = new Date();
    const credential: Credential = {
      name: String(data.name),
      credentialType: data.credential_type as CredentialType,
      value: String(data.value),
      description: String(data.description ?? ''),
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      createdAt: data.created_at ? new Date(String(data.created_at)) : now,
      updatedAt: data.updated_at ? new Date(String(data.updated_at)) : now,
      expiresAt: data.expires_at ? new Date(String(data.expires_at)) : undefined,
      tags: (data.tags as string[]) ?? [],
    };
    this.store.save(credential);
    return credential;
  }
}

export class KeyManager {
  constructor(private keyDir: string) {
    if (!existsSync(keyDir)) {
      mkdirSync(keyDir, { recursive: true });
    }
  }

  private keyFile(name: string): string {
    return join(this.keyDir, `${name}.key`);
  }

  generateAES256GCMKey(name: string = 'default'): string {
    const encryptor = new AES256GCMEncryptor({ key: 'temp' }); // temp key just to call generateKey
    const key = encryptor.generateKey();
    const keyFile = join(this.keyDir, `${name}.aes`);
    writeFileSync(keyFile, key, { mode: 0o600 });
    return key;
  }

  getAES256GCMKey(name: string = 'default'): string | null {
    const keyFile = join(this.keyDir, `${name}.aes`);
    return existsSync(keyFile) ? readFileSync(keyFile, 'utf8').trim() : null;
  }

  generateFernetKey(name: string = 'default'): string {
    const encryptor = new FernetEncryptor();
    const key = encryptor.generateKey();
    const keyFile = this.keyFile(name);
    writeFileSync(keyFile, key);
    return key;
  }

  generateAgeIdentity(name: string = 'default'): { identity: string; publicKey: string } {
    const encryptor = new AgeEncryptor();
    const identity = encryptor.generateKey();
    const identityFile = join(this.keyDir, `${name}.age`);
    writeFileSync(identityFile, identity);
    const publicKey = AgeEncryptor.extractPublicKey(identity);
    const pubFile = join(this.keyDir, `${name}.age.pub`);
    writeFileSync(pubFile, publicKey);
    return { identity, publicKey };
  }

  getFernetKey(name: string = 'default'): string | null {
    const keyFile = this.keyFile(name);
    return existsSync(keyFile) ? readFileSync(keyFile, 'utf8').trim() : null;
  }

  getAgeIdentityFile(name: string = 'default'): string | null {
    const identityFile = join(this.keyDir, `${name}.age`);
    return existsSync(identityFile) ? identityFile : null;
  }

  getAgePublicKey(name: string = 'default'): string | null {
    const pubFile = join(this.keyDir, `${name}.age.pub`);
    return existsSync(pubFile) ? readFileSync(pubFile, 'utf8').trim() : null;
  }

  listKeys(): Array<Record<string, unknown>> {
    const keys: Array<Record<string, unknown>> = [];
    if (!existsSync(this.keyDir)) return keys;
    const entries = readdirSync(this.keyDir);
    for (const entry of entries) {
      if (entry.endsWith('.aes')) {
        keys.push({
          name: entry.replace(/\.aes$/, ''),
          type: 'aes-256-gcm',
          file: join(this.keyDir, entry),
        });
      } else if (entry.endsWith('.key')) {
        keys.push({
          name: entry.replace(/\.key$/, ''),
          type: 'fernet',
          file: join(this.keyDir, entry),
        });
      } else if (entry.endsWith('.age') && !entry.endsWith('.age.pub')) {
        const name = entry.replace(/\.age$/, '');
        keys.push({
          name,
          type: 'age',
          file: join(this.keyDir, entry),
          public_key: this.getAgePublicKey(name),
        });
      }
    }
    return keys;
  }

  deleteKey(name: string): boolean {
    let deleted = false;
    const aesKey = join(this.keyDir, `${name}.aes`);
    if (existsSync(aesKey)) {
      unlinkSync(aesKey);
      deleted = true;
    }
    const fernetKey = this.keyFile(name);
    if (existsSync(fernetKey)) {
      unlinkSync(fernetKey);
      deleted = true;
    }
    const ageFile = join(this.keyDir, `${name}.age`);
    if (existsSync(ageFile)) {
      unlinkSync(ageFile);
      deleted = true;
    }
    const pubFile = join(this.keyDir, `${name}.age.pub`);
    if (existsSync(pubFile)) {
      unlinkSync(pubFile);
      deleted = true;
    }
    return deleted;
  }
}

export function createCredentialManager(params: {
  stateDir: string;
  backend?: EncryptionBackend;
  keyName?: string;
  passphrase?: string;
}): CredentialManager {
  const backend = params.backend ?? EncryptionBackend.AES_256_GCM;
  const keyName = params.keyName ?? 'default';
  const keyDir = join(params.stateDir, 'keys');
  const dbPath = join(params.stateDir, 'credentials.db');

  const keyManager = new KeyManager(keyDir);
  const store = new SQLiteCredentialStore(dbPath);

  if (backend === EncryptionBackend.AES_256_GCM) {
    const keyFilePath = join(keyDir, `${keyName}.aes`);
    const passphrase = params.passphrase ?? process.env.MARKTOFLOW_ENCRYPTION_KEY;
    const encryptor = new AES256GCMEncryptor({
      ...(passphrase ? { key: passphrase } : {}),
      keyFilePath,
    });
    return new CredentialManager(store, encryptor);
  }

  if (backend === EncryptionBackend.FERNET) {
    let key = keyManager.getFernetKey(keyName);
    if (!key) {
      key = keyManager.generateFernetKey(keyName);
    }
    return new CredentialManager(store, new FernetEncryptor(key));
  }

  if (backend === EncryptionBackend.AGE) {
    if (params.passphrase) {
      return new CredentialManager(store, new AgeEncryptor(undefined, undefined, params.passphrase));
    }
    let identityFile = keyManager.getAgeIdentityFile(keyName);
    let publicKey = keyManager.getAgePublicKey(keyName);
    if (!identityFile || !publicKey) {
      const generated = keyManager.generateAgeIdentity(keyName);
      identityFile = keyManager.getAgeIdentityFile(keyName);
      publicKey = generated.publicKey;
    }
    return new CredentialManager(
      store,
      new AgeEncryptor(publicKey ?? undefined, identityFile ?? undefined)
    );
  }

  if (backend === EncryptionBackend.GPG) {
    if (params.passphrase) {
      return new CredentialManager(store, new GPGEncryptor(undefined, undefined, params.passphrase, true));
    }
    throw new EncryptionError(
      'GPG asymmetric encryption requires recipient configuration. Use passphrase for symmetric encryption or configure recipient manually.'
    );
  }

  throw new Error(`Unknown backend: ${backend}`);
}

export function getAvailableBackends(): EncryptionBackend[] {
  const available: EncryptionBackend[] = [EncryptionBackend.AES_256_GCM, EncryptionBackend.FERNET];
  const age = new AgeEncryptor();
  if (age.isAvailable()) {
    available.push(EncryptionBackend.AGE);
  }
  const gpg = new GPGEncryptor();
  if (gpg.isAvailable()) {
    available.push(EncryptionBackend.GPG);
  }
  return available;
}
