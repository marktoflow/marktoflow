/**
 * core.crypto — Cryptographic operations (hash, hmac, random, encrypt, decrypt).
 */

export function executeCrypto(inputs: Record<string, unknown>): unknown {
  const { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
  const operation = inputs.operation as string;
  const data = inputs.data as string;

  switch (operation) {
    case 'hash': {
      const algorithm = (inputs.algorithm as string) ?? 'sha256';
      const encoding = (inputs.encoding as string) ?? 'hex';
      return createHash(algorithm).update(data).digest(encoding);
    }
    case 'hmac': {
      const algorithm = (inputs.algorithm as string) ?? 'sha256';
      const key = inputs.key as string;
      const encoding = (inputs.encoding as string) ?? 'hex';
      if (!key) throw new Error('core.crypto: key required for hmac');
      return createHmac(algorithm, key).update(data).digest(encoding);
    }
    case 'random': {
      const size = (inputs.size as number) ?? 32;
      const encoding = (inputs.encoding as string) ?? 'hex';
      return randomBytes(size).toString(encoding);
    }
    case 'encrypt': {
      const key = inputs.key as string;
      const algorithm = (inputs.algorithm as string) ?? 'aes-256-gcm';
      if (!key) throw new Error('core.crypto: key required for encrypt');
      const keyBuf = Buffer.from(key, 'hex');
      const iv = randomBytes(16);
      const cipher = createCipheriv(algorithm, keyBuf, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = algorithm.includes('gcm') ? cipher.getAuthTag().toString('hex') : '';
      return { encrypted, iv: iv.toString('hex'), authTag };
    }
    case 'decrypt': {
      const key = inputs.key as string;
      const algorithm = (inputs.algorithm as string) ?? 'aes-256-gcm';
      const encrypted = inputs.encrypted as string;
      const iv = inputs.iv as string;
      const authTag = inputs.authTag as string;
      if (!key || !encrypted || !iv) throw new Error('core.crypto: key, encrypted, iv required for decrypt');
      const keyBuf = Buffer.from(key, 'hex');
      const decipher = createDecipheriv(algorithm, keyBuf, Buffer.from(iv, 'hex'));
      if (algorithm.includes('gcm') && authTag) {
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      }
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    default:
      throw new Error(`core.crypto: unknown operation "${operation}"`);
  }
}
