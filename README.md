# setup

Sets up a macOS or Linux machine: installs CLIs and apps, then configures Claude Code, git and the shell profile. Clone it, then run `bootstrap.sh` from the clone:

```sh
git clone https://github.com/piotrekwitkowski/setup.git ~/@piwit/setup
cd ~/@piwit/setup
./bootstrap.sh      # check only: reports what is missing or outdated
./bootstrap.sh -f   # install, upgrade and write config (same as --fix)
```

`bootstrap.sh` installs Homebrew, fnm and Node.js LTS if they are missing, then hands over to `setup.main.ts`. On a work machine, copy `setup.work.ts` into the clone first: it is gitignored, so the clone doesn't have it.

## Profiles

`setup.main.ts` has no lists of its own. It reads them from two profiles, both typed by the `Profile` type exported from `setup.main.ts`:

- `setup.personal.ts`: committed. Everything every machine gets.
- `setup.work.ts`: gitignored and optional. Work-only and non-public entries.

Lists from both are combined. When both define a program with the same name, or set the same single value, the work profile wins. To add a program, permission or profile line, edit a profile, not `setup.main.ts`.

## What gets installed

What `setup.personal.ts` currently lists:

| Tool | Type | Method |
|---|---|---|
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
| Codex CLI | CLI | `brew install --cask codex` |
| Kiro | app | `brew install --cask kiro` |
| Kiro CLI | CLI | `brew install --cask kiro-cli` |
| Ollama | app | `brew install --cask ollama` |
| Session Manager plugin | CLI | `brew install --cask session-manager-plugin` |
| Zoom | app | `brew install --cask zoom` |

## Claude Code

`~/.claude/settings.json` gets the profiles' allow rules, hooks, sandbox domains and sandbox excluded commands. The allow list is replaced, so a rule you add by hand disappears on the next `-f` run unless it is in a profile.

If `~/.claude/CLAUDE.md` is missing, setup fetches it from the README of the GitHub repo named in `claudeMdReadme`. Run `gh auth login` first.

## Git

Each `gitIncludes` entry maps a folder to a config file:

- `~/.gitconfig` gets an `includeIf "gitdir:<folder>"` rule that loads the file for every repo under that folder.
- If the entry has a `user`, setup writes that name and email into the file. Without one, it creates an empty file and warns.
- `user.useConfigOnly = true` makes git refuse to commit outside those folders instead of guessing an identity.
- On macOS, git stores HTTPS credentials in the Keychain (`credential.helper = osxkeychain`).

## Shell profile

Setup appends missing lines to `~/.zprofile` on macOS or `~/.bash_profile` on Linux: the `brew shellenv` and `fnm env` lines it needs, then the profiles' `profileLines` and, on macOS, `macProfileLines`. It never removes lines, so delete obsolete ones by hand.
