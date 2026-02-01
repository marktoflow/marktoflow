/**
 * Built-in Operations Integration Tests
 *
 * Tests the 4 built-in operations:
 * - core.set: Variable assignment with template resolution
 * - core.transform: map, filter, reduce, find, group_by, unique, sort
 * - core.extract: Nested path access with defaults
 * - core.format: date, number, currency, string formatting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../src/engine.js';
import { loadInline } from '../utils/workflow-loader.js';
import { createSmartExecutor } from '../mock-executor.js';
import { WorkflowStatus } from '../../src/models.js';

describe('Built-in Operations Integration Tests', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  // ============================================================================
  // core.set Tests
  // ============================================================================

  describe('core.set', () => {
    it('should set multiple variables at once', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: set-test
          name: Set Test
        steps:
          - id: set-values
            type: action
            action: core.set
            inputs:
              name: Alice
              age: 30
              active: true
              tags:
                - admin
                - user
            output_variable: data
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.data).toEqual({
        name: 'Alice',
        age: 30,
        active: true,
        tags: ['admin', 'user'],
      });
    });

    it('should resolve templates in values', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: set-template-test
          name: Set Template Test
        steps:
          - id: init
            type: action
            action: core.set
            inputs:
              firstName: Alice
              lastName: Smith
            output_variable: user
          - id: compute
            type: action
            action: core.set
            inputs:
              fullName: "{{ user.firstName }} {{ user.lastName }}"
              greeting: "Hello, {{ user.firstName }}!"
            output_variable: computed
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.computed).toEqual({
        fullName: 'Alice Smith',
        greeting: 'Hello, Alice!',
      });
    });
  });

  // ============================================================================
  // core.transform Tests
  // ============================================================================

  describe('core.transform', () => {
    describe('map operation', () => {
      it('should transform each item in array', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: transform-map-test
            name: Transform Map Test
          steps:
            - id: double
              type: action
              action: core.transform
              inputs:
                input: "{{ numbers }}"
                operation: map
                expression: "{{ item * 2 }}"
              output_variable: doubled
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(
          workflow,
          { numbers: [1, 2, 3, 4, 5] },
          registry,
          executor
        );

        expect(result.output.doubled).toEqual([2, 4, 6, 8, 10]);
      });
    });

    describe('filter operation', () => {
      it('should filter items by condition', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: transform-filter-test
            name: Transform Filter Test
          steps:
            - id: filter-high
              type: action
              action: core.transform
              inputs:
                input: "{{ numbers }}"
                operation: filter
                condition: "{{ item > 5 }}"
              output_variable: high
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(
          workflow,
          { numbers: [2, 7, 4, 9, 1, 8, 3] },
          registry,
          executor
        );

        expect(result.output.high).toEqual([7, 9, 8]);
      });
    });

    describe('reduce operation', () => {
      it('should reduce items to single value', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: transform-reduce-test
            name: Transform Reduce Test
          steps:
            - id: sum
              type: action
              action: core.transform
              inputs:
                input: "{{ numbers }}"
                operation: reduce
                expression: "{{ accumulator + item }}"
                initialValue: 0
              output_variable: total
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(
          workflow,
          { numbers: [1, 2, 3, 4, 5] },
          registry,
          executor
        );

        expect(result.output.total).toBe(15);
      });

      it('should reduce with object accumulator', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: transform-reduce-obj-test
            name: Transform Reduce Object Test
          steps:
            - id: count
              type: action
              action: core.transform
              inputs:
                input: "{{ items }}"
                operation: reduce
                expression: "{{ accumulator | merge({count: accumulator.count + 1, sum: accumulator.sum + item}) }}"
                initialValue:
                  count: 0
                  sum: 0
              output_variable: stats
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(
          workflow,
          { items: [10, 20, 30] },
          registry,
          executor
        );

        expect(result.output.stats).toEqual({ count: 3, sum: 60 });
      });
    });

    describe('find operation', () => {
      it('should find first matching item', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: transform-find-test
            name: Transform Find Test
          steps:
            - id: find-active
              type: action
              action: core.transform
              inputs:
                input: "{{ users }}"
                operation: find
                condition: "{{ item.active }}"
              output_variable: first_active
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(
          workflow,
          {
            users: [
              { name: 'Alice', active: false },
              { name: 'Bob', active: true },
              { name: 'Charlie', active: true },
            ],
          },
          registry,
          executor
        );

        expect(result.output.first_active).toEqual({ name: 'Bob', active: true });
      });
    });

    describe('group_by operation', () => {
      it('should group items by key', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: transform-groupby-test
            name: Transform GroupBy Test
          steps:
            - id: group
              type: action
              action: core.transform
              inputs:
                input: "{{ users }}"
                operation: group_by
                key: item.department
              output_variable: by_dept
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(
          workflow,
          {
            users: [
              { name: 'Alice', department: 'eng' },
              { name: 'Bob', department: 'sales' },
              { name: 'Charlie', department: 'eng' },
            ],
          },
          registry,
          executor
        );

        expect(result.output.by_dept).toEqual({
          eng: [
            { name: 'Alice', department: 'eng' },
            { name: 'Charlie', department: 'eng' },
          ],
          sales: [{ name: 'Bob', department: 'sales' }],
        });
      });
    });

    describe('unique operation', () => {
      it('should remove duplicate values', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: transform-unique-test
            name: Transform Unique Test
          steps:
            - id: unique
              type: action
              action: core.transform
              inputs:
                input: "{{ items }}"
                operation: unique
              output_variable: unique_items
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(
          workflow,
          { items: [1, 2, 2, 3, 3, 3, 4] },
          registry,
          executor
        );

        expect(result.output.unique_items).toEqual([1, 2, 3, 4]);
      });
    });

    describe('sort operation', () => {
      it('should sort items by key', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: transform-sort-test
            name: Transform Sort Test
          steps:
            - id: sort
              type: action
              action: core.transform
              inputs:
                input: "{{ users }}"
                operation: sort
                key: item.name
              output_variable: sorted
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(
          workflow,
          {
            users: [
              { name: 'Charlie' },
              { name: 'Alice' },
              { name: 'Bob' },
            ],
          },
          registry,
          executor
        );

        expect(result.output.sorted).toEqual([
          { name: 'Alice' },
          { name: 'Bob' },
          { name: 'Charlie' },
        ]);
      });

      it('should sort in reverse order', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: transform-sort-reverse-test
            name: Transform Sort Reverse Test
          steps:
            - id: sort
              type: action
              action: core.transform
              inputs:
                input: "{{ numbers }}"
                operation: sort
                reverse: true
              output_variable: sorted
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(
          workflow,
          { numbers: [3, 1, 4, 1, 5, 9, 2, 6] },
          registry,
          executor
        );

        expect(result.output.sorted).toEqual([9, 6, 5, 4, 3, 2, 1, 1]);
      });
    });
  });

  // ============================================================================
  // core.extract Tests
  // ============================================================================

  describe('core.extract', () => {
    it('should extract nested value', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: extract-test
          name: Extract Test
        steps:
          - id: extract
            type: action
            action: core.extract
            inputs:
              input: "{{ api_response }}"
              path: data.users[0].email
            output_variable: email
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        {
          api_response: {
            data: {
              users: [{ email: 'alice@example.com' }, { email: 'bob@example.com' }],
            },
          },
        },
        registry,
        executor
      );

      expect(result.output.email).toBe('alice@example.com');
    });

    it('should return default for missing path', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: extract-default-test
          name: Extract Default Test
        steps:
          - id: extract
            type: action
            action: core.extract
            inputs:
              input: "{{ data }}"
              path: missing.field
              default: not-found
            output_variable: value
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, { data: {} }, registry, executor);

      expect(result.output.value).toBe('not-found');
    });

    it('should handle array indexing', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: extract-array-test
          name: Extract Array Test
        steps:
          - id: extract
            type: action
            action: core.extract
            inputs:
              input: "{{ data }}"
              path: items[2].name
            output_variable: name
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        {
          data: {
            items: [{ name: 'first' }, { name: 'second' }, { name: 'third' }],
          },
        },
        registry,
        executor
      );

      expect(result.output.name).toBe('third');
    });
  });

  // ============================================================================
  // core.format Tests
  // ============================================================================

  describe('core.format', () => {
    describe('date formatting', () => {
      it('should format date with pattern', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: format-date-test
            name: Format Date Test
          steps:
            - id: format
              type: action
              action: core.format
              inputs:
                value: "{{ timestamp }}"
                type: date
                format: "YYYY-MM-DD"
              output_variable: formatted
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const timestamp = new Date('2025-01-31T12:00:00Z').getTime();
        const result = await engine.execute(workflow, { timestamp }, registry, executor);

        expect(result.output.formatted).toMatch(/2025-01-31/);
      });

      it('should format date with time', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: format-datetime-test
            name: Format DateTime Test
          steps:
            - id: format
              type: action
              action: core.format
              inputs:
                value: "{{ timestamp }}"
                type: date
                format: "YYYY-MM-DD HH:mm:ss"
              output_variable: formatted
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const timestamp = new Date('2025-01-31T14:30:45Z').getTime();
        const result = await engine.execute(workflow, { timestamp }, registry, executor);

        // Note: result depends on timezone
        expect(result.output.formatted).toMatch(/2025-01-31/);
      });
    });

    describe('number formatting', () => {
      it('should format number with precision', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: format-number-test
            name: Format Number Test
          steps:
            - id: format
              type: action
              action: core.format
              inputs:
                value: 1234.5678
                type: number
                precision: 2
              output_variable: formatted
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(workflow, {}, registry, executor);

        expect(result.output.formatted).toBe('1234.57');
      });
    });

    describe('currency formatting', () => {
      it('should format currency', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: format-currency-test
            name: Format Currency Test
          steps:
            - id: format
              type: action
              action: core.format
              inputs:
                value: 1234.50
                type: currency
                currency: USD
                locale: en-US
              output_variable: formatted
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(workflow, {}, registry, executor);

        expect(result.output.formatted).toBe('$1,234.50');
      });
    });

    describe('string formatting', () => {
      it('should format string as uppercase', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: format-string-test
            name: Format String Test
          steps:
            - id: format
              type: action
              action: core.format
              inputs:
                value: hello world
                type: string
                format: upper
              output_variable: formatted
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(workflow, {}, registry, executor);

        expect(result.output.formatted).toBe('HELLO WORLD');
      });

      it('should format string as titlecase', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: format-title-test
            name: Format Title Test
          steps:
            - id: format
              type: action
              action: core.format
              inputs:
                value: hello world
                type: string
                format: title
              output_variable: formatted
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(workflow, {}, registry, executor);

        expect(result.output.formatted).toBe('Hello World');
      });
    });

    describe('JSON formatting', () => {
      it('should format as JSON', async () => {
        const { workflow } = loadInline(`
          ---
          workflow:
            id: format-json-test
            name: Format JSON Test
          steps:
            - id: format
              type: action
              action: core.format
              inputs:
                value: "{{ data }}"
                type: json
              output_variable: formatted
          ---
        `);

        const { executor, registry } = createSmartExecutor();
        const result = await engine.execute(
          workflow,
          { data: { name: 'Alice', age: 30 } },
          registry,
          executor
        );

        const parsed = JSON.parse(result.output.formatted);
        expect(parsed).toEqual({ name: 'Alice', age: 30 });
      });
    });
  });

  // ============================================================================
  // Pipeline Tests (combining operations)
  // ============================================================================

  describe('Operation Pipelines', () => {
    it('should chain map -> filter -> reduce', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: pipeline-test
          name: Pipeline Test
        steps:
          - id: double
            type: action
            action: core.transform
            inputs:
              input: "{{ numbers }}"
              operation: map
              expression: "{{ item * 2 }}"
            output_variable: doubled

          - id: filter-high
            type: action
            action: core.transform
            inputs:
              input: "{{ doubled }}"
              operation: filter
              condition: "{{ item > 10 }}"
            output_variable: filtered

          - id: sum
            type: action
            action: core.transform
            inputs:
              input: "{{ filtered }}"
              operation: reduce
              expression: "{{ accumulator + item }}"
              initialValue: 0
            output_variable: total
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        registry,
        executor
      );

      // doubled: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
      // filtered (>10): [12, 14, 16, 18, 20]
      // sum: 80
      expect(result.output.total).toBe(80);
    });
  });
});
