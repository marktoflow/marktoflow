/**
 * Script Execution Integration Tests
 *
 * Tests the script step type with:
 * - Context access (variables, inputs, steps)
 * - Safe globals (JSON, Math, Date, Array, etc.)
 * - Timeout handling
 * - Security (no require, import, process, eval)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../src/engine.js';
import { loadInline } from '../utils/workflow-loader.js';
import { createSmartExecutor } from '../mock-executor.js';
import { WorkflowStatus, StepStatus } from '../../src/models.js';

describe('Script Execution Integration Tests', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  // ============================================================================
  // Basic Script Execution
  // ============================================================================

  describe('Basic Execution', () => {
    it('should execute simple script and return value', async () => {
      const { workflow, warnings } = loadInline(`
        ---
        workflow:
          id: script-basic-test
          name: Script Basic Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                const x = 10;
                const y = 20;
                return x + y;
            output_variable: result
        ---
      `);

      console.log('DEBUG: warnings =', warnings);
      console.log('DEBUG: workflow.steps =', workflow.steps);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      console.log('DEBUG: result.output =', JSON.stringify(result.output, null, 2));
      console.log('DEBUG: result.stepResults =', result.stepResults.map(r => ({ id: r.stepId, status: r.status, output: r.output })));

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.result).toBe(30);
    });

    it('should return complex objects', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-object-test
          name: Script Object Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                return {
                  name: 'Alice',
                  scores: [95, 87, 92],
                  metadata: { level: 'expert' }
                };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result).toEqual({
        name: 'Alice',
        scores: [95, 87, 92],
        metadata: { level: 'expert' },
      });
    });
  });

  // ============================================================================
  // Context Access
  // ============================================================================

  describe('Context Access', () => {
    it('should access workflow variables', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-vars-test
          name: Script Vars Test
        steps:
          - id: set-data
            type: action
            action: core.set
            inputs:
              userName: Alice
              userAge: 30
            output_variable: user

          - id: compute
            type: script
            inputs:
              code: |
                const name = variables.user.userName;
                const age = variables.user.userAge;
                return { greeting: 'Hello, ' + name + '!', isAdult: age >= 18 };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result).toEqual({
        greeting: 'Hello, Alice!',
        isAdult: true,
      });
    });

    it('should access workflow inputs', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-inputs-test
          name: Script Inputs Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                const multiplier = inputs.multiplier || 1;
                const base = inputs.base || 10;
                return base * multiplier;
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(
        workflow,
        { multiplier: 5, base: 20 },
        registry,
        executor
      );

      expect(result.output.result).toBe(100);
    });

    it('should access step metadata', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-steps-test
          name: Script Steps Test
        steps:
          - id: first-step
            type: action
            action: core.set
            inputs:
              value: initial
            output_variable: data

          - id: check-status
            type: script
            inputs:
              code: |
                const firstStepMeta = steps['first-step'];
                return {
                  status: firstStepMeta ? firstStepMeta.status : 'unknown',
                  hasSteps: typeof steps === 'object'
                };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result.hasSteps).toBe(true);
      expect(result.output.result.status).toBe('completed');
    });
  });

  // ============================================================================
  // Safe Globals
  // ============================================================================

  describe('Safe Globals', () => {
    it('should provide JSON operations', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-json-test
          name: Script JSON Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                const obj = { name: 'test', value: 42 };
                const jsonStr = JSON.stringify(obj);
                const parsed = JSON.parse(jsonStr);
                return { stringified: jsonStr, parsed: parsed };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result.stringified).toBe('{"name":"test","value":42}');
      expect(result.output.result.parsed).toEqual({ name: 'test', value: 42 });
    });

    it('should provide Math operations', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-math-test
          name: Script Math Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                return {
                  sqrt: Math.sqrt(16),
                  round: Math.round(3.7),
                  max: Math.max(1, 5, 3),
                  floor: Math.floor(4.9),
                  abs: Math.abs(-10)
                };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result).toEqual({
        sqrt: 4,
        round: 4,
        max: 5,
        floor: 4,
        abs: 10,
      });
    });

    it('should provide Date operations', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-date-test
          name: Script Date Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                const now = new Date();
                const year = now.getFullYear();
                const isDate = now instanceof Date;
                return { hasYear: typeof year === 'number', isDate: isDate };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result.hasYear).toBe(true);
      expect(result.output.result.isDate).toBe(true);
    });

    it('should provide Array operations', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-array-test
          name: Script Array Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                const arr = [1, 2, 3, 4, 5];
                return {
                  mapped: arr.map(x => x * 2),
                  filtered: arr.filter(x => x > 2),
                  reduced: arr.reduce((a, b) => a + b, 0),
                  isArray: Array.isArray(arr),
                  includes: arr.includes(3)
                };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result).toEqual({
        mapped: [2, 4, 6, 8, 10],
        filtered: [3, 4, 5],
        reduced: 15,
        isArray: true,
        includes: true,
      });
    });

    it('should provide Object operations', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-object-ops-test
          name: Script Object Ops Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                const obj = { a: 1, b: 2, c: 3 };
                return {
                  keys: Object.keys(obj),
                  values: Object.values(obj),
                  entries: Object.entries(obj),
                  hasOwn: Object.hasOwn ? Object.hasOwn(obj, 'a') : obj.hasOwnProperty('a')
                };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result.keys).toEqual(['a', 'b', 'c']);
      expect(result.output.result.values).toEqual([1, 2, 3]);
      expect(result.output.result.entries).toEqual([['a', 1], ['b', 2], ['c', 3]]);
      expect(result.output.result.hasOwn).toBe(true);
    });

    it('should provide String and Number utilities', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-utils-test
          name: Script Utils Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                return {
                  parseInt: parseInt('42'),
                  parseFloat: parseFloat('3.14'),
                  isNaN: isNaN('hello'),
                  isFinite: isFinite(100),
                  encoded: encodeURIComponent('hello world'),
                  decoded: decodeURIComponent('hello%20world')
                };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result).toEqual({
        parseInt: 42,
        parseFloat: 3.14,
        isNaN: true,
        isFinite: true,
        encoded: 'hello%20world',
        decoded: 'hello world',
      });
    });

    it('should provide Map and Set', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-collections-test
          name: Script Collections Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                const map = new Map();
                map.set('a', 1);
                map.set('b', 2);

                const set = new Set([1, 2, 2, 3]);

                return {
                  mapSize: map.size,
                  mapGet: map.get('a'),
                  setSize: set.size,
                  setHas: set.has(2)
                };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result).toEqual({
        mapSize: 2,
        mapGet: 1,
        setSize: 3,
        setHas: true,
      });
    });

    it('should provide RegExp', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-regex-test
          name: Script Regex Test
        steps:
          - id: compute
            type: script
            inputs:
              code: |
                const pattern = new RegExp('hello (\\\\w+)', 'i');
                const text = 'Hello World!';
                const match = text.match(pattern);
                return {
                  matched: !!match,
                  group: match ? match[1] : null,
                  replaced: text.replace(pattern, 'Hi $1')
                };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.output.result).toEqual({
        matched: true,
        group: 'World',
        replaced: 'Hi World!',
      });
    });
  });

  // ============================================================================
  // Timeout Handling
  // ============================================================================

  describe('Timeout Handling', () => {
    it('should respect timeout configuration', async () => {
      // Note: JavaScript's event loop cannot interrupt synchronous code like a tight loop.
      // Timeouts only work for async operations that yield control.
      // This test uses an async delay that exceeds the timeout.
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-timeout-test
          name: Script Timeout Test
        steps:
          - id: slow-script
            type: script
            inputs:
              code: |
                const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                await delay(500);
                return 'completed';
              timeout: 100
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      // Script should fail due to timeout
      expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
      expect(result.stepResults[0].error).toContain('timed out');
    });
  });

  // ============================================================================
  // Security Tests
  // ============================================================================

  describe('Security', () => {
    it('should not allow require()', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-no-require-test
          name: Script No Require Test
        steps:
          - id: unsafe
            type: script
            inputs:
              code: |
                const fs = require('fs');
                return fs.readFileSync('/etc/passwd');
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      // Script should fail
      expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
    });

    it('should not allow access to process', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-no-process-test
          name: Script No Process Test
        steps:
          - id: unsafe
            type: script
            inputs:
              code: |
                return process.env.SECRET_KEY;
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      // Script should fail or return undefined
      if (result.stepResults[0].status === StepStatus.COMPLETED) {
        expect(result.output.result).toBeUndefined();
      } else {
        expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
      }
    });

    it('should not modify frozen context', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-frozen-context-test
          name: Script Frozen Context Test
        steps:
          - id: set-data
            type: action
            action: core.set
            inputs:
              value: original
            output_variable: data

          - id: try-modify
            type: script
            inputs:
              code: |
                try {
                  variables.data = 'modified';
                  return 'modified';
                } catch (e) {
                  return 'frozen';
                }
            output_variable: result

          - id: check
            type: action
            action: core.set
            inputs:
              originalValue: "{{ data.value }}"
            output_variable: check
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      // Original value should be unchanged
      expect(result.output.check.originalValue).toBe('original');
    });
  });

  // ============================================================================
  // Async Operations
  // ============================================================================

  describe('Async Operations', () => {
    it('should support async/await', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-async-test
          name: Script Async Test
        steps:
          - id: async-op
            type: script
            inputs:
              code: |
                const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                await delay(10);
                return { completed: true };
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.result).toEqual({ completed: true });
    });

    it('should support Promise chains', async () => {
      const { workflow } = loadInline(`
        ---
        workflow:
          id: script-promise-test
          name: Script Promise Test
        steps:
          - id: promise-op
            type: script
            inputs:
              code: |
                return Promise.resolve(42)
                  .then(x => x * 2)
                  .then(x => ({ value: x }));
            output_variable: result
        ---
      `);

      const { executor, registry } = createSmartExecutor();
      const result = await engine.execute(workflow, {}, registry, executor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output.result).toEqual({ value: 84 });
    });
  });
});
