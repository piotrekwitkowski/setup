#!/usr/bin/env bash
set -e

# Install Homebrew if missing (needed for fnm)
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

export PATH="/opt/homebrew/bin:$PATH"

# Install fnm if missing
if ! command -v fnm &>/dev/null; then
  echo "Installing fnm..."
  brew install fnm
fi

eval "$(fnm env)"

# Install latest LTS Node if not already installed
if ! fnm ls | grep -q "lts-latest"; then
  echo "Installing Node.js LTS..."
  fnm install --lts
fi
fnm use lts-latest 2>/dev/null || true

echo ""
echo ">>> Node"
echo "    node $(node --version | tr -d 'v'), npm $(npm --version)"

# Hand off to TypeScript setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
npx --yes tsx "$SCRIPT_DIR/setup.ts"
