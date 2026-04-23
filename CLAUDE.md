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

**`setup.ts`** — Single-file TypeScript script that handles everything else: brew CLIs, cask/dmg apps, npm globals, MCP servers, git config, and shell config. Every tool follows the same pattern: check if present, install if missing, print version if already installed. The `.zprofile` writer collects lines into three arrays (evals, envs, aliases) and writes them in sorted order at the end.
