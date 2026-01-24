/**
 * File watcher trigger for marktoflow v2.0
 * 
 * Monitors the file system for changes and triggers workflows.
 */

import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'node:events';

export interface FileWatcherOptions {
  path: string | string[];
  ignored?: string | string[] | ((path: string) => boolean);
  persistent?: boolean;
  recursive?: boolean;
  debounceMs?: number;
}

export interface FileEvent {
  event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir';
  path: string;
}

export type FileEventHandler = (event: FileEvent) => Promise<void>;

export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private options: FileWatcherOptions;
  private handlers: FileEventHandler[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: FileWatcherOptions) {
    super();
    this.options = {
      debounceMs: 100,
      recursive: true,
      persistent: true,
      ...options
    };
  }

  onEvent(handler: FileEventHandler): void {
    this.handlers.push(handler);
  }

  start(): void {
    if (this.watcher) return;

    const watchOptions: any = {
      ignoreInitial: true,
      persistent: this.options.persistent,
    };

    if (this.options.ignored) {
      watchOptions.ignored = this.options.ignored;
    }

    if (!this.options.recursive) {
      watchOptions.depth = 0;
    }

    this.watcher = watch(this.options.path, watchOptions);

    const handleEvent = (event: FileEvent['event'], path: string) => {
      const debounceMs = this.options.debounceMs || 0;
      
      if (debounceMs > 0) {
        if (this.debounceTimers.has(path)) {
          clearTimeout(this.debounceTimers.get(path)!);
        }
        
        const timer = setTimeout(() => {
          this.debounceTimers.delete(path);
          this.triggerHandlers({ event, path });
        }, debounceMs);
        
        this.debounceTimers.set(path, timer);
      } else {
        this.triggerHandlers({ event, path });
      }
    };

    this.watcher
      .on('add', path => handleEvent('add', path))
      .on('change', path => handleEvent('change', path))
      .on('unlink', path => handleEvent('unlink', path))
      .on('addDir', path => handleEvent('addDir', path))
      .on('unlinkDir', path => handleEvent('unlinkDir', path))
      .on('error', error => this.emit('error', error));
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private async triggerHandlers(event: FileEvent): Promise<void> {
    this.emit('event', event);
    for (const handler of this.handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.emit('error', error);
      }
    }
  }
}
