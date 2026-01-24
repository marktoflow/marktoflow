#!/bin/bash
# Test installation script for marktoflow

set -e

echo "======================================"
echo "marktoflow Installation Test"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo "Step 1: Checking prerequisites..."
echo -n "  Node.js version: "
node --version || { echo -e "${RED}✗ Node.js not found${NC}"; exit 1; }

echo -n "  npm version: "
npm --version || { echo -e "${RED}✗ npm not found${NC}"; exit 1; }

echo -n "  Global npm prefix: "
npm prefix -g

echo -n "  Global bin directory: "
NPM_BIN_DIR="$(npm prefix -g)/bin"
echo "$NPM_BIN_DIR"

echo ""

# Step 2: Check if marktoflow is in PATH
echo "Step 2: Checking PATH configuration..."
if command -v marktoflow &> /dev/null; then
    echo -e "  ${GREEN}✓ marktoflow command found in PATH${NC}"
    MARKTOFLOW_PATH=$(which marktoflow)
    echo "    Location: $MARKTOFLOW_PATH"
else
    echo -e "  ${YELLOW}⚠ marktoflow command not found in PATH${NC}"
    echo "    This is expected if not installed yet"
fi

# Check if npm bin dir is in PATH
if echo "$PATH" | grep -q "$(npm prefix -g)/bin"; then
    echo -e "  ${GREEN}✓ npm global bin directory is in PATH${NC}"
else
    echo -e "  ${RED}✗ npm global bin directory NOT in PATH${NC}"
    echo "    Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
    echo "    export PATH=\"\$PATH:$(npm prefix -g)/bin\""
fi

echo ""

# Step 3: Check if packages are built
echo "Step 3: Checking if packages are built..."
if [ -f "packages/cli/dist/index.js" ]; then
    echo -e "  ${GREEN}✓ CLI package built${NC}"
    # Check shebang
    if head -n 1 "packages/cli/dist/index.js" | grep -q "^#!/usr/bin/env node"; then
        echo -e "  ${GREEN}✓ Shebang line present in dist/index.js${NC}"
    else
        echo -e "  ${RED}✗ Shebang line missing in dist/index.js${NC}"
    fi
else
    echo -e "  ${RED}✗ CLI package not built${NC}"
    echo "    Run: pnpm build"
fi

if [ -f "packages/core/dist/index.js" ]; then
    echo -e "  ${GREEN}✓ Core package built${NC}"
else
    echo -e "  ${RED}✗ Core package not built${NC}"
fi

if [ -f "packages/integrations/dist/index.js" ]; then
    echo -e "  ${GREEN}✓ Integrations package built${NC}"
else
    echo -e "  ${RED}✗ Integrations package not built${NC}"
fi

echo ""

# Step 4: Check package.json bin configuration
echo "Step 4: Checking package.json bin configuration..."
BIN_CONFIG=$(grep -A 2 '"bin"' packages/cli/package.json)
if echo "$BIN_CONFIG" | grep -q '"marktoflow".*"./dist/index.js"'; then
    echo -e "  ${GREEN}✓ bin configuration is correct${NC}"
else
    echo -e "  ${RED}✗ bin configuration is incorrect${NC}"
fi

echo ""

# Step 5: Test local execution
echo "Step 5: Testing local execution (before installation)..."
if [ -f "packages/cli/dist/index.js" ]; then
    if node packages/cli/dist/index.js --version &> /dev/null; then
        echo -e "  ${GREEN}✓ Local execution works${NC}"
        node packages/cli/dist/index.js --version
    else
        echo -e "  ${RED}✗ Local execution failed${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ Package not built, skipping local execution test${NC}"
fi

echo ""
echo "======================================"
echo "Installation Test Complete"
echo "======================================"
echo ""
echo "To install marktoflow, run one of:"
echo "  1. npm install -g github:scottgl9/marktoflow-automation#main"
echo "  2. cd packages/cli && npm link"
echo "  3. npx github:scottgl9/marktoflow-automation version"
echo ""
