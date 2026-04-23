# setup

Mac setup script. From a local clone:

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
| Node.js LTS | runtime | fnm |
| Homebrew | package manager | curl |
| AWS CLI | CLI | brew |
| gh | CLI | brew |
| Go | language | brew |
| jq | CLI | brew |
| Claude Desktop | app | brew cask |
| Kiro | app | dmg |
| Vowen | app | dmg |
| Zoom | app | pkg |
| AWS CDK | CLI | npm -g |
| Claude Code | CLI | npm -g |
| OpenCode | CLI | npm -g |
| Wrangler | CLI | npm -g |

## Git configuration

Ensures `~/.gitconfig` contains `includeIf` directives routing repos under `~/@aws/` and `~/@piotrek/` to per-context config files (`~/.gitconfig-aws`, `~/.gitconfig-piotrek`). Creates the files empty if missing and warns when they lack a `[user]` section — fill them in with your name and email.

## Shell configuration

Configures `~/.zprofile` with environment variables, PATH updates, and aliases.
