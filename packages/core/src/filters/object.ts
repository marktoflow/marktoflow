/**
 * Object filters — path, keys, values, entries, pick, omit, merge.
 */

export function path(value: unknown, pathStr: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;

  const keys = pathStr.split('.');
  let result: unknown = value;

  for (const key of keys) {
    if (typeof result !== 'object' || result === null) return undefined;
    result = (result as Record<string, unknown>)[key];
  }

  return result;
}

export function keys(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return [];
  return Object.keys(value);
}

export function values(value: unknown): unknown[] {
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value);
}

export function entries(value: unknown): [string, unknown][] {
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value);
}

export function pick(value: unknown, ...keysToPick: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return {};
  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of keysToPick) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

export function omit(value: unknown, ...keysToOmit: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return {};
  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const omitSet = new Set(keysToOmit);
  for (const [key, val] of Object.entries(obj)) {
    if (!omitSet.has(key)) result[key] = val;
  }
  return result;
}

export function merge(value: unknown, ...objects: unknown[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return {};
  let result = { ...value } as Record<string, unknown>;
  for (const obj of objects) {
    if (typeof obj === 'object' && obj !== null) result = { ...result, ...obj };
  }
  return result;
}
