import { describe, it, expect } from 'vitest';
import { parseFile, ParseError } from '../src/parser.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';

const EXAMPLES_DIR = resolve(__dirname, '../../../examples');

/**
 * Recursively find all .md files under a directory.
 */
async function findMdFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const s = await stat(fullPath);
    if (s.isDirectory()) {
      results.push(...(await findMdFiles(fullPath)));
    } else if (entry.endsWith('.md')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Discover all workflow .md files that have YAML frontmatter with `workflow:`.
 * Skips READMEs and other non-workflow markdown files.
 */
async function discoverWorkflows(): Promise<string[]> {
  const allMdFiles = await findMdFiles(EXAMPLES_DIR);
  const workflows: string[] = [];

  for (const filePath of allMdFiles) {
    const content = await readFile(filePath, 'utf-8');
    // Must have YAML frontmatter with workflow: key
    if (content.startsWith('---') && /^workflow:/m.test(content.split('---')[1] || '')) {
      workflows.push(filePath);
    }
  }

  return workflows.sort();
}

describe('Example Workflows', () => {
  it('should discover example workflows', async () => {
    const workflows = await discoverWorkflows();
    expect(workflows.length).toBeGreaterThan(0);
  });

  it('should validate all example workflows', async () => {
    const workflows = await discoverWorkflows();

    for (const filePath of workflows) {
      const relPath = relative(EXAMPLES_DIR, filePath);

      let result;
      try {
        result = await parseFile(filePath, { resolveEnv: false });
      } catch (error) {
        if (error instanceof ParseError) {
          throw new Error(`ParseError in ${relPath}: ${error.message}`);
        }
        throw error;
      }

      // No warnings (silently skipped steps indicate problems)
      expect(result.warnings, `Warnings in ${relPath}: ${result.warnings.join(', ')}`).toEqual([]);

      // Must have at least one step
      expect(
        result.workflow.steps.length,
        `${relPath} should have at least 1 step`
      ).toBeGreaterThan(0);

      // Must have an explicit workflow id
      expect(
        result.workflow.metadata.id,
        `${relPath} should have an explicit workflow id`
      ).not.toBe('unnamed');
    }
  });
});
