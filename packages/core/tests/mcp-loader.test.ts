import { describe, it, expect, vi } from 'vitest';
import { McpLoader } from '../src/mcp-loader.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('McpLoader', () => {
  it('should load native module', async () => {
    // Create a real McpServer
    const mockServer = new McpServer({ name: 'test-server', version: '1.0.0' });
    
    // Mock module export
    const mockModule = {
      createMcpServer: vi.fn().mockResolvedValue(mockServer)
    };
    
    // Inject mock loader
    const loader = new McpLoader(async (name) => {
      if (name === 'test-mcp-module') return mockModule;
      throw new Error(`Module ${name} not found`);
    });

    const client = await loader.loadNative('test-mcp-module', { sdk: 'test-mcp-module' });

    expect(client).toBeDefined();
    expect(mockModule.createMcpServer).toHaveBeenCalled();
    
    // Clean up
    await client.close();
    await mockServer.close(); 
  });
});
