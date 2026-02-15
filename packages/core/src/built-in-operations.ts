/**
 * Built-in Operations for marktoflow
 *
 * Provides common operations that eliminate the need for verbose script blocks:
 * - core.set: Simple variable assignment
 * - core.transform: Map/filter/reduce transformations
 * - core.extract: Nested path access
 * - core.format: Date/number/string formatting
 * - file.read: Read files with format conversion (docx, pdf, xlsx)
 * - file.write: Write files (text or binary)
 * - parallel.spawn: Execute multiple AI agents concurrently
 * - parallel.map: Map over collection with parallel agents
 */

import { ExecutionContext } from './models.js';
import { resolveTemplates, resolveVariablePath } from './engine/variable-resolution.js';
import { executeFileOperation, isFileOperation } from './file-operations.js';
import { isParallelOperation } from './parallel.js';

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
): unknown | Promise<unknown> {
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

    case 'core.aggregate':
      return executeAggregate(resolvedInputs, context);

    case 'core.compare':
      return executeCompare(resolvedInputs, context);

    case 'core.rename_keys':
      return executeRenameKeys(resolvedInputs);

    case 'core.limit':
      return executeLimit(resolvedInputs);

    case 'core.sort':
      return executeSortOperation(resolvedInputs);

    case 'core.crypto':
      return executeCrypto(resolvedInputs);

    case 'core.datetime':
      return executeDatetime(resolvedInputs);

    case 'core.parse':
      return executeParse(resolvedInputs);

    case 'core.compress':
      return executeCompress(resolvedInputs);

    case 'core.decompress':
      return executeDecompress(resolvedInputs);

    default:
      // Check if it's a file operation
      if (isFileOperation(action)) {
        return executeFileOperation(action, resolvedInputs, context);
      }
      return null; // Not a built-in operation
  }
}

/**
 * Check if an action is a built-in operation
 */
export function isBuiltInOperation(action: string): boolean {
  const builtInActions = [
    'core.set', 'core.transform', 'core.extract', 'core.format',
    'core.aggregate', 'core.compare', 'core.rename_keys', 'core.limit',
    'core.sort', 'core.crypto', 'core.datetime', 'core.parse',
    'core.compress', 'core.decompress',
  ];
  return builtInActions.includes(action) || isFileOperation(action) || isParallelOperation(action);
}

// ============================================================================
// core.aggregate - Common aggregation presets
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
// core.compare - Compare two datasets
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
// core.rename_keys - Rename object keys
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
// core.limit - Limit array items
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
// core.sort - Sort array
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

// ============================================================================
// core.crypto - Cryptographic operations
// ============================================================================

