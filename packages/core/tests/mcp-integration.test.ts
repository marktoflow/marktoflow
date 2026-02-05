/**
 * MCP Integration Test - Full End-to-End Test with Real MCP Server
 */
import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpLoader } from '../src/mcp-loader.js';
import { MCPTool } from '../src/tools/mcp-tool.js';
import { ToolType } from '../src/tool-base.js';
import { parseContent } from '../src/parser.js';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

describe('MCP Integration - End-to-End', () => {
  it('should connect to real MCP server and execute tool', async () => {
    // Create a real MCP server with tools
    const server = new McpServer({
      name: 'test-calculator',
      version: '1.0.0',
    });

    // Use Zod schemas for proper type validation
    const addSchema = z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    });

    const multiplySchema = z.object({
      x: z.number().describe('First number'),
      y: z.number().describe('Second number'),
    });

    // Add tools using registerTool with proper schemas
    server.registerTool('add', {
      description: 'Add two numbers',
      inputSchema: addSchema,
    }, async (args) => {
      const sum = args.a + args.b;
      return {
        content: [{
          type: 'text' as const,
          text: `Result: ${sum}`
        }]
      };
    });

    server.registerTool('multiply', {
      description: 'Multiply two numbers',
      inputSchema: multiplySchema,
    }, async (args) => {
      const product = args.x * args.y;
      return {
        content: [{
          type: 'text' as const,
          text: `Result: ${product}`
        }]
      };
    });

    // Mock module that exports the server
    const mockModule = {
      createMcpServer: () => server,
    };

    // Load the module via McpLoader
    const loader = new McpLoader(async (name) => {
      if (name === 'test-calculator') return mockModule;
      throw new Error(`Module ${name} not found`);
    });

    const client = await loader.loadNative('test-calculator', { sdk: 'test-calculator' });

    // List available tools
    const tools = await client.listTools();
    expect(tools).toBeDefined();
    expect(tools.tools).toHaveLength(2);
    expect(tools.tools.map((t: any) => t.name)).toContain('add');
    expect(tools.tools.map((t: any) => t.name)).toContain('multiply');

    // Call the add tool
    const addResult = await client.callTool({
      name: 'add',
      arguments: { a: 5, b: 3 },
    });
    expect((addResult as any).content[0].text).toBe('Result: 8');

    // Call the multiply tool
    const multiplyResult = await client.callTool({
      name: 'multiply',
      arguments: { x: 4, y: 7 },
    });
    expect((multiplyResult as any).content[0].text).toBe('Result: 28');

    // Clean up
    await client.close();
    await server.close();
  });

  it('should use MCPTool in workflow engine', async () => {
    // Create MCP server
    const server = new McpServer({
      name: 'test-greeter',
      version: '1.0.0',
    });

    const greetSchema = z.object({
      name: z.string().describe('Name of person to greet'),
    });

    server.registerTool('greet', {
      description: 'Greet a person',
      inputSchema: greetSchema,
    }, async (args) => {
      return {
        content: [{
          type: 'text' as const,
          text: `Hello, ${args.name}!`
        }]
      };
    });

    // Mock module
    const mockModule = {
      createMcpServer: () => server,
    };

    // Create MCPTool instance with proper mock loader injection
    const mockLoader = new McpLoader(async (name) => {
      if (name === 'test-greeter') return mockModule;
      throw new Error(`Module ${name} not found`);
    });

    const tool = new MCPTool(
      {
        name: 'greeter',
        implementations: [
          {
            type: ToolType.MCP,
            priority: 1,
            packageName: 'test-greeter',
          },
        ],
      },
      {
        type: ToolType.MCP,
        priority: 1,
        packageName: 'test-greeter',
      }
    );

    // Inject mock loader before initialization
    (tool as any).loader = mockLoader;

    // Initialize the tool - this should now work
    await tool.initialize();

    // Check operations are loaded
    const operations = tool.listOperations();
    expect(operations.length).toBeGreaterThan(0);
    expect(operations).toContain('greet');

    // Execute the tool
    const result = await tool.execute('greet', { name: 'Alice' });
    expect(result).toBeDefined();
    expect((result as any).content[0].text).toBe('Hello, Alice!');

    // Clean up
    if ((tool as any).client) {
      await (tool as any).client.close();
    }
    await server.close();
  });

  it('should run workflow with MCP tool integration', async () => {
    // Create MCP server with data transformation tools
    const server = new McpServer({
      name: 'test-transform',
      version: '1.0.0',
    });

    const textSchema = z.object({
      text: z.string().describe('Text to transform'),
    });

    server.registerTool('uppercase', {
      description: 'Convert text to uppercase',
      inputSchema: textSchema,
    }, async (args) => {
      return {
        content: [{
          type: 'text' as const,
          text: args.text.toUpperCase()
        }]
      };
    });

    server.registerTool('reverse', {
      description: 'Reverse text',
      inputSchema: textSchema,
    }, async (args) => {
      return {
        content: [{
          type: 'text' as const,
          text: args.text.split('').reverse().join('')
        }]
      };
    });

    // Create workflow YAML
    const workflowYaml = `---
workflow:
  id: test-mcp-workflow
  name: MCP Integration Test

tools:
  transformer:
    sdk: test-transform

inputs:
  input_text:
    type: string
    required: true
---

# MCP Integration Test Workflow

## Step 1: Transform to uppercase
\`\`\`yaml
action: transformer.uppercase
inputs:
  text: "{{ inputs.input_text }}"
output_variable: uppercase_result
\`\`\`

## Step 2: Reverse the text
\`\`\`yaml
action: transformer.reverse
inputs:
  text: "{{ inputs.input_text }}"
output_variable: reversed_result
\`\`\`
`;

    // Write workflow to temp file
    const tmpDir = mkdtempSync(join(tmpdir(), 'mcp-workflow-'));
    const workflowPath = join(tmpDir, 'workflow.md');
    writeFileSync(workflowPath, workflowYaml);

    // Parse workflow using the function export
    const parseResult = parseContent(workflowYaml);
    const workflow = parseResult.workflow;

    expect(workflow.metadata.id).toBe('test-mcp-workflow');
    expect(workflow.tools).toBeDefined();
    expect(workflow.tools?.transformer).toBeDefined();
    expect(workflow.tools?.transformer.sdk).toBe('test-transform');

    // Note: Full workflow execution with MCPTool would require
    // setting up the tool registry and engine with proper mocking.
    // This test validates parsing and structure.

    await server.close();
  });

  it('should handle MCP server errors gracefully', async () => {
    // Create MCP server that throws errors
    const server = new McpServer({
      name: 'test-error',
      version: '1.0.0',
    });

    server.registerTool('fail', {
      description: 'Always fails',
      inputSchema: z.object({}),
    }, async () => {
      throw new Error('Intentional failure');
    });

    const mockModule = {
      createMcpServer: () => server,
    };

    const loader = new McpLoader(async (name) => {
      if (name === 'test-error') return mockModule;
      throw new Error(`Module ${name} not found`);
    });

    const client = await loader.loadNative('test-error', { sdk: 'test-error' });

    // Try to call the failing tool - should get error result
    const result = await client.callTool({ name: 'fail', arguments: {} }) as any;

    // MCP servers return isError flag in result
    expect(result.isError).toBe(true);

    // Clean up
    await client.close();
    await server.close();
  });

  it('should load MCP tools dynamically from package', async () => {
    // Create a complex MCP server with multiple tool types
    const server = new McpServer({
      name: 'test-multi-tool',
      version: '1.0.0',
    });

    // Add various tools with proper Zod schemas
    server.registerTool('string.concat', {
      description: 'Concatenate strings',
      inputSchema: z.object({
        strings: z.array(z.string()).describe('Array of strings'),
      }),
    }, async (args) => {
      return {
        content: [{
          type: 'text' as const,
          text: args.strings.join('')
        }]
      };
    });

    server.registerTool('math.sum', {
      description: 'Sum numbers',
      inputSchema: z.object({
        numbers: z.array(z.number()).describe('Array of numbers'),
      }),
    }, async (args) => {
      const sum = args.numbers.reduce((a, b) => a + b, 0);
      return {
        content: [{
          type: 'text' as const,
          text: sum.toString()
        }]
      };
    });

    server.registerTool('data.filter', {
      description: 'Filter array by predicate',
      inputSchema: z.object({
        array: z.array(z.any()).describe('Array to filter'),
        field: z.string().describe('Field to check'),
        value: z.any().describe('Value to match'),
      }),
    }, async (args) => {
      const filtered = args.array.filter((item: any) => item[args.field] === args.value);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(filtered)
        }]
      };
    });

    const mockModule = {
      createMcpServer: () => server,
    };

    const mockLoader = new McpLoader(async (name) => {
      if (name === 'test-multi-tool') return mockModule;
      throw new Error(`Module ${name} not found`);
    });

    const tool = new MCPTool(
      {
        name: 'multi-tool',
        implementations: [
          {
            type: ToolType.MCP,
            priority: 1,
            packageName: 'test-multi-tool',
          },
        ],
      },
      {
        type: ToolType.MCP,
        priority: 1,
        packageName: 'test-multi-tool',
      }
    );

    // Inject mock loader before initialization
    (tool as any).loader = mockLoader;

    await tool.initialize();

    // Verify all tools are loaded
    const operations = tool.listOperations();
    expect(operations.length).toBe(3);
    expect(operations).toContain('string.concat');
    expect(operations).toContain('math.sum');
    expect(operations).toContain('data.filter');

    // Test string concatenation
    const concatResult = await tool.execute('string.concat', {
      strings: ['Hello', ' ', 'World', '!'],
    });
    expect((concatResult as any).content[0].text).toBe('Hello World!');

    // Test math sum
    const sumResult = await tool.execute('math.sum', {
      numbers: [1, 2, 3, 4, 5],
    });
    expect((sumResult as any).content[0].text).toBe('15');

    // Test data filtering
    const filterResult = await tool.execute('data.filter', {
      array: [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 30 },
      ],
      field: 'age',
      value: 30,
    });
    const filtered = JSON.parse((filterResult as any).content[0].text);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].name).toBe('Alice');
    expect(filtered[1].name).toBe('Charlie');

    // Clean up
    if ((tool as any).client) {
      await (tool as any).client.close();
    }
    await server.close();
  });
});
