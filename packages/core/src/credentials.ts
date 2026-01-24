/**
 * Credential encryption and management.
 *
 * Provides secure credential storage with encryption support for:
 * - Age encryption (external binary)
 * - GPG encryption (external binary)
 * - Fernet encryption (built-in via npm package)
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { Secret, Token } from 'fernet';

export enum EncryptionBackend {
  AGE = 'age',
  GPG = 'gpg',
  FERNET = 'fernet',
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

export class FernetEncryptor implements Encryptor {
  private key: string | null;

  constructor(key?: string, keyFile?: string) {
    if (key) {
      this.key = key;
    } else if (keyFile && existsSync(keyFile)) {
      this.key = readFileSync(keyFile, 'utf8').trim();
    } else {
      this.key = null;
    }
  }

  private getSecret(): Secret {
    if (!this.key) {
      throw new KeyNotFoundError('No Fernet key configured');
    }
    return new Secret(this.key);
  }

  encrypt(plaintext: string): string {
    const token = new Token({
      secret: this.getSecret(),
      time: Math.floor(Date.now() / 1000),
    });
    return token.encode(plaintext);
  }

  decrypt(ciphertext: string): string {
    try {
      const token = new Token({
        secret: this.getSecret(),
        token: ciphertext,
        ttl: 0,
      });
      return token.decode();
    } catch (error) {
      throw new EncryptionError(`Decryption failed: ${String(error)}`);
    }
  }

  isAvailable(): boolean {
    return true;
  }

  generateKey(): string {
    return randomBytes(32).toString('base64');
  }

  setKey(key: string): void {
    this.key = key;
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
    private keyId?: string,
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
      description: existing.description,
      metadata: existing.metadata,
      expiresAt: existing.expiresAt,
      tags: existing.tags,
    });
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
      if (entry.endsWith('.key')) {
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
  const backend = params.backend ?? EncryptionBackend.FERNET;
  const keyName = params.keyName ?? 'default';
  const keyDir = join(params.stateDir, 'keys');
  const dbPath = join(params.stateDir, 'credentials.db');

  const keyManager = new KeyManager(keyDir);
  const store = new SQLiteCredentialStore(dbPath);

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
  const available: EncryptionBackend[] = [EncryptionBackend.FERNET];
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
