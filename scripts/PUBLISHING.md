# Publishing Guide

Automated, reproducible publishing process for marktoflow packages.

## Quick Start

```bash
# Test everything without publishing
pnpm publish:dry-run

# Publish for real
pnpm publish
```

## Overview

The publishing system automates:
1. ✅ Replacing `workspace:*` with actual versions
2. ✅ Building all packages
3. ✅ Testing packages before publishing
4. ✅ Publishing in correct dependency order
5. ✅ Restoring `workspace:*` after publishing
6. ✅ Verifying publication succeeded

## Prerequisites

1. **Authenticated to npm**:
   ```bash
   npm login
   ```

2. **Clean working tree** (recommended):
   ```bash
   git status  # Should be clean
   ```

3. **All tests passing**:
   ```bash
   pnpm test
   ```

## Commands

### Main Commands

| Command | Description |
|---------|-------------|
| `pnpm publish` | Full publish process with tests |
| `pnpm publish:dry-run` | Test publish without actually publishing |
| `pnpm publish:test` | Just run package tests |
| `pnpm publish:prepare` | Just replace workspace:* |
| `pnpm publish:restore` | Restore workspace:* (if needed) |

### Publish Process Steps

When you run `pnpm publish`, it:

1. **Shows Publish Plan**
   ```
   📋 Publish Plan
     1. @marktoflow/core@2.0.0-alpha.9
     2. @marktoflow/integrations@2.0.0-alpha.9
     3. @marktoflow/cli@2.0.0-alpha.10
     4. @marktoflow/gui@2.0.0-alpha.5
   ```

2. **Asks for Confirmation**
   - Review versions
   - Type `y` to proceed

3. **Checks npm Authentication**
   - Verifies you're logged in to npm

4. **Prepares Packages**
   - Backs up original package.json files
   - Replaces `workspace:*` with actual versions
   - Example: `@marktoflow/core: workspace:* → 2.0.0-alpha.9`

5. **Builds All Packages**
   - Runs `pnpm build` (uses Turbo)
   - Ensures all dist folders are up-to-date

6. **Tests Packages**
   - Creates npm pack tarballs
   - Installs in isolated test directory
   - Tests imports from all packages
   - Tests CLI commands work
   - Tests GUI server starts and serves UI
   - **Stops if any test fails!**

7. **Publishes to npm**
   - Publishes in dependency order:
     1. core (no deps)
     2. integrations (depends on core)
     3. cli (depends on core + integrations)
     4. gui (depends on core)
   - Uses `--tag alpha` for pre-release versions
   - Uses `--access public` for scoped packages

8. **Restores workspace:***
   - Automatically restores original package.json files
   - Your local development setup stays intact

9. **Verifies Publication**
   - Checks each package is available on npm
   - Reports any issues

## What Gets Tested

The test suite (`scripts/test-packages.js`) verifies:

### Package Installation
✅ All packages install without errors
✅ Dependencies resolve correctly

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

### GUI Integration Test
✅ GUI server starts
✅ Health endpoint responds
✅ Server stops cleanly

## Dry Run Mode

Test the entire process without publishing:

```bash
pnpm publish:dry-run
```

This runs everything except the actual `npm publish` commands:
- ✅ Prepares packages
- ✅ Builds packages
- ✅ Tests packages
- 🚫 Skips npm publish
- ✅ Restores workspace:*

Use this to verify everything works before publishing for real.

## Error Handling

### If Tests Fail

The publish will **stop automatically** if tests fail:

```
❌ Tests failed!
⚠️  DO NOT publish until tests pass
🔄 Restoring workspace:* dependencies...
✅ Backup restored
```

Your package.json files are automatically restored.

### If Publish Fails Mid-Way

If publishing fails after some packages succeeded:

1. **Automatic restore**: workspace:* is restored
2. **Manual verification**: Check which packages published
3. **Fix and retry**: Fix the issue and run `pnpm publish` again

### If workspace:* Not Restored

If something goes wrong and workspace:* is not restored:

```bash
pnpm publish:restore
```

This manually restores from the backup.

## Version Bumping

Before publishing, bump versions in package.json files:

```bash
# For a new alpha release
# Edit these files:
- packages/core/package.json       # If changed
- packages/integrations/package.json  # If changed
- packages/cli/package.json        # If changed
- packages/gui/package.json        # If changed

# Then commit
git add packages/*/package.json
git commit -m "chore: bump version to X.X.X-alpha.Y"
```

