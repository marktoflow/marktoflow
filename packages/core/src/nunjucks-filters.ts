/**
 * Custom Nunjucks Filters for marktoflow
 *
 * This module provides custom filters that extend Nunjucks built-in filters.
 * See https://mozilla.github.io/nunjucks/templating.html#builtin-filters
 *
 * Nunjucks Built-in Filters (do not redefine):
 * - upper, lower, trim, first, last, length, reverse, sort, join, default
 * - capitalize, title, replace, slice, abs, batch, groupby, random, etc.
 *
 * Custom Filters (defined here):
 * - String: split, slugify, prefix, suffix, truncate, substring, contains
 * - Regex: match, notMatch, regexReplace
 * - Object: path, keys, values, entries, pick, omit, merge
 * - Array: nth, count, sum, unique, flatten
 * - Date: now, format_date, add_days, subtract_days, diff_days
 * - JSON: parse_json, to_json
 * - Type checks: is_array, is_object, is_string, is_number, is_empty, is_null
 * - Logic: ternary, and, or, not
 * - Math: round, floor, ceil, min, max
 */

import type nunjucks from 'nunjucks';

// ============================================================================
// String Filters
// ============================================================================

/**
 * Split string by delimiter
 * Usage: {{ "a,b,c" | split(',') }} → ['a', 'b', 'c']
 */
export function split(value: unknown, delimiter: string = ','): string[] {
  return String(value ?? '').split(delimiter);
}

/**
 * Convert to URL-friendly slug
 * Usage: {{ "Hello World!" | slugify }} → "hello-world"
 */
export function slugify(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Add prefix to string
 * Usage: {{ "hello" | prefix('@') }} → "@hello"
 */
export function prefix(value: unknown, prefixStr: string): string {
  return prefixStr + String(value ?? '');
}

/**
 * Add suffix to string
 * Usage: {{ "hello" | suffix('!') }} → "hello!"
 */
export function suffix(value: unknown, suffixStr: string): string {
  return String(value ?? '') + suffixStr;
}

/**
 * Truncate string to length
 * Usage: {{ "hello world" | truncate(5) }} → "hello..."
 */
export function truncate(value: unknown, length: number, ellipsis: string = '...'): string {
  const str = String(value ?? '');
  if (str.length <= length) return str;
  return str.slice(0, length) + ellipsis;
}

/**
 * Extract substring
 * Usage: {{ "hello world" | substring(0, 5) }} → "hello"
 */
export function substring(value: unknown, start: number, end?: number): string {
  return String(value ?? '').substring(start, end);
}

/**
 * Check if string/array contains value
 * Usage: {{ "hello world" | contains('world') }} → true
 */
export function contains(value: unknown, search: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes(String(search));
  }
  if (Array.isArray(value)) {
    return value.includes(search);
  }
  return false;
}

// ============================================================================
// Regex Filters (Breaking change from old =~, !~, // operators)
// ============================================================================

/**
 * Match and extract using regex
 * Usage: {{ value | match('/pattern/', 1) }} → capture group 1
 * Usage: {{ value | match('/pattern/') }} → full match or first group
 *
 * Pattern format: '/pattern/flags' where flags are optional (gimsu)
 */
export function match(value: unknown, pattern: string, groupIndex?: number): unknown {
  const str = String(value ?? '');
  const { regex } = parseRegexPattern(pattern);

  const result = str.match(regex);
  if (!result) return null;

  // If group index specified, return that group
  if (groupIndex !== undefined) {
    return result[groupIndex] ?? null;
  }

  // If has named groups, return groups object
  if (result.groups && Object.keys(result.groups).length > 0) {
    return result.groups;
  }

  // If has capture groups, return first capture group
  if (result.length > 1) {
    return result[1];
  }

  // Return full match
  return result[0];
}

/**
 * Negative match - returns true if pattern does NOT match
 * Usage: {{ value | notMatch('/pattern/') }} → true/false
 */
