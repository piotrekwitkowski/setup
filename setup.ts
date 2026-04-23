import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";

const run = (cmd: string) => spawnSync(cmd, { shell: true, stdio: "inherit" });
const exists = (cmd: string) => spawnSync(`command -v ${cmd}`, { shell: true }).status === 0;
const out = (cmd: string) => execSync(cmd).toString().trim();

const step = (label: string) => console.log(`\n>>> ${label}`);
const ok = (name: string, version: string) => console.log(`    ${name} ${version}`);
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

const zprofile = `${homedir()}/.zprofile`;
const existingZprofile = existsSync(zprofile) ? readFileSync(zprofile, "utf8") : "";
const evals: string[] = [];
const envs: string[] = [];
const aliases: string[] = [];
const ensureInZprofile = (line: string) => {
  const already = existingZprofile.includes(line);
  console.log(`    ${already ? "✓" : "+"} ${line}`);
  if (line.startsWith("eval ")) {
    if (!evals.includes(line)) evals.push(line);
  } else if (line.startsWith("export ")) {
    if (!envs.includes(line)) envs.push(line);
  } else if (line.startsWith("alias ")) {
    if (!aliases.includes(line)) aliases.push(line);
  }
};

const writeZprofile = () => {
  const existingContents = existingZprofile;
  const newContents = [
    ...evals,
    "",
    ...envs.sort(),
    "",
    ...aliases
  ].join("\n") + "\n";

  const changed = existingContents !== newContents;
  if (changed) writeFileSync(zprofile, newContents);
  return changed;
};

// --- Homebrew ---