export function executeCrypto(inputs: Record<string, unknown>): unknown {
  const { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
  const operation = inputs.operation as string;
  const data = inputs.data as string;

  switch (operation) {
    case 'hash': {
      const algorithm = (inputs.algorithm as string) ?? 'sha256';
      const encoding = (inputs.encoding as string) ?? 'hex';
      return createHash(algorithm).update(data).digest(encoding);
    }
    case 'hmac': {
      const algorithm = (inputs.algorithm as string) ?? 'sha256';
      const key = inputs.key as string;
      const encoding = (inputs.encoding as string) ?? 'hex';
      if (!key) throw new Error('core.crypto: key required for hmac');
      return createHmac(algorithm, key).update(data).digest(encoding);
    }
    case 'random': {
      const size = (inputs.size as number) ?? 32;
      const encoding = (inputs.encoding as string) ?? 'hex';
      return randomBytes(size).toString(encoding);
    }
    case 'encrypt': {
      const key = inputs.key as string;
      const algorithm = (inputs.algorithm as string) ?? 'aes-256-gcm';
      if (!key) throw new Error('core.crypto: key required for encrypt');
      const keyBuf = Buffer.from(key, 'hex');
      const iv = randomBytes(16);
      const cipher = createCipheriv(algorithm, keyBuf, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = algorithm.includes('gcm') ? cipher.getAuthTag().toString('hex') : '';
      return { encrypted, iv: iv.toString('hex'), authTag };
    }
    case 'decrypt': {
      const key = inputs.key as string;
      const algorithm = (inputs.algorithm as string) ?? 'aes-256-gcm';
      const encrypted = inputs.encrypted as string;
      const iv = inputs.iv as string;
      const authTag = inputs.authTag as string;
      if (!key || !encrypted || !iv) throw new Error('core.crypto: key, encrypted, iv required for decrypt');
      const keyBuf = Buffer.from(key, 'hex');
      const decipher = createDecipheriv(algorithm, keyBuf, Buffer.from(iv, 'hex'));
      if (algorithm.includes('gcm') && authTag) {
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      }
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    default:
      throw new Error(`core.crypto: unknown operation "${operation}"`);
  }
}

// ============================================================================
// core.datetime - Date/time operations
// ============================================================================

export function executeDatetime(inputs: Record<string, unknown>): unknown {
  const operation = inputs.operation as string;
  const date = inputs.date ? new Date(inputs.date as string) : new Date();

  switch (operation) {
    case 'now':
      return new Date().toISOString();
    case 'parse':
      return date.toISOString();
    case 'format': {
      const fmt = (inputs.format as string) ?? 'iso';
      if (fmt === 'iso') return date.toISOString();
      if (fmt === 'date') return date.toISOString().split('T')[0];
      if (fmt === 'time') return date.toISOString().split('T')[1]?.replace('Z', '');
      if (fmt === 'unix') return Math.floor(date.getTime() / 1000);
      if (fmt === 'unix_ms') return date.getTime();
      return date.toISOString();
    }
    case 'add': {
      const amount = inputs.amount as number;
      const unit = (inputs.unit as string) ?? 'days';
      const ms = { ms: 1, seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 };
      const mult = ms[unit as keyof typeof ms] ?? ms.days;
      return new Date(date.getTime() + amount * mult).toISOString();
    }
    case 'subtract': {
      const amount = inputs.amount as number;
      const unit = (inputs.unit as string) ?? 'days';
      const ms = { ms: 1, seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 };
      const mult = ms[unit as keyof typeof ms] ?? ms.days;
      return new Date(date.getTime() - amount * mult).toISOString();
    }
    case 'diff': {
      const date2 = new Date(inputs.date2 as string);
      const unit = (inputs.unit as string) ?? 'days';
      const diffMs = date.getTime() - date2.getTime();
      const divisors = { ms: 1, seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
      return diffMs / (divisors[unit as keyof typeof divisors] ?? divisors.days);
    }
    case 'start_of': {
      const unit = (inputs.unit as string) ?? 'day';
      const d = new Date(date);
      if (unit === 'day') { d.setHours(0, 0, 0, 0); }
      else if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); }
      else if (unit === 'year') { d.setMonth(0, 1); d.setHours(0, 0, 0, 0); }
      else if (unit === 'hour') { d.setMinutes(0, 0, 0); }
      return d.toISOString();
    }
    case 'end_of': {
      const unit = (inputs.unit as string) ?? 'day';
      const d = new Date(date);
      if (unit === 'day') { d.setHours(23, 59, 59, 999); }
      else if (unit === 'month') { d.setMonth(d.getMonth() + 1, 0); d.setHours(23, 59, 59, 999); }
      else if (unit === 'year') { d.setMonth(11, 31); d.setHours(23, 59, 59, 999); }
      return d.toISOString();
    }
    default:
      throw new Error(`core.datetime: unknown operation "${operation}"`);
  }
}

// ============================================================================
// core.parse - Parse structured data formats
// ============================================================================

export function executeParse(inputs: Record<string, unknown>): unknown {
  const data = inputs.data as string;
  const format = inputs.format as string;

  if (!data || typeof data !== 'string') throw new Error('core.parse: data must be a string');
  if (!format) throw new Error('core.parse: format is required');

  switch (format) {
    case 'json':
      return JSON.parse(data);
    case 'csv': {
      const delimiter = (inputs.delimiter as string) ?? ',';
      const hasHeader = (inputs.header as boolean) ?? true;
      const lines = data.split('\n').filter((l) => l.trim());
      if (lines.length === 0) return [];
      if (hasHeader) {
        const headers = lines[0].split(delimiter).map((h) => h.trim());
        return lines.slice(1).map((line) => {
          const values = line.split(delimiter);
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim(); });
          return obj;
        });
      }
      return lines.map((line) => line.split(delimiter).map((v) => v.trim()));
    }
    case 'xml': {
      // Simple XML to object parser (handles basic cases)
      const result: Record<string, unknown> = {};
      const tagRegex = /<(\w+)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
      let match;
      while ((match = tagRegex.exec(data)) !== null) {
        result[match[1]] = match[2].trim();
      }
      return result;
    }
    case 'yaml': {
      // Use the yaml package if available, otherwise basic parsing
      try {
        const yaml = require('yaml');
        return yaml.parse(data);
      } catch {
        throw new Error('core.parse: yaml format requires the "yaml" package');
      }
    }
    case 'url_params': {
      const params = new URLSearchParams(data);
      const result: Record<string, string> = {};
      params.forEach((value, key) => { result[key] = value; });
      return result;
    }
    default:
      throw new Error(`core.parse: unknown format "${format}"`);
  }
}

// ============================================================================
// core.compress / core.decompress - Compression operations
// ============================================================================

export function executeCompress(inputs: Record<string, unknown>): unknown {
  const { gzipSync, deflateSync } = require('node:zlib');
  const data = inputs.data as string;
  const algorithm = (inputs.algorithm as string) ?? 'gzip';

  if (!data) throw new Error('core.compress: data is required');

  const buf = Buffer.from(data, 'utf8');
  switch (algorithm) {
    case 'gzip':
      return gzipSync(buf).toString('base64');
    case 'deflate':
      return deflateSync(buf).toString('base64');
    default:
      throw new Error(`core.compress: unknown algorithm "${algorithm}"`);
  }
}

export function executeDecompress(inputs: Record<string, unknown>): unknown {
  const { gunzipSync, inflateSync } = require('node:zlib');
  const data = inputs.data as string;
  const algorithm = (inputs.algorithm as string) ?? 'gzip';

  if (!data) throw new Error('core.decompress: data is required');

  const buf = Buffer.from(data, 'base64');
  switch (algorithm) {
    case 'gzip':
      return gunzipSync(buf).toString('utf8');
    case 'deflate':
      return inflateSync(buf).toString('utf8');
    default:
      throw new Error(`core.decompress: unknown algorithm "${algorithm}"`);
  }
}