export function notMatch(value: unknown, pattern: string): boolean {
  const str = String(value ?? '');
  const { regex } = parseRegexPattern(pattern);
  return !regex.test(str);
}

/**
 * Replace using regex
 * Usage: {{ value | regexReplace('/pattern/', 'replacement', 'g') }}
 *
 * Pattern format: '/pattern/' (without flags, add flags as 3rd arg)
 * or '/pattern/flags' (with flags inline)
 */
export function regexReplace(
  value: unknown,
  pattern: string,
  replacement: string,
  flags?: string
): string {
  const str = String(value ?? '');
  const parsed = parseRegexPattern(pattern);
  // Merge flags (argument overrides inline flags if both provided)
  const finalFlags = flags ?? parsed.flags;
  const regex = new RegExp(parsed.pattern, finalFlags);
  return str.replace(regex, replacement);
}

/**
 * Parse a regex pattern string like '/pattern/flags'
 */
function parseRegexPattern(pattern: string): { pattern: string; flags: string; regex: RegExp } {
  // Handle '/pattern/flags' format
  const regexMatch = pattern.match(/^\/(.+)\/([gimsu]*)$/);
  if (regexMatch) {
    const [, p, f] = regexMatch;
    return { pattern: p, flags: f, regex: new RegExp(p, f) };
  }
  // Plain pattern without slashes
  return { pattern, flags: '', regex: new RegExp(pattern) };
}

// ============================================================================
// Object Filters
// ============================================================================

/**
 * Get value at path
 * Usage: {{ obj | path('user.name') }} → obj.user.name
 */
export function path(value: unknown, pathStr: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const keys = pathStr.split('.');
  let result: unknown = value;

  for (const key of keys) {
    if (typeof result !== 'object' || result === null) {
      return undefined;
    }
    result = (result as Record<string, unknown>)[key];
  }

  return result;
}

/**
 * Get object keys
 * Usage: {{ {a: 1, b: 2} | keys }} → ['a', 'b']
 */
export function keys(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.keys(value);
}

/**
 * Get object values
 * Usage: {{ {a: 1, b: 2} | values }} → [1, 2]
 */
export function values(value: unknown): unknown[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.values(value);
}

/**
 * Get object entries (key-value pairs)
 * Usage: {{ {a: 1, b: 2} | entries }} → [['a', 1], ['b', 2]]
 */
export function entries(value: unknown): [string, unknown][] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.entries(value);
}

/**
 * Pick specific keys from object
 * Usage: {{ obj | pick('a', 'c') }} → {a: 1, c: 3}
 */
export function pick(value: unknown, ...keysToPick: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of keysToPick) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Omit specific keys from object
 * Usage: {{ obj | omit('b') }} → {a: 1, c: 3}
 */
export function omit(value: unknown, ...keysToOmit: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const omitSet = new Set(keysToOmit);

  for (const [key, val] of Object.entries(obj)) {
    if (!omitSet.has(key)) {
      result[key] = val;
    }
  }

  return result;
}

/**
 * Merge objects
 * Usage: {{ {a: 1} | merge({b: 2}) }} → {a: 1, b: 2}
 */
