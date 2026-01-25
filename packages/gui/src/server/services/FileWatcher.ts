import { watch, type FSWatcher } from 'chokidar';
import type { Server as SocketIOServer } from 'socket.io';
import { relative } from 'path';

export class FileWatcher {
  private watcher: FSWatcher;
  private io: SocketIOServer;
  private baseDir: string;

  constructor(baseDir: string, io: SocketIOServer) {
    this.baseDir = baseDir;
    this.io = io;

    // Watch for workflow files
    this.watcher = watch(['**/*.md', '**/*.yaml', '**/*.yml'], {
      cwd: baseDir,
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/.*',
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.setupListeners();
    console.log(`File watcher started for: ${baseDir}`);
  }

  private setupListeners() {
    this.watcher.on('change', (path) => {
      console.log(`File changed: ${path}`);
      this.io.emit('workflow:updated', {
        path,
        event: 'change',
        timestamp: new Date().toISOString(),
      });
    });

    this.watcher.on('add', (path) => {
      console.log(`File added: ${path}`);
      this.io.emit('workflow:updated', {
        path,
        event: 'add',
        timestamp: new Date().toISOString(),
      });
    });

    this.watcher.on('unlink', (path) => {
      console.log(`File removed: ${path}`);
      this.io.emit('workflow:updated', {
        path,
        event: 'remove',
        timestamp: new Date().toISOString(),
      });
    });

    this.watcher.on('error', (error) => {
      console.error('File watcher error:', error);
    });
  }

  stop() {
    this.watcher.close();
    console.log('File watcher stopped');
  }
}
