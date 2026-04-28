# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Cross-platform setup script that provisions a macOS or Linux machine. Entry point is `bootstrap.sh`, which installs Homebrew, fnm, and Node.js LTS, then delegates to `setup.ts` (run via `npx tsx`).

## Running

```sh
./bootstrap.sh
```

There is no build step, test suite, or linter. The script is run directly via `npx --yes tsx setup.ts` (invoked by `bootstrap.sh`). Type-check with `npx tsc --noEmit`.

## Architecture

**`bootstrap.sh`** — Minimal bash shim that detects the OS, ensures Homebrew (with the correct prefix for macOS vs Linux), fnm, and Node LTS exist, then hands off to `setup.ts`.

**`setup.ts`** — Single-file TypeScript script that handles everything else. Cross-platform core: brew CLIs, npm globals, MCP servers, Claude Code settings, git config, and shell profile. Mac-only section: desktop apps (cask/dmg installs). Shell config writes to `~/.zprofile` on macOS and `~/.bash_profile` on Linux. Every tool follows the same pattern: check if present, install if missing, print version if already installed. The profile writer collects lines into three arrays (evals, envs, aliases) and writes them in sorted order at the end.
