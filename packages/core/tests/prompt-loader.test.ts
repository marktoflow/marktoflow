import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadPromptFile,
  resolvePromptTemplate,
  validatePromptInputs,
  extractPromptVariables,
} from '../src/prompt-loader.js';
import type { ExecutionContext } from '../src/models.js';

describe('prompt-loader', () => {
  const testDir = join(tmpdir(), 'marktoflow-prompt-test-' + Date.now());

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('loadPromptFile', () => {
    it('should load a simple prompt without frontmatter', async () => {
      const promptPath = join(testDir, 'simple.md');
      await writeFile(promptPath, 'Hello, world!');

      const prompt = await loadPromptFile(promptPath);

      expect(prompt.content).toBe('Hello, world!');
      expect(prompt.variables).toEqual({});
      expect(prompt.name).toBeUndefined();
    });

    it('should load a prompt with frontmatter', async () => {
      const promptPath = join(testDir, 'with-frontmatter.md');
      await writeFile(
        promptPath,
        `---
name: Code Review
description: Review code for quality
variables:
  code:
    type: string
    required: true
  language:
    type: string
    default: auto
---

Review this {{ prompt.language }} code:

\`\`\`
{{ prompt.code }}
\`\`\`
`
      );

      const prompt = await loadPromptFile(promptPath);

      expect(prompt.name).toBe('Code Review');
      expect(prompt.description).toBe('Review code for quality');
      expect(prompt.variables.code).toEqual({
        type: 'string',
        required: true,
        default: undefined,
        description: undefined,
      });
      expect(prompt.variables.language).toEqual({
        type: 'string',
        required: undefined,
        default: 'auto',
        description: undefined,
      });
      expect(prompt.content).toContain('Review this');
    });

    it('should throw error for non-existent file', async () => {
      await expect(loadPromptFile(join(testDir, 'nonexistent.md'))).rejects.toThrow(
        'Failed to load prompt file'
      );
    });

    it('should resolve relative paths from base path', async () => {
      const subDir = join(testDir, 'prompts');
      await mkdir(subDir, { recursive: true });

      const promptPath = join(subDir, 'relative.md');
      await writeFile(promptPath, 'Relative prompt content');

      const basePath = join(testDir, 'workflow.md');
      const prompt = await loadPromptFile('./prompts/relative.md', basePath);

      expect(prompt.content).toBe('Relative prompt content');
    });
  });

  describe('resolvePromptTemplate', () => {
    it('should resolve prompt.* variables', async () => {
      const promptPath = join(testDir, 'template.md');
      await writeFile(
        promptPath,
        `---
variables:
  name:
    type: string
---

Hello, {{ prompt.name }}!
`
      );

      const prompt = await loadPromptFile(promptPath);
      const resolved = resolvePromptTemplate(prompt, { name: 'Alice' });

      expect(resolved.content).toBe('Hello, Alice!');
      expect(resolved.variables.name).toBe('Alice');
    });

    it('should use default values when input not provided', async () => {
      const promptPath = join(testDir, 'defaults.md');
      await writeFile(
        promptPath,
        `---
variables:
  greeting:
    type: string
    default: Hello
---

{{ prompt.greeting }}, world!
`
      );

      const prompt = await loadPromptFile(promptPath);
      const resolved = resolvePromptTemplate(prompt, {});

      expect(resolved.content).toBe('Hello, world!');
    });

    it('should handle nested variables', async () => {
      const promptPath = join(testDir, 'nested.md');
      await writeFile(
        promptPath,
        `---
variables:
  user:
    type: object
---

User: {{ prompt.user.name }} ({{ prompt.user.email }})
`
      );

      const prompt = await loadPromptFile(promptPath);
      const resolved = resolvePromptTemplate(prompt, {
        user: { name: 'Bob', email: 'bob@example.com' },
      });

      expect(resolved.content).toContain('User: Bob (bob@example.com)');
    });

    it('should serialize objects and arrays', async () => {
      const promptPath = join(testDir, 'serialize.md');
      await writeFile(
        promptPath,
        `---
variables:
  items:
    type: array
---

Items: {{ prompt.items }}
`
      );

      const prompt = await loadPromptFile(promptPath);
      const resolved = resolvePromptTemplate(prompt, {
        items: ['a', 'b', 'c'],
      });

      expect(resolved.content).toContain('[\n  "a",\n  "b",\n  "c"\n]');
    });

    it('should resolve from execution context', async () => {
      const promptPath = join(testDir, 'context.md');
      await writeFile(
        promptPath,
        `---
variables:
  name:
    type: string
---

Name: {{ prompt.name }}, Input: {{ inputs.value }}
`
      );

      const prompt = await loadPromptFile(promptPath);
      const context: ExecutionContext = {
        workflowId: 'test',
        runId: 'run-1',
        variables: {},
        inputs: { value: 'from-context' },
        startedAt: new Date(),
        currentStepIndex: 0,
        status: 'running',
        stepMetadata: {},
      };

      const resolved = resolvePromptTemplate(prompt, { name: 'Test' }, context);

      expect(resolved.content).toContain('Name: Test');
      expect(resolved.content).toContain('Input: from-context');
    });
  });

  describe('validatePromptInputs', () => {
    it('should pass when all required variables are provided', async () => {
      const promptPath = join(testDir, 'required.md');
      await writeFile(
        promptPath,
        `---
variables:
  name:
    type: string
    required: true
  age:
    type: number
---

{{ prompt.name }} is {{ prompt.age }} years old.
`
      );

      const prompt = await loadPromptFile(promptPath);
      const result = validatePromptInputs(prompt, { name: 'Alice', age: 30 });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail when required variable is missing', async () => {
      const promptPath = join(testDir, 'missing-required.md');
      await writeFile(
        promptPath,
        `---
variables:
  name:
    type: string
    required: true
---

Hello, {{ prompt.name }}!
`
      );

      const prompt = await loadPromptFile(promptPath);
      const result = validatePromptInputs(prompt, {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required prompt variable: name');
    });

    it('should pass when required variable has default', async () => {
      const promptPath = join(testDir, 'required-with-default.md');
      await writeFile(
        promptPath,
        `---
variables:
  name:
    type: string
    required: true
    default: Guest
---

Hello, {{ prompt.name }}!
`
      );

      const prompt = await loadPromptFile(promptPath);
      const result = validatePromptInputs(prompt, {});

      expect(result.valid).toBe(true);
    });

    it('should validate types', async () => {
      const promptPath = join(testDir, 'types.md');
      await writeFile(
        promptPath,
        `---
variables:
  count:
    type: number
---

Count: {{ prompt.count }}
`
      );

      const prompt = await loadPromptFile(promptPath);

      const validResult = validatePromptInputs(prompt, { count: 42 });
      expect(validResult.valid).toBe(true);

      const invalidResult = validatePromptInputs(prompt, { count: 'not a number' });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors[0]).toContain('Expected number');
    });

    it('should warn about unused inputs', async () => {
      const promptPath = join(testDir, 'unused.md');
      await writeFile(
        promptPath,
        `---
variables:
  name:
    type: string
---

Hello, {{ prompt.name }}!
`
      );

      const prompt = await loadPromptFile(promptPath);
      const result = validatePromptInputs(prompt, { name: 'Alice', extra: 'unused' });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unused prompt input: extra');
    });
  });

  describe('extractPromptVariables', () => {
    it('should extract prompt.* variable names', () => {
      const content = `
        Hello, {{ prompt.name }}!
        You are {{ prompt.age }} years old.
        Email: {{ prompt.user.email }}
      `;

      const variables = extractPromptVariables(content);

      expect(variables).toContain('name');
      expect(variables).toContain('age');
      expect(variables).toContain('user.email');
    });

    it('should return empty array for no variables', () => {
      const content = 'No variables here.';
      const variables = extractPromptVariables(content);

      expect(variables).toEqual([]);
    });

    it('should not duplicate variables', () => {
      const content = `
        {{ prompt.name }} {{ prompt.name }} {{ prompt.name }}
      `;

      const variables = extractPromptVariables(content);

      expect(variables).toEqual(['name']);
    });
  });
});
