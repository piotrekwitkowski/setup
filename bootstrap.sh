#!/usr/bin/env bash
set -e

OS="$(uname -s)"

# Install Homebrew if missing
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [[ "$OS" == "Darwin" ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

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
fnm use lts-latest >/dev/null 2>&1 || true

# Hand off to TypeScript
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_TS="$SCRIPT_DIR/setup.ts"
if [[ ! -f "$SETUP_TS" ]]; then
  SETUP_TS="/tmp/setup.ts"
  curl -fsSL https://raw.githubusercontent.com/piotrekwitkowski/setup/main/setup.ts -o "$SETUP_TS"
fi
npx --yes tsx "$SETUP_TS" "$@"
