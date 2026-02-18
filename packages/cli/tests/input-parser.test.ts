/**
 * Tests for CLI input parser — parseInputPairs
 */

import { describe, it, expect } from 'vitest';
import { parseInputPairs } from '../src/utils/input-parser.js';

describe('parseInputPairs', () => {
  it('should parse simple key=value pairs', () => {
    const result = parseInputPairs(['name=alice', 'count=5']);
    expect(result).toEqual({ name: 'alice', count: '5' });
  });

  it('should preserve values containing equals signs', () => {
    // This is the critical bug fix — values like SQL queries or base64
    // strings often contain '=' characters
    const result = parseInputPairs(['query=SELECT * FROM users WHERE id=1']);
    expect(result).toEqual({ query: 'SELECT * FROM users WHERE id=1' });
  });

  it('should handle base64 values with trailing equals', () => {
    const result = parseInputPairs(['token=eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0Ijp0cnVlfQ==']);
    expect(result).toEqual({ token: 'eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0Ijp0cnVlfQ==' });
  });

  it('should handle empty value after equals', () => {
    const result = parseInputPairs(['key=']);
    expect(result).toEqual({ key: '' });
  });

  it('should treat bare keys (no equals) as boolean true', () => {
    const result = parseInputPairs(['verbose']);
    expect(result).toEqual({ verbose: true });
  });

  it('should return empty object for undefined input', () => {
    expect(parseInputPairs(undefined)).toEqual({});
  });

  it('should return empty object for empty array', () => {
    expect(parseInputPairs([])).toEqual({});
  });

  it('should handle multiple equals in value', () => {
    const result = parseInputPairs(['formula=a=b=c=d']);
    expect(result).toEqual({ formula: 'a=b=c=d' });
  });
});
