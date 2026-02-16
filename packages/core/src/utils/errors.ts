/**
 * Error handling utilities for marktoflow.
 *
 * Provides consistent error conversion patterns used across the engine.
 */

/**
 * Convert an unknown error value to a human-readable string.
 *
 * @param error - Any thrown value
 * @returns A string representation of the error
 */
export function errorToString(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Convert an unknown thrown value to an Error object.
 *
 * @param error - Any thrown value
 * @returns An Error instance
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(errorToString(error));
}

// ============================================================================
// Extended Error Utilities (New Additions)
// ============================================================================

/**
 * Extract a human-readable message from any error.
 * Enhanced version that extracts message from objects with message property.
 */
export function getErrorMessage(error: unknown, defaultMessage = 'Unknown error'): string {
  if (error === null || error === undefined) {
    return defaultMessage;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  // Check for object with message property (before JSON.stringify)
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      return obj.message;
    }
  }

  // Fall back to existing errorToString behavior
  return errorToString(error);
}

/**
 * Normalize any error into an Error object.
 * Alias for toError for API consistency.
 * Also supports setting cause for error chains (ES2022+).
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  const message = getErrorMessage(error);
  const err = new Error(message);

  // Try to preserve original error as cause
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    // Copy stack if available
    if (typeof obj.stack === 'string') {
      err.stack = obj.stack;
    }
    // Set cause for error chains (ES2022+)
    try {
      // @ts-ignore - cause option might not be in types but works at runtime
      Object.defineProperty(err, 'cause', {
        value: error,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } catch {
      // Silently ignore if cause can't be set (older Node versions)
    }
  }

  return err;
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
  try {
    // Try to use Error constructor options (ES2022+)
    // @ts-ignore - cause option might not be in types but works at runtime
    return new Error(message, { cause: error });
  } catch {
    // Fallback for older environments - use defineProperty
    const err = new Error(message);
    try {
      Object.defineProperty(err, 'cause', {
        value: error,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } catch {
      // Silently ignore if cause can't be set
    }
    return err;
  }
}
