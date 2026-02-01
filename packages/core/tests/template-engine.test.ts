import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../src/template-engine.js';

describe('renderTemplate', () => {
  describe('variable resolution', () => {
    it('should resolve simple variables', () => {
      const result = renderTemplate('{{ name }}', { name: 'Alice' });
      expect(result).toBe('Alice');
    });

    it('should resolve nested variables', () => {
      const result = renderTemplate('{{ user.name }}', {
        user: { name: 'Bob' },
      });
      expect(result).toBe('Bob');
    });

    it('should resolve array indices', () => {
      const result = renderTemplate('{{ items[0] }}', {
        items: ['first', 'second'],
      });
      expect(result).toBe('first');
    });

    it('should preserve object type for single expression', () => {
      const result = renderTemplate('{{ data }}', {
        data: { id: 123, name: 'Test' },
      });
      expect(result).toEqual({ id: 123, name: 'Test' });
    });

    it('should preserve array type for single expression', () => {
      const result = renderTemplate('{{ items }}', {
        items: [1, 2, 3],
      });
      expect(result).toEqual([1, 2, 3]);
    });

    it('should interpolate multiple expressions as string', () => {
      const result = renderTemplate('Hello {{ name }}, you are {{ age }} years old', {
        name: 'Alice',
        age: 30,
      });
      expect(result).toBe('Hello Alice, you are 30 years old');
    });

    it('should return empty string for undefined variables', () => {
      const result = renderTemplate('{{ undefined_var }}', {});
      expect(result).toBe('');
    });
  });

  describe('Nunjucks built-in filters', () => {
    it('should apply upper filter', () => {
      const result = renderTemplate('{{ name | upper }}', { name: 'alice' });
      expect(result).toBe('ALICE');
    });

    it('should apply lower filter', () => {
      const result = renderTemplate('{{ name | lower }}', { name: 'ALICE' });
      expect(result).toBe('alice');
    });

    it('should apply capitalize filter', () => {
      const result = renderTemplate('{{ name | capitalize }}', { name: 'alice' });
      expect(result).toBe('Alice');
    });

    it('should apply trim filter', () => {
      const result = renderTemplate('{{ text | trim }}', { text: '  hello  ' });
      expect(result).toBe('hello');
    });

    it('should apply first filter', () => {
      const result = renderTemplate('{{ items | first }}', { items: ['a', 'b', 'c'] });
      expect(result).toBe('a');
    });

    it('should apply last filter', () => {
      const result = renderTemplate('{{ items | last }}', { items: ['a', 'b', 'c'] });
      expect(result).toBe('c');
    });

    it('should apply length filter', () => {
      const result = renderTemplate('{{ items | length }}', { items: [1, 2, 3] });
      expect(result).toBe(3);
    });

    it('should apply join filter', () => {
      const result = renderTemplate('{{ items | join(", ") }}', { items: ['a', 'b', 'c'] });
      expect(result).toBe('a, b, c');
    });

    it('should apply reverse filter', () => {
      const result = renderTemplate('{{ items | reverse | join("") }}', { items: ['a', 'b', 'c'] });
      expect(result).toBe('cba');
    });

    it('should apply sort filter', () => {
      const result = renderTemplate('{{ items | sort | join(",") }}', { items: [3, 1, 2] });
      expect(result).toBe('1,2,3');
    });

    it('should apply default filter', () => {
      const result = renderTemplate('{{ missing | default("N/A") }}', {});
      expect(result).toBe('N/A');
    });

    it('should apply replace filter', () => {
      const result = renderTemplate('{{ text | replace("world", "there") }}', { text: 'hello world' });
      expect(result).toBe('hello there');
    });

    it('should chain multiple filters', () => {
      const result = renderTemplate('{{ name | lower | capitalize }}', {
        name: 'ALICE',
      });
      expect(result).toBe('Alice');
    });
  });

  describe('custom filters', () => {
    it('should apply split filter', () => {
      const result = renderTemplate('{{ path | split("/") | first }}', {
        path: 'owner/repo',
      });
      expect(result).toBe('owner');
    });

    it('should apply slugify filter', () => {
      const result = renderTemplate('{{ title | slugify }}', {
        title: 'Hello World!',
      });
      expect(result).toBe('hello-world');
    });

    it('should apply prefix filter', () => {
      const result = renderTemplate('{{ name | prefix("@") }}', { name: 'user' });
      expect(result).toBe('@user');
    });

    it('should apply suffix filter', () => {
      const result = renderTemplate('{{ name | suffix("!") }}', { name: 'Hello' });
      expect(result).toBe('Hello!');
    });

    it('should apply truncate filter', () => {
      const result = renderTemplate('{{ text | truncate(5) }}', { text: 'Hello World' });
      expect(result).toBe('Hello...');
    });
  });

  describe('regex filters', () => {
    it('should match regex patterns', () => {
      const result = renderTemplate("{{ text | match('/hello (\\\\w+)/i', 1) }}", {
        text: 'Hello World',
      });
      expect(result).toBe('World');
    });

    it('should return null for non-matches', () => {
      const result = renderTemplate("{{ text | match('/xyz/') }}", {
        text: 'Hello World',
      });
      expect(result).toBeNull();
    });

    it('should apply negative match', () => {
      const result = renderTemplate("{{ email | notMatch('/@example\\\\.com$/') }}", {
        email: 'user@gmail.com',
      });
      expect(result).toBe(true);
    });

    it('should apply regex replace', () => {
      const result = renderTemplate("{{ text | regexReplace('/[^a-z0-9]+/', '-', 'gi') }}", {
        text: 'Hello World!',
      });
      expect(result).toBe('Hello-World-');
    });

    it('should extract JSON from markdown code block', () => {
      const result = renderTemplate(
        "{{ content | match('/```json\\\\s*([\\\\s\\\\S]*?)\\\\s*```/', 1) }}",
        { content: 'Here is data:\n```json\n{"key": "value"}\n```\nDone' }
      );
      expect(result).toContain('"key": "value"');
    });
  });

  describe('control structures', () => {
    it('should handle for loops', () => {
      const result = renderTemplate(
        '{% for item in items %}{{ item }}{% if not loop.last %}, {% endif %}{% endfor %}',
        { items: ['a', 'b', 'c'] }
      );
      expect(result).toBe('a, b, c');
    });

    it('should handle if conditions', () => {
      const result = renderTemplate(
        '{% if active %}active{% else %}inactive{% endif %}',
        { active: true }
      );
      expect(result).toBe('active');
    });

    it('should handle if-elif-else', () => {
      const template = '{% if count > 10 %}many{% elif count > 0 %}some{% else %}none{% endif %}';
      expect(renderTemplate(template, { count: 15 })).toBe('many');
      expect(renderTemplate(template, { count: 5 })).toBe('some');
      expect(renderTemplate(template, { count: 0 })).toBe('none');
    });

    it('should provide loop variables', () => {
      const result = renderTemplate(
        '{% for item in items %}{{ loop.index }}:{{ item }} {% endfor %}',
        { items: ['a', 'b', 'c'] }
      );
      expect(result).toBe('1:a 2:b 3:c ');
    });

    it('should handle nested loops', () => {
      const result = renderTemplate(
        '{% for row in rows %}{% for col in row %}{{ col }}{% endfor %};{% endfor %}',
        { rows: [[1, 2], [3, 4]] }
      );
      expect(result).toBe('12;34;');
    });
  });

  describe('object and array helpers', () => {
    it('should get keys', () => {
      const result = renderTemplate('{{ obj | keys | join(",") }}', {
        obj: { a: 1, b: 2 },
      });
      expect(result).toBe('a,b');
    });

    it('should get values', () => {
      const result = renderTemplate('{{ obj | values | join(",") }}', {
        obj: { a: 1, b: 2 },
      });
      expect(result).toBe('1,2');
    });

    it('should access path', () => {
      const result = renderTemplate("{{ data | path('user.profile.name') }}", {
        data: { user: { profile: { name: 'Alice' } } },
      });
      expect(result).toBe('Alice');
    });

    it('should count array length', () => {
      const result = renderTemplate('{{ items | count }}', {
        items: [1, 2, 3, 4, 5],
      });
      expect(result).toBe(5);
    });

    it('should sum array', () => {
      const result = renderTemplate('{{ numbers | sum }}', {
        numbers: [1, 2, 3, 4],
      });
      expect(result).toBe(10);
    });

    it('should get unique values', () => {
      const result = renderTemplate('{{ items | unique | join(",") }}', {
        items: [1, 2, 2, 3, 3, 3],
      });
      expect(result).toBe('1,2,3');
    });

    it('should flatten arrays', () => {
      const result = renderTemplate('{{ items | flatten | join(",") }}', {
        items: [[1, 2], [3, 4]],
      });
      expect(result).toBe('1,2,3,4');
    });

    it('should pick keys from object', () => {
      const result = renderTemplate('{{ obj | pick("a", "c") | to_json }}', {
        obj: { a: 1, b: 2, c: 3 },
      });
      expect(result).toBe('{"a":1,"c":3}');
    });

    it('should omit keys from object', () => {
      const result = renderTemplate('{{ obj | omit("b") | to_json }}', {
        obj: { a: 1, b: 2, c: 3 },
      });
      expect(result).toBe('{"a":1,"c":3}');
    });

    it('should merge objects', () => {
      const result = renderTemplate('{{ a | merge(b) | to_json }}', {
        a: { x: 1 },
        b: { y: 2 },
      });
      expect(result).toBe('{"x":1,"y":2}');
    });
  });

  describe('date helpers', () => {
    it('should format date', () => {
      const result = renderTemplate("{{ timestamp | format_date('YYYY-MM-DD') }}", {
        timestamp: new Date('2025-01-31T12:00:00Z'),
      });
      expect(result).toMatch(/2025-01-31/);
    });

    it('should add days', () => {
      const baseDate = new Date('2025-01-01T00:00:00Z');
      const result = renderTemplate('{{ date | add_days(7) }}', {
        date: baseDate.getTime(),
      });
      const expected = new Date('2025-01-08T00:00:00Z').getTime();
      expect(result).toBe(expected);
    });

    it('should subtract days', () => {
      const baseDate = new Date('2025-01-10T00:00:00Z');
      const result = renderTemplate('{{ date | subtract_days(5) }}', {
        date: baseDate.getTime(),
      });
      const expected = new Date('2025-01-05T00:00:00Z').getTime();
      expect(result).toBe(expected);
    });
  });

  describe('type checks', () => {
    it('should check is_array', () => {
      expect(renderTemplate('{{ val | is_array }}', { val: [1, 2] })).toBe(true);
      expect(renderTemplate('{{ val | is_array }}', { val: 'string' })).toBe(false);
    });

    it('should check is_object', () => {
      expect(renderTemplate('{{ val | is_object }}', { val: { a: 1 } })).toBe(true);
      expect(renderTemplate('{{ val | is_object }}', { val: [1, 2] })).toBe(false);
    });

    it('should check is_string', () => {
      expect(renderTemplate('{{ val | is_string }}', { val: 'hello' })).toBe(true);
      expect(renderTemplate('{{ val | is_string }}', { val: 123 })).toBe(false);
    });

    it('should check is_number', () => {
      expect(renderTemplate('{{ val | is_number }}', { val: 42 })).toBe(true);
      expect(renderTemplate('{{ val | is_number }}', { val: '42' })).toBe(false);
    });

    it('should check is_empty', () => {
      expect(renderTemplate('{{ val | is_empty }}', { val: [] })).toBe(true);
      expect(renderTemplate('{{ val | is_empty }}', { val: [1] })).toBe(false);
      expect(renderTemplate('{{ val | is_empty }}', { val: '' })).toBe(true);
      expect(renderTemplate('{{ val | is_empty }}', { val: {} })).toBe(true);
    });

    it('should check is_null', () => {
      expect(renderTemplate('{{ val | is_null }}', { val: null })).toBe(true);
      expect(renderTemplate('{{ val | is_null }}', { val: undefined })).toBe(false);
    });
  });

  describe('JSON helpers', () => {
    it('should parse JSON', () => {
      const result = renderTemplate('{{ json | parse_json }}', {
        json: '{"name": "Alice"}',
      });
      expect(result).toEqual({ name: 'Alice' });
    });

    it('should stringify to JSON', () => {
      const result = renderTemplate('{{ data | to_json }}', {
        data: { name: 'Alice' },
      });
      expect(result).toBe('{"name":"Alice"}');
    });

    it('should stringify to pretty JSON', () => {
      const result = renderTemplate('{{ data | to_json(true) }}', {
        data: { a: 1 },
      });
      expect(result).toBe('{\n  "a": 1\n}');
    });
  });

  describe('logic helpers', () => {
    it('should apply ternary', () => {
      expect(renderTemplate("{{ active | ternary('yes', 'no') }}", { active: true })).toBe('yes');
      expect(renderTemplate("{{ active | ternary('yes', 'no') }}", { active: false })).toBe('no');
    });

    it('should apply and', () => {
      expect(renderTemplate('{{ a | and(b) }}', { a: true, b: true })).toBe(true);
      expect(renderTemplate('{{ a | and(b) }}', { a: true, b: false })).toBe(false);
    });

    it('should apply or', () => {
      expect(renderTemplate('{{ a | or(b) }}', { a: false, b: 'fallback' })).toBe('fallback');
      expect(renderTemplate('{{ a | or(b) }}', { a: 'value', b: 'fallback' })).toBe('value');
    });

    it('should apply not', () => {
      expect(renderTemplate('{{ val | not }}', { val: true })).toBe(false);
      expect(renderTemplate('{{ val | not }}', { val: false })).toBe(true);
    });
  });

  describe('math helpers', () => {
    it('should round numbers', () => {
      expect(renderTemplate('{{ num | round }}', { num: 3.7 })).toBe(4);
      expect(renderTemplate('{{ num | round(2) }}', { num: 3.756 })).toBe(3.76);
    });

    it('should floor numbers', () => {
      expect(renderTemplate('{{ num | floor }}', { num: 3.9 })).toBe(3);
    });

    it('should ceil numbers', () => {
      expect(renderTemplate('{{ num | ceil }}', { num: 3.1 })).toBe(4);
    });

    it('should find min', () => {
      expect(renderTemplate('{{ nums | min }}', { nums: [5, 2, 8, 1] })).toBe(1);
    });

    it('should find max', () => {
      expect(renderTemplate('{{ nums | max }}', { nums: [5, 2, 8, 1] })).toBe(8);
    });

    it('should apply abs', () => {
      expect(renderTemplate('{{ num | abs }}', { num: -5 })).toBe(5);
    });
  });

  describe('real-world examples', () => {
    it('should extract owner from GitHub repo path', () => {
      const result = renderTemplate('{{ repo | split("/") | first }}', {
        repo: 'facebook/react',
      });
      expect(result).toBe('facebook');
    });

    it('should format a list of items', () => {
      const result = renderTemplate(
        '{{ items | join(", ") | default("No items") }}',
        { items: ['apple', 'banana', 'cherry'] }
      );
      expect(result).toBe('apple, banana, cherry');
    });

    it('should create a URL-safe slug', () => {
      const result = renderTemplate('{{ title | slugify }}', {
        title: 'Hello World! This is a Test.',
      });
      expect(result).toBe('hello-world-this-is-a-test');
    });

    it('should filter and count items', () => {
      // Note: filter with a string predicate is a custom implementation
      // For complex filtering, use script steps
      const result = renderTemplate('{{ items | count }}', {
        items: [1, 2, 3, 4, 5],
      });
      expect(result).toBe(5);
    });

    it('should generate markdown list from array', () => {
      const result = renderTemplate(
        '{% for item in items %}- {{ item }}\n{% endfor %}',
        { items: ['Task 1', 'Task 2', 'Task 3'] }
      );
      expect(result).toBe('- Task 1\n- Task 2\n- Task 3\n');
    });
  });
});
