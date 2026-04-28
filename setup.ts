import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir, platform } from "os";

const run = (cmd: string) => spawnSync(cmd, { shell: true, stdio: "inherit" });
const exists = (cmd: string) => spawnSync(`command -v ${cmd}`, { shell: true }).status === 0;
const out = (cmd: string) => execSync(cmd).toString().trim();

const step = (label: string) => console.log(`\n>>> ${label}`);
const ok = (name: string, version: string) => console.log(`    ${name} ${version}`);
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

const os = platform() === "darwin"
  ? { mac: true, brewPrefix: "/opt/homebrew", shell: "zsh", profile: `${homedir()}/.zprofile` }
  : { mac: false, brewPrefix: "/home/linuxbrew/.linuxbrew", shell: "bash", profile: `${homedir()}/.bash_profile` };

// --- Shell config ---
const existingProfile = existsSync(os.profile) ? readFileSync(os.profile, "utf8") : "";
const evals: string[] = [];
const envs: string[] = [];
const aliases: string[] = [];
const ensureInProfile = (line: string) => {
  const already = existingProfile.includes(line);
  console.log(`    ${already ? "✓" : "+"} ${line}`);
  if (line.startsWith("eval ")) {
    if (!evals.includes(line)) evals.push(line);
  } else if (line.startsWith("export ")) {
    if (!envs.includes(line)) envs.push(line);
  } else if (line.startsWith("alias ")) {
    if (!aliases.includes(line)) aliases.push(line);
  }
};

const writeProfile = () => {
  const newContents = [
    ...evals,
    "",
    ...envs.sort(),
    "",
    ...aliases
  ].join("\n") + "\n";

  if (existingProfile === newContents) return false;

  const oldLines = new Set(existingProfile.split("\n").filter(Boolean));
  const newLines = new Set(newContents.split("\n").filter(Boolean));
  for (const line of newLines) if (!oldLines.has(line)) console.log(green(`    + ${line}`));
  for (const line of oldLines) if (!newLines.has(line)) console.log(`    - ${line}`);

  writeFileSync(os.profile, newContents);
  return true;
};

// --- Prerequisites (installed by bootstrap.sh) ---

step("Homebrew");
ok("brew", out("brew --version").split(" ")[1]);

step("fnm");
ok("fnm", out("fnm --version"));

step("Node");
ok("node", `${out("node --version").replace("v", "")}, npm ${out("npm --version")}`);

// --- Brew CLIs ---

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

// --- Mac-only apps ---

if (os.mac) {
  step("Kiro CLI");
  if (!existsSync("/Applications/Kiro CLI.app")) {
    console.log("Installing...");
    run("brew install --cask kiro-cli");
  } else {
    ok("kiro-cli", out("defaults read '/Applications/Kiro CLI.app/Contents/Info.plist' CFBundleShortVersionString"));
  }

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
}

// --- npm globals ---

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

step("Lighthouse");
const lighthouseVersion = spawnSync("lighthouse --version", { shell: true }).stdout?.toString().trim();
if (!lighthouseVersion) {
  console.log("Installing...");
  run("npm install -g lighthouse");
} else {
  ok("lighthouse", lighthouseVersion);
}

