/**
 * Type check filters — is_array, is_object, is_string, is_number, is_empty, is_null.
 */

export function is_array(value: unknown): boolean {
  return Array.isArray(value);
}

export function is_object(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function is_string(value: unknown): boolean {
  return typeof value === 'string';
}

export function is_number(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value);
}

export function is_empty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function is_null(value: unknown): boolean {
  return value === null;
}
