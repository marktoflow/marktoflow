import { describe, it, expect, vi } from 'vitest';
import { SDKRegistry } from '../src/sdk-registry.js';
import { McpLoader } from '../src/mcp-loader.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SecretManager } from '../src/secret-providers/secret-manager.js';
import { EnvProvider } from '../src/secret-providers/providers/env.js';

describe('SDKRegistry', () => {
  it('should load regular SDK', async () => {
    const mockSdk = { foo: 'bar' };
    const mockLoader = { load: vi.fn().mockResolvedValue(mockSdk) };
    const registry = new SDKRegistry(mockLoader);

    registry.registerTools({
      'mysdk': { sdk: 'my-package' }
    });

    const sdk = await registry.load('mysdk');
    expect(sdk).toEqual(mockSdk);
  });

  it('should load MCP module via proxy', async () => {
    // Mock module with createMcpServer
    const mockModule = { createMcpServer: () => {} };
    const mockLoader = { load: vi.fn().mockResolvedValue(mockModule) };
    
    // Mock McpLoader
    const mockMcpClient = { 
      callTool: vi.fn().mockResolvedValue({ content: 'result' }),
      close: vi.fn()
    } as unknown as Client;
    
    const mockMcpLoader = {
       connectModule: vi.fn().mockResolvedValue(mockMcpClient),
       loadNative: vi.fn()
    } as unknown as McpLoader;

    const registry = new SDKRegistry(mockLoader, {}, mockMcpLoader);

    registry.registerTools({
      'mymcp': { sdk: 'mcp-package' }
    });

    const sdk: any = await registry.load('mymcp');
    expect(mockMcpLoader.connectModule).toHaveBeenCalledWith(mockModule, expect.anything());
    
    // Test proxy
    const result = await sdk.toolName({ arg: 1 });
    expect(mockMcpClient.callTool).toHaveBeenCalledWith({
      name: 'toolName',
      arguments: { arg: 1 }
    });
    expect(result).toEqual({ content: 'result' });
    
    // Test close
    sdk.close();
    expect(mockMcpClient.close).toHaveBeenCalled();
  });

  it('should resolve secret references in auth config', async () => {
    // Setup environment variable
    process.env.TOKEN = 'my-secret-token';

    // Create SecretManager with EnvProvider (no prefix)
    const envProvider = new EnvProvider();
    const secretManager = new SecretManager({
      providers: [{ type: 'env', config: {}, cacheEnabled: true }],
    });
    secretManager.registerProvider('env', envProvider);
    await secretManager.initialize();

    // Mock SDK loader
    const mockSdk = { foo: 'bar' };
    const mockLoader = { load: vi.fn().mockResolvedValue(mockSdk) };

    // Mock initializer that captures the resolved config
    let capturedConfig: any = null;
    const mockInitializers = {
      'test-sdk': {
        async initialize(_module: unknown, config: any) {
          capturedConfig = config;
          return mockSdk;
        }
      }
    };

    const registry = new SDKRegistry(mockLoader, mockInitializers, undefined, secretManager);

    // Register tool with secret reference
    registry.registerTools({
      'mytool': {
        sdk: 'test-sdk',
        auth: {
          token: '${secret:env://TOKEN}'
        }
      }
    });

    // Load SDK
    await registry.load('mytool');

    // Verify secret was resolved
    expect(capturedConfig).toBeTruthy();
    expect(capturedConfig.auth.token).toBe('my-secret-token');

    // Cleanup
    delete process.env.TOKEN;
  });

  it('should handle multiple secret references in config', async () => {
    // Setup environment variables
    process.env.MY_API_KEY = 'secret-key-123';
    process.env.MY_API_SECRET = 'secret-secret-456';

    // Create SecretManager with EnvProvider (no prefix)
    const envProvider = new EnvProvider();
    const secretManager = new SecretManager({
      providers: [{ type: 'env', config: {}, cacheEnabled: true }],
    });
    secretManager.registerProvider('env', envProvider);
    await secretManager.initialize();

    // Mock SDK loader and initializer
    const mockSdk = { foo: 'bar' };
    const mockLoader = { load: vi.fn().mockResolvedValue(mockSdk) };

    let capturedConfig: any = null;
    const mockInitializers = {
      'test-sdk': {
        async initialize(_module: unknown, config: any) {
          capturedConfig = config;
          return mockSdk;
        }
      }
    };

    const registry = new SDKRegistry(mockLoader, mockInitializers, undefined, secretManager);

    // Register tool with multiple secret references
    registry.registerTools({
      'mytool': {
        sdk: 'test-sdk',
        auth: {
          api_key: '${secret:env://MY_API_KEY}',
          api_secret: '${secret:env://MY_API_SECRET}',
          static_value: 'not-a-secret'
        }
      }
    });

    // Load SDK
    await registry.load('mytool');

    // Verify all secrets were resolved correctly
    expect(capturedConfig).toBeTruthy();
    expect(capturedConfig.auth.api_key).toBe('secret-key-123');
    expect(capturedConfig.auth.api_secret).toBe('secret-secret-456');
    expect(capturedConfig.auth.static_value).toBe('not-a-secret');

    // Cleanup
    delete process.env.MY_API_KEY;
    delete process.env.MY_API_SECRET;
  });

  it('should work without SecretManager when no secrets in config', async () => {
    const mockSdk = { foo: 'bar' };
    const mockLoader = { load: vi.fn().mockResolvedValue(mockSdk) };

    let capturedConfig: any = null;
    const mockInitializers = {
      'test-sdk': {
        async initialize(_module: unknown, config: any) {
          capturedConfig = config;
          return mockSdk;
        }
      }
    };

    // No SecretManager provided
    const registry = new SDKRegistry(mockLoader, mockInitializers);

    registry.registerTools({
      'mytool': {
        sdk: 'test-sdk',
        auth: {
          token: 'plain-token'
        }
      }
    });

    await registry.load('mytool');

    // Config should pass through unchanged
    expect(capturedConfig.auth.token).toBe('plain-token');
  });
});
