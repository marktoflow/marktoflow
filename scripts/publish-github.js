#!/usr/bin/env node

/**
 * Publish to GitHub Package Registry
 * - Configures npm authentication for GitHub
 * - Updates publishConfig to GitHub registry
 * - Prepares packages (replaces workspace:*)
 * - Builds all packages
 * - Tests packages
 * - Publishes to GitHub Package Registry
 * - Restores original publishConfig and workspace:*
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
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

const GITHUB_REGISTRY = 'https://npm.pkg.github.com/';
const NPM_REGISTRY = 'https://registry.npmjs.org/';

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
  console.log('\n📋 GitHub Package Registry Publish Plan\n');

  for (const pkg of PACKAGES) {
    const { name, version } = getPackageVersion(pkg.path);
    console.log(`  ${pkg.order}. ${name}@${version}`);
  }

  console.log('\n📝 Process:');
  console.log('  1. Configure GitHub authentication');
  console.log('  2. Update publishConfig to GitHub registry');
  console.log('  3. Replace workspace:* with actual versions');
  console.log('  4. Build all packages');
  console.log('  5. Run tests');
  console.log('  6. Publish to GitHub Package Registry');
  console.log('  7. Restore original publishConfig');
  console.log('  8. Restore workspace:*');
  console.log('  9. Verify publication');
  console.log('\n📦 Registry: ' + GITHUB_REGISTRY);
}

function configureGitHubAuth(token) {
  console.log('\n🔑 Configuring GitHub authentication...');

  // Configure npm to use GitHub token for GitHub Package Registry
  const npmrcPath = join(process.env.HOME || process.env.USERPROFILE, '.npmrc');
  let npmrcContent = '';

  try {
    npmrcContent = readFileSync(npmrcPath, 'utf-8');
  } catch (error) {
    // File doesn't exist, that's fine
  }

  // Add GitHub registry auth if not present
  const authLine = `//npm.pkg.github.com/:_authToken=${token}`;
  if (!npmrcContent.includes('//npm.pkg.github.com/:_authToken=')) {
    npmrcContent += `\n${authLine}\n`;
    writeFileSync(npmrcPath, npmrcContent);
    console.log('  ✓ Added GitHub authentication to ~/.npmrc');
  } else {
    console.log('  ✓ GitHub authentication already configured');
  }
}

function updatePublishConfig(registry) {
  console.log(`\n📝 Updating publishConfig to ${registry}...`);

  for (const pkg of PACKAGES) {
    const pkgJsonPath = join(rootDir, pkg.path, 'package.json');
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

    if (!pkgJson.publishConfig) {
      pkgJson.publishConfig = {};
    }

    pkgJson.publishConfig.registry = registry;
    writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');

    console.log(`  ✓ Updated ${pkg.name}`);
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

  console.log(`\n📤 Publishing ${name}@${version} to GitHub...`);

  const dryRunFlag = dryRun ? '--dry-run' : '';
  const command = `npm publish --access public ${dryRunFlag}`;

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
  console.log('  Note: GitHub Package Registry verification may take a few moments...');

  for (const pkg of PACKAGES) {
    const { name, version } = getPackageVersion(pkg.path);
    console.log(`  ℹ️  ${name}@${version} should be available at:`);
    console.log(`     https://github.com/marktoflow/marktoflow/packages`);
  }
}

async function main() {
  console.log('🚀 marktoflow GitHub Package Registry Publisher\n');

  // Parse arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipTests = args.includes('--skip-tests');
  const tokenIndex = args.indexOf('--token');
  const token = tokenIndex >= 0 ? args[tokenIndex + 1] : process.env.GITHUB_TOKEN;

  if (!token && !dryRun) {
    console.error('❌ GitHub token required');
    console.error('\nUsage:');
    console.error('  node scripts/publish-github.js --token <GITHUB_TOKEN>');
    console.error('  Or set GITHUB_TOKEN environment variable');
    process.exit(1);
  }

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

    // Configure GitHub auth
    if (!dryRun) {
      configureGitHubAuth(token);
    }

    // Update publishConfig to GitHub registry
    updatePublishConfig(GITHUB_REGISTRY);

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
        updatePublishConfig(NPM_REGISTRY);
        restorePackages();
        process.exit(1);
      }
    }

    // Restore original publishConfig
    updatePublishConfig(NPM_REGISTRY);

    // Restore workspace:*
    restorePackages();

    // Verify
    if (!dryRun) {
      verifyPublication();
    }

    console.log('\n✅ Publish to GitHub Package Registry complete!');

    if (!dryRun) {
      console.log('\n📦 Installation command:');
      console.log('  npm install @marktoflow/marktoflow@2.0.1 --registry=https://npm.pkg.github.com/');
      console.log('\n  Or configure .npmrc:');
      console.log('  echo "@marktoflow:registry=https://npm.pkg.github.com/" >> .npmrc');
    }
  } catch (error) {
    console.error('\n❌ Publish failed:', error.message);

    // Always restore on error
    try {
      updatePublishConfig(NPM_REGISTRY);
      restorePackages();
    } catch (restoreError) {
      console.error('⚠️  Failed to restore');
      console.error('   Run manually: node scripts/prepare-publish.js restore');
    }

    process.exit(1);
  }
}

// Run
main();
