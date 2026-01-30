/**
 * Core built-in tools for marktoflow workflows
 *
 * These tools are always available without needing to be declared in the workflow.
 */

import { SDKInitializer } from './sdk-registry.js';
import { LogLevel } from './logging.js';

/**
 * Core tools client that provides built-in workflow actions
 */
export class CoreToolsClient {
  constructor() {
    // No-op constructor - logger integration not yet implemented
  }

  /**
   * Log a message during workflow execution
   */
  async log(inputs: {
    level: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ logged: true }> {
    const level = (inputs.level || 'info') as LogLevel;
    const message = inputs.message;
    const metadata = inputs.metadata;

    // Use console logging (logger integration is not fully implemented yet)
    const logFn = level === 'error' || level === 'critical' ? console.error :
                  level === 'warning' ? console.warn : console.log;

    if (metadata && Object.keys(metadata).length > 0) {
      logFn(`[${level.toUpperCase()}] ${message}`, metadata);
    } else {
      logFn(`[${level.toUpperCase()}] ${message}`);
    }

    return { logged: true };
  }
}

/**
 * Core SDK initializer
 */
export const CoreInitializer: SDKInitializer = {
  async initialize(_module: unknown, _config: any): Promise<unknown> {
    return new CoreToolsClient();
  },
};
