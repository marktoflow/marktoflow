# marktoflow Installation Guide

Complete installation guide for marktoflow CLI with troubleshooting.

## Table of Contents

- [Installation Methods](#installation-methods)
- [Verifying Installation](#verifying-installation)
- [PATH Configuration](#path-configuration)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

---

## Installation Methods

### Method 1: Install from npm (Recommended)

Install from the npm registry:

```bash
npm install -g @marktoflow/cli@alpha
```

**Pros:**

- Fast installation
- Official npm package
- Easy updates with `npm update -g @marktoflow/cli`

**Cons:**

- Currently in alpha (use `@alpha` tag)

### Method 2: Use npx (No Installation)

Run marktoflow commands without installing:

```bash
# Run any command with npx
npx @marktoflow/cli@alpha version
npx @marktoflow/cli@alpha init
npx @marktoflow/cli@alpha run workflow.md
```

**Pros:**

- No installation required
- No PATH configuration needed
- Always runs the latest version
- Great for CI/CD environments

**Cons:**

- Slower (downloads package each time, but caches it)
- Requires typing full package path

### Method 3: Install from GitHub

Install the latest development version directly from GitHub:

```bash
npm install -g github:scottgl9/marktoflow#main
```

**Pros:**

- Always get the latest unreleased features
- Simple one-command install

**Cons:**

- Requires git to be installed
- Slower than npm registry

### Method 4: Install from Source

For development or contributing:

```bash
# 1. Clone repository
git clone https://github.com/scottgl9/marktoflow.git
cd marktoflow

# 2. Install dependencies (requires pnpm)
npm install -g pnpm
pnpm install

# 3. Build all packages
pnpm build

# 4. Link CLI globally
cd packages/cli
npm link

# 5. Verify installation
marktoflow version
```

**Pros:**

- Full source code access
- Can modify and test changes
- See all internals

**Cons:**

- Requires build step
- Requires pnpm
- More complex setup

---

## Verifying Installation

After installation, verify marktoflow is working:

```bash
# Check version (should show 2.0.0-alpha.9 or higher)
marktoflow version

# Check available commands
marktoflow --help

# Check environment
marktoflow doctor
```

**Expected output for `marktoflow version`:**

```
marktoflow v2.0.0-alpha.9
```

If you see `command not found: marktoflow`, proceed to [PATH Configuration](#path-configuration).

---

## PATH Configuration

If `marktoflow` command is not found after installation, npm's global bin directory is not in your PATH.

### Step 1: Find npm's Global Bin Directory

```bash
npm bin -g
```

**Common locations:**

| Platform    | Typical Path                              |
| ----------- | ----------------------------------------- |
| macOS/Linux | `/usr/local/bin`                          |
| macOS/Linux | `~/.npm-global/bin`                       |
| nvm users   | `~/.nvm/versions/node/vX.X.X/bin`         |
| Windows     | `C:\Users\<username>\AppData\Roaming\npm` |

### Step 2: Add to PATH

#### macOS / Linux

**For bash** (edit `~/.bashrc` or `~/.bash_profile`):

```bash
# Add this line at the end of the file
export PATH="$PATH:$(npm bin -g)"
```

**For zsh** (edit `~/.zshrc`):

```bash
# Add this line at the end of the file
export PATH="$PATH:$(npm bin -g)"
```

**For fish** (edit `~/.config/fish/config.fish`):

```fish
# Add this line at the end of the file
set -gx PATH $PATH (npm bin -g)
```

**Apply changes:**

```bash
# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc, ~/.bash_profile, etc.

# Or restart your terminal
```

#### Windows

**Option 1: GUI Method**

1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Go to **Advanced** tab → **Environment Variables**
3. Under **User variables**, select **Path** and click **Edit**
4. Click **New** and paste the path from `npm bin -g`
5. Click **OK** to save all dialogs
6. Restart your terminal

**Option 2: PowerShell Method**

```powershell
# Get npm global bin path
$npmPath = npm bin -g

# Add to User PATH (permanent)
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "User") + ";$npmPath",
    "User"
)

# Verify
$env:Path -split ';' | Select-String "npm"
```

**Option 3: Command Prompt Method**

```cmd
# Get npm global bin path
npm bin -g

# Add to PATH permanently
setx PATH "%PATH%;C:\Users\<username>\AppData\Roaming\npm"

# Restart terminal and verify
echo %PATH%
```

### Step 3: Verify PATH Update

```bash
# Check if marktoflow is in PATH
which marktoflow  # macOS/Linux
where marktoflow  # Windows

# Test command
marktoflow version
```

---

## Troubleshooting

### Issue: "command not found: marktoflow"

**Cause:** npm's global bin directory is not in PATH.

**Solutions:**

1. **Fix PATH** (see [PATH Configuration](#path-configuration) above)
2. **Use npx instead:**
   ```bash
   npx github:scottgl9/marktoflow version
   ```
3. **Use full path:**
   ```bash
   $(npm bin -g)/marktoflow version
   ```

### Issue: "npm ERR! code EACCES" (Permission Denied)

**Cause:** npm trying to install to system directory without permissions.

**Solutions:**

**Option 1: Use npx (Recommended)**

```bash
npx @scottgl/marktoflow@alpha version
```

**Option 2: Configure npm to use user directory**

```bash
# Create directory for global packages
mkdir ~/.npm-global

# Configure npm to use it
npm config set prefix '~/.npm-global'

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$PATH:$HOME/.npm-global/bin"

# Reload shell
source ~/.bashrc  # or ~/.zshrc

# Try installation again
npm install -g @marktoflow/cli@alpha
```

**Option 3: Use sudo (Not Recommended)**

```bash
sudo npm install -g @marktoflow/cli@alpha
```

**Note:** Using sudo can cause permission issues later. Options 1 or 2 are better.

### Issue: "ENOENT: no such file or directory, open 'package.json'"

**Cause:** Running `npm link` in wrong directory.

**Solution:**

```bash
# Ensure you're in the CLI package directory
cd packages/cli

# Then run npm link
npm link
```

### Issue: "Module not found" errors after installation

**Cause:** Dependencies not installed or built.

**Solution:**

```bash
# Reinstall from npm
npm install -g --force @scottgl/marktoflow@alpha

# Or if installing from source:
cd marktoflow
pnpm install
pnpm build
cd packages/cli
npm link
```

### Issue: Installation hangs or takes forever

**Cause:** Network issues or large repository download.

**Solutions:**

1. **Use npx with cache:**

   ```bash
   npx @scottgl/marktoflow@alpha version
   # First run downloads, subsequent runs use cache
   ```

2. **Check npm registry:**

   ```bash
   npm config get registry
   # Should be: https://registry.npmjs.org/
   ```

3. **Use verbose logging:**
   ```bash
   npm install -g @marktoflow/cli@alpha --verbose
   ```

### Issue: "Cannot find module '@marktoflow/core'"

**Cause:** Workspace dependencies not resolved properly.

**Solution:**

```bash
# Reinstall from source
git clone https://github.com/scottgl9/marktoflow.git
cd marktoflow
pnpm install
pnpm build
cd packages/cli
npm link
```

### Issue: Different behavior between global and npx

**Cause:** Cached versions differ.

**Solution:**

```bash
# Clear npm cache
npm cache clean --force

# Reinstall global package
npm uninstall -g marktoflow
npm install -g @marktoflow/cli@alpha

# Or use npx with --no-cache
npx --no-cache @scottgl/marktoflow@alpha version
```

---

## Uninstallation

### If installed globally from npm:

```bash
npm uninstall -g @marktoflow/cli
```

### If installed from source with npm link:

```bash
cd packages/cli
npm unlink
```

### If installed from npm registry (future):

```bash
npm uninstall -g marktoflow
```

### Clean up configuration files:

```bash
# Remove .marktoflow directory (optional)
rm -rf ~/.marktoflow

# Remove credentials (optional)
rm -rf ~/.marktoflow/credentials
```

---

## Platform-Specific Notes

### macOS

- **Homebrew users:** Node.js installed via Homebrew may require additional PATH configuration
- **nvm users:** Each Node.js version has its own global bin directory
- **Multiple Node versions:** Use nvm to switch versions: `nvm use 20`

### Linux

- **Distribution differences:** PATH configuration files vary (`.bashrc`, `.profile`, `.bash_profile`)
- **System-wide install:** Use `/usr/local/bin` (may require sudo)
- **User-only install:** Use `~/.npm-global/bin` (no sudo needed)

### Windows

- **PowerShell vs CMD:** Both work, but PATH syntax differs
- **WSL users:** Follow Linux instructions within WSL
- **Git Bash:** Follows Linux-style PATH configuration

---

## Testing Installation

After successful installation, test with a simple workflow:

```bash
# Create test directory
mkdir marktoflow-test
cd marktoflow-test

# Initialize marktoflow
marktoflow init

# Create test workflow
cat > test-workflow.md << 'EOF'
---
workflow:
  id: test
  name: 'Test Workflow'

steps:
  - id: step1
    action: echo
    inputs:
      message: 'Hello from marktoflow!'
---

# Test Workflow

This is a test workflow.
EOF

# Run workflow (dry-run mode)
marktoflow run test-workflow.md --dry-run

# If successful, you should see:
# ✓ Step step1 completed (mocked)
```

---

## Additional Resources

- [README.md](../README.md) - Project overview
- [REST API Guide](REST-API-GUIDE.md) - Connect to any REST API
- [GitHub Repository](https://github.com/scottgl9/marktoflow)
- [Issue Tracker](https://github.com/scottgl9/marktoflow/issues)

---

## Getting Help

If you continue to experience installation issues:

1. **Check existing issues:** https://github.com/scottgl9/marktoflow/issues
2. **Open a new issue:** Include:
   - Operating system and version
   - Node.js version (`node --version`)
   - npm version (`npm --version`)
   - Full error message
   - Installation method used
3. **Use npx as workaround:** No installation required

---

**Last Updated:** 2026-01-27
**Version:** 2.0.0-alpha.9
