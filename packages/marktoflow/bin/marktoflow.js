#!/usr/bin/env node

// Wrapper to execute @marktoflow/cli from the metapackage
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const require = createRequire(import.meta.url);

// Find the CLI package
try {
  const cliPath = require.resolve('@marktoflow/cli');
  const cliDir = dirname(cliPath);
  const cliIndexPath = join(cliDir, 'index.js');

  // Import and run the CLI
  await import(cliIndexPath);
} catch (error) {
  console.error('Error loading @marktoflow/cli:', error.message);
  process.exit(1);
}
