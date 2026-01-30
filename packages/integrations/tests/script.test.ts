import { describe, it, expect, beforeEach } from 'vitest';
import { InlineScriptClient, ScriptInitializer } from '../src/tools/script.js';

describe('Script Integration', () => {
  describe('ScriptInitializer', () => {
    it('should throw if path is missing', async () => {
      const config = { sdk: 'script', options: {} };
      await expect(ScriptInitializer.initialize(null, config as any)).rejects.toThrow(
        'Script integration requires options.path'
      );
    });

    it('should create InlineScriptClient for path="inline"', async () => {
      const config = {
        sdk: 'script',
        options: {
          path: 'inline',
        },
      };

      const result = await ScriptInitializer.initialize(null, config as any);
      expect(result).toBeInstanceOf(InlineScriptClient);
    });

    it('should accept custom timeout for inline scripts', async () => {
      const config = {
        sdk: 'script',
        options: {
          path: 'inline',
          timeout: 5000,
        },
      };

      const result = await ScriptInitializer.initialize(null, config as any);
      expect(result).toBeInstanceOf(InlineScriptClient);
    });
  });

  describe('InlineScriptClient', () => {
    let client: InlineScriptClient;

    beforeEach(() => {
      client = new InlineScriptClient(5000); // 5 second timeout for tests
    });

    describe('basic execution', () => {
      it('should execute simple code and return result', async () => {
        const result = await client.execute({
          code: 'return 42;',
        });

        expect(result).toBe(42);
      });

      it('should handle string return values', async () => {
        const result = await client.execute({
          code: 'return "hello world";',
        });

        expect(result).toBe('hello world');
      });

      it('should handle object return values', async () => {
        const result = await client.execute({
          code: 'return { name: "test", value: 123 };',
        });

        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('should handle array return values', async () => {
        const result = await client.execute({
          code: 'return [1, 2, 3];',
        });

        expect(result).toEqual([1, 2, 3]);
      });

      it('should handle null return', async () => {
        const result = await client.execute({
          code: 'return null;',
        });

        expect(result).toBeNull();
      });

      it('should handle undefined return', async () => {
        const result = await client.execute({
          code: 'return undefined;',
        });

        expect(result).toBeUndefined();
      });
    });

    describe('context access', () => {
      it('should access context variables', async () => {
        const result = await client.execute({
          code: 'return context.myValue * 2;',
          context: { myValue: 21 },
        });

        expect(result).toBe(42);
      });

      it('should access nested context properties', async () => {
        const result = await client.execute({
          code: 'return context.data.items.length;',
          context: { data: { items: [1, 2, 3, 4, 5] } },
        });

        expect(result).toBe(5);
      });

      it('should handle optional chaining pattern', async () => {
        const result = await client.execute({
          code: 'return context.missing?.value || "default";',
          context: {},
        });

        expect(result).toBe('default');
      });

      it('should access inputs from context', async () => {
        const result = await client.execute({
          code: 'return context.inputs.name;',
          context: { inputs: { name: 'test-input' } },
        });

        expect(result).toBe('test-input');
      });
    });

    describe('async execution', () => {
      it('should handle async/await', async () => {
        const result = await client.execute({
          code: `
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            await delay(10);
            return "done";
          `,
        });

        expect(result).toBe('done');
      });

      it('should handle Promise.resolve', async () => {
        const result = await client.execute({
          code: 'return Promise.resolve(42);',
        });

        expect(result).toBe(42);
      });
    });

    describe('built-in objects', () => {
      it('should have access to JSON', async () => {
        const result = await client.execute({
          code: 'return JSON.stringify({ a: 1 });',
        });

        expect(result).toBe('{"a":1}');
      });

      it('should have access to Date', async () => {
        const result = await client.execute({
          code: 'return new Date().getFullYear() >= 2024;',
        });

        expect(result).toBe(true);
      });

      it('should have access to Math', async () => {
        const result = await client.execute({
          code: 'return Math.max(1, 5, 3);',
        });

        expect(result).toBe(5);
      });

      it('should have access to Array methods', async () => {
        const result = await client.execute({
          code: 'return [1, 2, 3].map(x => x * 2);',
        });

        expect(result).toEqual([2, 4, 6]);
      });

      it('should have access to Object methods', async () => {
        const result = await client.execute({
          code: 'return Object.keys({ a: 1, b: 2 });',
        });

        expect(result).toEqual(['a', 'b']);
      });

      it('should have access to RegExp', async () => {
        const result = await client.execute({
          code: 'return /test/.test("this is a test");',
        });

        expect(result).toBe(true);
      });
    });

    describe('complex scenarios', () => {
      it('should handle workflow-like data transformation', async () => {
        const result = await client.execute({
          code: `
            const items = context.data.items;
            const filtered = items.filter(i => i.active);
            const mapped = filtered.map(i => ({ id: i.id, name: i.name.toUpperCase() }));
            return { count: mapped.length, items: mapped };
          `,
          context: {
            data: {
              items: [
                { id: 1, name: 'item1', active: true },
                { id: 2, name: 'item2', active: false },
                { id: 3, name: 'item3', active: true },
              ],
            },
          },
        });

        expect(result).toEqual({
          count: 2,
          items: [
            { id: 1, name: 'ITEM1' },
            { id: 3, name: 'ITEM3' },
          ],
        });
      });

      it('should handle response formatting', async () => {
        const result = await client.execute({
          code: `
            const answer = context.agent_analysis?.response || context.agent_analysis || 'No answer';
            let formatted = String(answer).trim();
            if (formatted.length > 100) {
              formatted = formatted.substring(0, 97) + '...';
            }
            return { formatted_answer: formatted };
          `,
          context: {
            agent_analysis: 'This is the agent response that should be formatted.',
          },
        });

        expect(result).toEqual({
          formatted_answer: 'This is the agent response that should be formatted.',
        });
      });

      it('should handle JSON parsing from response', async () => {
        const result = await client.execute({
          code: `
            const response = context.api_response;
            const jsonMatch = response.match(/\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\`/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[1]);
            }
            return { error: 'No JSON found' };
          `,
          context: {
            api_response: 'Here is the result:\n```json\n{"status": "success", "count": 42}\n```\nEnd.',
          },
        });

        expect(result).toEqual({ status: 'success', count: 42 });
      });
    });

    describe('error handling', () => {
      it('should throw on missing code parameter', async () => {
        await expect(client.execute({ code: '' })).rejects.toThrow(
          'script.execute requires a "code" parameter'
        );
      });

      it('should throw on syntax error', async () => {
        await expect(
          client.execute({
            code: 'return {{{invalid syntax',
          })
        ).rejects.toThrow('Script compilation failed');
      });

      it('should throw on runtime error', async () => {
        await expect(
          client.execute({
            code: 'throw new Error("test error");',
          })
        ).rejects.toThrow('test error');
      });

      it('should throw on accessing undefined property', async () => {
        await expect(
          client.execute({
            code: 'return context.undefined.property;',
            context: {},
          })
        ).rejects.toThrow();
      });
    });

    describe('timeout handling', () => {
      it('should timeout on async operations that take too long', async () => {
        const shortTimeoutClient = new InlineScriptClient(100); // 100ms timeout

        await expect(
          shortTimeoutClient.execute({
            code: `
              // Async delay that exceeds timeout
              await new Promise(resolve => setTimeout(resolve, 500));
              return "done";
            `,
          })
        ).rejects.toThrow('timed out');
      }, 10000);

      it('should allow custom timeout configuration', () => {
        const client1 = new InlineScriptClient(1000);
        const client2 = new InlineScriptClient(5000);
        // Just verify they can be instantiated with different timeouts
        expect(client1).toBeInstanceOf(InlineScriptClient);
        expect(client2).toBeInstanceOf(InlineScriptClient);
      });
    });
  });
});