export function merge(value: unknown, ...objects: unknown[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  let result = { ...value } as Record<string, unknown>;

  for (const obj of objects) {
    if (typeof obj === 'object' && obj !== null) {
      result = { ...result, ...obj };
    }
  }

  return result;
}

// ============================================================================
// Array Filters
// ============================================================================

/**
 * Get nth element (0-indexed)
 * Usage: {{ [1, 2, 3] | nth(1) }} → 2
 */
export function nth(value: unknown, index: number): unknown {
  if (Array.isArray(value)) {
    return value[index];
  }
  return value;
}

/**
 * Get array length or object property count
 * Usage: {{ [1, 2, 3] | count }} → 3
 */
export function count(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (typeof value === 'string') {
    return value.length;
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('length' in obj && typeof obj.length === 'number') return obj.length;
    if ('total' in obj && typeof obj.total === 'number') return obj.total;
    if ('count' in obj && typeof obj.count === 'number') return obj.count;
    return Object.keys(value).length;
  }
  return 0;
}

/**
 * Sum array of numbers
 * Usage: {{ [1, 2, 3] | sum }} → 6
 */
export function sum(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((acc: number, val) => acc + Number(val), 0);
}

/**
 * Get unique values
 * Usage: {{ [1, 2, 2, 3] | unique }} → [1, 2, 3]
 */
export function unique(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [value];
  return Array.from(new Set(value));
}

/**
 * Flatten array one level
 * Usage: {{ [[1, 2], [3, 4]] | flatten }} → [1, 2, 3, 4]
 */
export function flatten(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [value];
  return value.flat(1);
}

// ============================================================================
// Date Filters
// ============================================================================

/**
 * Get current timestamp
 * Usage: {{ now() }} → 1706745600000
 * Note: In Nunjucks, use as {{ now() }} (global function, not filter)
 */
export function now(): number {
  return Date.now();
}

/**
 * Format date
 * Usage: {{ timestamp | format_date('YYYY-MM-DD') }} → "2025-01-31"
 */
export function format_date(value: unknown, format: string = 'YYYY-MM-DD'): string {
  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

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
 * Add days to date
 * Usage: {{ timestamp | add_days(7) }} → timestamp + 7 days
 */
export function add_days(value: unknown, days: number): number {
  const date = new Date(value as string | number);
  if (isNaN(date.getTime())) return 0;
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/**
 * Subtract days from date
 * Usage: {{ timestamp | subtract_days(7) }} → timestamp - 7 days
 */
export function subtract_days(value: unknown, days: number): number {
  const date = new Date(value as string | number);
  if (isNaN(date.getTime())) return 0;
  date.setDate(date.getDate() - days);
  return date.getTime();
}

/**
 * Get date difference in days
 * Usage: {{ date1 | diff_days(date2) }} → number of days
 */
export function diff_days(value: unknown, compareDate: unknown): number {
  const date1 = new Date(value as string | number);
  const date2 = new Date(compareDate as string | number);
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
  const diffMs = date1.getTime() - date2.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ============================================================================
// JSON Filters
// ============================================================================

/**
 * Parse JSON string
 * Usage: {{ '{"a":1}' | parse_json }} → {a: 1}
 */
export function parse_json(value: unknown): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

/**
 * Stringify to JSON
 * Usage: {{ {a: 1} | to_json }} → '{"a":1}'
 */
export function to_json(value: unknown, pretty: boolean = false): string {
  return JSON.stringify(value, null, pretty ? 2 : 0);
}

// ============================================================================
// Type Check Filters
// ============================================================================

/**
 * Check if value is array
 */
export function is_array(value: unknown): boolean {
  return Array.isArray(value);
}

/**
 * Check if value is object
 */
export function is_object(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is string
 */
export function is_string(value: unknown): boolean {
  return typeof value === 'string';
}

/**
 * Check if value is number
 */
export function is_number(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is empty
 */
export function is_empty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Check if value is null
 */
export function is_null(value: unknown): boolean {
  return value === null;
}

// ============================================================================
// Logic Filters
// ============================================================================

/**
 * Ternary operator
 * Usage: {{ condition | ternary('yes', 'no') }}
 */
export function ternary(condition: unknown, trueVal: unknown, falseVal: unknown): unknown {
  return condition ? trueVal : falseVal;
}

/**
 * Logical AND
 * Usage: {{ true | and(1, 'value') }} → true
 */
export function and(value: unknown, ...values: unknown[]): boolean {
  if (!value) return false;
  for (const v of values) {
    if (!v) return false;
  }
  return true;
}

/**
 * Logical OR (return first truthy)
 * Usage: {{ null | or('fallback') }} → "fallback"
 */
export function or(value: unknown, ...alternatives: unknown[]): unknown {
  if (value) return value;
  for (const alt of alternatives) {
    if (alt) return alt;
  }
  return null;
}

/**
 * Logical NOT
 * Usage: {{ true | not }} → false
 */
export function not(value: unknown): boolean {
  return !value;
}

// ============================================================================
// Math Filters (extending Nunjucks built-in abs)
// ============================================================================

/**
 * Round to nearest integer or decimal places
 * Usage: {{ 3.7 | round }} → 4
 * Usage: {{ 3.756 | round(2) }} → 3.76
 */
export function round(value: unknown, decimals: number = 0): number {
  const num = Number(value);
  const multiplier = Math.pow(10, decimals);
  return Math.round(num * multiplier) / multiplier;
}

/**
 * Round down
 * Usage: {{ 3.7 | floor }} → 3
 */
export function floor(value: unknown): number {
  return Math.floor(Number(value));
}

/**
 * Round up
 * Usage: {{ 3.1 | ceil }} → 4
 */
export function ceil(value: unknown): number {
  return Math.ceil(Number(value));
}

/**
 * Get minimum value
 * Usage: {{ [1, 2, 3] | min }} → 1
 * Usage: {{ 5 | min(3) }} → 3
 */
export function min(value: unknown, ...values: unknown[]): number {
  if (Array.isArray(value)) {
    return Math.min(...value.map((v) => Number(v)));
  }
  const nums = [Number(value), ...values.map((v) => Number(v))];
  return Math.min(...nums);
}

/**
 * Get maximum value
 * Usage: {{ [1, 2, 3] | max }} → 3
 * Usage: {{ 3 | max(5) }} → 5
 */
export function max(value: unknown, ...values: unknown[]): number {
  if (Array.isArray(value)) {
    return Math.max(...value.map((v) => Number(v)));
  }
  const nums = [Number(value), ...values.map((v) => Number(v))];
  return Math.max(...nums);
}

// ============================================================================
// Filter Registration
// ============================================================================

/**
 * Register all custom filters on a Nunjucks environment
 */
export function registerFilters(env: nunjucks.Environment): void {
  // String filters
  env.addFilter('split', split);
  env.addFilter('slugify', slugify);
  env.addFilter('prefix', prefix);
  env.addFilter('suffix', suffix);
  env.addFilter('truncate', truncate);
  env.addFilter('substring', substring);
  env.addFilter('contains', contains);

  // Regex filters (new!)
  env.addFilter('match', match);
  env.addFilter('notMatch', notMatch);
  env.addFilter('regexReplace', regexReplace);

  // Object filters
  env.addFilter('path', path);
  env.addFilter('keys', keys);
  env.addFilter('values', values);
  env.addFilter('entries', entries);
  env.addFilter('pick', pick);
  env.addFilter('omit', omit);
  env.addFilter('merge', merge);

  // Array filters
  env.addFilter('nth', nth);
  env.addFilter('count', count);
  env.addFilter('sum', sum);
  env.addFilter('unique', unique);
  env.addFilter('flatten', flatten);

  // Date filters
  env.addFilter('format_date', format_date);
  env.addFilter('add_days', add_days);
  env.addFilter('subtract_days', subtract_days);
  env.addFilter('diff_days', diff_days);

  // JSON filters
  env.addFilter('parse_json', parse_json);
  env.addFilter('to_json', to_json);

  // Type check filters
  env.addFilter('is_array', is_array);
  env.addFilter('is_object', is_object);
  env.addFilter('is_string', is_string);
  env.addFilter('is_number', is_number);
  env.addFilter('is_empty', is_empty);
  env.addFilter('is_null', is_null);

  // Logic filters
  env.addFilter('ternary', ternary);
  env.addFilter('and', and);
  env.addFilter('or', or);
  env.addFilter('not', not);

  // Math filters
  env.addFilter('round', round);
  env.addFilter('floor', floor);
  env.addFilter('ceil', ceil);
  env.addFilter('min', min);
  env.addFilter('max', max);

  // Global functions
  env.addGlobal('now', now);
}
