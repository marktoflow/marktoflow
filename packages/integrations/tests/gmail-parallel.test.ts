/**
 * Tests for Gmail parallel email fetching.
 *
 * Verifies that getEmails fetches messages in parallel batches
 * instead of sequentially.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('Gmail parallel fetching', () => {
  it('should use Promise.all for batch fetching in getEmails', async () => {
    const gmailPath = join(__dirname, '..', 'src', 'services', 'gmail.ts');
    const content = await readFile(gmailPath, 'utf-8');

    // Should use Promise.all for parallel fetching
    expect(content).toContain('Promise.all');

    // Should have batch size constant
    expect(content).toContain('BATCH_SIZE');
  });

  it('should not use sequential for loop for message fetching', async () => {
    const gmailPath = join(__dirname, '..', 'src', 'services', 'gmail.ts');
    const content = await readFile(gmailPath, 'utf-8');

    // The getEmails method should NOT have sequential pattern:
    // "for (const msg of messages) { ... await this.gmail.users.messages.get"
    // Instead it should use batch + Promise.all
    const getEmailsSection = content.slice(
      content.indexOf('async getEmails'),
      content.indexOf('async sendEmail')
    );

    // Should not have a simple for...of loop with await get inside
    const sequentialPattern = /for\s*\(\s*const\s+msg\s+of\s+messages\s*\)[\s\S]*?await\s+this\.gmail\.users\.messages\.get/;
    expect(sequentialPattern.test(getEmailsSection)).toBe(false);
  });

  it('should batch in groups of 5', async () => {
    const gmailPath = join(__dirname, '..', 'src', 'services', 'gmail.ts');
    const content = await readFile(gmailPath, 'utf-8');

    expect(content).toContain('BATCH_SIZE = 5');
  });

  it('should filter out messages without IDs before fetching', async () => {
    const gmailPath = join(__dirname, '..', 'src', 'services', 'gmail.ts');
    const content = await readFile(gmailPath, 'utf-8');

    // Should filter before batching, not inside the loop
    expect(content).toContain('filter((msg) => msg.id)');
  });
});
