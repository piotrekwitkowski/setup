# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Cross-platform setup script that provisions a macOS or Linux machine. Check-only by default; pass `--fix` / `-f` to install missing tools, upgrade outdated ones, and write config.

## Running

```sh
./bootstrap.sh          # check only — reports issues without making changes
./bootstrap.sh --fix    # install, upgrade, and write config
./bootstrap.sh -f       # shorthand for --fix
```

There is no build step, test suite, or linter. The script is run directly via `npx --yes tsx setup.main.ts` (invoked by `bootstrap.sh`). Type-check with `npx tsc --noEmit`.

## Architecture

**`bootstrap.sh`** — Minimal bash shim that detects the OS, ensures Homebrew (with the correct prefix for macOS vs Linux), fnm, and Node LTS exist, then hands off to `setup.main.ts` with `"$@"`.

**`setup.main.ts`** — The engine. Check-only by default; with `--fix` / `-f` it installs and upgrades. It holds no lists of programs, permissions or settings. It exports the `Profile` type (`programs` with macOS `apps` checked in /Applications, `clis` checked on PATH and `npm` globals, Claude allow rules and hooks, `claudeMdReadme`, sandbox settings, git includes with identities, shell profile lines) and loads the lists from the profiles below and knows only how to check, report (green / yellow / red) and fix each kind. It keeps the prerequisites it needs to run (Homebrew, fnm, Node LTS, the `brew shellenv` and `fnm env` profile lines, `allowLocalBinding` for tsx), the osxkeychain credential helper and `user.useConfigOnly`. Each program checks missing → outdated → ok; brew and npm outdated checks are grouped near the end. Shell config writes to `~/.zprofile` on macOS and `~/.bash_profile` on Linux, collecting missing lines and appending them in sorted order (evals, exports, aliases, functions).

**`setup.personal.ts`** — Committed profile with everything used on every machine.

**`setup.work.ts`** — Optional, gitignored profile for work-only and non-public entries. Loaded after `setup.personal.ts`. Lists from both are combined; a work entry with the same `name` as a personal program replaces it, and single values from the work file win.
