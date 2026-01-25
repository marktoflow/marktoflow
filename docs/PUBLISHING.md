# Publishing Guide

This guide explains how to publish new versions of marktoflow packages to npm.

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

### 3. Clean Build State

```bash
# Clean all build artifacts
pnpm clean

# Install dependencies
pnpm install

# Build all packages
pnpm build
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

## Publishing Process

### Step 1: Update Version Numbers

Update `version` in all four package.json files:

```bash
# Example: Updating to 2.0.0-alpha.8
# packages/core/package.json
{
  "name": "@marktoflow/core",
  "version": "2.0.0-alpha.8"
}

# packages/integrations/package.json
{
  "name": "@marktoflow/integrations",
  "version": "2.0.0-alpha.8",
  "dependencies": {
    "@marktoflow/core": "2.0.0-alpha.8"
  }
}

# packages/gui/package.json
{
  "name": "@marktoflow/gui",
  "version": "2.0.0-alpha.8",
  "dependencies": {
    "@marktoflow/core": "workspace:*"
  }
}

# packages/cli/package.json
{
  "name": "@marktoflow/cli",
  "version": "2.0.0-alpha.8",
  "dependencies": {
    "@marktoflow/core": "2.0.0-alpha.8",
    "@marktoflow/integrations": "2.0.0-alpha.8"
  },
  "optionalDependencies": {
    "@marktoflow/gui": "2.0.0-alpha.8"
  }
}
```

**IMPORTANT**: Ensure dependency versions match the version you're publishing!

**Note**: The GUI package uses `workspace:*` for local development but should reference the exact version when publishing.

### Step 2: Build Packages

```bash
# Build all packages
pnpm build

# Verify build output
ls -la packages/core/dist
ls -la packages/integrations/dist
ls -la packages/gui/dist
ls -la packages/cli/dist
```

### Step 3: Publish in Order

Publish in dependency order: core → integrations → gui → cli

#### Publish @marktoflow/core

```bash
cd packages/core
npm publish --access public --tag alpha
cd ../..
```

#### Publish @marktoflow/integrations

```bash
cd packages/integrations
npm publish --access public --tag alpha
cd ../..
```

#### Publish @marktoflow/gui

```bash
cd packages/gui
npm publish --access public --tag alpha
cd ../..
```

#### Publish @marktoflow/cli

```bash
cd packages/cli
npm publish --access public --tag alpha
cd ../..
```

### Step 4: Verify Publication

```bash
# Check published versions
npm view @marktoflow/core@alpha version
npm view @marktoflow/integrations@alpha version
npm view @marktoflow/gui@alpha version
npm view @marktoflow/cli@alpha version

# Search for packages
npm search @marktoflow
```

### Step 5: Update Documentation

Update version references in documentation:

- README.md
- docs/INSTALLATION.md
- Any other files mentioning version numbers

### Step 6: Commit and Tag

```bash
# Add changes
git add .

# Commit with version number
git commit -m "chore: release v2.0.0-alpha.4"

# Create git tag
git tag v2.0.0-alpha.4

# Push to GitHub
git push origin main
git push origin v2.0.0-alpha.4
```

---

## Publishing Stable Releases

When ready to publish a stable release (no alpha tag):

### Step 1: Update Versions (Remove Alpha)

Update all package.json files to remove `-alpha.x`:

```json
{
  "version": "2.0.0"
}
```

### Step 2: Publish Without Alpha Tag

```bash
# Core
cd packages/core
npm publish --access public
cd ../..

# Integrations
cd packages/integrations
npm publish --access public
cd ../..

# GUI
cd packages/gui
npm publish --access public
cd ../..

# CLI
cd packages/cli
npm publish --access public
cd ../..
```

This publishes to the `latest` tag, which users get by default:

```bash
npm install -g @marktoflow/cli  # Gets latest stable version
```

---

## Troubleshooting

### Authentication Errors

If you see `ENEEDAUTH` errors:

```bash
# Re-authenticate
npm login

