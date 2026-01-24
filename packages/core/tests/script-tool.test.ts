import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScriptTool } from '../src/script-tool.js';
import { writeFileSync, unlinkSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ScriptTool', () => {
  const tempScript = join(tmpdir(), 'test-script.sh');
  const tempYaml = join(tmpdir(), 'test-script.yaml');

  beforeEach(() => {
    // Create a simple bash script that echoes arguments as JSON
    // We use single quotes for the outer string to preserve double quotes inside
    const scriptContent = `#!/bin/bash
echo '{"args": "'$*'", "status": "ok"}'
`;
    writeFileSync(tempScript, scriptContent);
    chmodSync(tempScript, 0o755);
  });

  afterEach(() => {
    try { unlinkSync(tempScript); } catch {}
    try { unlinkSync(tempYaml); } catch {}
  });

  it('should execute a simple script and parse JSON output', async () => {
    const tool = new ScriptTool(tempScript);
    const result = await tool.execute('run', { foo: 'bar', baz: 123 });

    expect(result.status).toBe('ok');
    expect(result.args).toContain('--foo=bar');
    expect(result.args).toContain('--baz=123');
  });

  it('should handle multi-operation scripts via YAML metadata', async () => {
    const yamlContent = `
operations:
  test_op:
    description: "A test operation"
    timeout: 10
`;
    writeFileSync(tempYaml, yamlContent);

    const tool = new ScriptTool(tempScript);
    const result = await tool.execute('test_op', { key: 'value' });

    expect(result.args).toContain('test_op');
    expect(result.args).toContain('--key=value');
  });

  it('should handle non-JSON output', async () => {
    const scriptContent = `#!/bin/bash
echo "just some text"
`;
    writeFileSync(tempScript, scriptContent);
    
    const tool = new ScriptTool(tempScript);
    const result = await tool.execute('run', {});

    expect(result).toBe('just some text');
  });
});
