/**
 * MCP Loader for marktoflow v2.0
 *
 * Handles loading and connection to MCP servers (both native/in-memory and stdio).
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolConfig } from "./models.js";

// Interface for Native MCP Modules
export interface McpModule {
  createMcpServer(config?: Record<string, unknown>): McpServer | Promise<McpServer>;
}

export type ModuleLoader = (name: string) => Promise<any>;

export class McpLoader {
  private moduleLoader: ModuleLoader;

  constructor(moduleLoader?: ModuleLoader) {
    this.moduleLoader = moduleLoader || ((name: string) => import(name));
  }

  /**
   * Connect to a loaded MCP module.
   */
  async connectModule(module: any, config: ToolConfig): Promise<Client> {
    // Check if it follows the Native MCP Module contract
    if (typeof module.createMcpServer !== 'function') {
      throw new Error(`Module does not export 'createMcpServer' function.`);
    }

    // Create the server instance
    const server: McpServer = await module.createMcpServer(config.options || {});
    
    // Create linked in-memory transports
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Connect server to transport
    await server.connect(serverTransport);

    // Create and connect client
    const client = new Client(
      { name: "marktoflow-core", version: "2.0.0" },
      { capabilities: {} }
    );
    await client.connect(clientTransport);

    return client;
  }

  /**
   * Load a native MCP module and connect to it in-memory.
   */
  async loadNative(packageName: string, config: ToolConfig): Promise<Client> {
    let module: any;
    try {
      // Dynamic import of the package
      module = await this.moduleLoader(packageName);
    } catch (error) {
       throw new Error(`Failed to import native MCP module '${packageName}': ${error}`);
    }

    return this.connectModule(module, config);
  }

  /**
   * Connect to an external MCP server via Stdio.
   */
  async connectStdio(command: string, args: string[]): Promise<Client> {
    const transport = new StdioClientTransport({
      command,
      args,
    });

    const client = new Client(
      { name: "marktoflow-core", version: "2.0.0" },
      { capabilities: {} }
    );
    
    await client.connect(transport);

    return client;
  }
}
