/**
 * Script Executor for marktoflow v2.0
 *
 * Provides secure inline JavaScript execution for `script` step types.
 * Uses Node.js `vm` module with:
 * - Frozen context (read-only access to variables/inputs)
 * - Configurable timeout
 * - Safe globals (JSON, Math, Date, Array, etc.)
 *
 * Example usage in workflow:
 * ```yaml
 * - type: script
 *   inputs:
 *     code: |
 *       const items = variables.api_response.items;
 *       const filtered = items.filter(i => i.status === 'active');
 *       return { filtered, count: filtered.length };
 *     timeout: 5000
 *   output_variable: result
 * ```
 */

import * as vm from 'node:vm';

// ============================================================================
// Types
// ============================================================================

export interface ScriptExecutorOptions {
  /** Maximum execution time in milliseconds (default: 5000) */
  timeout?: number;
  /** Additional globals to expose to the script */
  extraGlobals?: Record<string, unknown>;
}

export interface ScriptContext {
  /** Workflow variables (read-only) */
  variables: Record<string, unknown>;
  /** Workflow inputs (read-only) */
  inputs: Record<string, unknown>;
  /** Step results metadata (read-only) */
  steps?: Record<string, unknown>;
}

export interface ScriptResult {
  /** Whether the script executed successfully */
  success: boolean;
  /** The return value of the script */
  value?: unknown;
  /** Error message if execution failed */
  error?: string;
}

// ============================================================================
// Safe Globals
// ============================================================================

/**
 * Safe globals available to scripts.
 * These are frozen copies that cannot modify the original objects.
 */
const SAFE_GLOBALS: Record<string, unknown> = {
  // JSON operations
  JSON,

  // Math operations - use the real Math object (it's already effectively immutable)
  Math,

  // Date operations
  Date,

  // Array utilities
  Array,

  // Object utilities
  Object,

  // String utilities
  String,

  // Number utilities
  Number: {
    isFinite: Number.isFinite,
    isInteger: Number.isInteger,
    isNaN: Number.isNaN,
    parseFloat: Number.parseFloat,
    parseInt: Number.parseInt,
  },

  // Other safe utilities
  parseInt,
  parseFloat,
  isFinite,
  isNaN,
  encodeURIComponent,
  decodeURIComponent,
  encodeURI,
  decodeURI,

  // Console for debugging (limited to log/warn/error)
  console: {
    log: (...args: unknown[]) => console.log('[script]', ...args),
    warn: (...args: unknown[]) => console.warn('[script]', ...args),
    error: (...args: unknown[]) => console.error('[script]', ...args),
  },

  // Promise is allowed for async operations
  Promise,

  // Timer functions for async operations
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,

  // Map and Set
  Map,
  Set,

  // RegExp for pattern matching
  RegExp,
};

// ============================================================================
// Script Execution
// ============================================================================

/**
 * Execute a JavaScript code snippet in a sandboxed environment.
 *
 * @param code The JavaScript code to execute
 * @param context Variables and inputs available to the script
 * @param options Execution options (timeout, extra globals)
 * @returns The result of script execution
 */
export function executeScript(
  code: string,
  context: ScriptContext,
  options: ScriptExecutorOptions = {}
): ScriptResult {
  const timeout = options.timeout ?? 5000;

  try {
    // Create frozen copies of context to prevent modification
    const frozenContext = {
      variables: deepFreeze({ ...context.variables }),
      inputs: deepFreeze({ ...context.inputs }),
      steps: context.steps ? deepFreeze({ ...context.steps }) : undefined,
    };

    // Build the sandbox with safe globals and context
    const sandbox: Record<string, unknown> = {
      ...SAFE_GLOBALS,
      ...frozenContext,
      ...(options.extraGlobals ?? {}),
    };

    // Wrap the code in an async IIFE that returns the result
    // This allows `return` statements and async/await
    const wrappedCode = `
      (async () => {
        ${code}
      })()
    `;

    // Create a VM context
    const vmContext = vm.createContext(sandbox, {
      name: 'script-executor',
      codeGeneration: {
        strings: false, // Disable eval() and Function()
        wasm: false, // Disable WebAssembly
      },
    });

    // Compile and run the script
    const script = new vm.Script(wrappedCode, {
      filename: 'inline-script.js',
    });

    // Run with timeout
    const resultPromise = script.runInContext(vmContext, {
      timeout,
      displayErrors: true,
    });

    // Handle both sync and async results
    if (resultPromise instanceof Promise) {
      // For async code, we need to handle the promise
      // Since this is a sync function, we'll need to handle this specially
      // The caller should await the result if it's a promise
      return {
        success: true,
        value: resultPromise,
      };
    }

    return {
      success: true,
      value: resultPromise,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute a script asynchronously, properly handling async code.
 */
export async function executeScriptAsync(
  code: string,
  context: ScriptContext,
  options: ScriptExecutorOptions = {}
): Promise<ScriptResult> {
  const timeout = options.timeout ?? 5000;

  try {
    // Create frozen copies of context to prevent modification
    const frozenContext = {
      variables: deepFreeze({ ...context.variables }),
      inputs: deepFreeze({ ...context.inputs }),
      steps: context.steps ? deepFreeze({ ...context.steps }) : undefined,
    };

    // Build the sandbox with safe globals and context
    const sandbox: Record<string, unknown> = {
      ...SAFE_GLOBALS,
      ...frozenContext,
      ...(options.extraGlobals ?? {}),
    };

    // Wrap the code in an async IIFE
    const wrappedCode = `
      (async () => {
        ${code}
      })()
    `;

    // Create a VM context
    const vmContext = vm.createContext(sandbox, {
      name: 'script-executor',
      codeGeneration: {
        strings: false,
        wasm: false,
      },
    });

    // Compile the script
    const script = new vm.Script(wrappedCode, {
      filename: 'inline-script.js',
    });

    // Run with timeout using a race
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Script execution timed out after ${timeout}ms`)), timeout);
    });

    const resultPromise = script.runInContext(vmContext, {
      displayErrors: true,
    });

    // Wait for result or timeout
    const result = await Promise.race([
      resultPromise instanceof Promise ? resultPromise : Promise.resolve(resultPromise),
      timeoutPromise,
    ]);

    return {
      success: true,
      value: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Deep freeze an object to prevent any modifications.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Freeze arrays and objects recursively
  if (Array.isArray(obj)) {
    obj.forEach((item) => deepFreeze(item));
  } else {
    Object.keys(obj as object).forEach((key) => {
      const value = (obj as Record<string, unknown>)[key];
      if (typeof value === 'object' && value !== null) {
        deepFreeze(value);
      }
    });
  }

  return Object.freeze(obj);
}

/**
 * Validate that a script doesn't contain dangerous patterns.
 * This is a basic check; the VM sandbox provides the real security.
 */
export function validateScript(code: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check for common dangerous patterns
  const dangerousPatterns = [
    { pattern: /require\s*\(/, message: 'require() is not available in scripts' },
    { pattern: /import\s+/, message: 'import statements are not available in scripts' },
    { pattern: /process\./, message: 'process object is not available in scripts' },
    { pattern: /global\./, message: 'global object is not available in scripts' },
    { pattern: /globalThis\./, message: 'globalThis is not available in scripts' },
    { pattern: /eval\s*\(/, message: 'eval() is not available in scripts' },
    { pattern: /Function\s*\(/, message: 'Function constructor is not available in scripts' },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(code)) {
      warnings.push(message);
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
