import { describe, it, expect } from 'vitest';
import { PluginManager, HookType } from '../src/plugins.js';

const testPlugin = {
  metadata: { name: 'test-plugin', version: '1.0.0' },
  getHooks() {
    return {
      [HookType.WORKFLOW_BEFORE_START]: [() => ({ success: true })],
    };
  },
};

describe('PluginManager', () => {
  it('registers and enables plugins', async () => {
    const manager = new PluginManager();
    manager.register(testPlugin, 'manual');
    const enabled = manager.enable('test-plugin');
    expect(enabled).toBe(true);

    const results = await manager.hooks().run(HookType.WORKFLOW_BEFORE_START, {
      hookType: HookType.WORKFLOW_BEFORE_START,
      data: {},
      timestamp: new Date(),
    });
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
  });
});
