# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Overview

Cross-platform setup script that provisions a macOS or Linux machine. Check-only by default; pass `--fix` / `-f` to install missing tools, upgrade outdated ones, and write config.

## Running

```sh
./bootstrap.sh          # check only — reports issues without making changes
./bootstrap.sh --fix    # install, upgrade, and write config
./bootstrap.sh -f       # shorthand for --fix
```

There is no build step, test suite, or linter. The script is run directly via `npx --yes tsx setup.ts` (invoked by `bootstrap.sh`). Type-check with `npx tsc --noEmit`.

## Architecture

**`bootstrap.sh`** — Minimal bash shim that detects the OS, ensures Homebrew (with the correct prefix for macOS vs Linux), fnm, and Node LTS exist, then hands off to `setup.ts` with `"$@"`.

**`setup.ts`** — Main script. Check-only by default; with `--fix` / `-f` it installs and upgrades. Cross-platform core: brew CLIs, npm globals, Codex settings, git config, and shell profile. Mac-only section: desktop apps (cask/dmg installs). Shell config writes to `~/.zprofile` on macOS and `~/.bash_profile` on Linux. Each tool checks missing → outdated → ok. Brew and npm outdated checks are grouped together near the end of the tools section. The profile writer collects lines into three arrays (evals, envs, aliases) and writes them in sorted order at the end.

**`lib/dmg.ts`** — Shared helper for DMG-based app installs (download, mount, copy to /Applications, unmount, cleanup). Used by `setup.ts` for Kiro IDE and Vowen.
