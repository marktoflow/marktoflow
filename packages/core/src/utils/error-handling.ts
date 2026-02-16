/**
 * Consistent error handling utilities for marktoflow.
 *
 * Provides standardized functions for converting unknown errors to
 * messages and Error objects. Handles various edge cases:
 * - Error objects with message
 * - Plain objects with message property
 * - Strings
 * - null/undefined
 * - Custom error types
 *
 * Usage:
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   const message = getErrorMessage(error);
 *   const err = normalizeError(error);
 *   const details = getErrorDetails(error);
 * }
 * ```
 */

/**
 * Extract a human-readable message from any error.
 *
 * Handles:
 * - Error objects: returns error.message
 * - Objects with .message: returns that message
 * - Strings: returns the string
 * - null/undefined: returns default message
 * - Other: returns String(error)
 */
export function getErrorMessage(error: unknown, defaultMessage = 'Unknown error'): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      return obj.message;
    }
  }

  if (error === null || error === undefined) {
    return defaultMessage;
  }

  return String(error);
}

/**
 * Normalize any error into an Error object.
 *
 * Always returns an Error object with:
 * - message: from getErrorMessage()
 * - stack: original stack if available
 * - cause: original error as cause (for error chains)
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  const message = getErrorMessage(error);

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    
    // Try to use Error constructor with cause option (ES2022+)
    let err: Error;
    try {
      // @ts-ignore - cause option might not be in types but works at runtime
      err = new Error(message, { cause: error });
    } catch {
      // Fallback: create Error and set cause manually
      err = new Error(message);
      Object.defineProperty(err, 'cause', {
        value: error,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }

    // Copy stack if available
    if (typeof obj.stack === 'string') {
      err.stack = obj.stack;
    }

    return err;
  }

  return new Error(message);
}

/**
 * Get detailed error information for logging/debugging.
 */
export interface ErrorDetails {
  message: string;
  name?: string;
  stack?: string;
  code?: string | number;
  statusCode?: number;
}

export function getErrorDetails(error: unknown): ErrorDetails {
  const err = normalizeError(error);

  const details: ErrorDetails = {
    message: err.message,
    name: err.name,
    ...(err.stack !== undefined && { stack: err.stack }),
  };

  // Extract additional properties for common error types
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;

    if ('code' in obj) {
      details.code = obj.code as string | number;
    }

    if ('statusCode' in obj) {
      details.statusCode = obj.statusCode as number;
    }
  }

  return details;
}

/**
 * Format an error for logging to console or files.
 *
 * Returns a formatted string with message and optional stack trace.
 */
export function formatError(error: unknown, includeStack = false): string {
  const details = getErrorDetails(error);
  let formatted = `${details.name || 'Error'}: ${details.message}`;

  if (includeStack && details.stack) {
    formatted += `\n${details.stack}`;
  }

  if (details.code) {
    formatted = `[${details.code}] ${formatted}`;
  }

  return formatted;
}

/**
 * Type guard: check if a value is an Error-like object.
 */
export function isError(value: unknown): value is Error {
  return (
    value instanceof Error ||
    (typeof value === 'object' &&
      value !== null &&
      'message' in value &&
      typeof (value as Record<string, unknown>).message === 'string')
  );
}

/**
 * Create a new Error with a message prefix.
 * Useful for wrapping errors with additional context.
 *
 * Example:
 * ```typescript
 * try {
 *   await loadWorkflow(path);
 * } catch (error) {
 *   throw prefixError(error, `Failed to load workflow from ${path}`);
 * }
 * ```
 */
export function prefixError(error: unknown, prefix: string): Error {
  const message = getErrorMessage(error);
  const err = new Error(`${prefix}: ${message}`);

  if (error instanceof Error && error.stack) {
    const stack = error.stack.split('\n');
    const newStack = err.stack?.split('\n').slice(0, 1).concat(stack.slice(1)).join('\n');
    if (newStack) {
      err.stack = newStack;
    }
  }

  return err;
}

/**
 * Create a chain of errors for better error context.
 * Sets the original error as the cause.
 *
 * Works with modern Error.cause (ES2022) and falls back to custom property.
 */
export function chainError(error: unknown, message: string): Error {
  // Try to use Error constructor options (ES2022+)
  try {
    // @ts-ignore - cause option might not be in types but works at runtime
    return new Error(message, { cause: error });
  } catch {
    // Fallback for older environments - use defineProperty
    const err = new Error(message);
    Object.defineProperty(err, 'cause', {
      value: error,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    return err;
  }
}
