import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MCPTool } from '../src/tools/mcp-tool.js';
import { ToolType } from '../src/tool-base.js';


describe('MCPTool', () => {
  it('loads tools from spec file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-tool-'));
    const specPath = join(dir, 'tools.yaml');
    writeFileSync(
      specPath,
      `tools:\n  - name: echo\n    description: Echo text\n    input_schema:\n      type: object\n      properties:\n        text:\n          type: string\n`
    );

    const tool = new MCPTool(
      {
        name: 'mcp-test',
        implementations: [
          {
            type: ToolType.MCP,
            priority: 1,
            specPath,
          },
        ],
      },
      {
        type: ToolType.MCP,
        priority: 1,
        specPath,
      }
    );

    await tool.initialize();

    expect(tool.listOperations()).toEqual(['echo']);
    const schema = tool.getOperationSchema('echo') as any;
    expect(schema.parameters.type).toBe('object');
  });
});
