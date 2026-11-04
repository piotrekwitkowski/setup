# setup

Cross-platform setup script for macOS and Linux. Clone it, then run `bootstrap.sh` from the clone:

```sh
git clone https://github.com/piotrekwitkowski/setup.git ~/@piwit/setup
cd ~/@piwit/setup
./bootstrap.sh
```

## What gets installed

| Tool | Type | Method |
|---|---|---|
| Homebrew | package manager | `curl \| bash` |
| fnm | Node version manager | `brew install fnm` |
| Node.js LTS | runtime | `fnm install --lts` |
| AWS CLI | CLI | `brew install awscli` |
| gh | CLI | `brew install gh` |
| git-secrets | CLI | `brew install git-secrets` |
| glab | CLI | `brew install glab` |
| Go | language | `brew install go` |
| OpenTofu | CLI | `brew install opentofu` |
| AWS CDK | CLI | `npm install -g aws-cdk` |
| Claude Code | CLI | `npm install -g @anthropic-ai/claude-code` |
| Lighthouse | CLI | `npm install -g lighthouse` |
| npm-check-updates | CLI | `npm install -g npm-check-updates` |
| OpenCode | CLI | `npm install -g opencode-ai` |

### macOS only

| Tool | Type | Method |
|---|---|---|
| Claude Desktop | app | `brew install --cask claude` |
| Codex | app | `brew install --cask codex-app` |
| Codex CLI | CLI | `brew install --cask codex` |
| Kiro | app | `brew install --cask kiro` |
| Kiro CLI | CLI | `brew install --cask kiro-cli` |
| Ollama | app | `brew install --cask ollama` |
| Session Manager plugin | CLI | `brew install --cask session-manager-plugin` |
| Zoom | app | `brew install --cask zoom` |

## Claude Code configuration

Configures `~/.claude/settings.json` with auto-approved permissions for readonly CLI commands and hooks that guard destructive operations behind confirmation prompts.

## Git configuration

Ensures `~/.gitconfig` has an `includeIf` rule for each git include: `~/@piwit/` loads `~/.gitconfig-piotrek`, plus any `gitIncludes` from `setup.work.ts`. When an include names a user, setup writes that `[user]` name and email into its file; otherwise it creates the file empty and warns. It also sets `user.useConfigOnly = true`, so git refuses to commit outside those folders instead of guessing an identity. On macOS, configures the osxkeychain credential helper.

## Shell configuration

Configures `~/.zprofile` (macOS) or `~/.bash_profile` (Linux) with environment variables, PATH updates, and aliases.
