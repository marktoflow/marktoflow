import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WorkflowEngine } from '../src/engine.js';
import { SDKRegistry, createSDKStepExecutor } from '../src/sdk-registry.js';
import { SecretManager } from '../src/secret-providers/secret-manager.js';
import { EnvProvider } from '../src/secret-providers/providers/env.js';
import type { Workflow } from '../src/models.js';

describe('Secrets Integration Tests', () => {
  beforeAll(() => {
    // Setup environment variables for testing
    process.env.TEST_SLACK_TOKEN = 'xoxb-test-token-123';
    process.env.TEST_GITHUB_TOKEN = 'ghp_test_token_456';
    process.env.TEST_API_KEY = 'test-api-key-789';
  });

  afterAll(() => {
    // Cleanup
    delete process.env.TEST_SLACK_TOKEN;
    delete process.env.TEST_GITHUB_TOKEN;
    delete process.env.TEST_API_KEY;
  });

  it('should resolve environment variable secrets in workflow execution', async () => {
    // Create test workflow
    const workflow: Workflow = {
      metadata: {
        id: 'test-secrets',
        name: 'Test Secrets',
        version: '1.0.0',
      },
      tools: {
        test: {
          sdk: 'test-sdk',
          auth: {
            token: '${secret:env://TEST_SLACK_TOKEN}',
          },
        },
      },
      steps: [
        {
          id: 'step1',
          type: 'action',
          action: 'test.method',
          inputs: {
            message: 'test',
          },
          outputVariable: 'result',
        },
      ],
      permissions: {},
    };

    // Setup SecretManager
    const envProvider = new EnvProvider();
    const secretManager = new SecretManager({
      providers: [{ type: 'env', config: {}, cacheEnabled: true }],
    });
    secretManager.registerProvider('env', envProvider);
    await secretManager.initialize();

    // Track resolved auth config
    let resolvedAuth: any = null;

    // Create SDKRegistry with SecretManager
    const mockInitializers = {
      'test-sdk': {
        async initialize(_module: unknown, config: any) {
          resolvedAuth = config.auth;
          return {
            method: async () => ({ success: true }),
          };
        },
      },
    };

    const mockLoader = {
      async load() {
        return {};
      },
    };

    const sdkRegistry = new SDKRegistry(
      mockLoader,
      mockInitializers,
      undefined,
      secretManager
    );
    sdkRegistry.registerTools(workflow.tools || {});

    // Create engine and execute
    const engine = new WorkflowEngine();
    const stepExecutor = createSDKStepExecutor();

    const result = await engine.execute(
      workflow,
      {},
      sdkRegistry,
      stepExecutor
    );

    // Verify secret was resolved
    expect(resolvedAuth).toBeTruthy();
    expect(resolvedAuth.token).toBe('xoxb-test-token-123');
    expect(result.status).toBe('completed');
  });

  it('should handle multiple secret references in single tool config', async () => {
    const workflow: Workflow = {
      metadata: {
        id: 'test-multi-secrets',
        name: 'Test Multiple Secrets',
        version: '1.0.0',
      },
      tools: {
        test: {
          sdk: 'test-sdk',
          auth: {
            slack_token: '${secret:env://TEST_SLACK_TOKEN}',
            github_token: '${secret:env://TEST_GITHUB_TOKEN}',
            api_key: '${secret:env://TEST_API_KEY}',
          },
        },
      },
      steps: [
        {
          id: 'step1',
          type: 'action',
          action: 'test.check',
          inputs: { value: 'test' },
          outputVariable: 'result',
        },
      ],
      permissions: {},
    };

    // Setup SecretManager
    const envProvider = new EnvProvider();
    const secretManager = new SecretManager({
      providers: [{ type: 'env', config: {}, cacheEnabled: true }],
    });
    secretManager.registerProvider('env', envProvider);
    await secretManager.initialize();

    let resolvedAuth: any = null;
    const mockInitializers = {
      'test-sdk': {
        async initialize(_module: unknown, config: any) {
          resolvedAuth = config.auth;
          return {
            check: async () => ({ success: true }),
          };
        },
      },
    };

    const mockLoader = { async load() { return {}; } };
    const sdkRegistry = new SDKRegistry(mockLoader, mockInitializers, undefined, secretManager);
    sdkRegistry.registerTools(workflow.tools || {});

    const engine = new WorkflowEngine();
    const stepExecutor = createSDKStepExecutor();

    await engine.execute(workflow, {}, sdkRegistry, stepExecutor);

    // Verify all secrets were resolved
    expect(resolvedAuth.slack_token).toBe('xoxb-test-token-123');
    expect(resolvedAuth.github_token).toBe('ghp_test_token_456');
    expect(resolvedAuth.api_key).toBe('test-api-key-789');
  });

  it('should cache secrets with configurable TTL', async () => {
    const envProvider = new EnvProvider();
    const secretManager = new SecretManager({
      providers: [{ type: 'env', config: {}, cacheEnabled: true }],
      defaultCacheTTL: 2, // 2 seconds
    });
    secretManager.registerProvider('env', envProvider);
    await secretManager.initialize();

    // First fetch
    const secret1 = await secretManager.getSecret('${secret:env://TEST_SLACK_TOKEN}');
    expect(secret1.value).toBe('xoxb-test-token-123');

    // Change env var
    process.env.TEST_SLACK_TOKEN = 'xoxb-updated-token';

    // Second fetch (should be cached)
    const secret2 = await secretManager.getSecret('${secret:env://TEST_SLACK_TOKEN}');
    expect(secret2.value).toBe('xoxb-test-token-123'); // Still old value

    // Wait for cache to expire
    await new Promise((resolve) => setTimeout(resolve, 2100));

    // Third fetch (should get new value)
    const secret3 = await secretManager.getSecret('${secret:env://TEST_SLACK_TOKEN}');
    expect(secret3.value).toBe('xoxb-updated-token');

    // Restore original value
    process.env.TEST_SLACK_TOKEN = 'xoxb-test-token-123';
  });

  it('should work without secrets config in workflow', async () => {
    const workflow: Workflow = {
      metadata: {
        id: 'no-secrets',
        name: 'No Secrets Workflow',
        version: '1.0.0',
      },
      tools: {
        test: {
          sdk: 'test-sdk',
          auth: {
            token: 'plain-token',
          },
        },
      },
      steps: [
        {
          id: 'step1',
          type: 'action',
          action: 'test.method',
          inputs: { value: 'test' },
          outputVariable: 'result',
        },
      ],
      permissions: {},
    };

    let resolvedAuth: any = null;
    const mockInitializers = {
      'test-sdk': {
        async initialize(_module: unknown, config: any) {
          resolvedAuth = config.auth;
          return {
            method: async () => ({ success: true }),
          };
        },
      },
    };

    const mockLoader = { async load() { return {}; } };

    // No SecretManager provided
    const sdkRegistry = new SDKRegistry(mockLoader, mockInitializers);
    sdkRegistry.registerTools(workflow.tools || {});

    const engine = new WorkflowEngine();
    const stepExecutor = createSDKStepExecutor();

    await engine.execute(workflow, {}, sdkRegistry, stepExecutor);

    // Plain token should pass through unchanged
    expect(resolvedAuth.token).toBe('plain-token');
  });

  it('should handle secret not found errors gracefully when throwOnNotFound=false', async () => {
    const envProvider = new EnvProvider();
    const secretManager = new SecretManager({
      providers: [{ type: 'env', config: {}, cacheEnabled: true }],
      throwOnNotFound: false, // Don't throw on missing secrets
    });
    secretManager.registerProvider('env', envProvider);
    await secretManager.initialize();

    // Try to resolve non-existent secret
    const secret = await secretManager.getSecret('${secret:env://NONEXISTENT_VAR}');

    // Should return empty secret instead of throwing
    expect(secret.value).toBe('');
  });

  it('should throw error when secret not found and throwOnNotFound=true', async () => {
    const envProvider = new EnvProvider();
    const secretManager = new SecretManager({
      providers: [{ type: 'env', config: {}, cacheEnabled: true }],
      throwOnNotFound: true, // Throw on missing secrets
    });
    secretManager.registerProvider('env', envProvider);
    await secretManager.initialize();

    // Should throw error
    await expect(async () => {
      await secretManager.getSecret('${secret:env://NONEXISTENT_VAR}');
    }).rejects.toThrow('Secret not found');
  });

  it('should parse secret references correctly', () => {
    const secretManager = new SecretManager({
      providers: [{ type: 'env', config: {} }],
    });

    const ref1 = secretManager.parseReference('${secret:vault://path/to/secret}');
    expect(ref1.provider).toBe('vault');
    expect(ref1.path).toBe('path/to/secret');
    expect(ref1.key).toBeUndefined();

    const ref2 = secretManager.parseReference('${secret:aws://secret-name#key}');
    expect(ref2.provider).toBe('aws');
    expect(ref2.path).toBe('secret-name');
    expect(ref2.key).toBe('key');

    const ref3 = secretManager.parseReference('secret:azure://my-secret');
    expect(ref3.provider).toBe('azure');
    expect(ref3.path).toBe('my-secret');
  });

  it('should detect secret references correctly', () => {
    expect(SecretManager.isSecretReference('${secret:vault://path}')).toBe(true);
    expect(SecretManager.isSecretReference('secret:aws://name')).toBe(true);
    expect(SecretManager.isSecretReference('plain-text')).toBe(false);
    expect(SecretManager.isSecretReference('${PLAIN_VAR}')).toBe(false);
  });
});
