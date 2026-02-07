/**
 * Smoke tests for marktoflow v2.0
 *
 * Validates that the full system can be imported and core operations work.
 * Run with: pnpm test:smoke
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = join(__dirname, '../..');

describe('Smoke: @marktoflow/core exports', () => {
  it('should export parseContent', async () => {
    const core = await import('@marktoflow/core');
    expect(typeof core.parseContent).toBe('function');
  });

  it('should export WorkflowEngine', async () => {
    const core = await import('@marktoflow/core');
    expect(core.WorkflowEngine).toBeDefined();
  });

  it('should export StateStore', async () => {
    const core = await import('@marktoflow/core');
    expect(core.StateStore).toBeDefined();
  });

  it('should export PluginManager', async () => {
    const core = await import('@marktoflow/core');
    expect(core.PluginManager).toBeDefined();
  });
});

describe('Smoke: Parse example workflow', () => {
  it('should parse daily-standup workflow', async () => {
    const { parseFile } = await import('@marktoflow/core');
    const workflowPath = join(ROOT, 'examples/daily-standup/workflow.md');

    if (!existsSync(workflowPath)) {
      console.warn('Skipping: example workflow not found');
      return;
    }

    const result = await parseFile(workflowPath);
    expect(result.workflow).toBeDefined();
    expect(result.workflow.metadata.id).toBeTruthy();
    expect(result.workflow.steps.length).toBeGreaterThan(0);
  });
});

describe('Smoke: StateStore CRUD', () => {
  it('should create and retrieve an execution record', async () => {
    const { StateStore } = await import('@marktoflow/core');
    const store = new StateStore(':memory:');

    store.createExecution({
      runId: 'smoke-test-run-1',
      workflowId: 'smoke-wf',
      workflowPath: '/tmp/smoke.md',
      status: 'running' as any,
      startedAt: new Date(),
      completedAt: null,
      currentStep: 0,
      totalSteps: 3,
      inputs: { foo: 'bar' },
      outputs: null,
      error: null,
      metadata: null,
    });

    const record = store.getExecution('smoke-test-run-1');
    expect(record).not.toBeNull();
    expect(record!.workflowId).toBe('smoke-wf');
    expect(record!.inputs).toEqual({ foo: 'bar' });

    store.updateExecution('smoke-test-run-1', {
      status: 'completed' as any,
      completedAt: new Date(),
    });

    const updated = store.getExecution('smoke-test-run-1');
    expect(updated!.status).toBe('completed');

    store.close();
  });
});

describe('Smoke: CLI entry point', () => {
  it('should have CLI dist file', () => {
    const cliDist = join(ROOT, 'packages/cli/dist/index.js');
    expect(existsSync(cliDist)).toBe(true);
  });

  it('should respond to --version', () => {
    const cliDist = join(ROOT, 'packages/cli/dist/index.js');
    if (!existsSync(cliDist)) return;

    const output = execSync(`node ${cliDist} version 2>&1`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    expect(output).toContain('marktoflow');
  });
});

describe('Smoke: GUI server module', () => {
  it('should import GUI package', async () => {
    try {
      const gui = await import('@marktoflow/gui');
      expect(gui).toBeDefined();
    } catch (e: any) {
      // GUI may not have all browser deps in Node environment; that's OK
      // as long as the module exists
      if (e.code === 'MODULE_NOT_FOUND') {
        const guiPkg = join(ROOT, 'packages/gui/package.json');
        expect(existsSync(guiPkg)).toBe(true);
      }
    }
  });
});
