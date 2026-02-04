#!/usr/bin/env node

/**
 * Main publish script
 * - Prepares packages (replaces workspace:*)
 * - Builds all packages
 * - Tests packages
 * - Publishes to npm
 * - Restores workspace:*
 * - Verifies publication
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { stdin as input, stdout as output } from 'process';
import * as readline from 'readline/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const PACKAGES = [
  { name: 'core', path: 'packages/core', order: 1 },
  { name: 'integrations', path: 'packages/integrations', order: 2 },
  { name: 'cli', path: 'packages/cli', order: 3 },
  { name: 'gui', path: 'packages/gui', order: 4 },
  { name: 'marktoflow', path: 'packages/marktoflow', order: 5 },
];

function exec(command, cwd = rootDir, options = {}) {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (error) {
    if (!options.ignoreErrors) {
      console.error(`❌ Command failed: ${command}`);
      throw error;
    }
    return null;
  }
}

function getPackageVersion(packagePath) {
  const pkgJsonPath = join(rootDir, packagePath, 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  return {
    name: pkgJson.name,
    version: pkgJson.version,
  };
}

async function confirmAction(message) {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`${message} (y/N): `);
  rl.close();
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

async function showPublishPlan() {
  console.log('\n📋 Publish Plan\n');

  for (const pkg of PACKAGES) {
    const { name, version } = getPackageVersion(pkg.path);
    console.log(`  ${pkg.order}. ${name}@${version}`);
  }

  console.log('\n📝 Process:');
  console.log('  1. Replace workspace:* with actual versions');
  console.log('  2. Build all packages');
  console.log('  3. Run tests');
  console.log('  4. Publish to npm (with alpha tag)');
  console.log('  5. Restore workspace:*');
  console.log('  6. Verify publication');
}

function checkNpmAuth() {
  console.log('\n🔑 Checking npm authentication...');

  try {
    exec('npm whoami', rootDir, { silent: true });
    console.log('  ✓ Authenticated to npm');
    return true;
  } catch (error) {
    console.error('  ❌ Not authenticated to npm');
    console.error('\n  Run: npm login');
    return false;
  }
}

function preparePackages() {
  console.log('\n📦 Preparing packages...');
  exec('node scripts/prepare-publish.js prepare');
}

function restorePackages() {
  console.log('\n🔄 Restoring workspace:* dependencies...');
  exec('node scripts/prepare-publish.js restore');
}

function buildPackages() {
  console.log('\n🔨 Building packages...');
  exec('pnpm build');
}

function testPackages() {
  console.log('\n🧪 Testing packages...');
  exec('node scripts/test-packages.js');
}

function publishPackage(pkg, dryRun = false) {
  const { name, version } = getPackageVersion(pkg.path);
  const pkgPath = join(rootDir, pkg.path);

  console.log(`\n📤 Publishing ${name}@${version}...`);

  const dryRunFlag = dryRun ? '--dry-run' : '';
  const command = `npm publish --access public --tag alpha ${dryRunFlag}`;

  try {
    exec(command, pkgPath);
    console.log(`  ✓ Published ${name}@${version}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to publish ${name}@${version}`);
    return false;
  }
}

function verifyPublication() {
  console.log('\n✅ Verifying publication...');

  for (const pkg of PACKAGES) {
    const { name, version } = getPackageVersion(pkg.path);

    try {
      const output = exec(`npm view ${name}@${version} version`, rootDir, {
        silent: true,
      });

      if (output.trim() === version) {
        console.log(`  ✓ ${name}@${version} is published`);
      } else {
        console.error(`  ❌ ${name}@${version} not found on npm`);
      }
    } catch (error) {
      console.error(`  ❌ ${name}@${version} not found on npm`);
    }
  }
}

async function main() {
  console.log('🚀 marktoflow Package Publisher\n');

  // Parse arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipTests = args.includes('--skip-tests');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No actual publishing\n');
  }

  try {
    // Show plan
    await showPublishPlan();

    // Confirm
    if (!dryRun) {
      const confirmed = await confirmAction('\n❓ Proceed with publish?');
      if (!confirmed) {
        console.log('\n❌ Publish cancelled');
        process.exit(0);
      }
    }

    // Check npm auth
    if (!dryRun && !checkNpmAuth()) {
      process.exit(1);
    }

    // Prepare (replace workspace:*)
    preparePackages();

    // Build
    buildPackages();

    // Test
    if (!skipTests) {
      testPackages();
    } else {
      console.log('\n⚠️  Skipping tests (--skip-tests)');
    }

    // Publish in order
    console.log('\n📤 Publishing packages...');
    for (const pkg of PACKAGES.sort((a, b) => a.order - b.order)) {
      const success = publishPackage(pkg, dryRun);
      if (!success && !dryRun) {
        console.error('\n❌ Publish failed, stopping');
        restorePackages();
        process.exit(1);
      }
    }

    // Restore workspace:*
    restorePackages();

    // Verify
    if (!dryRun) {
      verifyPublication();
    }

    console.log('\n✅ Publish complete!');

    if (!dryRun) {
      console.log('\n📦 Installation command:');
      console.log('  npm install -g @marktoflow/marktoflow@alpha');
      console.log('\n  Or individual packages:');
      console.log('  npm install @marktoflow/cli@alpha @marktoflow/gui@alpha');
    }
  } catch (error) {
    console.error('\n❌ Publish failed:', error.message);

    // Always restore on error
    try {
      restorePackages();
    } catch (restoreError) {
      console.error('⚠️  Failed to restore workspace:*');
      console.error('   Run manually: node scripts/prepare-publish.js restore');
    }

    process.exit(1);
  }
}

// Run
main();
