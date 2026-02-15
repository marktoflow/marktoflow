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
