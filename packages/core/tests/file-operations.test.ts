/**
 * Tests for file operations (file.read, file.write)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  executeFileRead,
  executeFileWrite,
  executeFileOperation,
  isFileOperation,
} from '../src/file-operations.js';
import { createExecutionContext } from '../src/models.js';

// Helper to create a simple execution context
function createTestContext(variables: Record<string, unknown> = {}, inputs: Record<string, unknown> = {}) {
  const ctx = createExecutionContext(
    {
      metadata: { id: 'test', name: 'Test' },
      tools: {},
      steps: [],
    },
    inputs
  );
  ctx.variables = variables;
  return ctx;
}

describe('File Operations', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `marktoflow-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('isFileOperation', () => {
    it('should identify file.read as a file operation', () => {
      expect(isFileOperation('file.read')).toBe(true);
    });

    it('should identify file.write as a file operation', () => {
      expect(isFileOperation('file.write')).toBe(true);
    });

    it('should not identify non-file actions', () => {
      expect(isFileOperation('core.set')).toBe(false);
      expect(isFileOperation('slack.chat.postMessage')).toBe(false);
      expect(isFileOperation('file.delete')).toBe(false);
    });
  });

  describe('file.read - text files', () => {
    it('should read a plain text file', async () => {
      const filePath = join(testDir, 'test.txt');
      const content = 'Hello, world!';
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.content).toBe(content);
      expect(result.path).toBe(filePath);
      expect(result.originalFormat).toBe('text');
      expect(result.convertedFrom).toBeUndefined();
    });

    it('should read a markdown file', async () => {
      const filePath = join(testDir, 'test.md');
      const content = '# Header\n\nSome content';
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.content).toBe(content);
      expect(result.originalFormat).toBe('text');
    });

    it('should read a JSON file', async () => {
      const filePath = join(testDir, 'test.json');
      const content = '{"name": "test", "value": 42}';
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.content).toBe(content);
      expect(result.originalFormat).toBe('text');
    });

    it('should read a YAML file', async () => {
      const filePath = join(testDir, 'test.yaml');
      const content = 'name: test\nvalue: 42';
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.content).toBe(content);
      expect(result.originalFormat).toBe('text');
    });

    it('should resolve template in path', async () => {
      const filePath = join(testDir, 'test.txt');
      const content = 'Template test';
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext({ fileName: 'test.txt' });
      const result = await executeFileRead({ path: `${testDir}/{{ fileName }}` }, context);

      expect(result.content).toBe(content);
    });

    it('should throw error for non-existent file', async () => {
      const filePath = join(testDir, 'nonexistent.txt');
      const context = createTestContext();

      await expect(executeFileRead({ path: filePath }, context)).rejects.toThrow('File not found');
    });

    it('should read file with different encoding', async () => {
      const filePath = join(testDir, 'test.txt');
      const content = 'Test content';
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath, encoding: 'utf8' }, context);

      expect(result.content).toBe(content);
    });
  });

  describe('file.read - binary files', () => {
    it('should read binary file as base64', async () => {
      const filePath = join(testDir, 'test.bin');
      const content = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]);
      await fs.writeFile(filePath, content);

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.originalFormat).toBe('binary');
      expect(result.convertedFrom).toBe('binary (base64 encoded)');
      // Verify base64 encoding
      expect(Buffer.from(result.content, 'base64')).toEqual(content);
    });
  });

  describe('file.write - text files', () => {
    it('should write a plain text file', async () => {
      const filePath = join(testDir, 'output.txt');
      const content = 'Written content';

      const context = createTestContext();
      const result = await executeFileWrite({ path: filePath, data: content }, context);

      expect(result.success).toBe(true);
      expect(result.path).toBe(filePath);

      // Verify file content
      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe(content);
    });

    it('should write file with template-resolved data', async () => {
      const filePath = join(testDir, 'output.txt');

      const context = createTestContext({ message: 'Hello from template!' });
      const result = await executeFileWrite(
        { path: filePath, data: '{{ message }}' },
        context
      );

      expect(result.success).toBe(true);
      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('Hello from template!');
    });

    it('should write file with template-resolved path', async () => {
      const filePath = join(testDir, 'output.txt');

      const context = createTestContext({ dir: testDir, name: 'output.txt' });
      const result = await executeFileWrite(
        { path: '{{ dir }}/{{ name }}', data: 'test' },
        context
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe(filePath);
    });

    it('should create directory if requested', async () => {
      const filePath = join(testDir, 'nested', 'dir', 'output.txt');
      const content = 'Nested content';

      const context = createTestContext();
      const result = await executeFileWrite(
        { path: filePath, data: content, createDirectory: true },
        context
      );

      expect(result.success).toBe(true);
      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe(content);
    });

    it('should write JSON object as formatted JSON', async () => {
      const filePath = join(testDir, 'output.json');
      const data = { name: 'test', value: 42 };

      const context = createTestContext({ obj: data });
      const result = await executeFileWrite(
        { path: filePath, data: '{{ obj }}' },
        context
      );

      expect(result.success).toBe(true);
      const written = await fs.readFile(filePath, 'utf8');
      expect(JSON.parse(written)).toEqual(data);
    });

    it('should write binary data from base64', async () => {
      const filePath = join(testDir, 'output.bin');
      const originalData = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
      const base64Data = originalData.toString('base64');

      const context = createTestContext();
      const result = await executeFileWrite(
        { path: filePath, data: base64Data, encoding: 'base64' },
        context
      );

      expect(result.success).toBe(true);
      const written = await fs.readFile(filePath);
      expect(written).toEqual(originalData);
    });

    it('should overwrite existing file', async () => {
      const filePath = join(testDir, 'output.txt');
      await fs.writeFile(filePath, 'original', 'utf8');

      const context = createTestContext();
      await executeFileWrite({ path: filePath, data: 'updated' }, context);

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('updated');
    });
  });

  describe('executeFileOperation', () => {
    it('should execute file.read', async () => {
      const filePath = join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'test content', 'utf8');

      const context = createTestContext();
      const result = await executeFileOperation('file.read', { path: filePath }, context);

      expect(result).toBeDefined();
      expect((result as { content: string }).content).toBe('test content');
    });

    it('should execute file.write', async () => {
      const filePath = join(testDir, 'output.txt');

      const context = createTestContext();
      const result = await executeFileOperation(
        'file.write',
        { path: filePath, data: 'written via operation' },
        context
      );

      expect(result).toBeDefined();
      expect((result as { success: boolean }).success).toBe(true);

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('written via operation');
    });

    it('should return null for unknown operation', async () => {
      const context = createTestContext();
      const result = await executeFileOperation('file.delete', {}, context);
      expect(result).toBeNull();
    });
  });

  describe('file type detection', () => {
    const textExtensions = [
      '.txt', '.md', '.json', '.yaml', '.yml', '.xml',
      '.html', '.htm', '.css', '.js', '.ts', '.jsx', '.tsx',
      '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h',
      '.sh', '.bash', '.sql', '.csv', '.log', '.env', '.ini',
      '.toml', '.cfg', '.conf',
    ];

    for (const ext of textExtensions) {
      it(`should detect ${ext} as text format`, async () => {
        const filePath = join(testDir, `test${ext}`);
        await fs.writeFile(filePath, 'content', 'utf8');

        const context = createTestContext();
        const result = await executeFileRead({ path: filePath }, context);

        expect(result.originalFormat).toBe('text');
      });
    }
  });

  describe('edge cases', () => {
    it('should handle empty file', async () => {
      const filePath = join(testDir, 'empty.txt');
      await fs.writeFile(filePath, '', 'utf8');

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.content).toBe('');
      expect(result.size).toBe(0);
    });

    it('should handle large file', async () => {
      const filePath = join(testDir, 'large.txt');
      const content = 'x'.repeat(100000);
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.content).toBe(content);
      expect(result.size).toBe(100000);
    });

    it('should handle file with unicode content', async () => {
      const filePath = join(testDir, 'unicode.txt');
      const content = 'Hello \u4e16\u754c \u{1F600}'; // Hello 世界 😀
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.content).toBe(content);
    });

    it('should handle relative path resolution', async () => {
      const filePath = join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'test', 'utf8');

      const context = createTestContext();
      // The path should resolve to absolute
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.path).toBe(filePath);
    });

    it('should handle file names with spaces', async () => {
      const filePath = join(testDir, 'file with spaces.txt');
      const content = 'content with spaces';
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.content).toBe(content);
    });

    it('should handle file names with special characters', async () => {
      const filePath = join(testDir, 'file-with_special.chars@2024.txt');
      const content = 'special content';
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.content).toBe(content);
    });

    it('should fail when trying to read a directory', async () => {
      const dirPath = join(testDir, 'subdir');
      await fs.mkdir(dirPath);

      const context = createTestContext();
      await expect(executeFileRead({ path: dirPath }, context)).rejects.toThrow();
    });

    it('should handle deeply nested directory creation', async () => {
      const filePath = join(testDir, 'a', 'b', 'c', 'd', 'e', 'file.txt');
      const content = 'nested content';

      const context = createTestContext();
      const result = await executeFileWrite(
        { path: filePath, data: content, createDirectory: true },
        context
      );

      expect(result.success).toBe(true);
      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe(content);
    });

    it('should fail when directory creation is not enabled', async () => {
      const filePath = join(testDir, 'nonexistent', 'dir', 'file.txt');
      const context = createTestContext();

      await expect(
        executeFileWrite({ path: filePath, data: 'test' }, context)
      ).rejects.toThrow();
    });
  });
});

describe('File Operations - Format Conversion', () => {
  // These tests check that conversion functions exist and handle missing dependencies gracefully
  // Actual conversion tests would require the optional dependencies to be installed

  describe('DOCX conversion', () => {
    it('should report missing mammoth package', async () => {
      const context = createTestContext(
        {},
        {}
      );

      // Create a minimal .docx file (won't be valid but tests path)
      const testDir = join(tmpdir(), `marktoflow-test-${Date.now()}`);
      await fs.mkdir(testDir, { recursive: true });
      const filePath = join(testDir, 'test.docx');
      await fs.writeFile(filePath, 'not a real docx');

      try {
        await executeFileRead({ path: filePath }, context);
        // If mammoth is installed, it will fail on invalid docx
      } catch (error) {
        const message = (error as Error).message;
        // Should either report mammoth not installed or fail to parse
        expect(message).toMatch(/mammoth|DOCX|corrupt|invalid/i);
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('PDF conversion', () => {
    it('should report missing pdf-parse package', async () => {
      const context = createTestContext();

      const testDir = join(tmpdir(), `marktoflow-test-${Date.now()}`);
      await fs.mkdir(testDir, { recursive: true });
      const filePath = join(testDir, 'test.pdf');
      await fs.writeFile(filePath, 'not a real pdf');

      try {
        await executeFileRead({ path: filePath }, context);
      } catch (error) {
        const message = (error as Error).message;
        // Should either report pdf-parse not installed or fail to parse
        expect(message).toMatch(/pdf-parse|PDF|Invalid|parse/i);
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('XLSX conversion', () => {
    it('should report missing xlsx package', async () => {
      const context = createTestContext();

      const testDir = join(tmpdir(), `marktoflow-test-${Date.now()}`);
      await fs.mkdir(testDir, { recursive: true });
      const filePath = join(testDir, 'test.xlsx');
      await fs.writeFile(filePath, 'not a real xlsx');

      try {
        await executeFileRead({ path: filePath }, context);
      } catch (error) {
        const message = (error as Error).message;
        // Should either report xlsx not installed or fail to parse
        expect(message).toMatch(/xlsx|XLSX|File is not a zip file|corrupt/i);
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });
});

describe('File Operations - Advanced Data Types', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `marktoflow-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('file.write - complex data types', () => {
    it('should write array as JSON', async () => {
      const filePath = join(testDir, 'array.json');
      const data = [1, 2, 3, 'test', { key: 'value' }];

      const context = createTestContext({ arr: data });
      await executeFileWrite({ path: filePath, data: '{{ arr }}' }, context);

      const written = await fs.readFile(filePath, 'utf8');
      expect(JSON.parse(written)).toEqual(data);
    });

    it('should write nested object as JSON', async () => {
      const filePath = join(testDir, 'nested.json');
      const data = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
              numbers: [1, 2, 3],
            },
          },
        },
      };

      const context = createTestContext({ obj: data });
      await executeFileWrite({ path: filePath, data: '{{ obj }}' }, context);

      const written = await fs.readFile(filePath, 'utf8');
      expect(JSON.parse(written)).toEqual(data);
    });

    it('should write number as string', async () => {
      const filePath = join(testDir, 'number.txt');
      const context = createTestContext({ num: 42 });

      await executeFileWrite({ path: filePath, data: '{{ num }}' }, context);

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('42');
    });

    it('should write boolean as string', async () => {
      const filePath = join(testDir, 'boolean.txt');
      const context = createTestContext({ flag: true });

      await executeFileWrite({ path: filePath, data: '{{ flag }}' }, context);

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('true');
    });

    it('should handle mixed content in templates', async () => {
      const filePath = join(testDir, 'mixed.txt');
      const context = createTestContext({ name: 'Alice', age: 30, active: true });

      await executeFileWrite(
        { path: filePath, data: 'Name: {{ name }}, Age: {{ age }}, Active: {{ active }}' },
        context
      );

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('Name: Alice, Age: 30, Active: true');
    });

    it('should write empty string', async () => {
      const filePath = join(testDir, 'empty.txt');
      const context = createTestContext();

      await executeFileWrite({ path: filePath, data: '' }, context);

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('');
    });

    it('should handle newlines and special characters', async () => {
      const filePath = join(testDir, 'special.txt');
      const content = 'Line 1\nLine 2\tTabbed\r\nWindows newline';

      const context = createTestContext();
      await executeFileWrite({ path: filePath, data: content }, context);

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe(content);
    });
  });

  describe('template resolution edge cases', () => {
    it('should handle nested variable references', async () => {
      const filePath = join(testDir, 'nested-vars.txt');
      const context = createTestContext({
        user: { name: 'Bob', email: 'bob@example.com' },
      });

      await executeFileWrite(
        { path: filePath, data: 'User: {{ user.name }} ({{ user.email }})' },
        context
      );

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('User: Bob (bob@example.com)');
    });

    it('should handle array indexing in templates', async () => {
      const filePath = join(testDir, 'array-index.txt');
      const context = createTestContext({
        items: ['first', 'second', 'third'],
      });

      await executeFileWrite(
        { path: filePath, data: 'Item: {{ items[0] }}' },
        context
      );

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('Item: first');
    });

    it('should handle multiple templates in path', async () => {
      const context = createTestContext({
        dir: testDir,
        folder: 'output',
        filename: 'result',
        ext: 'txt',
      });

      const filePath = join(testDir, 'output', 'result.txt');
      await fs.mkdir(join(testDir, 'output'), { recursive: true });

      await executeFileWrite(
        { path: '{{ dir }}/{{ folder }}/{{ filename }}.{{ ext }}', data: 'test' },
        context
      );

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('test');
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple reads of the same file', async () => {
      const filePath = join(testDir, 'concurrent.txt');
      const content = 'concurrent read test';
      await fs.writeFile(filePath, content, 'utf8');

      const context = createTestContext();

      // Perform 5 concurrent reads
      const reads = Array(5).fill(null).map(() =>
        executeFileRead({ path: filePath }, context)
      );

      const results = await Promise.all(reads);

      // All reads should succeed with the same content
      results.forEach(result => {
        expect(result.content).toBe(content);
      });
    });

    it('should handle sequential writes to the same file', async () => {
      const filePath = join(testDir, 'sequential.txt');
      const context = createTestContext();

      await executeFileWrite({ path: filePath, data: 'first' }, context);
      await executeFileWrite({ path: filePath, data: 'second' }, context);
      await executeFileWrite({ path: filePath, data: 'third' }, context);

      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('third'); // Last write wins
    });
  });

  describe('error scenarios', () => {
    it('should provide clear error for invalid path template', async () => {
      const context = createTestContext(); // No variables defined

      await expect(
        executeFileRead({ path: '{{ undefined_var }}/file.txt' }, context)
      ).rejects.toThrow();
    });

    it('should handle read after write in same workflow', async () => {
      const filePath = join(testDir, 'readwrite.txt');
      const content = 'write then read';
      const context = createTestContext();

      // Write file
      await executeFileWrite({ path: filePath, data: content }, context);

      // Read it back
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.content).toBe(content);
    });

    it('should handle file size metadata correctly', async () => {
      const filePath = join(testDir, 'sized.txt');
      const content = 'a'.repeat(1000);
      const context = createTestContext();

      const writeResult = await executeFileWrite({ path: filePath, data: content }, context);
      expect(writeResult.size).toBe(1000);

      const readResult = await executeFileRead({ path: filePath }, context);
      expect(readResult.size).toBe(1000);
    });
  });

  describe('binary data handling', () => {
    it('should correctly encode and decode binary data', async () => {
      const filePath = join(testDir, 'binary-roundtrip.bin');
      const originalData = Buffer.from([0x00, 0x01, 0x7F, 0x80, 0xFF, 0xAB, 0xCD]);
      const base64 = originalData.toString('base64');

      const context = createTestContext();

      // Write binary data
      await executeFileWrite({ path: filePath, data: base64, encoding: 'base64' }, context);

      // Read it back
      const readResult = await executeFileRead({ path: filePath }, context);

      // Should be base64 encoded
      expect(readResult.originalFormat).toBe('binary');
      expect(Buffer.from(readResult.content, 'base64')).toEqual(originalData);
    });

    it('should handle zero-byte binary file', async () => {
      const filePath = join(testDir, 'empty.bin');
      await fs.writeFile(filePath, Buffer.alloc(0));

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.size).toBe(0);
      expect(result.originalFormat).toBe('binary');
    });

    it('should handle large binary file', async () => {
      const filePath = join(testDir, 'large.bin');
      const size = 50000; // 50KB
      const buffer = Buffer.alloc(size);
      // Fill with pattern
      for (let i = 0; i < size; i++) {
        buffer[i] = i % 256;
      }
      await fs.writeFile(filePath, buffer);

      const context = createTestContext();
      const result = await executeFileRead({ path: filePath }, context);

      expect(result.size).toBe(size);
      const decoded = Buffer.from(result.content, 'base64');
      expect(decoded).toEqual(buffer);
    });
  });

  describe('symlink handling', () => {
    it('should read through symlinks', async () => {
      const targetPath = join(testDir, 'target.txt');
      const linkPath = join(testDir, 'link.txt');
      const content = 'symlink content';

      await fs.writeFile(targetPath, content, 'utf8');
      await fs.symlink(targetPath, linkPath);

      const context = createTestContext();
      const result = await executeFileRead({ path: linkPath }, context);

      expect(result.content).toBe(content);
    });

    it('should write through symlinks', async () => {
      const targetPath = join(testDir, 'target.txt');
      const linkPath = join(testDir, 'link.txt');
      await fs.writeFile(targetPath, 'original', 'utf8');
      await fs.symlink(targetPath, linkPath);

      const context = createTestContext();
      await executeFileWrite({ path: linkPath, data: 'updated' }, context);

      // Read from target to verify
      const content = await fs.readFile(targetPath, 'utf8');
      expect(content).toBe('updated');
    });

    it('should handle broken symlinks', async () => {
      const linkPath = join(testDir, 'broken-link.txt');
      const nonExistentTarget = join(testDir, 'nonexistent.txt');
      await fs.symlink(nonExistentTarget, linkPath);

      const context = createTestContext();
      await expect(executeFileRead({ path: linkPath }, context)).rejects.toThrow();
    });
  });
});
