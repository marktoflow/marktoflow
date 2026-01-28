#!/usr/bin/env node

/**
 * Post-build script to flatten the dist structure
 *
 * Before:
 *   dist/
 *     client/           (from vite build)
 *     server/
 *       server/         (from tsc)
 *       shared/         (from tsc)
 *
 * After:
 *   dist/
 *     client/           (unchanged)
 *     server/           (flattened - was server/server/)
 *     shared/           (moved from server/shared/)
 */

import { existsSync, cpSync, rmSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');
const distDir = join(packageRoot, 'dist');

console.log('🔧 Flattening dist structure...');

// Check if dist exists
if (!existsSync(distDir)) {
  console.error('❌ dist directory not found');
  process.exit(1);
}

// 1. Move dist/server/server/* to dist/server-temp/
const serverServerDir = join(distDir, 'server', 'server');
const serverTempDir = join(distDir, 'server-temp');

if (existsSync(serverServerDir)) {
  console.log('  📦 Moving server/server/* to temp location...');
  cpSync(serverServerDir, serverTempDir, { recursive: true });
}

// 2. Move dist/server/shared/* to dist/shared/
const serverSharedDir = join(distDir, 'server', 'shared');
const sharedDir = join(distDir, 'shared');

if (existsSync(serverSharedDir)) {
  console.log('  📦 Moving server/shared/* to dist/shared/...');
  cpSync(serverSharedDir, sharedDir, { recursive: true });
}

// 3. Remove old dist/server directory
console.log('  🗑️  Removing old server directory...');
rmSync(join(distDir, 'server'), { recursive: true, force: true });

// 4. Move temp back to dist/server
console.log('  📦 Moving temp back to dist/server/...');
cpSync(serverTempDir, join(distDir, 'server'), { recursive: true });
rmSync(serverTempDir, { recursive: true, force: true });

console.log('✅ Dist structure flattened successfully!');
console.log('\nFinal structure:');
console.log('  dist/');
console.log('    client/     - React app');
console.log('    server/     - Server code (flat)');
console.log('    shared/     - Shared code');
