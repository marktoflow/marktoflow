#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { createServer, type Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { join } from 'path';
import { existsSync } from 'fs';
import { workflowRoutes } from './routes/workflows.js';
import { aiRoutes } from './routes/ai.js';
import { executeRoutes } from './routes/execute.js';
import { toolsRoutes } from './routes/tools.js';
import { setupWebSocket } from './websocket/index.js';
import { FileWatcher } from './services/FileWatcher.js';

export interface ServerOptions {
  port?: number;
  workflowDir?: string;
  staticDir?: string;
}

let httpServer: Server | null = null;
let fileWatcher: FileWatcher | null = null;

/**
 * Start the GUI server programmatically
 */
export async function startServer(options: ServerOptions = {}): Promise<Server> {
  const PORT = options.port || parseInt(process.env.PORT || '3001', 10);
  const WORKFLOW_DIR = options.workflowDir || process.env.WORKFLOW_DIR || process.cwd();
  const STATIC_DIR = options.staticDir || process.env.STATIC_DIR;

  const app = express();
  httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000', `http://localhost:${PORT}`],
      methods: ['GET', 'POST'],
    },
  });

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/execute', executeRoutes);
  app.use('/api/tools', toolsRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '2.0.0-alpha.2' });
  });

  // Serve static files if static dir is provided
  if (STATIC_DIR && existsSync(STATIC_DIR)) {
    app.use(express.static(STATIC_DIR));
    // SPA fallback
    app.get('*', (_req, res) => {
      res.sendFile(join(STATIC_DIR, 'index.html'));
    });
  }

  // WebSocket
  setupWebSocket(io);

  // File watcher for live updates
  fileWatcher = new FileWatcher(WORKFLOW_DIR, io);

  return new Promise((resolve) => {
    httpServer!.listen(PORT, () => {
      console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║   Marktoflow GUI Server                                  ║
  ║                                                          ║
  ║   Server:    http://localhost:${String(PORT).padEnd(25)}║
  ║   Workflows: ${WORKFLOW_DIR.slice(0, 40).padEnd(40)}║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
      `);
      resolve(httpServer!);
    });
  });
}

/**
 * Stop the GUI server
 */
export function stopServer(): void {
  if (fileWatcher) {
    fileWatcher.stop();
    fileWatcher = null;
  }
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stopServer();
  process.exit(0);
});

// Auto-start if run directly
const isDirectRun = process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts');
if (isDirectRun) {
  startServer();
}
