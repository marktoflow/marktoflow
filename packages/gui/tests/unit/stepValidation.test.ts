import { describe, it, expect } from 'vitest';
import { validateStep, getFieldError, hasFieldError } from '../../src/client/utils/stepValidation';

describe('stepValidation', () => {
  describe('validateStep', () => {
    it('should pass for valid step with action', () => {
      const step = {
        id: 'valid-step',
        action: 'slack.chat.postMessage',
        inputs: {},
      };

      const result = validateStep(step);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for valid step with workflow', () => {
      const step = {
        id: 'sub-workflow',
        workflow: './path/to/workflow.md',
        inputs: {},
      };

      const result = validateStep(step);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when id is empty', () => {
      const step = {
        id: '',
        action: 'slack.chat.postMessage',
        inputs: {},
      };

      const result = validateStep(step);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'id')).toBe(true);
    });

    it('should fail when id starts with number', () => {
      const step = {
        id: '123-step',
        action: 'slack.chat.postMessage',
        inputs: {},
      };

      const result = validateStep(step);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'id')).toBe(true);
    });

    it('should fail when neither action nor workflow is provided', () => {
      const step = {
        id: 'empty-step',
        inputs: {},
      };

      const result = validateStep(step);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'action')).toBe(true);
    });

    it('should fail when action is not in correct format', () => {
      const step = {
        id: 'bad-action',
        action: 'invalid',
        inputs: {},
      };

      const result = validateStep(step);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'action')).toBe(true);
    });

    it('should pass for valid action formats', () => {
      // Two-part action
      let step = {
        id: 'step-1',
        action: 'http.get',
        inputs: {},
      };
      expect(validateStep(step).valid).toBe(true);

      // Three-part action
      step = {
        id: 'step-2',
        action: 'slack.chat.postMessage',
        inputs: {},
      };
      expect(validateStep(step).valid).toBe(true);
    });

    it('should fail for invalid workflow extensions', () => {
      const step = {
        id: 'sub-workflow',
        workflow: './path/to/workflow.txt',
        inputs: {},
      };

      const result = validateStep(step);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'workflow')).toBe(true);
    });

    it('should pass for valid workflow extensions', () => {
      const extensions = ['.md', '.yaml', '.yml'];
      for (const ext of extensions) {
        const step = {
          id: 'sub-workflow',
          workflow: `./path/to/workflow${ext}`,
          inputs: {},
        };
        expect(validateStep(step).valid).toBe(true);
      }
    });

    it('should fail for invalid output variable name', () => {
      const step = {
        id: 'step',
        action: 'http.get',
        inputs: {},
        outputVariable: '123invalid',
      };

      const result = validateStep(step);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'outputVariable')).toBe(true);
    });

    it('should pass for valid output variable name', () => {
      const step = {
        id: 'step',
        action: 'http.get',
        inputs: {},
        outputVariable: 'result_data',
      };

      expect(validateStep(step).valid).toBe(true);
    });

    it('should fail for invalid timeout', () => {
      const step = {
        id: 'step',
        action: 'http.get',
        inputs: {},
        timeout: -5,
      };

      const result = validateStep(step);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'timeout')).toBe(true);
    });

    it('should validate error handling', () => {
      const step = {
        id: 'step',
        action: 'http.get',
        inputs: {},
        errorHandling: {
          action: 'invalid' as any,
        },
      };

      const result = validateStep(step);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'errorHandling.action')).toBe(true);
    });

    it('should validate retry settings', () => {
      const step = {
        id: 'step',
        action: 'http.get',
        inputs: {},
        errorHandling: {
          action: 'retry' as const,
          maxRetries: 0,
          retryDelay: -100,
        },
      };

      const result = validateStep(step);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'errorHandling.maxRetries')).toBe(true);
      expect(result.errors.some((e) => e.field === 'errorHandling.retryDelay')).toBe(true);
    });

    it('should fail for empty conditions', () => {
      const step = {
        id: 'step',
        action: 'http.get',
        inputs: {},
        conditions: ['valid condition', '', 'another'],
      };

      const result = validateStep(step);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'conditions[1]')).toBe(true);
    });
  });

  describe('getFieldError', () => {
    it('should return error message for field', () => {
      const errors = [
        { field: 'id', message: 'ID is required' },
        { field: 'action', message: 'Action is invalid' },
      ];

      expect(getFieldError(errors, 'id')).toBe('ID is required');
      expect(getFieldError(errors, 'action')).toBe('Action is invalid');
      expect(getFieldError(errors, 'name')).toBeUndefined();
    });
  });

  describe('hasFieldError', () => {
    it('should return true if field has error', () => {
      const errors = [
        { field: 'id', message: 'ID is required' },
      ];

      expect(hasFieldError(errors, 'id')).toBe(true);
      expect(hasFieldError(errors, 'name')).toBe(false);
    });
  });
});
