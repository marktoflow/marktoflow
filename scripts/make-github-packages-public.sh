#!/bin/bash

# Make GitHub Packages public
# Requires: gh CLI installed and authenticated

PACKAGES=(
  "core"
  "integrations"
  "cli"
  "gui"
  "marktoflow"
)

ORG="marktoflow"
PACKAGE_TYPE="npm"

echo "🔓 Making GitHub Packages public..."
echo ""

for pkg in "${PACKAGES[@]}"; do
  PACKAGE_NAME="marktoflow%2F${pkg}"  # URL-encoded @marktoflow/pkg
  echo "Processing: @marktoflow/${pkg}"

  # Update package visibility to public using GitHub API
  gh api \
    --method PATCH \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/orgs/${ORG}/packages/${PACKAGE_TYPE}/${PACKAGE_NAME}" \
    -f visibility='public' \
    && echo "  ✓ Made @marktoflow/${pkg} public" \
    || echo "  ⚠️  Could not update @marktoflow/${pkg} (may need manual update)"

  echo ""
done

echo "✅ Done!"
echo ""
echo "Verify at: https://github.com/orgs/${ORG}/packages"
echo ""
echo "Note: If this script fails, you can manually change visibility:"
echo "1. Go to https://github.com/orgs/${ORG}/packages"
echo "2. Click each package → Settings → Danger Zone → Change visibility → Public"
