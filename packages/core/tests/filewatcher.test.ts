import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileWatcher } from '../src/filewatcher.js';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('FileWatcher', () => {
  const testDir = join(tmpdir(), `marktoflow-watch-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch {}
  });

  it('should detect file changes', async () => {
    const watcher = new FileWatcher({ path: testDir, debounceMs: 10 });
    const handler = vi.fn().mockResolvedValue(undefined);
    
    watcher.onEvent(handler);
    watcher.start();

    // Wait for watcher to be ready
    await new Promise(r => setTimeout(r, 100));

    const testFile = join(testDir, 'test.txt');
    writeFileSync(testFile, 'hello');

    // Wait for event to be processed
    await new Promise(r => setTimeout(r, 500));

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      event: 'add',
      path: expect.stringContaining('test.txt')
    }));

    await watcher.stop();
  });
});
