# Publishing Guide

This guide explains how to publish new versions of marktoflow packages to npm using the **automated publishing system**.

---

## Quick Start

```bash
# Test the entire process without publishing
pnpm publish:dry-run

# Publish for real
pnpm publish
```

**That's it!** The automated system handles workspace:* replacement, building, testing, and publishing.

---

## Package Structure

marktoflow is a monorepo with four published packages:

1. **@marktoflow/core** - Core engine (parser, executor, state management)
2. **@marktoflow/integrations** - Service integrations (Slack, GitHub, Jira, etc.)
3. **@marktoflow/gui** - Visual workflow designer (web UI with AI assistance)
4. **@marktoflow/cli** - CLI package (main package users install)

All packages are published under the `@marktoflow` npm organization.

### Package Dependencies

```
@marktoflow/cli
├── @marktoflow/core
├── @marktoflow/integrations
└── @marktoflow/gui (optional)

@marktoflow/gui
└── @marktoflow/core

@marktoflow/integrations
└── @marktoflow/core
```

---

## Prerequisites

### 1. npm Authentication

You must be logged in to npm with publish permissions for the @marktoflow organization:

```bash
# Login to npm
npm login

# Verify authentication
npm whoami
# Should output: scottgl (or your username)
```

### 2. Organization Access

Ensure you have publish permissions:

- Visit https://www.npmjs.com/settings/marktoflow/members
- Your account should have "Owner" or "Admin" role

### 3. Clean Working Tree

```bash
# Check git status
git status
# Should be clean (no uncommitted changes)

# All tests passing
pnpm test
```

---

## Version Management

### Semantic Versioning

We follow semantic versioning (semver):

- **Major** (x.0.0): Breaking changes
- **Minor** (0.x.0): New features (backward compatible)
- **Patch** (0.0.x): Bug fixes

### Alpha Releases

During development, use alpha tags:

- Format: `2.0.0-alpha.1`, `2.0.0-alpha.2`, etc.
- Published with `--tag alpha` flag
- Users install with `@alpha` tag: `npm install -g @marktoflow/cli@alpha`

### Stable Releases

For production-ready versions:

- Format: `2.0.0`, `2.1.0`, `2.1.1`, etc.
- Published without `--tag` flag (defaults to `latest`)
- Users install normally: `npm install -g @marktoflow/cli`

---

## Automated Publishing Process

### Overview

The automated system provides:

✅ **Automatic workspace:* replacement** with backup
✅ **Pre-publish testing** (imports, CLI, GUI integration)
✅ **Correct dependency order** (core → integrations → cli/gui)
✅ **Automatic rollback** on errors
✅ **Post-publish verification**
✅ **Dry-run mode** for safe testing

### Commands

| Command | Description |
|---------|-------------|
| `pnpm publish` | Full automated publish process |
| `pnpm publish:dry-run` | Test without actually publishing |
| `pnpm publish:test` | Run pre-publish tests only |
| `pnpm publish:prepare` | Replace workspace:* (manual use) |
| `pnpm publish:restore` | Restore workspace:* (manual use) |

### Step-by-Step Process

#### Step 1: Update Version Numbers

Update `version` in the package.json files that changed:

```bash
# Example: Updating to 2.0.0-alpha.10
# Edit the relevant files:
vi packages/core/package.json        # If core changed
vi packages/integrations/package.json  # If integrations changed
vi packages/cli/package.json         # If CLI changed
vi packages/gui/package.json         # If GUI changed
```

**Important**:
- Keep dependencies as `workspace:*` in the repo
- The automation will replace them before publishing
- Only bump versions for packages that actually changed

#### Step 2: Commit Version Changes

```bash
git add packages/*/package.json
git commit -m "chore: bump version to 2.0.0-alpha.10"
git push origin main
```

#### Step 3: Test the Process

**Always test first with dry-run:**

```bash
pnpm publish:dry-run
```

This runs the entire process except actual `npm publish`:
- ✅ Replaces workspace:*
- ✅ Builds all packages
- ✅ Tests packages
- ✅ Shows what would be published
- ✅ Restores workspace:*

