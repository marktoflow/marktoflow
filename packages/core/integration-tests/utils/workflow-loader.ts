/**
 * Workflow Loader Utilities
 *
 * Loads YAML workflow fixtures for integration testing.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContent } from '../../src/parser.js';
import type { Workflow } from '../../src/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, '..', 'test-fixtures');

// ============================================================================
// Types
// ============================================================================

export interface LoadedWorkflow {
  workflow: Workflow;
  warnings: string[];
  path: string;
}

// ============================================================================
// Loader Functions
// ============================================================================

/**
 * Load a workflow fixture from the test-fixtures directory.
 *
 * @param category The fixture category (e.g., 'control-flow', 'templates')
 * @param name The fixture filename (without .yaml extension)
 * @returns The parsed workflow
 *
 * @example
 * const { workflow } = loadFixture('control-flow', 'if-else-basic');
 */
export function loadFixture(category: string, name: string): LoadedWorkflow {
  const path = join(FIXTURES_DIR, category, `${name}.yaml`);

  if (!existsSync(path)) {
    throw new Error(`Fixture not found: ${path}`);
  }

  const content = readFileSync(path, 'utf-8');
  const { workflow, warnings } = parseContent(content, { validate: true });

  return { workflow, warnings, path };
}

/**
 * Load a workflow from inline YAML content.
 *
 * @param content The YAML workflow content (with frontmatter)
 * @returns The parsed workflow
 *
 * @example
 * const { workflow } = loadInline(`
 *   ---
 *   workflow:
 *     id: test
 *     name: Test
 *   steps:
 *     - id: step1
 *       action: mock.test
 *   ---
 * `);
 */
export function loadInline(content: string): LoadedWorkflow {
  // Normalize indentation - find minimum indent and remove it
  const lines = content.split('\n');
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const minIndent = Math.min(
    ...nonEmptyLines.map((line) => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    })
  );

  const normalizedContent = lines
    .map((line) => (line.trim() ? line.slice(minIndent) : ''))
    .join('\n')
    .trim();

  const { workflow, warnings } = parseContent(normalizedContent, { validate: true });
  return { workflow, warnings, path: 'inline' };
}

/**
 * Load all fixtures from a category.
 *
 * @param category The fixture category
 * @returns Array of loaded workflows
 */
export function loadAllFixtures(category: string): LoadedWorkflow[] {
  const categoryPath = join(FIXTURES_DIR, category);

  if (!existsSync(categoryPath)) {
    return [];
  }

  const fs = require('node:fs');
  const files = fs.readdirSync(categoryPath) as string[];

  return files
    .filter((file: string) => file.endsWith('.yaml') || file.endsWith('.yml'))
    .map((file: string) => {
      const name = file.replace(/\.ya?ml$/, '');
      return loadFixture(category, name);
    });
}

/**
 * Get the fixtures directory path.
 */
export function getFixturesDir(): string {
  return FIXTURES_DIR;
}
