/**
 * Nunjucks Filters Integration Tests
 *
 * Tests all 45+ custom Nunjucks filters:
 * - String (7): split, slugify, prefix, suffix, truncate, substring, contains
 * - Regex (3): match, notMatch, regexReplace
 * - Object (7): path, keys, values, entries, pick, omit, merge
 * - Array (5): nth, count, sum, unique, flatten
 * - Date (4): format_date, add_days, subtract_days, diff_days
 * - JSON (2): parse_json, to_json
 * - Type checks (6): is_array, is_object, is_string, is_number, is_empty, is_null
 * - Logic (4): ternary, and, or, not
 * - Math (5): round, floor, ceil, min, max
 * - Global (1): now()
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../src/engine.js';
import { loadInline } from '../utils/workflow-loader.js';
import { createSmartExecutor } from '../mock-executor.js';
import { WorkflowStatus } from '../../src/models.js';

describe('Nunjucks Filters Integration Tests', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  // ============================================================================
  // String Filters (7)
  // ============================================================================

  describe('String Filters', () => {
    it('split: should split string by delimiter', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: split-test
          name: Split Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ path | split('/') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { path: 'owner/repo/file' },
        registry,
        executor
      );

      expect(result.output.output.result).toEqual(['owner', 'repo', 'file']);
    });

    it('slugify: should create URL-safe slug', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: slugify-test
          name: Slugify Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ title | slugify }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { title: 'Hello World! This is a Test.' },
        registry,
        executor
      );

      expect(result.output.output.result).toBe('hello-world-this-is-a-test');
    });

    it('prefix: should add prefix to string', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: prefix-test
          name: Prefix Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ username | prefix('@') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { username: 'alice' },
        registry,
        executor
      );

      expect(result.output.output.result).toBe('@alice');
    });

    it('suffix: should add suffix to string', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: suffix-test
          name: Suffix Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ greeting | suffix('!') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { greeting: 'Hello' },
        registry,
        executor
      );

      expect(result.output.output.result).toBe('Hello!');
    });

    it('truncate: should truncate long strings', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: truncate-test
          name: Truncate Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ text | truncate(10) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { text: 'This is a very long text that should be truncated' },
        registry,
        executor
      );

      expect(result.output.output.result).toBe('This is a ...');
    });

    it('substring: should extract substring', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: substring-test
          name: Substring Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ text | substring(0, 5) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { text: 'Hello World' },
        registry,
        executor
      );

      expect(result.output.output.result).toBe('Hello');
    });

    it('contains: should check if string contains value', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: contains-test
          name: Contains Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              has_world: "{{ text | contains('World') }}"
              has_xyz: "{{ text | contains('xyz') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { text: 'Hello World' },
        registry,
        executor
      );

      expect(result.output.output.has_world).toBe(true);
      expect(result.output.output.has_xyz).toBe(false);
    });
  });

  // ============================================================================
  // Regex Filters (3)
  // ============================================================================

  describe('Regex Filters', () => {
    it('match: should extract regex match', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: match-test
          name: Match Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              username: "{{ email | match('/([^@]+)@/') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { email: 'alice@example.com' },
        registry,
        executor
      );

      expect(result.output.output.username).toBe('alice');
    });

    it('match: should extract specific capture group', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: match-group-test
          name: Match Group Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              repo: "{{ path | match('/([^/]+)/([^/]+)/', 2) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { path: 'owner/repo' },
        registry,
        executor
      );

      expect(result.output.output.repo).toBe('repo');
    });

    it('notMatch: should return true if pattern does not match', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: not-match-test
          name: Not Match Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              is_valid: "{{ email | notMatch('/spam/i') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { email: 'alice@example.com' },
        registry,
        executor
      );

      expect(result.output.output.is_valid).toBe(true);
    });

    it('regexReplace: should replace with regex', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: regex-replace-test
          name: Regex Replace Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ text | regexReplace('/[^a-z0-9]+/', '-', 'gi') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { text: 'Hello World!' },
        registry,
        executor
      );

      expect(result.output.output.result).toBe('Hello-World-');
    });
  });

  // ============================================================================
  // Object Filters (7)
  // ============================================================================

  describe('Object Filters', () => {
    it('path: should access nested object path', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: path-test
          name: Path Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              name: "{{ data | path('user.profile.name') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { data: { user: { profile: { name: 'Alice' } } } },
        registry,
        executor
      );

      expect(result.output.output.name).toBe('Alice');
    });

    it('keys: should get object keys', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: keys-test
          name: Keys Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ obj | keys }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { obj: { a: 1, b: 2, c: 3 } },
        registry,
        executor
      );

      expect(result.output.output.result).toEqual(['a', 'b', 'c']);
    });

    it('values: should get object values', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: values-test
          name: Values Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ obj | values }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { obj: { a: 1, b: 2, c: 3 } },
        registry,
        executor
      );

      expect(result.output.output.result).toEqual([1, 2, 3]);
    });

    it('entries: should get object entries', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: entries-test
          name: Entries Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ obj | entries }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { obj: { a: 1, b: 2 } },
        registry,
        executor
      );

      expect(result.output.output.result).toEqual([['a', 1], ['b', 2]]);
    });

    it('pick: should pick specific keys', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: pick-test
          name: Pick Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ obj | pick('a', 'c') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { obj: { a: 1, b: 2, c: 3 } },
        registry,
        executor
      );

      expect(result.output.output.result).toEqual({ a: 1, c: 3 });
    });

    it('omit: should omit specific keys', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: omit-test
          name: Omit Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ obj | omit('b') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { obj: { a: 1, b: 2, c: 3 } },
        registry,
        executor
      );

      expect(result.output.output.result).toEqual({ a: 1, c: 3 });
    });

    it('merge: should merge objects', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: merge-test
          name: Merge Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ obj1 | merge(obj2) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { obj1: { a: 1 }, obj2: { b: 2 } },
        registry,
        executor
      );

      expect(result.output.output.result).toEqual({ a: 1, b: 2 });
    });
  });

  // ============================================================================
  // Array Filters (5)
  // ============================================================================

  describe('Array Filters', () => {
    it('nth: should get nth element', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: nth-test
          name: Nth Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ items | nth(2) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { items: ['a', 'b', 'c', 'd'] },
        registry,
        executor
      );

      expect(result.output.output.result).toBe('c');
    });

    it('count: should count items', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: count-test
          name: Count Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ items | count }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { items: [1, 2, 3, 4, 5] },
        registry,
        executor
      );

      expect(result.output.output.result).toBe(5);
    });

    it('sum: should sum numbers', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: sum-test
          name: Sum Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ numbers | sum }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { numbers: [1, 2, 3, 4, 5] },
        registry,
        executor
      );

      expect(result.output.output.result).toBe(15);
    });

    it('unique: should remove duplicates', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: unique-test
          name: Unique Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ items | unique }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { items: [1, 2, 2, 3, 3, 3, 4] },
        registry,
        executor
      );

      expect(result.output.output.result).toEqual([1, 2, 3, 4]);
    });

    it('flatten: should flatten nested arrays', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: flatten-test
          name: Flatten Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ nested | flatten }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { nested: [[1, 2], [3, 4], [5]] },
        registry,
        executor
      );

      expect(result.output.output.result).toEqual([1, 2, 3, 4, 5]);
    });
  });

  // ============================================================================
  // Date Filters (4)
  // ============================================================================

  describe('Date Filters', () => {
    it('format_date: should format date', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: format-date-test
          name: Format Date Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ timestamp | format_date('YYYY-MM-DD') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const timestamp = new Date('2025-01-31T12:00:00Z').getTime();
      const result = await engine.execute(workflow, { timestamp }, registry, executor);

      expect(result.output.output.result).toMatch(/2025-01-31/);
    });

    it('add_days: should add days to date', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: add-days-test
          name: Add Days Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ timestamp | add_days(7) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const timestamp = new Date('2025-01-01T00:00:00Z').getTime();
      const result = await engine.execute(workflow, { timestamp }, registry, executor);

      const expected = new Date('2025-01-08T00:00:00Z').getTime();
      expect(result.output.output.result).toBe(expected);
    });

    it('subtract_days: should subtract days from date', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: subtract-days-test
          name: Subtract Days Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ timestamp | subtract_days(5) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const timestamp = new Date('2025-01-10T00:00:00Z').getTime();
      const result = await engine.execute(workflow, { timestamp }, registry, executor);

      const expected = new Date('2025-01-05T00:00:00Z').getTime();
      expect(result.output.output.result).toBe(expected);
    });

    it('diff_days: should calculate day difference', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: diff-days-test
          name: Diff Days Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ date1 | diff_days(date2) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const date1 = new Date('2025-01-10T00:00:00Z').getTime();
      const date2 = new Date('2025-01-01T00:00:00Z').getTime();
      const result = await engine.execute(workflow, { date1, date2 }, registry, executor);

      expect(result.output.output.result).toBe(9);
    });
  });

  // ============================================================================
  // JSON Filters (2)
  // ============================================================================

  describe('JSON Filters', () => {
    it('parse_json: should parse JSON string', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: parse-json-test
          name: Parse JSON Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ json_str | parse_json }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { json_str: '{"name": "Alice", "age": 30}' },
        registry,
        executor
      );

      expect(result.output.output.result).toEqual({ name: 'Alice', age: 30 });
    });

    it('to_json: should stringify to JSON', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: to-json-test
          name: To JSON Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ data | to_json }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { data: { name: 'Alice' } },
        registry,
        executor
      );

      expect(result.output.output.result).toBe('{"name":"Alice"}');
    });
  });

  // ============================================================================
  // Type Check Filters (6)
  // ============================================================================

  describe('Type Check Filters', () => {
    it('is_array: should check if value is array', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: is-array-test
          name: Is Array Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              array_check: "{{ arr | is_array }}"
              string_check: "{{ str | is_array }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { arr: [1, 2, 3], str: 'hello' },
        registry,
        executor
      );

      expect(result.output.output.array_check).toBe(true);
      expect(result.output.output.string_check).toBe(false);
    });

    it('is_object: should check if value is object', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: is-object-test
          name: Is Object Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              obj_check: "{{ obj | is_object }}"
              arr_check: "{{ arr | is_object }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { obj: { a: 1 }, arr: [1, 2] },
        registry,
        executor
      );

      expect(result.output.output.obj_check).toBe(true);
      expect(result.output.output.arr_check).toBe(false);
    });

    it('is_string: should check if value is string', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: is-string-test
          name: Is String Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              str_check: "{{ str | is_string }}"
              num_check: "{{ num | is_string }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { str: 'hello', num: 42 },
        registry,
        executor
      );

      expect(result.output.output.str_check).toBe(true);
      expect(result.output.output.num_check).toBe(false);
    });

    it('is_number: should check if value is number', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: is-number-test
          name: Is Number Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              num_check: "{{ num | is_number }}"
              str_check: "{{ str | is_number }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { num: 42, str: '42' },
        registry,
        executor
      );

      expect(result.output.output.num_check).toBe(true);
      expect(result.output.output.str_check).toBe(false);
    });

    it('is_empty: should check if value is empty', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: is-empty-test
          name: Is Empty Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              empty_arr: "{{ empty_arr | is_empty }}"
              full_arr: "{{ full_arr | is_empty }}"
              empty_str: "{{ empty_str | is_empty }}"
              empty_obj: "{{ empty_obj | is_empty }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { empty_arr: [], full_arr: [1], empty_str: '', empty_obj: {} },
        registry,
        executor
      );

      expect(result.output.output.empty_arr).toBe(true);
      expect(result.output.output.full_arr).toBe(false);
      expect(result.output.output.empty_str).toBe(true);
      expect(result.output.output.empty_obj).toBe(true);
    });

    it('is_null: should check if value is null', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: is-null-test
          name: Is Null Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              null_check: "{{ null_val | is_null }}"
              defined_check: "{{ defined_val | is_null }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { null_val: null, defined_val: 'value' },
        registry,
        executor
      );

      expect(result.output.output.null_check).toBe(true);
      expect(result.output.output.defined_check).toBe(false);
    });
  });

  // ============================================================================
  // Logic Filters (4)
  // ============================================================================

  describe('Logic Filters', () => {
    it('ternary: should return value based on condition', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: ternary-test
          name: Ternary Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              active_result: "{{ active | ternary('enabled', 'disabled') }}"
              inactive_result: "{{ inactive | ternary('enabled', 'disabled') }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { active: true, inactive: false },
        registry,
        executor
      );

      expect(result.output.output.active_result).toBe('enabled');
      expect(result.output.output.inactive_result).toBe('disabled');
    });

    it('and: should perform logical AND', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: and-test
          name: And Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              both_true: "{{ a | and(b) }}"
              one_false: "{{ a | and(c) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { a: true, b: true, c: false },
        registry,
        executor
      );

      expect(result.output.output.both_true).toBe(true);
      expect(result.output.output.one_false).toBe(false);
    });

    it('or: should perform logical OR', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: or-test
          name: Or Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ empty | or(fallback) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { empty: '', fallback: 'default' },
        registry,
        executor
      );

      expect(result.output.output.result).toBe('default');
    });

    it('not: should perform logical NOT', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: not-test
          name: Not Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              not_true: "{{ flag | not }}"
              not_false: "{{ no_flag | not }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { flag: true, no_flag: false },
        registry,
        executor
      );

      expect(result.output.output.not_true).toBe(false);
      expect(result.output.output.not_false).toBe(true);
    });
  });

  // ============================================================================
  // Math Filters (5)
  // ============================================================================

  describe('Math Filters', () => {
    it('round: should round numbers', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: round-test
          name: Round Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              rounded: "{{ num | round }}"
              rounded_decimals: "{{ num | round(2) }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { num: 3.756 },
        registry,
        executor
      );

      expect(result.output.output.rounded).toBe(4);
      expect(result.output.output.rounded_decimals).toBe(3.76);
    });

    it('floor: should round down', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: floor-test
          name: Floor Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ num | floor }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, { num: 3.9 }, registry, executor);

      expect(result.output.output.result).toBe(3);
    });

    it('ceil: should round up', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: ceil-test
          name: Ceil Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ num | ceil }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, { num: 3.1 }, registry, executor);

      expect(result.output.output.result).toBe(4);
    });

    it('min: should find minimum', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: min-test
          name: Min Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ numbers | min }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { numbers: [5, 2, 8, 1, 9] },
        registry,
        executor
      );

      expect(result.output.output.result).toBe(1);
    });

    it('max: should find maximum', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: max-test
          name: Max Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ numbers | max }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { numbers: [5, 2, 8, 1, 9] },
        registry,
        executor
      );

      expect(result.output.output.result).toBe(9);
    });
  });

  // ============================================================================
  // Global Functions (1)
  // ============================================================================

  describe('Global Functions', () => {
    it('now(): should return current timestamp', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: now-test
          name: Now Test
        steps:
          - id: test
            type: action
            action: core.set
            inputs:
              result: "{{ now() }}"
            output_variable: output
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const before = Date.now();
      const result = await engine.execute(workflow, {}, registry, executor);
      const after = Date.now();

      expect(result.output.output.result).toBeGreaterThanOrEqual(before);
      expect(result.output.output.result).toBeLessThanOrEqual(after);
    });
  });
});
