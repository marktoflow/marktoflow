/**
 * User-defined SDK integrations for marktoflow.
 *
 * Allows users to register custom integrations via:
 * 1. marktoflow.integrations.ts/js — Config file with integrations array
 * 2. ./integrations/ directory — Auto-discovered local integration files
 * 3. NPM packages — marktoflow-integration-* packages auto-discovered
 *
 * Each integration implements the UserIntegration interface:
 *   { name, initialize, validate? }
 */

import { readdir, stat, access, readFile } from 'node:fs/promises';
import { resolve, join, basename, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SDKInitializer, type SDKRegistry } from './sdk-registry.js';
import type { ToolConfig } from './models.js';

// ============================================================================
// Types
// ============================================================================

/**
 * The interface users implement to create a custom integration.
 *
 * @example
 * ```ts
 * import { defineIntegration } from '@marktoflow/core';
 *
 * export default defineIntegration({
 *   name: 'my-api',
 *   initialize: async (config) => {
 *     const client = new MyApiClient({ apiKey: config.auth?.api_key });
 *     return {
 *       getUsers: (inputs) => client.getUsers(inputs),
 *       createUser: (inputs) => client.createUser(inputs),
 *     };
 *   },
 * });
 * ```
 */
export interface UserIntegration {
  /** Unique name used in workflow YAML `tools:` section and `action:` references */
  name: string;

  /** Human-readable description (shown in CLI list/help) */
  description?: string;

  /**
   * Initialize the integration and return an object whose methods
   * can be called via `action: "name.method"` in workflow steps.
   *
   * @param config - Tool configuration from the workflow's `tools:` section
   * @returns An object with callable async methods
   */
  initialize(config: ToolConfig): Promise<Record<string, (inputs: Record<string, unknown>) => Promise<unknown>>>;

  /**
   * Optional validation of config before initialization.
   * Return an array of error strings (empty = valid).
   */
  validate?(config: ToolConfig): string[];
}

/**
 * Configuration for user integrations loaded from marktoflow.integrations.ts/js.
 */
export interface UserIntegrationsConfig {
  /** Array of user-defined integrations */
  integrations?: UserIntegration[];

  /**
   * Paths to directories containing integration files.
   * Defaults to ['./integrations'] relative to config file location.
   */
  integrationDirs?: string[];

  /**
   * Whether to auto-discover marktoflow-integration-* npm packages.
   * Defaults to true.
   */
  discoverNpmIntegrations?: boolean;
}

// ============================================================================
// Helper: defineIntegration (type-safe factory)
// ============================================================================

/**
 * Type-safe helper to define a user integration.
 * Provides autocomplete and type checking without requiring manual type annotations.
 *
 * @example
 * ```ts
 * import { defineIntegration } from '@marktoflow/core';
 *
 * export default defineIntegration({
 *   name: 'weather-api',
 *   initialize: async (config) => ({
 *     getCurrent: async (inputs) => {
 *       const res = await fetch(`https://api.weather.com/current?city=${inputs.city}`);
 *       return res.json();
 *     },
 *   }),
 * });
 * ```
 */
export function defineIntegration(integration: UserIntegration): UserIntegration {
  return integration;
}

/**
 * Type-safe helper to define a marktoflow config file.
 */
export function defineIntegrationsConfig(config: UserIntegrationsConfig): UserIntegrationsConfig {
  return config;
}

// ============================================================================
// UserIntegration → SDKInitializer adapter
// ============================================================================

/**
 * Wraps a UserIntegration into the internal SDKInitializer interface
 * used by the SDKRegistry.
 */
export function toSDKInitializer(integration: UserIntegration): SDKInitializer {
  return {
    async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
      // Run validation if provided
      if (integration.validate) {
        const errors = integration.validate(config);
        if (errors.length > 0) {
          throw new Error(
            `Integration '${integration.name}' config validation failed:\n` +
              errors.map((e) => `  - ${e}`).join('\n')
          );
        }
      }
      return integration.initialize(config);
    },
  };
}

// ============================================================================
// Discovery: Config File
// ============================================================================

/** Supported config file names in priority order */
const CONFIG_FILE_NAMES = [
  'marktoflow.integrations.ts',
  'marktoflow.integrations.mts',
  'marktoflow.integrations.js',
  'marktoflow.integrations.mjs',
  'marktoflow.integrations.cjs',
];