## Publishing Checklist

Before running `pnpm publish`:

- [ ] All changes committed
- [ ] Version numbers bumped in package.json
- [ ] All tests passing locally (`pnpm test`)
- [ ] Logged in to npm (`npm whoami`)
- [ ] No local workspace:* changes
- [ ] Run `pnpm publish:dry-run` first

## Troubleshooting

### "workspace:* is not supported"

This means a package.json still has `workspace:*`. Run:

```bash
pnpm publish:restore  # Restore clean state
pnpm publish          # Try again
```

### "Not authenticated to npm"

```bash
npm login
# Then try again
```

### "Version already published"

The version already exists on npm. You need to:

1. Bump the version number in package.json
2. Commit the change
3. Try publishing again

### Tests fail but packages seem fine

Check the test output carefully. Common issues:
- Port already in use (kill processes on port 3999)
- Network issues downloading packages
- File permission issues in test directory

## Files

| File | Purpose |
|------|---------|
| `scripts/prepare-publish.js` | Replaces workspace:* with versions |
| `scripts/test-packages.js` | Tests packages before publish |
| `scripts/publish.js` | Main orchestration script |
| `scripts/PUBLISHING.md` | This documentation |
| `.publish-backup/` | Backup of original package.json files |
| `.publish-test/` | Temporary test directory |

## Safety Features

✅ **Dry run mode** - Test without publishing
✅ **Automatic backup** - Original files saved
✅ **Automatic restore** - Reverted on error
✅ **Pre-publish tests** - Catch issues early
✅ **Dependency order** - Publishes in correct order
✅ **Confirmation prompt** - No accidental publishes
✅ **Post-publish verification** - Confirms success

## Example Session

```bash
$ pnpm publish

🚀 marktoflow Package Publisher

📋 Publish Plan

  1. @marktoflow/core@2.0.0-alpha.9
  2. @marktoflow/integrations@2.0.0-alpha.9
  3. @marktoflow/cli@2.0.0-alpha.10
  4. @marktoflow/gui@2.0.0-alpha.5

📝 Process:
  1. Replace workspace:* with actual versions
  2. Build all packages
  3. Run tests
  4. Publish to npm (with alpha tag)
  5. Restore workspace:*
  6. Verify publication

❓ Proceed with publish? (y/N): y

🔑 Checking npm authentication...
  ✓ Authenticated to npm

📦 Preparing packages...
  ✓ Backed up: packages/core/package.json
  ✓ Backed up: packages/integrations/package.json
  ✓ Backed up: packages/cli/package.json
  ✓ Backed up: packages/gui/package.json
  ✓ packages/cli: @marktoflow/core → 2.0.0-alpha.9
  ✓ packages/cli: @marktoflow/integrations → 2.0.0-alpha.9
  ✓ packages/gui: @marktoflow/core → 2.0.0-alpha.9
✅ Packages prepared for publishing

🔨 Building packages...
[build output...]

🧪 Testing packages...
[test output...]
✅ All tests passed!

📤 Publishing packages...
+ @marktoflow/core@2.0.0-alpha.9
+ @marktoflow/integrations@2.0.0-alpha.9
+ @marktoflow/cli@2.0.0-alpha.10
+ @marktoflow/gui@2.0.0-alpha.5

🔄 Restoring workspace:* dependencies...
  ✓ Restored: packages/core/package.json
  ✓ Restored: packages/integrations/package.json
  ✓ Restored: packages/cli/package.json
  ✓ Restored: packages/gui/package.json
✅ Backup restored

✅ Verifying publication...
  ✓ @marktoflow/core@2.0.0-alpha.9 is published
  ✓ @marktoflow/integrations@2.0.0-alpha.9 is published
  ✓ @marktoflow/cli@2.0.0-alpha.10 is published
  ✓ @marktoflow/gui@2.0.0-alpha.5 is published

✅ Publish complete!

📦 Installation command:
  npm install @marktoflow/cli@alpha @marktoflow/gui@alpha
```

## Benefits

🎯 **Reproducible** - Same process every time
🔒 **Safe** - Automatic rollback on errors
⚡ **Fast** - Parallel builds with Turbo
🧪 **Tested** - Catches issues before publish
📝 **Documented** - Clear output at every step
🤖 **Automated** - No manual version replacement
✅ **Reliable** - Verifies success after publish
