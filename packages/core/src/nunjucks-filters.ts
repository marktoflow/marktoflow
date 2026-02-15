/**
 * Custom Nunjucks Filters for marktoflow
 *
 * Thin registration layer — all implementations live in ./filters/.
 */

import type nunjucks from 'nunjucks';

// Re-export all filters for backward compatibility
export {
  // String
  split, slugify, prefix, suffix, truncate, substring, contains,
  // Regex
  match, notMatch, regexReplace,
  // Object
  path, keys, values, entries, pick, omit, merge,
  // Array
  nth, count, sum, unique, flatten,
  // Date
  now, format_date, add_days, subtract_days, diff_days,
  // JSON
  parse_json, to_json,
  // Type checks
  is_array, is_object, is_string, is_number, is_empty, is_null,
  // Logic
  ternary, and, or, not,
  // Math
  round, floor, ceil, min, max, add, subtract, multiply, divide,
} from './filters/index.js';

import {
  split, slugify, prefix, suffix, truncate, substring, contains,
  match, notMatch, regexReplace,
  path, keys, values, entries, pick, omit, merge,
  nth, count, sum, unique, flatten,
  now, format_date, add_days, subtract_days, diff_days,
  parse_json, to_json,
  is_array, is_object, is_string, is_number, is_empty, is_null,
  ternary, and, or, not,
  round, floor, ceil, min, max, add, subtract, multiply, divide,
} from './filters/index.js';

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

  // Regex filters
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
  env.addFilter('add', add);
  env.addFilter('subtract', subtract);
  env.addFilter('multiply', multiply);
  env.addFilter('divide', divide);

  // Global functions
  env.addGlobal('now', now);
}
