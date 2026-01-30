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
  private logger?: any; // ExecutionLogger instance passed from engine

  constructor(logger?: any) {
    this.logger = logger;
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

    // If we have a logger instance, use it
    if (this.logger) {
      this.logger.log(this.logger.currentRunId, level, message, {
        details: metadata,
      });
    } else {
      // Fallback to console logging if no logger available
      const logFn = level === 'error' || level === 'critical' ? console.error :
                    level === 'warning' ? console.warn : console.log;
      logFn(`[${level.toUpperCase()}] ${message}`, metadata || '');
    }

    return { logged: true };
  }
}

/**
 * Core SDK initializer
 */
export const CoreInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: any): Promise<unknown> {
    return new CoreToolsClient(config.logger);
  },
};
