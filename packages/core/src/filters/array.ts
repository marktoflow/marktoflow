/**
 * Array filters — nth, count, sum, unique, flatten.
 */

export function nth(value: unknown, index: number): unknown {
  if (Array.isArray(value)) return value[index];
  return value;
}

export function count(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'string') return value.length;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('length' in obj && typeof obj.length === 'number') return obj.length;
    if ('total' in obj && typeof obj.total === 'number') return obj.total;
    if ('count' in obj && typeof obj.count === 'number') return obj.count;
    return Object.keys(value).length;
  }
  return 0;
}

export function sum(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((acc: number, val) => acc + Number(val), 0);
}

export function unique(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [value];
  return Array.from(new Set(value));
}

export function flatten(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [value];
  return value.flat(1);
}
