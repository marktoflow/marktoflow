#!/usr/bin/env node

/**
 * Test packages before publishing
 * - Creates npm pack tarballs
 * - Installs them in a test directory
 * - Runs basic smoke tests
 * - Tests CLI + GUI integration
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const testDir = join(rootDir, '.publish-test');

function exec(command, cwd = rootDir) {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error(error.stdout || error.message);
    throw error;
  }
}

function cleanTestDir() {
  if (existsSync(testDir)) {
    console.log('🧹 Cleaning test directory...');
    rmSync(testDir, { recursive: true, force: true });
  }
  mkdirSync(testDir, { recursive: true });
}

function createTarballs() {
  console.log('\n📦 Creating package tarballs...');

  const packages = [
    { name: 'core', path: 'packages/core' },
    { name: 'integrations', path: 'packages/integrations' },
    { name: 'cli', path: 'packages/cli' },
    { name: 'gui', path: 'packages/gui' },
  ];

  const tarballs = [];

  for (const pkg of packages) {
    const pkgPath = join(rootDir, pkg.path);
    console.log(`\n  📦 Packing ${pkg.name}...`);

    const output = exec('npm pack 2>&1', pkgPath);
    const tarballName = output.trim().split('\n').pop();
    const tarballPath = join(pkgPath, tarballName);

    if (!existsSync(tarballPath)) {
      throw new Error(`Tarball not found: ${tarballPath}`);
    }

    tarballs.push({ name: pkg.name, path: tarballPath });
    console.log(`  ✓ Created: ${tarballName}`);
  }

  return tarballs;
}

function testInstallation(tarballs) {
  console.log('\n🧪 Testing package installation...');

  // Create package.json
  const packageJson = {
    name: 'marktoflow-publish-test',
    version: '1.0.0',
    type: 'module',
  };
  writeFileSync(
    join(testDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Install packages
  const tarballPaths = tarballs.map((t) => t.path).join(' ');
  console.log('\n  📥 Installing packages...');

  try {
    exec(`npm install ${tarballPaths} --silent`, testDir);
    console.log('  ✓ Packages installed successfully');
  } catch (error) {
    console.error('  ❌ Installation failed');
    throw error;
  }
}

function testImports() {
  console.log('\n🧪 Testing package imports...');

  const tests = [
    {
      name: 'core',
      code: `
        import { parseFile, WorkflowEngine } from '@marktoflow/core';
        console.log('✓ parseFile:', typeof parseFile);
        console.log('✓ WorkflowEngine:', typeof WorkflowEngine);
      `,
    },
    {
      name: 'integrations',
      code: `
        import { SlackInitializer, GitHubInitializer } from '@marktoflow/integrations';
        console.log('✓ SlackInitializer:', typeof SlackInitializer);
        console.log('✓ GitHubInitializer:', typeof GitHubInitializer);
      `,
    },
    {
      name: 'gui',
      code: `
        import { startServer, stopServer } from '@marktoflow/gui';
        console.log('✓ startServer:', typeof startServer);
        console.log('✓ stopServer:', typeof stopServer);
      `,
    },
  ];

  for (const test of tests) {
    console.log(`\n  🔍 Testing @marktoflow/${test.name}...`);
    const testFile = join(testDir, `test-${test.name}.js`);
    writeFileSync(testFile, test.code);

    try {
      const output = exec(`node ${testFile}`, testDir);
      console.log(output.trim().split('\n').map((l) => `    ${l}`).join('\n'));
    } catch (error) {
      console.error(`  ❌ Import test failed for ${test.name}`);
      throw error;
    }
  }
}

function testCLI() {
  console.log('\n🧪 Testing CLI commands...');

  try {
    const output = exec('npx marktoflow --help', testDir);
    if (!output.includes('Agent automation framework')) {
      throw new Error('CLI help output unexpected');
    }
    console.log('  ✓ CLI --help works');
  } catch (error) {
    console.error('  ❌ CLI test failed');
    throw error;
  }
}

function testGUI() {
  console.log('\n🧪 Testing GUI server...');

  // Create workflows directory
  const workflowsDir = join(testDir, 'workflows');
  mkdirSync(workflowsDir, { recursive: true });

  const testScript = `
import { startServer, stopServer } from '@marktoflow/gui';

console.log('Starting GUI server...');
try {
  await startServer({ port: 3999, workflowDir: './workflows' });
  console.log('✓ GUI server started');

  // Quick check - does the server respond?
  const response = await fetch('http://localhost:3999/api/health');
  const data = await response.json();
  console.log('✓ Health check:', data.status);

  stopServer();
  console.log('✓ GUI server stopped');
  process.exit(0);
} catch (error) {
  console.error('❌ GUI test failed:', error.message);
  process.exit(1);
}
`;

  const testFile = join(testDir, 'test-gui-server.js');
  writeFileSync(testFile, testScript);

  try {
    // Use execSync with timeout option (cross-platform, works on both Linux and macOS)
    execSync(`node ${testFile}`, {
      cwd: testDir,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10000, // 10 seconds in milliseconds
    });
    console.log('  ✓ GUI server test passed');
  } catch (error) {
    console.error('  ❌ GUI server test failed');
    throw error;
  }
}

async function runTests() {
  console.log('🧪 Testing packages before publish\n');

  try {
    cleanTestDir();
    const tarballs = createTarballs();
    testInstallation(tarballs);
    testImports();
    testCLI();
    testGUI();

    console.log('\n✅ All tests passed!');
    console.log('\n✨ Packages are ready to publish');

    return true;
  } catch (error) {
    console.error('\n❌ Tests failed!');
    console.error('\n⚠️  DO NOT publish until tests pass');
    return false;
  }
}

// Run tests
runTests().then((success) => {
  process.exit(success ? 0 : 1);
});
