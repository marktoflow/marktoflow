#!/usr/bin/env node

/**
 * Prepare packages for publishing
 * - Replaces workspace:* with actual versions
 * - Creates backup of original files
 * - Can restore from backup
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const backupDir = join(rootDir, '.publish-backup');

const PACKAGES = [
  'packages/core',
  'packages/integrations',
  'packages/cli',
  'packages/gui',
];

function getPackageJson(packagePath) {
  const path = join(rootDir, packagePath, 'package.json');
  return {
    path,
    content: JSON.parse(readFileSync(path, 'utf-8')),
  };
}

function backupFile(filePath) {
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = join(backupDir, filePath.replace(rootDir, ''));
  const backupDirPath = dirname(backupPath);
  if (!existsSync(backupDirPath)) {
    mkdirSync(backupDirPath, { recursive: true });
  }
  const content = readFileSync(filePath, 'utf-8');
  writeFileSync(backupPath, content, 'utf-8');
  console.log(`  ✓ Backed up: ${filePath.replace(rootDir + '/', '')}`);
}

function restoreBackups() {
  console.log('\n🔄 Restoring from backup...');

  if (!existsSync(backupDir)) {
    console.log('  ℹ️  No backup found');
    return;
  }

  for (const pkg of PACKAGES) {
    const originalPath = join(rootDir, pkg, 'package.json');
    const backupPath = join(backupDir, pkg, 'package.json');

    if (existsSync(backupPath)) {
      const content = readFileSync(backupPath, 'utf-8');
      writeFileSync(originalPath, content, 'utf-8');
      console.log(`  ✓ Restored: ${pkg}/package.json`);
    }
  }

  console.log('✅ Backup restored');
}

function replaceWorkspaceDeps() {
  console.log('\n📦 Preparing packages for publishing...');

  // Get all package versions
  const versions = {};
  for (const pkg of PACKAGES) {
    const { content } = getPackageJson(pkg);
    const name = content.name;
    versions[name] = content.version;
  }

  console.log('\n📋 Package versions:');
  for (const [name, version] of Object.entries(versions)) {
    console.log(`  ${name}: ${version}`);
  }

  console.log('\n💾 Creating backups...');

  // Backup and replace workspace:* with actual versions
  for (const pkg of PACKAGES) {
    const { path, content } = getPackageJson(pkg);

    // Backup original
    backupFile(path);

    // Replace workspace:* in dependencies
    let changed = false;

    if (content.dependencies) {
      for (const [dep, version] of Object.entries(content.dependencies)) {
        if (version === 'workspace:*' && versions[dep]) {
          content.dependencies[dep] = versions[dep];
          changed = true;
          console.log(`  ✓ ${pkg}: ${dep} → ${versions[dep]}`);
        }
      }
    }

    if (content.devDependencies) {
      for (const [dep, version] of Object.entries(content.devDependencies)) {
        if (version === 'workspace:*' && versions[dep]) {
          content.devDependencies[dep] = versions[dep];
          changed = true;
          console.log(`  ✓ ${pkg}: ${dep} → ${versions[dep]}`);
        }
      }
    }

    if (changed) {
      writeFileSync(path, JSON.stringify(content, null, 2) + '\n', 'utf-8');
    }
  }

  console.log('\n✅ Packages prepared for publishing');
  console.log('\n💡 To restore: node scripts/prepare-publish.js restore');
}

// CLI handling
const command = process.argv[2];

if (command === 'restore') {
  restoreBackups();
} else if (command === 'prepare' || !command) {
  replaceWorkspaceDeps();
} else {
  console.log('Usage: node scripts/prepare-publish.js [prepare|restore]');
  process.exit(1);
}