#### Step 4: Publish for Real

```bash
pnpm publish
```

**Interactive process:**

1. Shows publish plan with all versions
2. Asks for confirmation
3. Checks npm authentication
4. Prepares packages (replaces workspace:*)
5. Builds all packages
6. Tests packages comprehensively
7. Publishes in dependency order
8. Restores workspace:*
9. Verifies publication succeeded

**Example output:**

```
🚀 marktoflow Package Publisher

📋 Publish Plan

  1. @marktoflow/core@2.0.0-alpha.12
  2. @marktoflow/integrations@2.0.0-alpha.12
  3. @marktoflow/cli@2.0.0-alpha.12
  4. @marktoflow/gui@2.0.0-alpha.12

📝 Process:
  1. Replace workspace:* with actual versions
  2. Build all packages
  3. Run tests
  4. Publish to npm (with alpha tag)
  5. Restore workspace:*
  6. Verify publication

❓ Proceed with publish? (y/N): y

[... automated process runs ...]

✅ Publish complete!

📦 Installation command:
  npm install @marktoflow/cli @marktoflow/gui
```

#### Step 5: Create Git Tag

After successful publish, create a git tag:

```bash
# Create tag
git tag v2.0.0-alpha.10

# Push tag
git push origin v2.0.0-alpha.10
```

#### Step 6: Create GitHub Release

Create a release on GitHub:

1. Go to https://github.com/marktoflow/marktoflow/releases/new
2. Select the tag you just created
3. Add release notes describing changes
4. Publish release

---

## What Gets Tested

The automated testing ensures:

### Package Installation Tests
✅ All packages install without errors
✅ Dependencies resolve correctly
✅ No `workspace:*` in published packages

### Import Tests
```javascript
// Core
import { parseFile, WorkflowEngine } from '@marktoflow/core';

// Integrations
import { SlackInitializer, GitHubInitializer } from '@marktoflow/integrations';

// GUI
import { startServer, stopServer } from '@marktoflow/gui';
```

### CLI Tests
✅ `marktoflow --help` works
✅ All commands are available
✅ Binary is executable

### GUI Integration Test
```javascript
await startServer({ port: 3999, workflowDir: './workflows' });
const response = await fetch('http://localhost:3999/api/health');
// Verifies: Server starts, responds, serves static files
stopServer();
```

These tests catch issues that caused multiple broken alpha releases in the past.

---

## Error Handling

### Automatic Rollback

If any step fails, the system:
1. Stops immediately
2. Shows clear error message
3. **Automatically restores workspace:***
4. Exits with error code

You never have to manually fix broken package.json files.

### Common Errors

#### Authentication Errors

```
❌ Not authenticated to npm
  Run: npm login
```

**Solution**: Run `npm login` and try again.

#### Test Failures

```
❌ Tests failed!
⚠️  DO NOT publish until tests pass
```

**Solution**: Fix the failing tests, commit the fix, and try again.

#### Version Already Published

```
npm error 403 You cannot publish over the previously published versions: X.X.X-alpha.X
```

**Solution**: Increment the version number and try again.

### Emergency Restore

If something goes wrong and workspace:* isn't restored:

```bash
pnpm publish:restore
```

---

## Publishing Stable Releases

When ready to publish a stable release (no alpha tag):

### Step 1: Update Versions (Remove Alpha)

Update package.json files to remove `-alpha.x`:

```json
{
  "version": "2.0.0"
}
```

### Step 2: Update Publishing Script

Edit `scripts/publish.js` to remove `--tag alpha`:

```javascript
// Change this line:
const command = `npm publish --access public --tag alpha`;

// To:
const command = `npm publish --access public`;
```

### Step 3: Publish

```bash
pnpm publish
```

This publishes to the `latest` tag:

```bash
npm install -g @marktoflow/cli  # Gets latest stable version
```

### Step 4: Restore Alpha Publishing

After publishing stable, restore the alpha tag in `scripts/publish.js`.

---

## Manual Publishing (Not Recommended)

If you need to publish manually (not recommended):

