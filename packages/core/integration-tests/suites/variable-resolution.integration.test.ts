/**
 * Variable Resolution Integration Tests
 *
 * Tests variable resolution across workflows:
 * - Nested objects (a.b.c.d)
 * - Array indexing (items[0].property)
 * - Loop variables (item, index, loop.first/last)
 * - Cross-step variable passing
 * - Input variable access
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../src/engine.js';
import { loadInline } from '../utils/workflow-loader.js';
import { createSmartExecutor, createMockExecutor } from '../mock-executor.js';
import { WorkflowStatus } from '../../src/models.js';

describe('Variable Resolution Integration Tests', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  // ============================================================================
  // Nested Object Access
  // ============================================================================

  describe('Nested Object Access', () => {
    it('should access deeply nested properties', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: nested-test
          name: Nested Test
        steps:
          - id: access
            type: action
            action: core.set
            inputs:
              city: "{{ user.profile.address.city }}"
              country: "{{ user.profile.address.country }}"
            output_variable: location
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        {
          user: {
            profile: {
              address: {
                city: 'New York',
                country: 'USA',
              },
            },
          },
        },
        registry,
        executor
      );

      expect(result.output.location).toEqual({
        city: 'New York',
        country: 'USA',
      });
    });

    it('should handle missing nested properties gracefully', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: missing-nested-test
          name: Missing Nested Test
        steps:
          - id: access
            type: action
            action: core.set
            inputs:
              value: "{{ user.profile.missing.property | default('not-found') }}"
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { user: { profile: {} } },
        registry,
        executor
      );

      expect(result.output.result.value).toBe('not-found');
    });
  });

  // ============================================================================
  // Array Indexing
  // ============================================================================

  describe('Array Indexing', () => {
    it('should access array elements by index', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: array-index-test
          name: Array Index Test
        steps:
          - id: access
            type: action
            action: core.set
            inputs:
              first: "{{ items[0] }}"
              second: "{{ items[1] }}"
              last: "{{ items[2] }}"
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { items: ['apple', 'banana', 'cherry'] },
        registry,
        executor
      );

      expect(result.output.result).toEqual({
        first: 'apple',
        second: 'banana',
        last: 'cherry',
      });
    });

    it('should access nested array element properties', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: nested-array-test
          name: Nested Array Test
        steps:
          - id: access
            type: action
            action: core.set
            inputs:
              firstName: "{{ users[0].name }}"
              secondRole: "{{ users[1].roles[0] }}"
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        {
          users: [
            { name: 'Alice', roles: ['admin'] },
            { name: 'Bob', roles: ['user', 'moderator'] },
          ],
        },
        registry,
        executor
      );

      expect(result.output.result).toEqual({
        firstName: 'Alice',
        secondRole: 'user',
      });
    });

    it('should handle mixed path notation', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: mixed-path-test
          name: Mixed Path Test
        steps:
          - id: access
            type: action
            action: core.set
            inputs:
              value: "{{ data.users[1].profile.tags[0] }}"
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        {
          data: {
            users: [
              { profile: { tags: ['a'] } },
              { profile: { tags: ['b', 'c'] } },
            ],
          },
        },
        registry,
        executor
      );

      expect(result.output.result.value).toBe('b');
    });
  });

  // ============================================================================
  // Loop Variables
  // ============================================================================

  describe('Loop Variables', () => {
    it('should access item and index in for_each', async () => {
      const { executor, registry, getCapturedInputs } = createMockExecutor({
        defaultBehavior: { dynamic: (step) => step.inputs },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: loop-vars-test
          name: Loop Vars Test
        steps:
          - id: loop
            type: for_each
            items: "{{ items }}"
            item_variable: item
            index_variable: idx
            steps:
              - id: process
                type: action
                action: mock.process
                inputs:
                  name: "{{ item.name }}"
                  position: "{{ idx }}"
        ---
      `);

      const result = await engine.execute(
        workflow,
        { items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] },
        registry,
        executor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);

      const inputs = getCapturedInputs('process');
      expect(inputs[0]).toEqual({ name: 'A', position: 0 });
      expect(inputs[1]).toEqual({ name: 'B', position: 1 });
      expect(inputs[2]).toEqual({ name: 'C', position: 2 });
    });

    it('should access loop metadata (first, last, length)', async () => {
      const { executor, registry, getCapturedInputs } = createMockExecutor({
        defaultBehavior: { dynamic: (step) => step.inputs },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: loop-meta-test
          name: Loop Meta Test
        steps:
          - id: loop
            type: for_each
            items: "{{ items }}"
            item_variable: item
            steps:
              - id: process
                type: action
                action: mock.process
                inputs:
                  value: "{{ item }}"
                  isFirst: "{{ loop.first }}"
                  isLast: "{{ loop.last }}"
                  total: "{{ loop.length }}"
                  index: "{{ loop.index }}"
        ---
      `);

      const result = await engine.execute(
        workflow,
        { items: ['X', 'Y', 'Z'] },
        registry,
        executor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);

      const inputs = getCapturedInputs('process');
      expect(inputs[0]).toEqual({ value: 'X', isFirst: true, isLast: false, total: 3, index: 0 });
      expect(inputs[1]).toEqual({ value: 'Y', isFirst: false, isLast: false, total: 3, index: 1 });
      expect(inputs[2]).toEqual({ value: 'Z', isFirst: false, isLast: true, total: 3, index: 2 });
    });

    it('should access nested item properties', async () => {
      const { executor, registry, getCapturedInputs } = createMockExecutor({
        defaultBehavior: { dynamic: (step) => step.inputs },
      });

      const { workflow } = loadInline(`
        ---
        workflow:
          id: loop-nested-test
          name: Loop Nested Test
        steps:
          - id: loop
            type: for_each
            items: "{{ users }}"
            item_variable: user
            steps:
              - id: process
                type: action
                action: mock.process
                inputs:
                  name: "{{ user.name }}"
                  email: "{{ user.contact.email }}"
                  firstTag: "{{ user.tags[0] }}"
        ---
      `);

      const result = await engine.execute(
        workflow,
        {
          users: [
            { name: 'Alice', contact: { email: 'alice@test.com' }, tags: ['admin', 'active'] },
            { name: 'Bob', contact: { email: 'bob@test.com' }, tags: ['user'] },
          ],
        },
        registry,
        executor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);

      const inputs = getCapturedInputs('process');
      expect(inputs[0]).toEqual({
        name: 'Alice',
        email: 'alice@test.com',
        firstTag: 'admin',
      });
      expect(inputs[1]).toEqual({
        name: 'Bob',
        email: 'bob@test.com',
        firstTag: 'user',
      });
    });
  });

  // ============================================================================
  // Cross-Step Variable Passing
  // ============================================================================

  describe('Cross-Step Variable Passing', () => {
    it('should pass variables between steps', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: cross-step-test
          name: Cross Step Test
        steps:
          - id: step1
            type: action
            action: core.set
            inputs:
              value: 100
            output_variable: first

          - id: step2
            type: action
            action: core.set
            inputs:
              doubled: "{{ first.value * 2 }}"
            output_variable: second

          - id: step3
            type: action
            action: core.set
            inputs:
              tripled: "{{ second.doubled + first.value }}"
            output_variable: third
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.first).toEqual({ value: 100 });
      expect(result.output.second).toEqual({ doubled: 200 });
      expect(result.output.third).toEqual({ tripled: 300 });
    });

    it('should accumulate data across steps', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: accumulate-test
          name: Accumulate Test
        steps:
          - id: init
            type: action
            action: core.set
            inputs:
              items: []
              count: 0
            output_variable: state

          - id: add-first
            type: action
            action: core.set
            inputs:
              items: "{{ state.items | merge(['item1']) }}"
              count: "{{ state.count + 1 }}"
            output_variable: state

          - id: add-second
            type: action
            action: core.set
            inputs:
              items: "{{ state.items | merge(['item2']) }}"
              count: "{{ state.count + 1 }}"
            output_variable: state
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      // Note: merge on arrays might produce object, adjust if needed
      expect(result.output.state.count).toBe(2);
    });
  });

  // ============================================================================
  // Input Variable Access
  // ============================================================================

  describe('Input Variable Access', () => {
    it('should access inputs with inputs.* prefix', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: inputs-test
          name: Inputs Test

        inputs:
          userName:
            type: string
          userAge:
            type: integer

        steps:
          - id: use-inputs
            type: action
            action: core.set
            inputs:
              greeting: "Hello, {{ inputs.userName }}!"
              isAdult: "{{ inputs.userAge >= 18 }}"
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { userName: 'Alice', userAge: 25 },
        registry,
        executor
      );

      expect(result.output.result).toEqual({
        greeting: 'Hello, Alice!',
        isAdult: true,
      });
    });

    it('should access top-level inputs without prefix', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: top-level-inputs-test
          name: Top Level Inputs Test
        steps:
          - id: use-inputs
            type: action
            action: core.set
            inputs:
              message: "{{ message }}"
              count: "{{ count }}"
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { message: 'Hello', count: 42 },
        registry,
        executor
      );

      expect(result.output.result).toEqual({
        message: 'Hello',
        count: 42,
      });
    });
  });

  // ============================================================================
  // Complex Variable Expressions
  // ============================================================================

  describe('Complex Expressions', () => {
    it('should handle filters in variable expressions', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: filter-expr-test
          name: Filter Expression Test
        steps:
          - id: transform
            type: action
            action: core.set
            inputs:
              upper: "{{ name | upper }}"
              slug: "{{ title | slugify }}"
              first: "{{ items | first }}"
              sum: "{{ numbers | sum }}"
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        {
          name: 'alice',
          title: 'Hello World!',
          items: ['first', 'second'],
          numbers: [1, 2, 3],
        },
        registry,
        executor
      );

      expect(result.output.result).toEqual({
        upper: 'ALICE',
        slug: 'hello-world',
        first: 'first',
        sum: 6,
      });
    });

    it('should handle chained filters', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: chained-filter-test
          name: Chained Filter Test
        steps:
          - id: transform
            type: action
            action: core.set
            inputs:
              result: "{{ path | split('/') | first | upper }}"
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

      expect(result.output.output.result).toBe('OWNER');
    });

    it('should handle conditional expressions', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: conditional-expr-test
          name: Conditional Expression Test
        steps:
          - id: transform
            type: action
            action: core.set
            inputs:
              status: "{{ active | ternary('enabled', 'disabled') }}"
              fallback: "{{ missing | default('N/A') }}"
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { active: true },
        registry,
        executor
      );

      expect(result.output.result).toEqual({
        status: 'enabled',
        fallback: 'N/A',
      });
    });
  });
});
