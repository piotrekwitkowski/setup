#!/usr/bin/env bash
set -e

# Install nvm if missing
if [ ! -d "$HOME/.nvm" ]; then
  echo "Installing nvm..."
  NVM_LATEST=$(curl -fsSL https://api.github.com/repos/nvm-sh/nvm/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
  curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_LATEST}/install.sh" | bash
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install latest LTS Node if not already active
if ! command -v node &>/dev/null; then
  echo "Installing Node.js LTS..."
  nvm install --lts
  nvm use --lts
fi

echo "Node $(node --version), npm $(npm --version)"

# Hand off to TypeScript setup
npx --yes tsx setup.ts