/**
 * Find and load the marktoflow config file from the given directory.
 * Searches up from workDir to find the config file.
 *
 * @returns The loaded config and the directory it was found in, or null
 */
export async function loadIntegrationsConfig(
  workDir: string
): Promise<{ config: UserIntegrationsConfig; configDir: string } | null> {
  let dir = resolve(workDir);
  const root = resolve('/');

  while (dir !== root) {
    for (const name of CONFIG_FILE_NAMES) {
      const configPath = join(dir, name);
      try {
        await access(configPath);
        const mod = await importModule(configPath);
        const config = (mod.default ?? mod) as UserIntegrationsConfig;
        return { config, configDir: dir };
      } catch {
        // File doesn't exist or can't be loaded — try next
      }
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

// ============================================================================
// Discovery: Integration Directory
// ============================================================================

/**
 * Load all integration files from a directory.
 * Each file should export a UserIntegration (default or named `integration`).
 */
export async function loadIntegrationDir(dirPath: string): Promise<UserIntegration[]> {
  const integrations: UserIntegration[] = [];
  const resolvedDir = resolve(dirPath);

  try {
    const dirStat = await stat(resolvedDir);
    if (!dirStat.isDirectory()) return integrations;
  } catch {
    return integrations; // Directory doesn't exist
  }

  const entries = await readdir(resolvedDir);
  const integrationFiles = entries.filter((f) => {
    const ext = extname(f);
    return ['.ts', '.mts', '.js', '.mjs', '.cjs'].includes(ext) && !f.startsWith('_') && !f.endsWith('.test.ts') && !f.endsWith('.spec.ts');
  });

  for (const file of integrationFiles.sort()) {
    const filePath = join(resolvedDir, file);
    try {
      const mod = await importModule(filePath);
      const integration = extractIntegration(mod, file);
      if (integration) {
        integrations.push(integration);
      }
    } catch (error) {
      console.warn(
        `[marktoflow] Failed to load integration from ${filePath}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  return integrations;
}

// ============================================================================
// Discovery: NPM Packages
// ============================================================================

/**
 * Discover and load marktoflow-integration-* packages from node_modules.
 */
export async function discoverNpmIntegrations(workDir: string): Promise<UserIntegration[]> {
  const integrations: UserIntegration[] = [];
  const nodeModulesPath = join(resolve(workDir), 'node_modules');

  try {
    await access(nodeModulesPath);
  } catch {
    return integrations; // No node_modules
  }

  const entries = await readdir(nodeModulesPath);
  const integrationPackages = entries.filter((name) => name.startsWith('marktoflow-integration-'));

  for (const pkgName of integrationPackages.sort()) {
    try {
      const pkgJsonPath = join(nodeModulesPath, pkgName, 'package.json');
      const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
      const mainFile = pkgJson.main || pkgJson.exports?.['.'] || 'index.js';
      const entryPath = join(nodeModulesPath, pkgName, mainFile);

      const mod = await importModule(entryPath);
      const integration = extractIntegration(mod, pkgName);
      if (integration) {
        integrations.push(integration);
      }
    } catch (error) {
      console.warn(
        `[marktoflow] Failed to load npm integration '${pkgName}': ${error instanceof Error ? error.message : error}`
      );
    }
  }

  return integrations;
}

// ============================================================================
// Main: loadUserIntegrations
// ============================================================================

export interface LoadUserIntegrationsOptions {
  /** Working directory to search from */
  workDir?: string;
  /** Skip config file loading */
  skipConfig?: boolean;
  /** Skip directory scanning */
  skipDirs?: boolean;
  /** Skip npm package discovery */
  skipNpm?: boolean;
  /** Additional integrations to include (programmatic API) */
  extra?: UserIntegration[];
}

export interface LoadUserIntegrationsResult {
  /** All discovered integrations */
  integrations: UserIntegration[];
  /** Sources of each integration for debugging */
  sources: Map<string, string>;
}

/**
 * Load all user integrations from all sources.
 * Deduplicates by name (first occurrence wins).
 *
 * Priority order:
 * 1. `extra` (programmatic)
 * 2. Config file `integrations` array
 * 3. Integration directories
 * 4. NPM packages
 */
export async function loadUserIntegrations(
  options: LoadUserIntegrationsOptions = {}
): Promise<LoadUserIntegrationsResult> {
  const workDir = resolve(options.workDir ?? process.cwd());
  const seen = new Map<string, string>();
  const integrations: UserIntegration[] = [];

  function add(integration: UserIntegration, source: string): void {
    if (seen.has(integration.name)) return;
    seen.set(integration.name, source);
    integrations.push(integration);
  }

  // 1. Programmatic extras
  for (const integration of options.extra ?? []) {
    add(integration, 'programmatic');
  }

  // 2. Config file
  let configFound = false;
  if (!options.skipConfig) {
    const loaded = await loadIntegrationsConfig(workDir);
    if (loaded) {
      configFound = true;
      const configDir = loaded.configDir;
      for (const integration of loaded.config.integrations ?? []) {
        add(integration, `config:${join(configDir, 'marktoflow.integrations.*')}`);
      }

      // Use config-specified integration dirs (defaults to ['./integrations'])
      if (!options.skipDirs) {
        const dirs = loaded.config.integrationDirs ?? ['./integrations'];
        for (const dir of dirs) {
          const absDir = resolve(configDir, dir);
          const dirIntegrations = await loadIntegrationDir(absDir);
          for (const integration of dirIntegrations) {
            add(integration, `dir:${absDir}`);
          }
        }
      }

      // Respect npm discovery setting from config
      if (loaded.config.discoverNpmIntegrations === false) {
        options.skipNpm = true;
      }
    }
  }

  // 3. Default integration directory (only when no config file was found)
  if (!options.skipDirs && !configFound) {
    const defaultDir = join(workDir, 'integrations');
    const dirIntegrations = await loadIntegrationDir(defaultDir);
    for (const integration of dirIntegrations) {
      add(integration, `dir:${defaultDir}`);
    }
  }

  // 4. NPM packages
  if (!options.skipNpm) {
    const npmIntegrations = await discoverNpmIntegrations(workDir);
    for (const integration of npmIntegrations) {
      add(integration, `npm:marktoflow-integration-${integration.name}`);
    }
  }

  return { integrations, sources: seen };
}

/**
 * Register all discovered user integrations into an SDKRegistry.
 */
export async function registerUserIntegrations(
  registry: SDKRegistry,
  options: LoadUserIntegrationsOptions = {}
): Promise<LoadUserIntegrationsResult> {
  const result = await loadUserIntegrations(options);

  for (const integration of result.integrations) {
    registry.registerInitializer(integration.name, toSDKInitializer(integration));
  }

  return result;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Import a module from a file path, handling both TS and JS.
 */
async function importModule(filePath: string): Promise<Record<string, unknown>> {
  const ext = extname(filePath);

  // For TypeScript files, try tsx/ts-node import or fall back to dynamic import
  if (['.ts', '.mts'].includes(ext)) {
    // If running under tsx/ts-node, dynamic import works for .ts files
    try {
      return await import(pathToFileURL(filePath).href);
    } catch {
      // Try without file URL
      return await import(filePath);
    }
  }

  // For JS files, use dynamic import
  return await import(pathToFileURL(filePath).href);
}

/**
 * Extract a UserIntegration from a loaded module.
 * Looks for default export or named `integration` export.
 */
function extractIntegration(
  mod: Record<string, unknown>,
  sourceName: string
): UserIntegration | null {
  // Check default export
  const defaultExport = mod.default as Record<string, unknown> | undefined;
  if (isUserIntegration(defaultExport)) {
    return defaultExport as unknown as UserIntegration;
  }

  // Check named `integration` export
  const named = mod.integration as Record<string, unknown> | undefined;
  if (isUserIntegration(named)) {
    return named as unknown as UserIntegration;
  }

  // Auto-derive name from filename if module has initialize but no name
  if (defaultExport && typeof (defaultExport as Record<string, unknown>).initialize === 'function') {
    const name =
      (defaultExport as Record<string, unknown>).name as string ||
      basename(sourceName, extname(sourceName));
    return {
      name,
      ...defaultExport,
    } as unknown as UserIntegration;
  }

  return null;
}

/**
 * Type guard for UserIntegration.
 */
function isUserIntegration(obj: unknown): obj is UserIntegration {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Record<string, unknown>;
  return typeof candidate.name === 'string' && typeof candidate.initialize === 'function';
}
