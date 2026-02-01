/**
 * Mock SDK Registry for Integration Tests
 *
 * Provides a configurable SDK registry mock for testing.
 */

import type { SDKRegistryLike } from '../../src/engine.js';

// ============================================================================
// Types
// ============================================================================

export interface MockSDK {
  name: string;
  methods: Record<string, (...args: unknown[]) => unknown | Promise<unknown>>;
}

export interface MockRegistryConfig {
  /** SDKs to register */
  sdks?: MockSDK[];
  /** Names of SDKs that should be "available" */
  availableSDKs?: string[];
}

// ============================================================================
// Mock Registry Factory
// ============================================================================

/**
 * Create a mock SDK registry for testing.
 *
 * @example
 * const registry = createMockRegistry({
 *   sdks: [
 *     {
 *       name: 'slack',
 *       methods: {
 *         'chat.postMessage': (inputs) => ({ ts: '123', channel: inputs.channel })
 *       }
 *     }
 *   ]
 * });
 */
export function createMockRegistry(config: MockRegistryConfig = {}): SDKRegistryLike {
  const sdkMap = new Map<string, MockSDK>();
  const availableSet = new Set(config.availableSDKs ?? []);

  // Register configured SDKs
  if (config.sdks) {
    for (const sdk of config.sdks) {
      sdkMap.set(sdk.name, sdk);
      availableSet.add(sdk.name);
    }
  }

  return {
    async load(sdkName: string): Promise<unknown> {
      const sdk = sdkMap.get(sdkName);
      if (sdk) {
        return sdk.methods;
      }
      return {};
    },

    has(sdkName: string): boolean {
      return availableSet.has(sdkName) || sdkMap.has(sdkName);
    },
  };
}

/**
 * Create a registry that always returns empty objects.
 */
export function createEmptyRegistry(): SDKRegistryLike {
  return {
    async load() {
      return {};
    },
    has() {
      return true;
    },
  };
}

/**
 * Create a registry that fails to load any SDK.
 */
export function createFailingRegistry(errorMessage: string = 'SDK not available'): SDKRegistryLike {
  return {
    async load(sdkName: string) {
      throw new Error(`${errorMessage}: ${sdkName}`);
    },
    has() {
      return false;
    },
  };
}
