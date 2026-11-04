# setup

Cross-platform setup script for macOS and Linux. From a local clone:

```sh
./bootstrap.sh
```

Or on a new machine:

```sh
bash <(curl -fsSL https://raw.githubusercontent.com/piotrekwitkowski/setup/main/bootstrap.sh)
```

## What gets installed

| Tool | Type | Method |
|---|---|---|
| Homebrew | package manager | `curl \| bash` |
| fnm | Node version manager | `brew install fnm` |
| Node.js LTS | runtime | `fnm install --lts` |
| AWS CLI | CLI | `brew install awscli` |
| Codex CLI | CLI | `brew install --cask codex` |
| gh | CLI | `brew install gh` |
| git-secrets | CLI | `brew install git-secrets` |
| glab | CLI | `brew install glab` |
| Go | language | `brew install go` |
| OpenTofu | CLI | `brew install opentofu` |
| Session Manager plugin | CLI | bundle from AWS S3 |
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
| Kiro | app | dmg from [kiro.dev](https://kiro.dev) |
| Kiro CLI | CLI | `brew install --cask kiro-cli` |
| Ollama | app | `brew install --cask ollama` |
| Zoom | app | `brew install --cask zoom` |

## Claude Code configuration

Configures `~/.claude/settings.json` with auto-approved permissions for readonly CLI commands and hooks that guard destructive operations behind confirmation prompts.

## Git configuration

Ensures `~/.gitconfig` contains `includeIf` directives routing repos under `~/@aws/` and `~/@piotrek/` to per-context config files (`~/.gitconfig-aws`, `~/.gitconfig-piotrek`). Creates the files empty if missing and warns when they lack a `[user]` section — fill them in with your name and email. On macOS, configures the osxkeychain credential helper.

## Shell configuration

Configures `~/.zprofile` (macOS) or `~/.bash_profile` (Linux) with environment variables, PATH updates, and aliases.
