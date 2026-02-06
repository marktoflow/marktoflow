import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  AES256GCMEncryptor,
  CredentialManager,
  InMemoryCredentialStore,
  SQLiteCredentialStore,
  FernetEncryptor,
  CredentialType,
  EncryptionBackend,
  EncryptionError,
  KeyNotFoundError,
  KeyManager,
  createCredentialManager,
  getAvailableBackends,
} from '../src/credentials.js';

function createTempDir(): string {
  const dir = join(tmpdir(), `marktoflow-test-${randomBytes(8).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('AES256GCMEncryptor', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    // Clear env var so it doesn't interfere
    delete process.env.MARKTOFLOW_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    delete process.env.MARKTOFLOW_ENCRYPTION_KEY;
  });

  it('should encrypt and decrypt a string', () => {
    const encryptor = new AES256GCMEncryptor({
      key: 'test-encryption-key-12345',
      keyFilePath: join(tempDir, '.key'),
    });

    const plaintext = 'Hello, World!';
    const encrypted = encryptor.encrypt(plaintext);
    const decrypted = encryptor.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext (random IV)', () => {
    const encryptor = new AES256GCMEncryptor({
      key: 'test-key-for-iv-test',
      keyFilePath: join(tempDir, '.key'),
    });

    const plaintext = 'same-input-different-output';
    const encrypted1 = encryptor.encrypt(plaintext);
    const encrypted2 = encryptor.encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
    expect(encryptor.decrypt(encrypted1)).toBe(plaintext);
    expect(encryptor.decrypt(encrypted2)).toBe(plaintext);
  });

  it('should store ciphertext as iv:authTag:ciphertext format', () => {
    const encryptor = new AES256GCMEncryptor({
      key: 'format-test-key',
      keyFilePath: join(tempDir, '.key'),
    });

    const encrypted = encryptor.encrypt('test');
    const parts = encrypted.split(':');

    expect(parts.length).toBe(3);

    // Verify each part is valid base64
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = Buffer.from(parts[2], 'base64');

    expect(iv.length).toBe(12);      // 96-bit IV
    expect(authTag.length).toBe(16);  // 128-bit auth tag
    expect(ciphertext.length).toBeGreaterThan(0);
  });

  it('should handle empty strings', () => {
    const encryptor = new AES256GCMEncryptor({
      key: 'empty-test-key',
      keyFilePath: join(tempDir, '.key'),
    });

    const encrypted = encryptor.encrypt('');
    const decrypted = encryptor.decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle unicode text', () => {
    const encryptor = new AES256GCMEncryptor({
      key: 'unicode-test-key',
      keyFilePath: join(tempDir, '.key'),
    });

    const plaintext = 'Hello, World! Bonjour! Hola! Ciao!';
    const encrypted = encryptor.encrypt(plaintext);
    const decrypted = encryptor.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should handle large payloads', () => {
    const encryptor = new AES256GCMEncryptor({
      key: 'large-payload-key',
      keyFilePath: join(tempDir, '.key'),
    });

    const plaintext = 'x'.repeat(100_000);
    const encrypted = encryptor.encrypt(plaintext);
    const decrypted = encryptor.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should fail to decrypt with wrong key', () => {
    const encryptor1 = new AES256GCMEncryptor({
      key: 'key-one',
      keyFilePath: join(tempDir, '.key1'),
    });
    const encryptor2 = new AES256GCMEncryptor({
      key: 'key-two',
      keyFilePath: join(tempDir, '.key2'),
    });

    const encrypted = encryptor1.encrypt('secret data');
    expect(() => encryptor2.decrypt(encrypted)).toThrow(EncryptionError);
  });

  it('should fail to decrypt tampered ciphertext', () => {
    const encryptor = new AES256GCMEncryptor({
      key: 'tamper-test-key',
      keyFilePath: join(tempDir, '.key'),
    });

    const encrypted = encryptor.encrypt('secret');
    const parts = encrypted.split(':');
    // Tamper with the ciphertext part
    const tampered = Buffer.from(parts[2], 'base64');
    tampered[0] = tampered[0] ^ 0xff;
    parts[2] = tampered.toString('base64');

    expect(() => encryptor.decrypt(parts.join(':'))).toThrow(EncryptionError);
  });

  it('should fail to decrypt invalid format', () => {
    const encryptor = new AES256GCMEncryptor({
      key: 'format-error-key',
      keyFilePath: join(tempDir, '.key'),
    });

    expect(() => encryptor.decrypt('not-valid')).toThrow(EncryptionError);
    expect(() => encryptor.decrypt('a:b')).toThrow(EncryptionError);
  });

  it('should generate a key', () => {
    const encryptor = new AES256GCMEncryptor({
      key: 'temp',
      keyFilePath: join(tempDir, '.key'),
    });

    const key = encryptor.generateKey();
    expect(key).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(/^[0-9a-f]+$/.test(key)).toBe(true);
  });

  it('should always be available', () => {
    const encryptor = new AES256GCMEncryptor({
      key: 'test',
      keyFilePath: join(tempDir, '.key'),
    });
    expect(encryptor.isAvailable()).toBe(true);
  });

  it('should read key from MARKTOFLOW_ENCRYPTION_KEY env var', () => {
    process.env.MARKTOFLOW_ENCRYPTION_KEY = 'env-var-key-test';
    const encryptor = new AES256GCMEncryptor({
      keyFilePath: join(tempDir, 'no-such-file'),
    });

    const plaintext = 'env var encrypted';
    const encrypted = encryptor.encrypt(plaintext);
    const decrypted = encryptor.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should auto-generate key file if none exists', () => {
    const keyFilePath = join(tempDir, 'auto-generated', '.key');
    const encryptor = new AES256GCMEncryptor({ keyFilePath });

    expect(existsSync(keyFilePath)).toBe(true);

    const plaintext = 'auto-key test';
    const encrypted = encryptor.encrypt(plaintext);
    const decrypted = encryptor.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should reuse existing key file', () => {
    const keyFilePath = join(tempDir, '.key');

    // First instance auto-generates
    const enc1 = new AES256GCMEncryptor({ keyFilePath });
    const encrypted = enc1.encrypt('persistent');

    // Second instance should read the same key
    const enc2 = new AES256GCMEncryptor({ keyFilePath });
    const decrypted = enc2.decrypt(encrypted);
    expect(decrypted).toBe('persistent');
  });
});

describe('CredentialManager with AES-256-GCM', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    delete process.env.MARKTOFLOW_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    delete process.env.MARKTOFLOW_ENCRYPTION_KEY;
  });

  it('should set and get credentials with AES-256-GCM', () => {
    const store = new InMemoryCredentialStore();
    const encryptor = new AES256GCMEncryptor({
      key: 'manager-test-key',
      keyFilePath: join(tempDir, '.key'),
    });
    const manager = new CredentialManager(store, encryptor);

    manager.set({
      name: 'my-api-key',
      value: 'sk-secret-12345',
      credentialType: CredentialType.API_KEY,
      description: 'Test API key',
      tags: ['test'],
    });

    const decrypted = manager.get('my-api-key');
    expect(decrypted).toBe('sk-secret-12345');
  });

  it('should store encrypted value (not plain text)', () => {
    const store = new InMemoryCredentialStore();
    const encryptor = new AES256GCMEncryptor({
      key: 'encryption-check-key',
      keyFilePath: join(tempDir, '.key'),
    });
    const manager = new CredentialManager(store, encryptor);

    manager.set({ name: 'secret', value: 'plain-text-value' });

    const raw = manager.get('secret', false);
    expect(raw).not.toBe('plain-text-value');
    expect(raw.split(':').length).toBe(3); // iv:authTag:ciphertext
  });

  it('should work with SQLiteCredentialStore', () => {
    const dbPath = join(tempDir, 'creds.db');
    const store = new SQLiteCredentialStore(dbPath);
    const encryptor = new AES256GCMEncryptor({
      key: 'sqlite-test-key',
      keyFilePath: join(tempDir, '.key'),
    });
    const manager = new CredentialManager(store, encryptor);

    manager.set({
      name: 'db-cred',
      value: 'secret-db-value',
      credentialType: CredentialType.TOKEN,
    });

    expect(manager.get('db-cred')).toBe('secret-db-value');
    expect(manager.exists('db-cred')).toBe(true);
    expect(manager.list().length).toBe(1);
  });
});

describe('migrateToEncrypted', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    delete process.env.MARKTOFLOW_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should migrate plain-text credentials to encrypted', () => {
    const store = new InMemoryCredentialStore();

    // Save plain-text credentials directly into the store
    store.save({
      name: 'cred1',
      credentialType: CredentialType.API_KEY,
      value: 'plain-secret-1',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    });
    store.save({
      name: 'cred2',
      credentialType: CredentialType.TOKEN,
      value: 'plain-secret-2',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    });

    // Create manager with AES-256-GCM encryptor
    const encryptor = new AES256GCMEncryptor({
      key: 'migration-key',
      keyFilePath: join(tempDir, '.key'),
    });
    const manager = new CredentialManager(store, encryptor);

    // Migrate from plain text (no old encryptor)
    const migrated = manager.migrateToEncrypted(null);
    expect(migrated).toBe(2);

    // Verify credentials are now encrypted and decryptable
    expect(manager.get('cred1')).toBe('plain-secret-1');
    expect(manager.get('cred2')).toBe('plain-secret-2');

    // Verify stored values are encrypted
    const raw1 = manager.get('cred1', false);
    expect(raw1).not.toBe('plain-secret-1');
    expect(raw1.split(':').length).toBe(3);
  });

  it('should migrate from Fernet to AES-256-GCM', () => {
    const store = new InMemoryCredentialStore();
    const fernetEncryptor = new FernetEncryptor();
    const fernetKey = fernetEncryptor.generateKey();
    fernetEncryptor.setKey(fernetKey);

    // Store Fernet-encrypted credentials
    const fernetManager = new CredentialManager(store, fernetEncryptor);
    fernetManager.set({ name: 'fernet-cred', value: 'fernet-secret' });

    // Create AES manager and migrate
    const aesEncryptor = new AES256GCMEncryptor({
      key: 'aes-migration-key',
      keyFilePath: join(tempDir, '.key'),
    });
    const aesManager = new CredentialManager(store, aesEncryptor);
    const migrated = aesManager.migrateToEncrypted(fernetEncryptor);

    expect(migrated).toBe(1);
    expect(aesManager.get('fernet-cred')).toBe('fernet-secret');
  });
});

describe('createCredentialManager with AES-256-GCM default', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    delete process.env.MARKTOFLOW_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    delete process.env.MARKTOFLOW_ENCRYPTION_KEY;
  });

  it('should default to AES-256-GCM backend', () => {
    const manager = createCredentialManager({ stateDir: tempDir });

    manager.set({ name: 'default-backend', value: 'test-value' });
    expect(manager.get('default-backend')).toBe('test-value');

    // Verify AES format (iv:authTag:ciphertext)
    const raw = manager.get('default-backend', false);
    expect(raw.split(':').length).toBe(3);
  });

  it('should still support explicit Fernet backend', () => {
    const manager = createCredentialManager({
      stateDir: tempDir,
      backend: EncryptionBackend.FERNET,
    });

    manager.set({ name: 'fernet-test', value: 'fernet-value' });
    expect(manager.get('fernet-test')).toBe('fernet-value');
  });

  it('should support explicit AES-256-GCM backend', () => {
    const manager = createCredentialManager({
      stateDir: tempDir,
      backend: EncryptionBackend.AES_256_GCM,
    });

    manager.set({ name: 'aes-explicit', value: 'aes-value' });
    expect(manager.get('aes-explicit')).toBe('aes-value');
  });

  it('should use passphrase when provided', () => {
    const manager = createCredentialManager({
      stateDir: tempDir,
      backend: EncryptionBackend.AES_256_GCM,
      passphrase: 'my-custom-passphrase',
    });

    manager.set({ name: 'passphrase-cred', value: 'passphrase-value' });
    expect(manager.get('passphrase-cred')).toBe('passphrase-value');
  });
});

describe('getAvailableBackends includes AES-256-GCM', () => {
  it('should include AES-256-GCM as first available backend', () => {
    const backends = getAvailableBackends();
    expect(backends).toContain(EncryptionBackend.AES_256_GCM);
    expect(backends[0]).toBe(EncryptionBackend.AES_256_GCM);
  });

  it('should still include Fernet', () => {
    const backends = getAvailableBackends();
    expect(backends).toContain(EncryptionBackend.FERNET);
  });
});

describe('KeyManager with AES-256-GCM', () => {
  let tempDir: string;
  let keyManager: KeyManager;

  beforeEach(() => {
    tempDir = createTempDir();
    keyManager = new KeyManager(tempDir);
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate and retrieve AES-256-GCM key', () => {
    const key = keyManager.generateAES256GCMKey('test');
    expect(key).toHaveLength(64);

    const retrieved = keyManager.getAES256GCMKey('test');
    expect(retrieved).toBe(key);
  });

  it('should return null for missing AES key', () => {
    expect(keyManager.getAES256GCMKey('nonexistent')).toBeNull();
  });

  it('should list AES-256-GCM keys', () => {
    keyManager.generateAES256GCMKey('mykey');
    const keys = keyManager.listKeys();
    const aesKeys = keys.filter((k) => k.type === 'aes-256-gcm');
    expect(aesKeys.length).toBe(1);
    expect(aesKeys[0].name).toBe('mykey');
  });

  it('should delete AES-256-GCM keys', () => {
    keyManager.generateAES256GCMKey('deleteme');
    expect(keyManager.getAES256GCMKey('deleteme')).not.toBeNull();

    const deleted = keyManager.deleteKey('deleteme');
    expect(deleted).toBe(true);
    expect(keyManager.getAES256GCMKey('deleteme')).toBeNull();
  });
});
