#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { workflowRoutes } from './routes/workflows.js';
import { aiRoutes } from './routes/ai.js';
import { executeRoutes } from './routes/execute.js';
import { setupWebSocket } from './websocket/index.js';
import { FileWatcher } from './services/FileWatcher.js';

const PORT = process.env.PORT || 3001;
const WORKFLOW_DIR = process.env.WORKFLOW_DIR || process.cwd();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0-alpha.1' });
});

// WebSocket
setupWebSocket(io);

// File watcher for live updates
const fileWatcher = new FileWatcher(WORKFLOW_DIR, io);

// Start server
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║   Marktoflow GUI Server                                  ║
  ║                                                          ║
  ║   Server:    http://localhost:${PORT}                      ║
  ║   Workflows: ${WORKFLOW_DIR.slice(0, 40).padEnd(40)}║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  fileWatcher.stop();
  server.close();
  process.exit(0);
});