### Prepare Packages

```bash
# Replace workspace:*
pnpm publish:prepare

# Build all
pnpm build
```

### Publish in Order

```bash
# Core
cd packages/core && npm publish --access public --tag alpha && cd ../..

# Integrations
cd packages/integrations && npm publish --access public --tag alpha && cd ../..

# GUI
cd packages/gui && npm publish --access public --tag alpha && cd ../..

# CLI
cd packages/cli && npm publish --access public --tag alpha && cd ../..
```

### Restore

```bash
# IMPORTANT: Restore workspace:*
pnpm publish:restore
```

**Why not recommended:**
- Easy to forget to restore workspace:*
- No pre-publish testing
- No automatic rollback on errors
- Manual process is error-prone

---

## Troubleshooting

### Build Failures

If build fails:

```bash
# Clean everything
pnpm clean

# Reinstall
pnpm install

# Try again
pnpm build
```

### Port Already in Use

If GUI test fails with "port in use":

```bash
# Find process on port 3999
lsof -i :3999

# Kill it
kill -9 <PID>

# Try again
pnpm publish:test
```

### Package Not Found After Publishing

Wait a few minutes for npm to propagate:

```bash
# Check if published
npm view @marktoflow/cli@alpha version

# May need to wait 1-2 minutes for npm CDN
```

---

## Detailed Documentation

For complete details on the publishing system:

- **[scripts/PUBLISHING.md](../scripts/PUBLISHING.md)** - Technical implementation details
- **[scripts/prepare-publish.js](../scripts/prepare-publish.js)** - Workspace replacement script
- **[scripts/test-packages.js](../scripts/test-packages.js)** - Testing script
- **[scripts/publish.js](../scripts/publish.js)** - Main orchestrator

---

## Quick Reference

### Alpha Release Checklist

- [ ] Update version in changed package.json files
- [ ] Commit: `git commit -m "chore: bump version to vX.X.X-alpha.X"`
- [ ] Push: `git push origin main`
- [ ] Test: `pnpm publish:dry-run`
- [ ] Publish: `pnpm publish`
- [ ] Tag: `git tag vX.X.X-alpha.X && git push origin vX.X.X-alpha.X`
- [ ] Create GitHub release

### Stable Release Checklist

- [ ] Update version in all package.json files (remove `-alpha.X`)
- [ ] Update `scripts/publish.js` (remove `--tag alpha`)
- [ ] Run full test suite: `pnpm test`
- [ ] Test: `pnpm publish:dry-run`
- [ ] Publish: `pnpm publish`
- [ ] Restore alpha tag in `scripts/publish.js`
- [ ] Tag: `git tag vX.X.X && git push origin vX.X.X`
- [ ] Create GitHub release with changelog
- [ ] Update all documentation (remove `@alpha` references)

---

## Current Status

**Latest Published Versions**:

- @marktoflow/core@2.0.0-alpha.12
- @marktoflow/integrations@2.0.0-alpha.12
- @marktoflow/cli@2.0.0-alpha.12
- @marktoflow/gui@2.0.0-alpha.12

**Installation**:

```bash
# Install CLI (includes optional GUI)
npm install -g @marktoflow/cli

# Install GUI separately (for programmatic use)
npm install @marktoflow/gui
```

**Next Steps**:

- Continue alpha releases during development
- Publish 2.0.0 stable when ready for production
- Consider GitHub Actions for automated publishing on tag push

---

## Benefits of Automated Publishing

| Aspect | Manual Process | Automated Process |
|--------|---------------|-------------------|
| Steps | 10+ manual steps | 1 command |
| Time | 15-20 minutes | 5 minutes |
| Errors | Frequent | Rare (caught by tests) |
| Rollback | Manual | Automatic |
| Testing | After publish | Before publish |
| Confidence | Low | High |
| Reproducible | ❌ No | ✅ Yes |

The automated system eliminates common errors:
- ✅ No more forgotten workspace:* restoration
- ✅ No more untested publishes
- ✅ No more broken package releases
- ✅ No more manual version replacement mistakes
