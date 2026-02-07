#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { createServer, type Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { StateStore } from '@marktoflow/core';
import { workflowRoutes } from './routes/workflows.js';
import { aiRoutes } from './routes/ai.js';
import { executeRoutes, setExecutionManager as setExecuteExecutionManager } from './routes/execute.js';
import { toolsRoutes } from './routes/tools.js';
import { executionRoutes } from './routes/executions.js';
import { formRoutes, setExecutionManager as setFormExecutionManager } from './routes/form.js';
import { versionRoutes } from './routes/versions.js';
import { collaborationRoutes } from './routes/collaboration.js';
import { adminRoutes } from './routes/admin.js';
import { templateRoutes } from './routes/templates.js';
import { settingsRoutes } from './routes/settings.js';
import { setupWebSocket } from './websocket/index.js';
import { FileWatcher } from './services/FileWatcher.js';
import { ExecutionManager } from './services/ExecutionManager.js';

// Get the directory where this file is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ServerOptions {
  port?: number;
  workflowDir?: string;
  staticDir?: string;
}

let httpServer: Server | null = null;
let fileWatcher: FileWatcher | null = null;
let stateStore: StateStore | null = null;

/**
 * Get the StateStore instance
 */
export function getStateStore(): StateStore {
  if (!stateStore) {
    throw new Error('StateStore not initialized. Call startServer() first.');
  }
  return stateStore;
}

/**
 * Start the GUI server programmatically
 */
export async function startServer(options: ServerOptions = {}): Promise<Server> {
  const PORT = options.port || parseInt(process.env.PORT || '3001', 10);
  const WORKFLOW_DIR = options.workflowDir || process.env.WORKFLOW_DIR || process.cwd();

  // Auto-discover static directory if not provided
  // When running from dist/server/index.js, the client is at dist/client
  const defaultStaticDir = join(__dirname, '..', 'client');
  const STATIC_DIR = options.staticDir || process.env.STATIC_DIR ||
    (existsSync(defaultStaticDir) ? defaultStaticDir : undefined);

  // Initialize StateStore
  const stateDir = join(WORKFLOW_DIR, '.marktoflow', 'state');
  mkdirSync(stateDir, { recursive: true });
  stateStore = new StateStore(join(stateDir, 'workflow-state.db'));

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
  app.use('/api/executions', executionRoutes);
  app.use('/api/tools', toolsRoutes);
  app.use('/api/form', formRoutes);
  app.use('/api/versions', versionRoutes);
  app.use('/api/collaboration', collaborationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api/settings', settingsRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '2.0.0-alpha.5' });
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
  const wsEmitter = setupWebSocket(io);

  // Create ExecutionManager with StateStore and WebSocket
  const executionManager = new ExecutionManager(stateStore, wsEmitter, WORKFLOW_DIR);

  // Set execution manager for routes
  setExecuteExecutionManager(executionManager, WORKFLOW_DIR);
  setFormExecutionManager(executionManager);

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
  if (stateStore) {
    stateStore.close();
    stateStore = null;
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
