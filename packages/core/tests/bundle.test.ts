import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkflowBundle } from '../src/bundle.js';


describe('WorkflowBundle', () => {
  it('merges bundle script tools into workflow.tools', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
    const toolsDir = join(dir, 'tools');
    mkdirSync(toolsDir, { recursive: true });

    // Script tool and its optional yaml
    writeFileSync(join(toolsDir, 'echo.sh'), '#!/bin/sh\necho "{}"\n');
    writeFileSync(
      join(toolsDir, 'echo.yaml'),
      'operations:\n  run:\n    description: Echo\n'
    );

    // Simple workflow
    writeFileSync(
      join(dir, 'workflow.md'),
      `---\nworkflow:\n  id: test\n  name: Test\nsteps:\n  - id: s1\n    action: echo.run\n    inputs:\n      message: "hi"\n---\n\n# Test\n`
    );

    const bundle = new WorkflowBundle(dir);
    const workflow = await bundle.loadWorkflowWithBundleTools();

    expect(workflow.tools).toBeDefined();
    expect(workflow.tools?.echo).toBeDefined();
    expect(workflow.tools?.echo.sdk).toBe('script');
  });
});