step("Homebrew");
if (!exists("brew")) {
  console.log("Installing...");
  run('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
  run('eval "$(/opt/homebrew/bin/brew shellenv)"');
} else {
  ok("brew", out("brew --version").split(" ")[1]);
}

// --- Brew tools ---

step("AWS CLI");
if (!exists("aws")) {
  console.log("Installing...");
  run("brew install awscli");
} else {
  ok("aws", out("aws --version").split(" ")[0].split("/")[1]);
}

step("gh");
if (!exists("gh")) {
  console.log("Installing...");
  run("brew install gh");
} else {
  ok("gh", out("gh --version").split(" ")[2]);
}

step("git-secrets");
if (!exists("git-secrets")) {
  console.log("Installing...");
  run("brew install git-secrets");
} else {
  ok("git-secrets", out("brew list --versions git-secrets").split(" ")[1]);
}

step("Go");
if (!exists("go")) {
  console.log("Installing...");
  run("brew install go");
} else {
  ok("go", out("go version").split(" ")[2].replace("go", ""));
}

// --- Apps ---

step("Claude Desktop");
if (!existsSync("/Applications/Claude.app")) {
  console.log("Installing...");
  run("brew install --cask claude");
} else {
  ok("Claude Desktop", out("defaults read /Applications/Claude.app/Contents/Info.plist CFBundleShortVersionString"));
}

step("Kiro");
if (!existsSync("/Applications/Kiro.app")) {
  console.log("Installing...");
  const arch = out("uname -m") === "arm64" ? "arm64" : "x64";
  const page = out("curl -fsSL https://kiro.dev/downloads/");
  const match = page.match(/Latest IDE([\d.]+)/);
  if (!match) throw new Error("Could not determine latest Kiro version");
  const version = match[1];
  const dmg = `kiro-ide-${version}-stable-darwin-${arch}.dmg`;
  const url = `https://prod.download.desktop.kiro.dev/releases/stable/darwin-${arch}/signed/${version}/${dmg}`;
  run(`curl -fsSL "${url}" -o /tmp/${dmg}`);
  run(`hdiutil attach /tmp/${dmg} -quiet`);
  const volume = out("ls /Volumes | grep -i kiro");
  run(`cp -R "/Volumes/${volume}/Kiro.app" /Applications/`);
  run(`hdiutil detach "/Volumes/${volume}" -quiet`);
  run(`rm /tmp/${dmg}`);
  ok("Kiro", version);
  console.log("    Sign in with AWS in Kiro to configure SSO before continuing.");
} else {
  ok("Kiro", out("defaults read /Applications/Kiro.app/Contents/Info.plist CFBundleShortVersionString"));
}

step("Ollama");
if (!existsSync("/Applications/Ollama.app")) {
  console.log("Installing...");
  run("brew install --cask ollama");
} else {
  ok("Ollama", out("defaults read /Applications/Ollama.app/Contents/Info.plist CFBundleShortVersionString"));
}

step("Vowen");
if (!existsSync("/Applications/Vowen.app")) {
  console.log("Installing...");
  const page = out("curl -fsSL https://vowen.ai/");
  const match = page.match(/Vowen-([\d.]+)-arm64\.dmg/);
  if (!match) throw new Error("Could not determine latest Vowen version");
  const version = match[1];
  const dmg = `Vowen-${version}-arm64.dmg`;
  run(`curl -fsSL "https://assets.vowen.ai/${dmg}" -o /tmp/${dmg}`);
  run(`hdiutil attach /tmp/${dmg} -quiet`);
  const volume = out("ls /Volumes | grep -i vowen");
  run(`cp -R "/Volumes/${volume}/Vowen.app" /Applications/`);
  run(`hdiutil detach "/Volumes/${volume}" -quiet`);
  run(`rm /tmp/${dmg}`);
  ok("Vowen", version);
} else {
  ok("Vowen", out("defaults read /Applications/Vowen.app/Contents/Info.plist CFBundleShortVersionString"));
}

step("Zoom");
if (!existsSync("/Applications/zoom.us.app")) {
  console.log("Installing...");
  run("brew install --cask zoom");
} else {
  ok("Zoom", out("defaults read /Applications/zoom.us.app/Contents/Info.plist CFBundleVersion"));
}

// --- npm -g tools ---

step("AWS CDK");
const cdkVersion = spawnSync("cdk --version", { shell: true }).stdout?.toString().trim().split(" ")[0];
if (!cdkVersion) {
  console.log("Installing...");
  run("npm install -g aws-cdk");
} else {
  ok("cdk", cdkVersion);
}

step("Claude Code");
const claudeVersion = spawnSync("claude --version", { shell: true }).stdout?.toString().trim().split(" ")[0];
if (!claudeVersion) {
  console.log("Installing...");
  run("npm install -g @anthropic-ai/claude-code");
} else {
  ok("claude", claudeVersion);
}

step("OpenCode");
const opencodeVersion = spawnSync("opencode --version", { shell: true }).stdout?.toString().trim();
if (!opencodeVersion) {
  console.log("Installing...");
  run("npm install -g opencode-ai");
} else {
  ok("opencode", opencodeVersion);
}

step("Wrangler");
const wranglerVersion = spawnSync("wrangler --version", { shell: true }).stdout?.toString().trim();
if (!wranglerVersion) {
  console.log("Installing...");
  run("npm install -g wrangler");
} else {
  ok("wrangler", wranglerVersion);
}

// --- MCP servers ---

step("GitHub MCP server");
const claudeJson = `${homedir()}/.claude.json`;
const claudeConfig = existsSync(claudeJson) ? JSON.parse(readFileSync(claudeJson, "utf8")) : {};
const mcpServers = claudeConfig.mcpServers ?? {};
if (mcpServers.github?.url === "https://api.githubcopilot.com/mcp/") {
  console.log("    ✓ github → https://api.githubcopilot.com/mcp/");
} else {
  run("claude mcp add --transport http github https://api.githubcopilot.com/mcp/ --scope user");
  console.log(green("    + github → https://api.githubcopilot.com/mcp/"));
}

// --- git config ---

step("git config");
const expand = (p: string) => p.replace(/^~/, homedir());
const gitconfig = expand("~/.gitconfig");
const existingGitconfig = existsSync(gitconfig) ? readFileSync(gitconfig, "utf8") : "";
let remainder = existingGitconfig;

// credential helper — use macOS keychain
const credentialLabel = "credential.helper = osxkeychain";
if (/\[credential\][^[]*helper\s*=\s*osxkeychain/.test(remainder)) {
  console.log(`    ✓ ${credentialLabel}`);
} else {
  console.log(green(`    + ${credentialLabel}`));
  remainder += `[credential]\n\thelper = osxkeychain\n`;
}

// includeIf entries — per-directory identity, in sorted order
const includes: Array<{ dir: string; path: string }> = [
  { dir: "~/@aws/", path: "~/.gitconfig-aws" },
  { dir: "~/@piotrek/", path: "~/.gitconfig-piotrek" },
].sort((a, b) => a.dir.localeCompare(b.dir));

for (const { dir, path } of includes) {
  const label = `${dir} → ${path}`;
  const blockRegex = new RegExp(`\\[includeIf "gitdir:${dir.replace(/[.*+?^${}()|[\\\]\\\\]/g, "\\\\$&")}"\\]\\n\\tpath = (.*)\\n`);
  const match = remainder.match(blockRegex);
  if (!match) {
    console.log(green(`    + ${label}`));
  } else if (expand(match[1]) !== expand(path)) {
    console.log(green(`    ✓ ${label} (was ${match[1]})`));
  } else {
    console.log(`    ✓ ${label}`);
  }
  if (match) remainder = remainder.replace(blockRegex, "");
}
const sortedBlocks = includes.map(({ dir, path }) => `[includeIf "gitdir:${dir}"]\n\tpath = ${path}\n`).join("");

// write back
const gitconfigContents = sortedBlocks + remainder;
if (gitconfigContents !== existingGitconfig) writeFileSync(gitconfig, gitconfigContents);

// per-directory identity files
for (const { path } of includes) {
  const fsPath = expand(path);
  if (!existsSync(fsPath)) writeFileSync(fsPath, "");
  if (readFileSync(fsPath, "utf8").includes("[user]")) {
    console.log(`    ✓ ${path}`);
  } else {
    console.log(yellow(`    ! ${path} — add [user] name and email`));
  }
}

// --- .zprofile ---

step(".zprofile");
ensureInZprofile(`eval "$(/opt/homebrew/bin/brew shellenv zsh)"`);
ensureInZprofile(`eval "$(fnm env)"`);
ensureInZprofile(`export AWS_REGION=eu-west-2`);
ensureInZprofile(`export CLAUDE_CODE_USE_BEDROCK=1`);
ensureInZprofile(`export GIT_CONFIG_NOSYSTEM=1`);
ensureInZprofile(`export PATH="$HOME/.opencode/bin:$PATH"`);
ensureInZprofile(`export WRANGLER_HOME="$HOME/.wrangler"`);
ensureInZprofile(`alias kiro='/Applications/Kiro.app/Contents/Resources/app/bin/code'`);

step("Done!");
if (writeZprofile()) console.log("    ~/.zprofile was updated. Restart terminal or run: source ~/.zprofile");
