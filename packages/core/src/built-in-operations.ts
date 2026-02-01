/**
 * Built-in Operations for marktoflow
 *
 * Provides common operations that eliminate the need for verbose script blocks:
 * - core.set: Simple variable assignment
 * - core.transform: Map/filter/reduce transformations
 * - core.extract: Nested path access
 * - core.format: Date/number/string formatting
 */

import { ExecutionContext } from './models.js';
import { resolveTemplates, resolveVariablePath } from './engine.js';

// ============================================================================
// Types
// ============================================================================

export interface SetOperationInputs {
  [key: string]: unknown;
}

export interface TransformOperationInputs {
  input: unknown[];
  operation: 'map' | 'filter' | 'reduce' | 'find' | 'group_by' | 'unique' | 'sort';
  expression?: string;
  condition?: string;
  initialValue?: unknown;
  key?: string;
  reverse?: boolean;
}

export interface ExtractOperationInputs {
  input: unknown;
  path: string;
  default?: unknown;
}

export interface FormatOperationInputs {
  value: unknown;
  type: 'date' | 'number' | 'string' | 'currency' | 'json';
  format?: string;
  locale?: string;
  currency?: string;
  precision?: number;
}

// ============================================================================
// core.set - Simple Variable Assignment
// ============================================================================

/**
 * Set multiple variables at once with expression resolution.
 *
 * Example:
 * ```yaml
 * action: core.set
 * inputs:
 *   owner: "{{ inputs.repo =~ /^([^\/]+)\// }}"
 *   repo_name: "{{ inputs.repo =~ /\/(.+)$/ }}"
 *   timestamp: "{{ now() }}"
 * ```
 */
export function executeSet(
  inputs: SetOperationInputs,
  context: ExecutionContext
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(inputs)) {
    const resolved = resolveTemplates(value, context);
    result[key] = resolved;
  }

  return result;
}

// ============================================================================
// core.transform - Array Transformations
// ============================================================================

/**
 * Transform arrays using common operations like map, filter, reduce.
 *
 * Examples:
 *
 * Map:
 * ```yaml
 * action: core.transform
 * inputs:
 *   input: "{{ oncall_response.data.oncalls }}"
 *   operation: map
 *   expression: "@{{ item.user.name }}"
 * ```
 *
 * Filter:
 * ```yaml
 * action: core.transform
 * inputs:
 *   input: "{{ issues }}"
 *   operation: filter
 *   condition: "item.priority == 'high'"
 * ```
 *
 * Reduce:
 * ```yaml
 * action: core.transform
 * inputs:
 *   input: "{{ numbers }}"
 *   operation: reduce
 *   expression: "{{ accumulator + item }}"
 *   initialValue: 0
 * ```
 */
export function executeTransform(
  rawInputs: TransformOperationInputs,
  resolvedInputs: Record<string, unknown>,
  context: ExecutionContext
): unknown {
  // Use resolved input array
  const input = resolvedInputs.input;

  if (!Array.isArray(input)) {
    throw new Error('Transform input must be an array');
  }

  // Use raw (unresolved) expression and condition to preserve templates
  const operation = rawInputs.operation;

  switch (operation) {
    case 'map':
      return transformMap(input, rawInputs.expression || '{{ item }}', context);

    case 'filter':
      return transformFilter(input, rawInputs.condition || 'item', context);

    case 'reduce':
      return transformReduce(
        input,
        rawInputs.expression || '{{ accumulator }}',
        resolvedInputs.initialValue, // Resolve initialValue upfront
        context
      );

    case 'find':
      return transformFind(input, rawInputs.condition || 'item', context);

    case 'group_by':
      if (!rawInputs.key) {
        throw new Error('group_by operation requires "key" parameter');
      }
      return transformGroupBy(input, rawInputs.key, context);

    case 'unique':
      return transformUnique(input, rawInputs.key, context);

    case 'sort':
      return transformSort(input, rawInputs.key, resolvedInputs.reverse as boolean || false, context);

    default:
      throw new Error(`Unknown transform operation: ${operation}`);
  }
}

