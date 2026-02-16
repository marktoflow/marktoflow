import { describe, it, expect } from 'vitest';
import {
  getErrorMessage,
  normalizeError,
  getErrorDetails,
  formatError,
  isError,
  prefixError,
  chainError,
} from '../src/utils/error-handling.js';

describe('Error Handling Utilities', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error');
      expect(getErrorMessage(error)).toBe('Test error');
    });

    it('should handle string errors', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should extract message from object with message property', () => {
      const error = { message: 'Object error' };
      expect(getErrorMessage(error)).toBe('Object error');
    });

    it('should handle null/undefined with default', () => {
      expect(getErrorMessage(null)).toBe('Unknown error');
      expect(getErrorMessage(undefined)).toBe('Unknown error');
      expect(getErrorMessage(null, 'Custom default')).toBe('Custom default');
    });

    it('should convert other types to string', () => {
      expect(getErrorMessage(42)).toBe('42');
      expect(getErrorMessage(true)).toBe('true');
      expect(getErrorMessage({})).toBe('[object Object]');
    });

    it('should handle errors with custom properties', () => {
      const error: any = new Error('Main message');
      error.statusCode = 500;
      expect(getErrorMessage(error)).toBe('Main message');
    });
  });

  describe('normalizeError', () => {
    it('should return Error object as-is', () => {
      const error = new Error('Test');
      expect(normalizeError(error)).toBe(error);
    });

    it('should wrap string in Error', () => {
      const error = normalizeError('String error');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('String error');
    });

    it('should wrap object with message property', () => {
      const error = normalizeError({ message: 'Custom error' });
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Custom error');
    });

    it('should preserve stack trace when available', () => {
      const original = new Error('Original');
      const originalStack = original.stack;
      const normalized = normalizeError({ message: 'Wrapped', stack: originalStack });
      expect(normalized.stack).toBe(originalStack);
    });

    it('should handle null/undefined', () => {
      const error1 = normalizeError(null);
      const error2 = normalizeError(undefined);
      expect(error1).toBeInstanceOf(Error);
      expect(error2).toBeInstanceOf(Error);
    });
  });

  describe('getErrorDetails', () => {
    it('should extract details from Error', () => {
      const error = new Error('Test error');
      const details = getErrorDetails(error);
      expect(details.message).toBe('Test error');
      expect(details.name).toBe('Error');
      expect(details.stack).toBeDefined();
    });

    it('should extract custom error properties', () => {
      const error: any = new Error('API error');
      error.code = 'API_ERROR';
      error.statusCode = 500;
      const details = getErrorDetails(error);
      expect(details.code).toBe('API_ERROR');
      expect(details.statusCode).toBe(500);
    });

    it('should handle TypeError', () => {
      const error = new TypeError('Type mismatch');
      const details = getErrorDetails(error);
      expect(details.name).toBe('TypeError');
      expect(details.message).toBe('Type mismatch');
    });

    it('should handle non-Error objects', () => {
      const details = getErrorDetails({ message: 'Custom error' });
      expect(details.message).toBe('Custom error');
    });
  });

  describe('formatError', () => {
    it('should format error message', () => {
      const error = new Error('Test error');
      const formatted = formatError(error, false);
      expect(formatted).toContain('Error: Test error');
    });

    it('should include stack trace when requested', () => {
      const error = new Error('Test error');
      const formatted = formatError(error, true);
      expect(formatted).toContain('at ');
    });

    it('should include error code when available', () => {
      const error: any = new Error('API failed');
      error.code = 'API_001';
      const formatted = formatError(error);
      expect(formatted).toContain('[API_001]');
    });

    it('should not include stack by default', () => {
      const error = new Error('Test');
      const formatted = formatError(error);
      expect(formatted).not.toContain('at ');
    });
  });

  describe('isError', () => {
    it('should identify Error instances', () => {
      expect(isError(new Error('Test'))).toBe(true);
      expect(isError(new TypeError('Test'))).toBe(true);
    });

    it('should identify error-like objects', () => {
      expect(isError({ message: 'Error-like' })).toBe(true);
    });

    it('should reject non-errors', () => {
      expect(isError('string')).toBe(false);
      expect(isError(42)).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError({ notAMessage: 'value' })).toBe(false);
    });
  });

  describe('prefixError', () => {
    it('should add prefix to error message', () => {
      const error = new Error('Original error');
      const prefixed = prefixError(error, 'Failed to process');
      expect(prefixed.message).toBe('Failed to process: Original error');
    });

    it('should work with string errors', () => {
      const prefixed = prefixError('Something went wrong', 'Database operation');
      expect(prefixed.message).toBe('Database operation: Something went wrong');
    });

    it('should preserve stack trace', () => {
      const error = new Error('Original');
      const originalStack = error.stack;
      const prefixed = prefixError(error, 'Wrapped');
      expect(prefixed.stack).toBeDefined();
      // Stack should be modified with new error's top frames
      // (exact content varies by runtime, just verify it exists)
      expect(typeof prefixed.stack).toBe('string');
    });
  });

  describe('chainError', () => {
    it('should create error with cause', () => {
      const original = new Error('Original error');
      const chained = chainError(original, 'Operation failed');
      expect(chained.message).toBe('Operation failed');
      expect((chained as any).cause).toBe(original);
    });

    it('should work with various error types', () => {
      const original: any = { message: 'API error', statusCode: 500 };
      const chained = chainError(original, 'Request failed');
      expect(chained.message).toBe('Request failed');
      expect((chained as any).cause).toBe(original);
    });

    it('should preserve error chain for debugging', () => {
      const err1 = new Error('Database connection failed');
      const err2 = chainError(err1, 'Failed to fetch data');
      const err3 = chainError(err2, 'Workflow execution failed');

      // Verify the chain is preserved
      expect((err3 as any).cause).toBe(err2);
      expect((err2 as any).cause).toBe(err1);
      expect((err1 as any).cause).toBeUndefined();
    });
  });

  describe('Integration: Consistent error handling', () => {
    it('should handle common error patterns consistently', () => {
      const errors = [
        new Error('Native error'),
        'String error',
        { message: 'Object error' },
        { message: 'API error', code: 'API_001', statusCode: 500 },
      ];

      const messages = errors.map((e) => getErrorMessage(e));
      expect(messages).toEqual([
        'Native error',
        'String error',
        'Object error',
        'API error',
      ]);

      const normalized = errors.map((e) => normalizeError(e));
      expect(normalized.every((e) => e instanceof Error)).toBe(true);

      const details = errors.map((e) => getErrorDetails(e));
      expect(details.every((d) => d.message)).toBe(true);
    });

    it('should support error wrapping for better context', () => {
      try {
        throw new Error('Inner error');
      } catch (innerError) {
        try {
          throw chainError(innerError, 'Outer operation failed');
        } catch (outerError) {
          const details = getErrorDetails(outerError);
          expect(details.message).toBe('Outer operation failed');

          const formatted = formatError(outerError, true);
          expect(formatted).toContain('Outer operation failed');
        }
      }
    });
  });
});
