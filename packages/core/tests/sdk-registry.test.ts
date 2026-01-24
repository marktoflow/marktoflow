import { describe, it, expect, vi } from 'vitest';
import { SDKRegistry } from '../src/sdk-registry.js';
import { McpLoader } from '../src/mcp-loader.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

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
});