/**
 * Map transformation - transform each item in an array
 */
function transformMap(
  items: unknown[],
  expression: string,
  context: ExecutionContext
): unknown[] {
  return items.map((item) => {
    const itemContext = { ...context, variables: { ...context.variables, item } };
    return resolveTemplates(expression, itemContext);
  });
}

/**
 * Filter transformation - keep items that match a condition
 */
function transformFilter(
  items: unknown[],
  condition: string,
  context: ExecutionContext
): unknown[] {
  return items.filter((item) => {
    const itemContext = { ...context, variables: { ...context.variables, item } };
    const resolved = resolveTemplates(condition, itemContext);
    return Boolean(resolved);
  });
}

/**
 * Reduce transformation - aggregate items to a single value
 */
function transformReduce(
  items: unknown[],
  expression: string,
  initialValue: unknown,
  context: ExecutionContext
): unknown {
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

/**
 * Find transformation - find first item that matches condition
 */
function transformFind(
  items: unknown[],
  condition: string,
  context: ExecutionContext
): unknown {
  for (const item of items) {
    const itemContext = { ...context, variables: { ...context.variables, item } };
    const resolved = resolveTemplates(condition, itemContext);
    if (Boolean(resolved)) {
      return item;
    }
  }
  return undefined;
}

/**
 * Group by transformation - group items by a key
 */
function transformGroupBy(
  items: unknown[],
  key: string,
  context: ExecutionContext
): Record<string, unknown[]> {
  const groups: Record<string, unknown[]> = {};

  for (const item of items) {
    const itemContext = { ...context, variables: { ...context.variables, item } };
    const groupKey = String(resolveVariablePath(key, itemContext));

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
  }

  return groups;
}

/**
 * Unique transformation - remove duplicates
 */
function transformUnique(
  items: unknown[],
  key: string | undefined,
  context: ExecutionContext
): unknown[] {
  if (!key) {
    // Simple unique for primitive values
    return Array.from(new Set(items));
  }

  // Unique based on key
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

/**
 * Sort transformation - sort items by key or value
 */
function transformSort(
  items: unknown[],
  key: string | undefined,
  reverse: boolean,
  context: ExecutionContext
): unknown[] {
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

    // Handle different types
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal);
    }

    // Fall back to string comparison
    return String(aVal).localeCompare(String(bVal));
  });

  return reverse ? sorted.reverse() : sorted;
}

// ============================================================================
// core.extract - Nested Path Access
// ============================================================================

/**
 * Extract values from nested objects safely.
 *
 * Example:
 * ```yaml
 * action: core.extract
 * inputs:
 *   input: "{{ api_response }}"
 *   path: "data.users[0].email"
 *   default: "unknown@example.com"
 * ```
 */
export function executeExtract(
  inputs: ExtractOperationInputs,
  context: ExecutionContext
): unknown {
  const input = resolveTemplates(inputs.input, context);
  const path = inputs.path;
  const defaultValue = inputs.default;

  // Create a temporary context with the input as a variable
  const tempContext = {
    ...context,
    variables: { ...context.variables, __extract_input: input },
  };

  const result = resolveVariablePath(`__extract_input.${path}`, tempContext);

  if (result === undefined) {
    return defaultValue !== undefined ? defaultValue : null;
  }

  return result;
}

// ============================================================================
// core.format - Value Formatting
// ============================================================================

/**
 * Format values for display (dates, numbers, strings, currency).
 *
 * Examples:
 *
 * Date:
 * ```yaml
 * action: core.format
 * inputs:
 *   value: "{{ now() }}"
 *   type: date
 *   format: "YYYY-MM-DD HH:mm:ss"
 * ```
 *
 * Number:
 * ```yaml
 * action: core.format
 * inputs:
 *   value: 1234.56
 *   type: number
 *   precision: 2
 * ```
 *
 * Currency:
 * ```yaml
 * action: core.format
 * inputs:
 *   value: 1234.56
 *   type: currency
 *   currency: USD
 *   locale: en-US
 * ```
 */
