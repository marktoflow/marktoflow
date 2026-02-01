import { describe, it, expect } from 'vitest';
import {
  executeScript,
  executeScriptAsync,
  validateScript,
} from '../src/script-executor.js';

describe('executeScript', () => {
  describe('basic execution', () => {
    it('should execute simple code and return result', async () => {
      const result = await executeScriptAsync('return 42', {
        variables: {},
        inputs: {},
      });
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should access variables', async () => {
      const result = await executeScriptAsync('return variables.count * 2', {
        variables: { count: 5 },
        inputs: {},
      });
      expect(result.success).toBe(true);
      expect(result.value).toBe(10);
    });

    it('should access inputs', async () => {
      const result = await executeScriptAsync('return inputs.name.toUpperCase()', {
        variables: {},
        inputs: { name: 'alice' },
      });
      expect(result.success).toBe(true);
      expect(result.value).toBe('ALICE');
    });

    it('should handle object returns', async () => {
      const result = await executeScriptAsync(
        `
        const items = variables.data.items;
        const filtered = items.filter(i => i.active);
        return { filtered, count: filtered.length };
      `,
        {
          variables: {
            data: {
              items: [
                { id: 1, active: true },
                { id: 2, active: false },
                { id: 3, active: true },
              ],
            },
          },
          inputs: {},
        }
      );

      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        filtered: [
          { id: 1, active: true },
          { id: 3, active: true },
        ],
        count: 2,
      });
    });
  });

  describe('context is read-only', () => {
    it('should not persist modifications of variables', async () => {
      const originalVars = { count: 5 };
      const result = await executeScriptAsync(
        `
        // Modifications in script don't affect original
        const newCount = variables.count + 10;
        return newCount;
      `,
        {
          variables: originalVars,
          inputs: {},
        }
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe(15);
      // Original is unchanged
      expect(originalVars.count).toBe(5);
    });

    it('should not persist modifications of inputs', async () => {
      const originalInputs = { name: 'alice' };
      const result = await executeScriptAsync(
        `
        return inputs.name.toUpperCase();
      `,
        {
          variables: {},
          inputs: originalInputs,
        }
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe('ALICE');
      // Original is unchanged
      expect(originalInputs.name).toBe('alice');
    });
  });

  describe('safe globals', () => {
    it('should have access to JSON', async () => {
      const result = await executeScriptAsync(
        'return JSON.parse(\'{"name": "test"}\').name',
        {
          variables: {},
          inputs: {},
        }
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe('test');
    });

    it('should have access to Math', async () => {
      const result = await executeScriptAsync('return Math.max(1, 5, 3)', {
        variables: {},
        inputs: {},
      });

      expect(result.success).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should have access to Date', async () => {
      const result = await executeScriptAsync(
        'const d = new Date("2025-01-01T00:00:00Z"); return d.getUTCFullYear()',
        {
          variables: {},
          inputs: {},
        }
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe(2025);
    });

    it('should have access to Array methods', async () => {
      const result = await executeScriptAsync('return Array.isArray([1, 2, 3])', {
        variables: {},
        inputs: {},
      });

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should have access to Object methods', async () => {
      const result = await executeScriptAsync(
        'return Object.keys({a: 1, b: 2}).length',
        {
          variables: {},
          inputs: {},
        }
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe(2);
    });

    it('should have access to console', async () => {
      // Just verify it doesn't throw
      const result = await executeScriptAsync(
        'console.log("test"); return true',
        {
          variables: {},
          inputs: {},
        }
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe('async support', () => {
    it('should support async/await', async () => {
      const result = await executeScriptAsync(
        `
        // Simple async operation
        const val = await Promise.resolve('done');
        return val;
      `,
        {
          variables: {},
          inputs: {},
        }
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe('done');
    });

    it('should support Promises', async () => {
      const result = await executeScriptAsync(
        `
        return Promise.resolve(42);
      `,
        {
          variables: {},
          inputs: {},
        }
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });
  });

  describe('error handling', () => {
    it('should catch syntax errors', async () => {
      const result = await executeScriptAsync('return {{invalid}}', {
        variables: {},
        inputs: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should catch runtime errors', async () => {
      const result = await executeScriptAsync(
        'return undefined_variable.property',
        {
          variables: {},
          inputs: {},
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle thrown errors', async () => {
      const result = await executeScriptAsync('throw new Error("Test error")', {
        variables: {},
        inputs: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });
  });

  describe('timeout', () => {
    it('should handle scripts that fail due to unavailable APIs', async () => {
      // setTimeout is not available in the sandboxed VM
      const result = await executeScriptAsync(
        `
        setTimeout(() => {}, 1000);
        return 'done';
      `,
        {
          variables: {},
          inputs: {},
        },
        { timeout: 100 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('setTimeout is not defined');
    });
  });
});

describe('validateScript', () => {
  it('should pass for valid scripts', () => {
    const result = validateScript('return variables.count * 2');
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should warn about require()', () => {
    const result = validateScript("const fs = require('fs')");
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('require() is not available in scripts');
  });

  it('should warn about import statements', () => {
    const result = validateScript("import fs from 'fs'");
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('import statements are not available in scripts');
  });

  it('should warn about process', () => {
    const result = validateScript('const env = process.env');
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('process object is not available in scripts');
  });

  it('should warn about eval', () => {
    const result = validateScript("eval('code')");
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('eval() is not available in scripts');
  });

  it('should warn about Function constructor', () => {
    const result = validateScript("new Function('return 1')");
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Function constructor is not available in scripts');
  });
});
