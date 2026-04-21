#!/usr/bin/env zsh
set -e

# -------------------------------------------------------
# Mac setup script
# Installs: Homebrew, gh CLI, Claude Code CLI, OpenCode CLI
# Safe to run multiple times (idempotent)
# -------------------------------------------------------

print_step() {
  echo "\n>>> $1"
}

# -------------------------------------------------------
# Homebrew
# -------------------------------------------------------
print_step "Checking Homebrew..."
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Add brew to PATH for the rest of this script (Apple Silicon)
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
else
  echo "Homebrew already installed: $(brew --version | head -1)"
fi

# -------------------------------------------------------
# gh CLI
# -------------------------------------------------------
print_step "Checking gh CLI..."
if ! command -v gh &>/dev/null; then
  echo "Installing gh CLI..."
  brew install gh
else
  echo "gh already installed: $(gh --version | head -1)"
fi

# -------------------------------------------------------
# Claude Code CLI
# -------------------------------------------------------
print_step "Checking Claude Code CLI..."
if ! command -v claude &>/dev/null; then
  echo "Installing Claude Code CLI..."
  brew install anthropic/tap/claude-code || npm install -g @anthropic-ai/claude-code
else
  echo "Claude Code already installed: $(claude --version 2>/dev/null | head -1)"
fi

# -------------------------------------------------------
# OpenCode CLI
# -------------------------------------------------------
print_step "Checking OpenCode CLI..."
if ! command -v opencode &>/dev/null; then
  echo "Installing OpenCode..."
  curl -fsSL https://opencode.ai/install | bash

  # Add opencode to PATH for the rest of this script
  export PATH="$HOME/.opencode/bin:$PATH"
else
  echo "OpenCode already installed: $(opencode --version 2>/dev/null | head -1)"
fi

# -------------------------------------------------------
# PATH reminder
# -------------------------------------------------------
print_step "Done!"
echo ""
echo "Make sure the following is in your ~/.zprofile:"
echo ""
echo "  export PATH=\"\$HOME/.opencode/bin:\$PATH\""
echo ""
echo "Then run: source ~/.zprofile"
