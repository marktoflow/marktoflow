/**
 * Built-in workflow tools for controlling workflow execution
 *
 * These actions are always available in workflows without needing to be declared.
 */

import { SDKInitializer } from './sdk-registry.js';

/**
 * Workflow tools client that provides workflow control actions
 */
export class WorkflowToolsClient {
  /**
   * Set workflow output variables
   *
   * This action sets the final output values of the workflow that can be accessed
   * by the caller or displayed at the end of execution.
   *
   * @example
   * ```yaml
   * action: workflow.set_outputs
   * inputs:
   *   result: '{{ calculation_result }}'
   *   status: 'success'
   *   message: 'Workflow completed'
   * ```
   */
  async set_outputs(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    // The engine will capture this special return value and set it as workflow outputs
    // This is a marker that tells the engine to update the workflow's output variables
    return {
      __workflow_outputs__: inputs,
      ...inputs,
    };
  }

  /**
   * Sleep for a specified duration
   *
   * @example
   * ```yaml
   * action: workflow.sleep
   * inputs:
   *   duration: 5000  # milliseconds
   * ```
   */
  async sleep(inputs: { duration: number }): Promise<{ slept: number }> {
    const duration = inputs.duration || 0;
    await new Promise(resolve => setTimeout(resolve, duration));
    return { slept: duration };
  }

  /**
   * Fail the workflow with an error message
   *
   * @example
   * ```yaml
   * action: workflow.fail
   * inputs:
   *   message: 'Validation failed'
   *   code: 'VALIDATION_ERROR'
   * ```
   */
  async fail(inputs: { message: string; code?: string }): Promise<never> {
    const error = new Error(inputs.message) as Error & { code?: string };
    if (inputs.code) {
      error.code = inputs.code;
    }
    throw error;
  }

  /**
   * Log a message (alias for core.log)
   *
   * @example
   * ```yaml
   * action: workflow.log
   * inputs:
   *   message: 'Processing item {{ item_id }}'
   *   level: 'info'
   * ```
   */
  async log(inputs: {
    message: string;
    level?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ logged: true }> {
    const level = inputs.level || 'info';
    const message = inputs.message;
    const metadata = inputs.metadata;

    const logFn = level === 'error' || level === 'critical' ? console.error :
                  level === 'warning' ? console.warn : console.log;

    if (metadata && Object.keys(metadata).length > 0) {
      logFn(`[${level.toUpperCase()}] ${message}`, metadata);
    } else {
      logFn(`[${level.toUpperCase()}] ${message}`);
    }

    return { logged: true };
  }

  /**
   * Create a timestamp
   *
   * @example
   * ```yaml
   * action: workflow.timestamp
   * inputs:
   *   format: 'iso'  # 'iso', 'unix', or 'ms'
   * output_variable: timestamp
   * ```
   */
  async timestamp(inputs: { format?: string } = {}): Promise<{ timestamp: string | number }> {
    const format = inputs.format || 'iso';

    switch (format) {
      case 'iso':
        return { timestamp: new Date().toISOString() };
      case 'unix':
        return { timestamp: Math.floor(Date.now() / 1000) };
      case 'ms':
        return { timestamp: Date.now() };
      default:
        return { timestamp: new Date().toISOString() };
    }
  }

  /**
   * No-op action (useful for testing or placeholders)
   */
  async noop(): Promise<{ success: true }> {
    return { success: true };
  }
}

/**
 * Workflow SDK initializer
 */
export const WorkflowInitializer: SDKInitializer = {
  async initialize(_module: unknown, _config: unknown): Promise<unknown> {
    return new WorkflowToolsClient();
  },
};