step("npm-check-updates");
const ncuVersion = spawnSync("ncu --version", { shell: true }).stdout?.toString().trim();
if (!ncuVersion) {
  console.log("Installing...");
  run("npm install -g npm-check-updates");
} else {
  ok("ncu", ncuVersion);
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

// --- Claude Code settings ---

step("Claude Code settings");
const claudeSettings = `${homedir()}/.claude/settings.json`;
const existingClaudeSettings = existsSync(claudeSettings) ? JSON.parse(readFileSync(claudeSettings, "utf8")) : {};
const desiredClaudeSettings = {
  ...existingClaudeSettings,
  permissions: {
    ...existingClaudeSettings.permissions,
    allow: [
      "Bash(cat *)",
      "Bash(curl -s http://localhost*)",
      "Bash(diff *)",
      "Bash(find *)",
      "Bash(gh -R *)",
      "Bash(gh api *)",
      "Bash(gh issue list *)",
      "Bash(gh issue status *)",
      "Bash(gh issue view *)",
      "Bash(gh pr checks *)",
      "Bash(gh pr diff *)",
      "Bash(gh pr list *)",
      "Bash(gh pr status *)",
      "Bash(gh pr view *)",
      "Bash(gh release list *)",
      "Bash(gh release view *)",
      "Bash(gh repo view *)",
      "Bash(gh run list *)",
      "Bash(gh run view *)",
      "Bash(gh search *)",
      "Bash(git *)",
      "Bash(grep *)",
      "Bash(head *)",
      "Bash(jq *)",
      "Bash(lighthouse *)",
      "Bash(ls *)",
      "Bash(npm audit)",
      "Bash(npm explain *)",
      "Bash(npm ls *)",
      "Bash(npm outdated)",
      "Bash(npm test)",
      "Bash(npm view *)",
      "Bash(tail *)",
      "Bash(tree *)",
      "Bash(wc *)",
      "Bash(which *)",
    ],
  },
  hooks: {
    ...existingClaudeSettings.hooks,
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: `jq -r '.tool_input.command' | grep -q 'git.*push' && echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"contains git push"}}' || true`,
          },
        ],
      },
    ],
  },
};
const settingsChanged = JSON.stringify(existingClaudeSettings) !== JSON.stringify(desiredClaudeSettings);
if (settingsChanged) writeFileSync(claudeSettings, JSON.stringify(desiredClaudeSettings, null, 2) + "\n");
for (const key of ["allow", "deny", "ask"] as const) {
  const existing = new Set(existingClaudeSettings.permissions?.[key] ?? []);
  for (const rule of desiredClaudeSettings.permissions[key] ?? [])
    console.log(existing.has(rule) ? `    ✓ ${key} ${rule}` : green(`    + ${key} ${rule}`));
}
const existingHooks = existingClaudeSettings.hooks ?? {};
for (const [event, matchers] of Object.entries(desiredClaudeSettings.hooks) as [string, any[]][]) {
  for (const entry of matchers) {
    const label = entry.matcher ? `${event}(${entry.matcher})` : event;
    const existingMatchers = existingHooks[event] ?? [];
    const existed = existingMatchers.some((e: any) => JSON.stringify(e) === JSON.stringify(entry));
    console.log(existed ? `    ✓ hook ${label}` : green(`    + hook ${label}`));
  }
}

// --- git config ---

step("git config");
const expand = (p: string) => p.replace(/^~/, homedir());
const gitconfig = expand("~/.gitconfig");
const existingGitconfig = existsSync(gitconfig) ? readFileSync(gitconfig, "utf8") : "";
let remainder = existingGitconfig;

if (os.mac) {
  const credentialLabel = "credential.helper = osxkeychain";
  if (/\[credential\][^[]*helper\s*=\s*osxkeychain/.test(remainder)) {
    console.log(`    ✓ ${credentialLabel}`);
  } else {
    console.log(green(`    + ${credentialLabel}`));
    remainder += `[credential]\n\thelper = osxkeychain\n`;
  }
}

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

const gitconfigContents = sortedBlocks + remainder;
if (gitconfigContents !== existingGitconfig) writeFileSync(gitconfig, gitconfigContents);

for (const { path } of includes) {
  const fsPath = expand(path);
  if (!existsSync(fsPath)) writeFileSync(fsPath, "");
  if (readFileSync(fsPath, "utf8").includes("[user]")) {
    console.log(`    ✓ ${path}`);
  } else {
    console.log(yellow(`    ! ${path} — add [user] name and email`));
  }
}

// --- Shell profile ---

step(os.shell === "zsh" ? ".zprofile" : ".bash_profile");

ensureInProfile(`eval "$(${os.brewPrefix}/bin/brew shellenv ${os.shell})"`);
ensureInProfile(`eval "$(fnm env)"`);
ensureInProfile(`export AWS_REGION=eu-west-2`);
ensureInProfile(`export CLAUDE_CODE_USE_BEDROCK=1`);
ensureInProfile(`export GIT_CONFIG_NOSYSTEM=1`);
ensureInProfile(`export PATH="$HOME/.opencode/bin:$PATH"`);
ensureInProfile(`export WRANGLER_HOME="$HOME/.wrangler"`);
if (os.mac) {
  ensureInProfile(`alias kiro='/Applications/Kiro.app/Contents/Resources/app/bin/code'`);
}

step("Done!");
if (writeProfile()) console.log(`    ${os.profile} was updated. Restart terminal or run: source ${os.profile}`);
