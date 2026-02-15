/**
 * core.transform — Array transformations (map, filter, reduce, find, group_by, unique, sort).
 */

import { ExecutionContext } from '../models.js';
import { resolveTemplates, resolveVariablePath } from '../engine/variable-resolution.js';

export interface TransformOperationInputs {
  input: unknown[];
  operation: 'map' | 'filter' | 'reduce' | 'find' | 'group_by' | 'unique' | 'sort';
  expression?: string;
  condition?: string;
  initialValue?: unknown;
  key?: string;
  reverse?: boolean;
}

export function executeTransform(
  rawInputs: TransformOperationInputs,
  resolvedInputs: Record<string, unknown>,
  context: ExecutionContext
): unknown {
  const input = resolvedInputs.input;

  if (!Array.isArray(input)) {
    throw new Error('Transform input must be an array');
  }

  const operation = rawInputs.operation;

  switch (operation) {
    case 'map':
      return transformMap(input, rawInputs.expression || '{{ item }}', context);
    case 'filter':
      return transformFilter(input, rawInputs.condition || 'item', context);
    case 'reduce':
      return transformReduce(input, rawInputs.expression || '{{ accumulator }}', resolvedInputs.initialValue, context);
    case 'find':
      return transformFind(input, rawInputs.condition || 'item', context);
    case 'group_by':
      if (!rawInputs.key) throw new Error('group_by operation requires "key" parameter');
      return transformGroupBy(input, rawInputs.key, context);
    case 'unique':
      return transformUnique(input, rawInputs.key, context);
    case 'sort':
      return transformSort(input, rawInputs.key, resolvedInputs.reverse as boolean || false, context);
    default:
      throw new Error(`Unknown transform operation: ${operation}`);
  }
}

function transformMap(items: unknown[], expression: string, context: ExecutionContext): unknown[] {
  return items.map((item) => {
    const itemContext = { ...context, variables: { ...context.variables, item } };
    return resolveTemplates(expression, itemContext);
  });
}

function transformFilter(items: unknown[], condition: string, context: ExecutionContext): unknown[] {
  return items.filter((item) => {
    const itemContext = { ...context, variables: { ...context.variables, item } };
    const resolved = resolveTemplates(condition, itemContext);
    return Boolean(resolved);
  });
}

function transformReduce(items: unknown[], expression: string, initialValue: unknown, context: ExecutionContext): unknown {
  let accumulator: unknown = initialValue !== undefined ? initialValue : null;

  for (const item of items) {
    const reduceContext: ExecutionContext = {
      ...context,
      variables: { ...context.variables, item, accumulator } as Record<string, unknown>,
    };
    accumulator = resolveTemplates(expression, reduceContext);
  }

  return accumulator;
}

function transformFind(items: unknown[], condition: string, context: ExecutionContext): unknown {
  for (const item of items) {
    const itemContext = { ...context, variables: { ...context.variables, item } };
    const resolved = resolveTemplates(condition, itemContext);
    if (Boolean(resolved)) return item;
  }
  return undefined;
}

function transformGroupBy(items: unknown[], key: string, context: ExecutionContext): Record<string, unknown[]> {
  const groups: Record<string, unknown[]> = {};

  for (const item of items) {
    const itemContext = { ...context, variables: { ...context.variables, item } };
    const groupKey = String(resolveVariablePath(key, itemContext));
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(item);
  }

  return groups;
}

function transformUnique(items: unknown[], key: string | undefined, context: ExecutionContext): unknown[] {
  if (!key) return Array.from(new Set(items));

  const seen = new Set<string>();
  const result: unknown[] = [];

  for (const item of items) {
    const itemContext = { ...context, variables: { ...context.variables, item } };
    const keyValue = String(resolveVariablePath(key, itemContext));
    if (!seen.has(keyValue)) {
      seen.add(keyValue);
      result.push(item);
    }
  }

  return result;
}

function transformSort(items: unknown[], key: string | undefined, reverse: boolean, context: ExecutionContext): unknown[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    let aVal: unknown = a;
    let bVal: unknown = b;

    if (key) {
      const aContext = { ...context, variables: { ...context.variables, item: a } };
      const bContext = { ...context, variables: { ...context.variables, item: b } };
      aVal = resolveVariablePath(key, aContext);
      bVal = resolveVariablePath(key, bContext);
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal;
    if (typeof aVal === 'string' && typeof bVal === 'string') return aVal.localeCompare(bVal);
    return String(aVal).localeCompare(String(bVal));
  });

  return reverse ? sorted.reverse() : sorted;
}
