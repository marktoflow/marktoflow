/**
 * Tests for async I/O in credential persistence.
 *
 * Verifies that Gmail, Google services, and Outlook use
 * non-blocking async file operations instead of sync I/O.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SERVICE_FILES = [
  'gmail.ts',
  'google-docs.ts',
  'google-calendar.ts',
  'google-sheets.ts',
  'google-drive.ts',
  'outlook.ts',
];

const SYNC_PATTERNS = [
  'readFileSync',
  'writeFileSync',
  'mkdirSync',
  'existsSync',
  'appendFileSync',
];

describe('async I/O compliance', () => {
  for (const file of SERVICE_FILES) {
    it(`${file} should not use synchronous filesystem operations`, async () => {
      const filePath = join(__dirname, '..', 'src', 'services', file);
      const content = await readFile(filePath, 'utf-8');

      for (const pattern of SYNC_PATTERNS) {
        expect(content).not.toContain(pattern);
      }
    });
  }

  for (const file of SERVICE_FILES) {
    it(`${file} should use async fs/promises imports`, async () => {
      const filePath = join(__dirname, '..', 'src', 'services', file);
      const content = await readFile(filePath, 'utf-8');

      // Should import from node:fs/promises (not node:fs)
      expect(content).toContain("from 'node:fs/promises'");
    });
  }

  it('gmail.ts should create directories before writing credentials', async () => {
    const filePath = join(__dirname, '..', 'src', 'services', 'gmail.ts');
    const content = await readFile(filePath, 'utf-8');

    // Verify mkdir is called before writeFile in the token persistence block
    const mkdirIndex = content.indexOf('mkdir(');
    const writeIndex = content.indexOf('writeFile(');
    expect(mkdirIndex).toBeGreaterThan(-1);
    expect(writeIndex).toBeGreaterThan(-1);
    expect(mkdirIndex).toBeLessThan(writeIndex);
  });

  it('outlook.ts should create directories before writing credentials', async () => {
    const filePath = join(__dirname, '..', 'src', 'services', 'outlook.ts');
    const content = await readFile(filePath, 'utf-8');

    const mkdirIndex = content.indexOf('mkdir(');
    const writeIndex = content.indexOf('writeFile(');
    expect(mkdirIndex).toBeGreaterThan(-1);
    expect(writeIndex).toBeGreaterThan(-1);
    expect(mkdirIndex).toBeLessThan(writeIndex);
  });

  it('gmail loadSavedTokens should be async', async () => {
    const filePath = join(__dirname, '..', 'src', 'services', 'gmail.ts');
    const content = await readFile(filePath, 'utf-8');

    expect(content).toContain('async function loadSavedTokens()');
    expect(content).toContain('await loadSavedTokens()');
  });

  it('outlook loadOutlookTokens should be async', async () => {
    const filePath = join(__dirname, '..', 'src', 'services', 'outlook.ts');
    const content = await readFile(filePath, 'utf-8');

    expect(content).toContain('async function loadOutlookTokens()');
    expect(content).toContain('await loadOutlookTokens()');
  });

  it('outlook saveOutlookTokens should be async', async () => {
    const filePath = join(__dirname, '..', 'src', 'services', 'outlook.ts');
    const content = await readFile(filePath, 'utf-8');

    expect(content).toContain('async function saveOutlookTokens(');
    expect(content).toContain('await saveOutlookTokens(');
  });
});
