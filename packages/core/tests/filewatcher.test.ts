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
    const watcher = new FileWatcher({ path: testDir, debounceMs: 10, recursive: false, usePolling: true, interval: 100 });
    const handler = vi.fn().mockResolvedValue(undefined);

    watcher.onEvent(handler);
    watcher.start();

    await new Promise<void>((resolve) => {
      watcher.on('ready', () => resolve());
    });

    // Give chokidar extra time to stabilize on slow filesystems (e.g., external drives)
    await new Promise((r) => setTimeout(r, 200));

    const eventPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for file event')), 8000);
      watcher.on('event', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    const testFile = join(testDir, 'test.txt');
    writeFileSync(testFile, 'hello');

    await eventPromise;

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      event: 'add',
      path: expect.stringContaining('test.txt')
    }));

    await watcher.stop();
  });
});
