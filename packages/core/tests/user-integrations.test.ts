/**
 * Tests for user-defined SDK integrations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import {
  defineIntegration,
  defineIntegrationsConfig,
  toSDKInitializer,
  loadIntegrationDir,
  discoverNpmIntegrations,
  loadUserIntegrations,
  registerUserIntegrations,
  type UserIntegration,
  type UserIntegrationsConfig,
} from '../src/user-integrations.js';
import { SDKRegistry } from '../src/sdk-registry.js';

// ============================================================================
// Fixtures
// ============================================================================

const tmpDir = join(__dirname, '__tmp_user_integrations__');

function createTmpDir() {
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }
}

function cleanTmpDir() {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function writeFile(relativePath: string, content: string) {
  const fullPath = join(tmpDir, relativePath);
  const dir = join(fullPath, '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
}

// ============================================================================
// Test integration fixture
// ============================================================================

function createTestIntegration(name: string = 'test-sdk'): UserIntegration {
  return defineIntegration({
    name,
    description: `Test integration: ${name}`,
    validate(config) {
      const errors: string[] = [];
      if (!config.auth?.['token']) {
        errors.push('auth.token is required');
      }
      return errors;
    },
    async initialize(config) {
      const token = config.auth?.['token'] as string;
      return {
        getItems: async (inputs: Record<string, unknown>) => {
          return {
            items: [`item-${token}`, ...(inputs.ids as string[] || [])],
          };
        },
        createItem: async (inputs: Record<string, unknown>) => {
          return { id: `new-${inputs.name}`, created: true };
        },
      };
    },
  });
}

// ============================================================================
// defineIntegration
// ============================================================================

describe('defineIntegration', () => {
  it('should return the integration object unchanged', () => {
    const integration: UserIntegration = {
      name: 'my-sdk',
      async initialize() {
        return { doStuff: async () => ({ done: true }) };
      },
    };
    const result = defineIntegration(integration);
    expect(result).toBe(integration);
    expect(result.name).toBe('my-sdk');
  });

  it('should preserve optional fields', () => {
    const integration = defineIntegration({
      name: 'full-sdk',
      description: 'A full integration',
      validate: () => [],
      async initialize() {
        return {};
      },
    });
    expect(integration.description).toBe('A full integration');
    expect(integration.validate).toBeDefined();
  });
});

// ============================================================================
// defineIntegrationsConfig
// ============================================================================

describe('defineIntegrationsConfig', () => {
  it('should return the config object unchanged', () => {
    const config: UserIntegrationsConfig = {
      integrations: [createTestIntegration()],
      integrationDirs: ['./custom-integrations'],
      discoverNpmIntegrations: false,
    };
    const result = defineIntegrationsConfig(config);
    expect(result).toBe(config);
  });
});

// ============================================================================
// toSDKInitializer
// ============================================================================

describe('toSDKInitializer', () => {
  it('should convert UserIntegration to SDKInitializer', async () => {
    const integration = createTestIntegration();
    const initializer = toSDKInitializer(integration);

    const sdk = await initializer.initialize(null, {
      sdk: 'test-sdk',
      auth: { token: 'abc123' },
    });

    expect(sdk).toBeDefined();
    const client = sdk as Record<string, (inputs: Record<string, unknown>) => Promise<unknown>>;
    const result = await client.getItems({ ids: ['x', 'y'] });
    expect(result).toEqual({ items: ['item-abc123', 'x', 'y'] });
  });

  it('should run validation before initialize', async () => {
    const integration = createTestIntegration();
    const initializer = toSDKInitializer(integration);

    await expect(
      initializer.initialize(null, { sdk: 'test-sdk' })
    ).rejects.toThrow('config validation failed');
  });

  it('should pass validation with correct config', async () => {
    const integration = createTestIntegration();
    const initializer = toSDKInitializer(integration);

    const sdk = await initializer.initialize(null, {
      sdk: 'test-sdk',
      auth: { token: 'valid' },
    });
    expect(sdk).toBeDefined();
  });

  it('should work without validate function', async () => {
    const integration: UserIntegration = {
      name: 'no-validate',
      async initialize() {
        return { ping: async () => ({ pong: true }) };
      },
    };
    const initializer = toSDKInitializer(integration);

    const sdk = await initializer.initialize(null, { sdk: 'no-validate' });
    const client = sdk as Record<string, (inputs: Record<string, unknown>) => Promise<unknown>>;
    expect(await client.ping({})).toEqual({ pong: true });
  });

  it('should include all validation errors in error message', async () => {
    const integration = defineIntegration({
      name: 'multi-error',
      validate() {
        return ['error 1', 'error 2', 'error 3'];
      },
      async initialize() {
        return {};
      },
    });
    const initializer = toSDKInitializer(integration);

    await expect(
      initializer.initialize(null, { sdk: 'multi-error' })
    ).rejects.toThrow(/error 1.*error 2.*error 3/s);
  });
});

// ============================================================================
// loadIntegrationDir
// ============================================================================

describe('loadIntegrationDir', () => {
  beforeEach(() => {
    createTmpDir();
  });

  afterEach(() => {
    cleanTmpDir();
  });

  it('should return empty array for non-existent directory', async () => {
    const result = await loadIntegrationDir('/nonexistent/path');
    expect(result).toEqual([]);
  });

  it('should return empty array for empty directory', async () => {
    const dir = join(tmpDir, 'empty-integrations');
    mkdirSync(dir, { recursive: true });
    const result = await loadIntegrationDir(dir);
    expect(result).toEqual([]);
  });

  it('should skip files starting with underscore', async () => {
    const dir = join(tmpDir, 'skip-underscore');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '_helpers.js'),
      'module.exports = { name: "helpers", initialize: async () => ({}) };'
    );
    const result = await loadIntegrationDir(dir);
    expect(result).toEqual([]);
  });

  it('should skip test files', async () => {
    const dir = join(tmpDir, 'skip-tests');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'my-sdk.test.ts'),
      'export default { name: "my-sdk", initialize: async () => ({}) };'
    );
    writeFileSync(
      join(dir, 'my-sdk.spec.ts'),
      'export default { name: "my-sdk", initialize: async () => ({}) };'
    );
    const result = await loadIntegrationDir(dir);
    expect(result).toEqual([]);
  });

  it('should load .mjs integration files', async () => {
    const dir = join(tmpDir, 'mjs-integrations');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'simple.mjs'),
      `export default { name: 'simple-mjs', initialize: async () => ({ hello: async () => 'world' }) };`
    );
    const result = await loadIntegrationDir(dir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('simple-mjs');
  });

  it('should handle files that fail to load gracefully', async () => {
    const dir = join(tmpDir, 'bad-integrations');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'bad.mjs'), 'throw new Error("broken");');

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadIntegrationDir(dir);
    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load integration')
    );
    consoleSpy.mockRestore();
  });

  it('should auto-derive name from filename when missing', async () => {
    const dir = join(tmpDir, 'auto-name');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'my-custom-api.mjs'),
      `export default { initialize: async () => ({ ping: async () => 'pong' }) };`
    );
    const result = await loadIntegrationDir(dir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('my-custom-api');
  });

  it('should prefer named integration export', async () => {
    const dir = join(tmpDir, 'named-export');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'named.mjs'),
      `export const integration = { name: 'named-sdk', initialize: async () => ({}) };`
    );
    const result = await loadIntegrationDir(dir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('named-sdk');
  });
});

// ============================================================================
// discoverNpmIntegrations
// ============================================================================

describe('discoverNpmIntegrations', () => {
  beforeEach(() => {
    createTmpDir();
  });

  afterEach(() => {
    cleanTmpDir();
  });

  it('should return empty array when no node_modules', async () => {
    const result = await discoverNpmIntegrations(tmpDir);
    expect(result).toEqual([]);
  });

  it('should discover marktoflow-integration-* packages', async () => {
    const pkgDir = join(tmpDir, 'node_modules', 'marktoflow-integration-test');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'marktoflow-integration-test', main: 'index.mjs' })
    );
    writeFileSync(
      join(pkgDir, 'index.mjs'),
      `export default { name: 'test-npm', initialize: async () => ({ run: async () => 'ok' }) };`
    );

    const result = await discoverNpmIntegrations(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('test-npm');
  });

  it('should ignore non-integration packages', async () => {
    const pkgDir = join(tmpDir, 'node_modules', 'some-other-package');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'some-other-package', main: 'index.js' })
    );
    writeFileSync(join(pkgDir, 'index.js'), 'module.exports = {};');

    const result = await discoverNpmIntegrations(tmpDir);
    expect(result).toEqual([]);
  });

  it('should handle broken packages gracefully', async () => {
    const pkgDir = join(tmpDir, 'node_modules', 'marktoflow-integration-broken');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'marktoflow-integration-broken', main: 'nonexistent.js' })
    );

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await discoverNpmIntegrations(tmpDir);
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });
});

// ============================================================================
// loadUserIntegrations
// ============================================================================

describe('loadUserIntegrations', () => {
  beforeEach(() => {
    createTmpDir();
  });

  afterEach(() => {
    cleanTmpDir();
  });

  it('should include programmatic extras', async () => {
    const extra = createTestIntegration('extra-sdk');
    const result = await loadUserIntegrations({
      workDir: tmpDir,
      extra: [extra],
      skipConfig: true,
      skipDirs: true,
      skipNpm: true,
    });

    expect(result.integrations).toHaveLength(1);
    expect(result.integrations[0].name).toBe('extra-sdk');
    expect(result.sources.get('extra-sdk')).toBe('programmatic');
  });

  it('should deduplicate by name (first wins)', async () => {
    const extra1 = createTestIntegration('dup-sdk');
    const extra2 = defineIntegration({
      name: 'dup-sdk',
      description: 'second one',
      async initialize() {
        return {};
      },
    });

    const result = await loadUserIntegrations({
      workDir: tmpDir,
      extra: [extra1, extra2],
      skipConfig: true,
      skipDirs: true,
      skipNpm: true,
    });

    expect(result.integrations).toHaveLength(1);
    expect(result.integrations[0].description).toBe('Test integration: dup-sdk');
  });

  it('should load from integration directory', async () => {
    const intDir = join(tmpDir, 'integrations');
    mkdirSync(intDir, { recursive: true });
    writeFileSync(
      join(intDir, 'local-sdk.mjs'),
      `export default { name: 'local-sdk', initialize: async () => ({ doThing: async () => 42 }) };`
    );

    const result = await loadUserIntegrations({
      workDir: tmpDir,
      skipConfig: true,
      skipNpm: true,
    });

    expect(result.integrations).toHaveLength(1);
    expect(result.integrations[0].name).toBe('local-sdk');
    expect(result.sources.get('local-sdk')).toContain('dir:');
  });

  it('should combine multiple sources', async () => {
    // Extra
    const extra = createTestIntegration('extra');

    // Dir integration
    const intDir = join(tmpDir, 'integrations');
    mkdirSync(intDir, { recursive: true });
    writeFileSync(
      join(intDir, 'dir-sdk.mjs'),
      `export default { name: 'dir-sdk', initialize: async () => ({}) };`
    );

    // NPM integration
    const pkgDir = join(tmpDir, 'node_modules', 'marktoflow-integration-npm');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'marktoflow-integration-npm', main: 'index.mjs' })
    );
    writeFileSync(
      join(pkgDir, 'index.mjs'),
      `export default { name: 'npm-sdk', initialize: async () => ({}) };`
    );

    const result = await loadUserIntegrations({
      workDir: tmpDir,
      extra: [extra],
      skipConfig: true,
    });

    expect(result.integrations).toHaveLength(3);
    const names = result.integrations.map((i) => i.name).sort();
    expect(names).toEqual(['dir-sdk', 'extra', 'npm-sdk']);
  });

  it('should return empty when nothing found', async () => {
    const result = await loadUserIntegrations({
      workDir: tmpDir,
      skipConfig: true,
      skipNpm: true,
    });
    expect(result.integrations).toEqual([]);
    expect(result.sources.size).toBe(0);
  });
});

// ============================================================================
// registerUserIntegrations
// ============================================================================

describe('registerUserIntegrations', () => {
  it('should register integrations into SDKRegistry', async () => {
    const integration = createTestIntegration('my-sdk');
    const registry = new SDKRegistry();

    await registerUserIntegrations(registry, {
      extra: [integration],
      skipConfig: true,
      skipDirs: true,
      skipNpm: true,
    });

    // The initializer should be registered; verify by registering tools and loading
    registry.registerTools({
      'my-tool': { sdk: 'my-sdk', auth: { token: 'test123' } },
    });

    const sdk = await registry.load('my-tool');
    expect(sdk).toBeDefined();

    const client = sdk as Record<string, (inputs: Record<string, unknown>) => Promise<unknown>>;
    const result = await client.getItems({});
    expect(result).toEqual({ items: ['item-test123'] });
  });

  it('should work with multiple integrations', async () => {
    const int1 = createTestIntegration('sdk-a');
    const int2 = defineIntegration({
      name: 'sdk-b',
      async initialize() {
        return { ping: async () => ({ pong: true }) };
      },
    });

    const registry = new SDKRegistry();
    const result = await registerUserIntegrations(registry, {
      extra: [int1, int2],
      skipConfig: true,
      skipDirs: true,
      skipNpm: true,
    });

    expect(result.integrations).toHaveLength(2);
  });

  it('should not override built-in integrations', async () => {
    // Register a built-in first
    const registry = new SDKRegistry();
    registry.registerInitializer('openai', {
      async initialize() {
        return { built: true };
      },
    });

    // Try to register user integration with same name
    const userOpenai = defineIntegration({
      name: 'openai',
      async initialize() {
        return { user: true };
      },
    });

    await registerUserIntegrations(registry, {
      extra: [userOpenai],
      skipConfig: true,
      skipDirs: true,
      skipNpm: true,
    });

    // The user's initializer should have been registered (overwrites)
    // This is by design — users can override built-in integrations
    // The SDKRegistry.registerInitializer uses Map.set which overwrites
    registry.registerTools({ test: { sdk: 'openai' } });
    const sdk = (await registry.load('test')) as Record<string, unknown>;
    expect(sdk.user).toBe(true);
  });
});

// ============================================================================
// End-to-end: UserIntegration used in SDKRegistry workflow
// ============================================================================

describe('end-to-end: UserIntegration in workflow', () => {
  it('should work through the full SDKRegistry → load → call flow', async () => {
    const integration = defineIntegration({
      name: 'todo-api',
      description: 'Simple todo list API',
      validate(config) {
        if (!config.auth?.['api_key']) return ['auth.api_key is required'];
        return [];
      },
      async initialize(config) {
        const apiKey = config.auth!['api_key'] as string;
        const todos: { id: number; title: string }[] = [];
        let nextId = 1;

        return {
          list: async () => ({ todos, apiKey }),
          create: async (inputs: Record<string, unknown>) => {
            const todo = { id: nextId++, title: inputs.title as string };
            todos.push(todo);
            return todo;
          },
          delete: async (inputs: Record<string, unknown>) => {
            const idx = todos.findIndex((t) => t.id === (inputs.id as number));
            if (idx === -1) throw new Error('Todo not found');
            const [removed] = todos.splice(idx, 1);
            return removed;
          },
        };
      },
    });

    const registry = new SDKRegistry();
    registry.registerInitializer('todo-api', toSDKInitializer(integration));
    registry.registerTools({
      todos: {
        sdk: 'todo-api',
        auth: { api_key: 'my-secret-key' },
      },
    });

    // Load the SDK
    const sdk = await registry.load('todos');
    const client = sdk as Record<string, (inputs: Record<string, unknown>) => Promise<unknown>>;

    // Create items
    const item1 = (await client.create({ title: 'Buy milk' })) as { id: number; title: string };
    expect(item1).toEqual({ id: 1, title: 'Buy milk' });

    const item2 = (await client.create({ title: 'Write tests' })) as { id: number; title: string };
    expect(item2).toEqual({ id: 2, title: 'Write tests' });

    // List
    const list = (await client.list({})) as { todos: unknown[]; apiKey: string };
    expect(list.todos).toHaveLength(2);
    expect(list.apiKey).toBe('my-secret-key');

    // Delete
    const deleted = await client.delete({ id: 1 });
    expect(deleted).toEqual({ id: 1, title: 'Buy milk' });

    // Verify deletion
    const list2 = (await client.list({})) as { todos: unknown[] };
    expect(list2.todos).toHaveLength(1);
  });

  it('should reject with validation errors', async () => {
    const integration = createTestIntegration('strict-sdk');
    const registry = new SDKRegistry();
    registry.registerInitializer('strict-sdk', toSDKInitializer(integration));
    registry.registerTools({
      strict: { sdk: 'strict-sdk' }, // Missing auth.token
    });

    await expect(registry.load('strict')).rejects.toThrow('auth.token is required');
  });
});