# Or set token directly
npm config set //registry.npmjs.org/:_authToken=YOUR_TOKEN
```

### Permission Errors

If you see `E403` (Forbidden) errors:

- Verify you're a member of @marktoflow organization
- Check you have publish permissions
- Visit https://www.npmjs.com/settings/marktoflow/members

### Version Conflicts

If a version already exists:

```bash
npm error 403 You cannot publish over the previously published versions
```

Solution: Increment the version number and try again.

### Dependency Mismatch

If users report dependency errors:

- Ensure all internal dependencies use exact version numbers (not `^` or `~`)
- Verify dependency versions match in all package.json files

---

## Quick Reference

### Alpha Release Checklist

- [ ] Update version in all four package.json files (with `-alpha.X`)
- [ ] Update dependency versions to match
- [ ] Run `pnpm clean && pnpm install && pnpm build`
- [ ] Publish core: `cd packages/core && npm publish --access public --tag alpha`
- [ ] Publish integrations: `cd packages/integrations && npm publish --access public --tag alpha`
- [ ] Publish gui: `cd packages/gui && npm publish --access public --tag alpha`
- [ ] Publish cli: `cd packages/cli && npm publish --access public --tag alpha`
- [ ] Verify: `npm view @marktoflow/cli@alpha version`
- [ ] Update documentation
- [ ] Commit and tag: `git commit -m "chore: release vX.X.X-alpha.X"`
- [ ] Push: `git push origin main && git push origin vX.X.X-alpha.X`

### Stable Release Checklist

- [ ] Update version in all four package.json files (remove `-alpha.X`)
- [ ] Update dependency versions to match
- [ ] Run `pnpm clean && pnpm install && pnpm build`
- [ ] Run full test suite: `pnpm test`
- [ ] Publish core: `cd packages/core && npm publish --access public`
- [ ] Publish integrations: `cd packages/integrations && npm publish --access public`
- [ ] Publish gui: `cd packages/gui && npm publish --access public`
- [ ] Publish cli: `cd packages/cli && npm publish --access public`
- [ ] Verify: `npm view @marktoflow/cli version`
- [ ] Update all documentation (remove `@alpha` tags)
- [ ] Create GitHub release with changelog
- [ ] Commit and tag: `git commit -m "chore: release vX.X.X"`
- [ ] Push: `git push origin main && git push origin vX.X.X`

---

## Automation (Future)

Consider automating the publishing process with:

- **Changesets**: Automatic version management and changelogs
- **GitHub Actions**: Publish on tag push
- **Release Please**: Automated release PR generation

Example GitHub Action:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install
      - run: pnpm build
      - run: pnpm test

      - name: Publish packages
        run: |
          cd packages/core && npm publish --access public
          cd ../integrations && npm publish --access public
          cd ../gui && npm publish --access public
          cd ../cli && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Current Status

**Latest Published Version**: 2.0.0-alpha.7

**Published Packages**:

- @marktoflow/core@2.0.0-alpha.7
- @marktoflow/integrations@2.0.0-alpha.7
- @marktoflow/gui@2.0.0-alpha.1 (new)
- @marktoflow/cli@2.0.0-alpha.7

**Installation**:

```bash
# Install CLI (includes optional GUI)
npm install -g @marktoflow/cli@alpha

# Install GUI separately (for programmatic use)
npm install @marktoflow/gui@alpha
```

**GUI Package Features**:

The new `@marktoflow/gui` package provides:

- Visual drag-and-drop workflow editor
- AI-powered assistance (Claude Code, GitHub Copilot, Claude API, Ollama)
- Real-time workflow execution and debugging
- Light and dark themes
- Live file sync with workflow files

**Starting the GUI**:

```bash
# Via CLI
marktoflow gui

# Programmatically
import { startServer } from '@marktoflow/gui';
await startServer({ port: 3001, workflowDir: './workflows' });
```

**Next Steps**:

- Continue alpha releases during development
- Publish 2.0.0 stable when ready for production
