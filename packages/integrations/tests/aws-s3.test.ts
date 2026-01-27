import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, AWSS3Initializer, AWSS3Client } from '../src/index.js';

describe('AWS S3 Integration', () => {
  it('should register aws s3 initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: '@aws-sdk/client-s3',
      auth: {
        region: 'us-east-1',
        access_key_id: 'test_access_key',
        secret_access_key: 'test_secret_key',
      },
    };

    const result = AWSS3Initializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if region is missing', async () => {
    const config = {
      sdk: '@aws-sdk/client-s3',
      auth: {
        access_key_id: 'test_access_key',
        secret_access_key: 'test_secret_key',
      },
    };

    await expect(AWSS3Initializer.initialize({}, config)).rejects.toThrow('region');
  });

  it('should throw if access_key_id is missing', async () => {
    const config = {
      sdk: '@aws-sdk/client-s3',
      auth: {
        region: 'us-east-1',
        secret_access_key: 'test_secret_key',
      },
    };

    await expect(AWSS3Initializer.initialize({}, config)).rejects.toThrow('access_key_id');
  });

  it('should throw if secret_access_key is missing', async () => {
    const config = {
      sdk: '@aws-sdk/client-s3',
      auth: {
        region: 'us-east-1',
        access_key_id: 'test_access_key',
      },
    };

    await expect(AWSS3Initializer.initialize({}, config)).rejects.toThrow('secret_access_key');
  });

  it('should create AWSS3Client', async () => {
    const config = {
      sdk: '@aws-sdk/client-s3',
      auth: {
        region: 'us-east-1',
        access_key_id: 'test_access_key',
        secret_access_key: 'test_secret_key',
      },
    };

    const result = await AWSS3Initializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: AWSS3Client }).client).toBeInstanceOf(AWSS3Client);
  });
});
