#!/bin/bash
# Verify installation after GitHub install
# Run this after: npm install -g github:scottgl9/marktoflow-automation#main

set -e

echo "======================================"
echo "marktoflow Post-Installation Check"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check if marktoflow is installed
echo "1. Checking if marktoflow is installed..."
if command -v marktoflow &> /dev/null; then
    echo -e "  ${GREEN}✓ marktoflow command found${NC}"
    MARKTOFLOW_PATH=$(which marktoflow)
    echo "    Location: $MARKTOFLOW_PATH"
else
    echo -e "  ${RED}✗ marktoflow command not found${NC}"
    echo ""
    echo "  Troubleshooting:"
    echo "  1. Check if npm global bin is in PATH:"
    echo "     PATH contains: $(npm prefix -g)/bin"
    echo "     Your PATH: $PATH"
    echo ""
    echo "  2. Try running with full path:"
    echo "     $(npm prefix -g)/bin/marktoflow version"
    echo ""
    echo "  3. Add to PATH (add to ~/.bashrc, ~/.zshrc, etc.):"
    echo "     export PATH=\"\$PATH:$(npm prefix -g)/bin\""
    echo ""
    echo "  4. Or use npx instead:"
    echo "     npx github:scottgl9/marktoflow-automation version"
    echo ""
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check version
echo "2. Checking marktoflow version..."
if command -v marktoflow &> /dev/null; then
    VERSION=$(marktoflow version 2>&1 || echo "error")
    if [[ "$VERSION" == *"2.0.0"* ]]; then
        echo -e "  ${GREEN}✓ Version: $VERSION${NC}"
    else
        echo -e "  ${RED}✗ Unexpected version: $VERSION${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "  ${YELLOW}⚠ Skipped (command not in PATH)${NC}"
fi

echo ""

# Check help command
echo "3. Checking help command..."
if command -v marktoflow &> /dev/null; then
    if marktoflow --help > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Help command works${NC}"
    else
        echo -e "  ${RED}✗ Help command failed${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "  ${YELLOW}⚠ Skipped (command not in PATH)${NC}"
fi

echo ""

# Check init command
echo "4. Testing init command (dry-run)..."
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"
if command -v marktoflow &> /dev/null; then
    if marktoflow init > /dev/null 2>&1; then
        if [ -d ".marktoflow" ]; then
            echo -e "  ${GREEN}✓ Init command works${NC}"
        else
            echo -e "  ${RED}✗ Init did not create .marktoflow directory${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo -e "  ${RED}✗ Init command failed${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "  ${YELLOW}⚠ Skipped (command not in PATH)${NC}"
fi
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo "marktoflow is ready to use."
else
    echo -e "${RED}✗ $ERRORS check(s) failed${NC}"
    echo ""
    echo "If marktoflow is not in PATH, see:"
    echo "  docs/INSTALLATION.md - Complete installation guide"
    exit 1
fi
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Create a project: mkdir my-project && cd my-project"
echo "  2. Initialize: marktoflow init"
echo "  3. Create workflow: marktoflow new"
echo "  4. Run workflow: marktoflow run workflow.md"
echo ""
echo "Documentation:"
echo "  - Installation Guide: docs/INSTALLATION.md"
echo "  - REST API Guide: docs/REST-API-GUIDE.md"
echo "  - Examples: examples/"
echo ""
