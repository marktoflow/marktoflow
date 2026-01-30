import { ScriptTool, ToolConfig, SDKInitializer } from '@marktoflow/core';
import vm from 'node:vm';

/**
 * Inline script executor that runs JavaScript code in a sandboxed context
 */
export class InlineScriptClient {
  private timeout: number;

  constructor(timeout: number = 30000) {
    this.timeout = timeout;
  }

  /**
   * Execute inline JavaScript code
   *
   * @param params.code - JavaScript code to execute
   * @param params.context - Optional context object available as `context` in the script
   * @returns The result of the code execution
   */
  async execute(params: { code: string; context?: Record<string, unknown> }): Promise<unknown> {
    const { code, context = {} } = params;

    if (!code || typeof code !== 'string') {
      throw new Error('script.execute requires a "code" parameter with JavaScript code');
    }

    return new Promise((resolve, reject) => {
      let isResolved = false;
      let timeoutId: NodeJS.Timeout;

      const safeResolve = (value: unknown) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          resolve(value);
        }
      };

      const safeReject = (error: unknown) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          reject(error);
        }
      };

      // Set up timeout
      timeoutId = setTimeout(() => {
        safeReject(new Error(`Script execution timed out after ${this.timeout}ms`));
      }, this.timeout);

      // Create a sandbox with common utilities
      const sandbox: vm.Context = {
        // Provide the workflow context
        context,

        // Common utilities
        console: {
          log: (...args: unknown[]) => console.log('[script]', ...args),
          error: (...args: unknown[]) => console.error('[script]', ...args),
          warn: (...args: unknown[]) => console.warn('[script]', ...args),
          info: (...args: unknown[]) => console.info('[script]', ...args),
        },
        JSON,
        Date,
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        Promise,
        Map,
        Set,
        Buffer,
        setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
        clearTimeout: (id: NodeJS.Timeout) => clearTimeout(id),
        setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
        clearInterval: (id: NodeJS.Timeout) => clearInterval(id),

        // For promise resolution
        __safeResolve__: safeResolve,
        __safeReject__: safeReject,
      };

      // Create a new VM context for isolation
      const vmContext = vm.createContext(sandbox);

      // Wrap the code to handle both sync and async returns
      const wrappedCode = `
        (async () => {
          try {
            const __userCode__ = async () => {
              ${code}
            };
            const __result__ = await __userCode__();
            __safeResolve__(__result__);
          } catch (__error__) {
            __safeReject__(__error__);
          }
        })();
      `;

      try {
        // Compile and run the script
        const script = new vm.Script(wrappedCode, {
          filename: 'inline-script.js',
        });

        script.runInContext(vmContext);
      } catch (error) {
        if (error instanceof Error) {
          safeReject(new Error(`Script compilation failed: ${error.message}`));
        } else {
          safeReject(error);
        }
      }
    });
  }
}

export const ScriptInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const scriptPath = config.options?.['path'] as string;
    if (!scriptPath) {
      throw new Error('Script integration requires options.path');
    }

    // Handle inline script execution
    if (scriptPath === 'inline') {
      const timeout = (config.options?.['timeout'] as number) || 30000;
      return new InlineScriptClient(timeout);
    }

    // Handle external script files
    const toolsDir = config.options?.['toolsDir'] as string;
    const tool = new ScriptTool(scriptPath, toolsDir);

    // We return a proxy that maps method calls to tool.execute(method, args)
    return new Proxy(tool, {
      get: (target, prop) => {
        if (typeof prop === 'string' && prop !== 'then') {
          return (params: Record<string, any>) => target.execute(prop, params);
        }
        return Reflect.get(target, prop);
      },
    });
  },
};
