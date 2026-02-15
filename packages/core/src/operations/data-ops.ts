/**
 * Data operations — aggregate, compare, rename_keys, limit, sort.
 */

import { ExecutionContext } from '../models.js';

// ============================================================================
// core.aggregate
// ============================================================================

export function executeAggregate(
  inputs: Record<string, unknown>,
  _context: ExecutionContext
): unknown {
  const items = inputs.input as unknown[];
  const operation = inputs.operation as string;
  const field = inputs.field as string | undefined;

  if (!Array.isArray(items)) throw new Error('core.aggregate: input must be an array');

  const values = field
    ? items.map((item) => {
        if (item && typeof item === 'object') return (item as Record<string, unknown>)[field];
        return item;
      })
    : items;

  const numValues = values.map(Number).filter((n) => !isNaN(n));

  switch (operation) {
    case 'sum':
      return numValues.reduce((a, b) => a + b, 0);
    case 'avg':
    case 'average':
      return numValues.length > 0 ? numValues.reduce((a, b) => a + b, 0) / numValues.length : 0;
    case 'count':
      return items.length;
    case 'min':
      return numValues.length > 0 ? Math.min(...numValues) : null;
    case 'max':
      return numValues.length > 0 ? Math.max(...numValues) : null;
    case 'first':
      return items[0] ?? null;
    case 'last':
      return items[items.length - 1] ?? null;
    case 'concat':
      return values.join(inputs.separator as string ?? ', ');
    case 'unique_count':
      return new Set(values).size;
    default:
      throw new Error(`core.aggregate: unknown operation "${operation}"`);
  }
}

// ============================================================================
// core.compare
// ============================================================================

export function executeCompare(
  inputs: Record<string, unknown>,
  _context: ExecutionContext
): unknown {
  const source1 = inputs.source1 as unknown[];
  const source2 = inputs.source2 as unknown[];
  const field = inputs.field as string;

  if (!Array.isArray(source1) || !Array.isArray(source2)) {
    throw new Error('core.compare: source1 and source2 must be arrays');
  }
  if (!field) throw new Error('core.compare: field is required');

  const getVal = (item: unknown) =>
    item && typeof item === 'object' ? (item as Record<string, unknown>)[field] : item;

  const set1 = new Set(source1.map(getVal));
  const set2 = new Set(source2.map(getVal));

  return {
    added: source2.filter((item) => !set1.has(getVal(item))),
    removed: source1.filter((item) => !set2.has(getVal(item))),
    unchanged: source1.filter((item) => set2.has(getVal(item))),
    total_source1: source1.length,
    total_source2: source2.length,
  };
}

// ============================================================================
// core.rename_keys
// ============================================================================

export function executeRenameKeys(inputs: Record<string, unknown>): unknown {
  const input = inputs.input;
  const mapping = inputs.mapping as Record<string, string>;

  if (!mapping || typeof mapping !== 'object') {
    throw new Error('core.rename_keys: mapping is required');
  }

  const rename = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = mapping[key] ?? key;
      result[newKey] = value;
    }
    return result;
  };

  if (Array.isArray(input)) {
    return input.map((item) =>
      item && typeof item === 'object' ? rename(item as Record<string, unknown>) : item
    );
  }

  if (input && typeof input === 'object') {
    return rename(input as Record<string, unknown>);
  }

  return input;
}

// ============================================================================
// core.limit
// ============================================================================

export function executeLimit(inputs: Record<string, unknown>): unknown {
  const items = inputs.input as unknown[];
  const count = inputs.count as number;
  const offset = (inputs.offset as number) ?? 0;

  if (!Array.isArray(items)) throw new Error('core.limit: input must be an array');
  if (typeof count !== 'number') throw new Error('core.limit: count is required');

  return items.slice(offset, offset + count);
}

// ============================================================================
// core.sort
// ============================================================================

export function executeSortOperation(inputs: Record<string, unknown>): unknown {
  const items = inputs.input as unknown[];
  const field = inputs.field as string | undefined;
  const direction = (inputs.direction as string) ?? 'asc';

  if (!Array.isArray(items)) throw new Error('core.sort: input must be an array');

  const sorted = [...items].sort((a, b) => {
    const va = field && a && typeof a === 'object' ? (a as Record<string, unknown>)[field] : a;
    const vb = field && b && typeof b === 'object' ? (b as Record<string, unknown>)[field] : b;

    if (typeof va === 'number' && typeof vb === 'number') return va - vb;
    return String(va ?? '').localeCompare(String(vb ?? ''));
  });

  return direction === 'desc' ? sorted.reverse() : sorted;
}
