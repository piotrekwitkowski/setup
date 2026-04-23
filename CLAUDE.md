# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Mac setup script that provisions a fresh machine. Entry point is `bootstrap.sh`, which installs Homebrew, fnm, and Node.js LTS, then delegates to `setup.ts` (run via `npx tsx`).

## Running

```sh
./bootstrap.sh
```

There is no build step, test suite, or linter. The script is run directly via `npx --yes tsx setup.ts` (invoked by `bootstrap.sh`). Type-check with `npx tsc --noEmit`.

## Architecture

**`bootstrap.sh`** — Minimal bash shim that ensures Homebrew, fnm, and Node LTS exist, then hands off to `setup.ts`.

**`setup.ts`** — Single-file TypeScript script that handles everything else:
- **Brew CLIs** (awscli, gh, git-secrets, go, jq) — idempotent install-if-missing pattern using `command -v`
- **Apps** — Cask installs (Claude Desktop, Ollama, Zoom) or manual dmg download+mount (Kiro, Vowen) checked via `/Applications/*.app`
- **npm globals** (aws-cdk, claude-code, opencode-ai, wrangler) — checked via version output
- **MCP servers** — Configures remote MCP servers in `~/.claude.json` for Claude Code (currently: GitHub MCP server)
- **Git config** — Writes `~/.gitconfig` with credential helper and `includeIf` directives for `~/@aws/` and `~/@piotrek/` directory contexts
- **Shell config** — Builds `~/.zprofile` from collected evals, exports, and aliases via `ensureInZprofile()`

Every tool follows the same pattern: check if present, install if missing, print version if already installed. The `.zprofile` writer collects lines into three arrays (evals, envs, aliases) and writes them in sorted order at the end.