export function executeFormat(
  inputs: FormatOperationInputs,
  context: ExecutionContext
): string {
  const value = resolveTemplates(inputs.value, context);

  switch (inputs.type) {
    case 'date':
      return formatDate(value, inputs.format);

    case 'number':
      return formatNumber(value, inputs.precision, inputs.locale);

    case 'currency':
      return formatCurrency(value, inputs.currency || 'USD', inputs.locale);

    case 'string':
      return formatString(value, inputs.format);

    case 'json':
      return JSON.stringify(value, null, 2);

    default:
      throw new Error(`Unknown format type: ${inputs.type}`);
  }
}

/**
 * Format a date value
 * Supports simple format tokens: YYYY, MM, DD, HH, mm, ss
 */
function formatDate(value: unknown, format?: string): string {
  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }

  if (!format) {
    return date.toISOString();
  }

  // Simple date formatting (basic implementation)
  let formatted = format;
  formatted = formatted.replace('YYYY', date.getFullYear().toString());
  formatted = formatted.replace('MM', String(date.getMonth() + 1).padStart(2, '0'));
  formatted = formatted.replace('DD', String(date.getDate()).padStart(2, '0'));
  formatted = formatted.replace('HH', String(date.getHours()).padStart(2, '0'));
  formatted = formatted.replace('mm', String(date.getMinutes()).padStart(2, '0'));
  formatted = formatted.replace('ss', String(date.getSeconds()).padStart(2, '0'));

  return formatted;
}

/**
 * Format a number value
 */
function formatNumber(value: unknown, precision?: number, locale?: string): string {
  const num = Number(value);

  if (isNaN(num)) {
    throw new Error('Invalid number value');
  }

  if (precision !== undefined) {
    return num.toFixed(precision);
  }

  if (locale) {
    return num.toLocaleString(locale);
  }

  return num.toString();
}

/**
 * Format a currency value
 */
function formatCurrency(value: unknown, currency: string, locale?: string): string {
  const num = Number(value);

  if (isNaN(num)) {
    throw new Error('Invalid currency value');
  }

  return num.toLocaleString(locale || 'en-US', {
    style: 'currency',
    currency,
  });
}

/**
 * Format a string value
 * Supports: upper, lower, title, capitalize, trim
 */
function formatString(value: unknown, format?: string): string {
  let str = String(value);

  if (!format) {
    return str;
  }

  switch (format.toLowerCase()) {
    case 'upper':
    case 'uppercase':
      return str.toUpperCase();

    case 'lower':
    case 'lowercase':
      return str.toLowerCase();

    case 'title':
    case 'titlecase':
      return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

    case 'capitalize':
      return str.charAt(0).toUpperCase() + str.slice(1);

    case 'trim':
      return str.trim();

    default:
      return str;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute a built-in operation based on action name
 */
export function executeBuiltInOperation(
  action: string,
  rawInputs: Record<string, unknown>,
  resolvedInputs: Record<string, unknown>,
  context: ExecutionContext
): unknown {
  switch (action) {
    case 'core.set':
      return executeSet(resolvedInputs, context);

    case 'core.transform':
      // For transform operations, use raw inputs to preserve template expressions
      return executeTransform(rawInputs as unknown as TransformOperationInputs, resolvedInputs, context);

    case 'core.extract':
      return executeExtract(resolvedInputs as unknown as ExtractOperationInputs, context);

    case 'core.format':
      return executeFormat(resolvedInputs as unknown as FormatOperationInputs, context);

    default:
      return null; // Not a built-in operation
  }
}

/**
 * Check if an action is a built-in operation
 */
export function isBuiltInOperation(action: string): boolean {
  const builtInActions = ['core.set', 'core.transform', 'core.extract', 'core.format'];
  return builtInActions.includes(action);
}
