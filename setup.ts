import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir, platform } from "os";
import { installDmg } from "./lib/dmg";

const fix = process.argv.includes("--fix") || process.argv.includes("-f");
const run = (cmd: string) => spawnSync(cmd, { shell: true, stdio: "inherit" });
const exists = (cmd: string) => spawnSync(`command -v ${cmd}`, { shell: true }).status === 0;
const out = (cmd: string) => execSync(cmd).toString().trim();

const step = (label: string) => console.log(`\n>>> ${label}`);
const ok = (name: string, version: string) => console.log(`    ${name} ${version}`);
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const missing = (name: string) => console.log(`    ${red(`${name} not installed`)}`);

let issues = 0;

const os = platform() === "darwin"
  ? { mac: true, brewPrefix: "/opt/homebrew", shell: "zsh", profile: `${homedir()}/.zprofile` }
  : { mac: false, brewPrefix: "/home/linuxbrew/.linuxbrew", shell: "bash", profile: `${homedir()}/.bash_profile` };

// --- Prerequisites (installed by bootstrap.sh) ---

step("Homebrew");
ok("brew", out("brew --version").split(" ")[1]);

step("fnm");
ok("fnm", out("fnm --version"));

step("Node.js LTS");
const currentNode = out("node --version").replace("v", "");
const latestLts = out("fnm ls-remote --lts | tail -1").replace("v", "").split(" ")[0];
if (currentNode === latestLts) {
  ok("node", `${currentNode} (latest LTS), npm ${out("npm --version")}`);
} else {
  console.log(`    ${yellow(`node ${currentNode} → ${latestLts} available`)}`);
  issues++;
  if (fix) {
    run("fnm install --lts");
    run("fnm default lts-latest");
  }
}

// --- Brew CLIs ---

const brewClis: Array<{ name: string; formula: string; version: () => string }> = [
  { name: "aws", formula: "awscli", version: () => out("aws --version").split(" ")[0].split("/")[1] },
  { name: "gh", formula: "gh", version: () => out("gh --version").split(" ")[2] },
  { name: "git-secrets", formula: "git-secrets", version: () => out("brew list --versions git-secrets").split(" ")[1] },
  { name: "go", formula: "go", version: () => out("go version").split(" ")[2].replace("go", "") },
];

for (const cli of brewClis) {
  step(cli.name);
  if (!exists(cli.name)) {
    missing(cli.name);
    issues++;
    if (fix) run(`brew install ${cli.formula}`);
  } else {
    ok(cli.name, cli.version());
  }
}

// --- Mac-only apps ---

if (os.mac) {
  const caskApps: Array<{ name: string; appPath: string; cask: string; version: () => string }> = [
    { name: "Claude Desktop", appPath: "/Applications/Claude.app", cask: "claude", version: () => out("defaults read /Applications/Claude.app/Contents/Info.plist CFBundleShortVersionString") },
    { name: "Kiro CLI", appPath: "/Applications/Kiro CLI.app", cask: "kiro-cli", version: () => out("defaults read '/Applications/Kiro CLI.app/Contents/Info.plist' CFBundleShortVersionString") },
    { name: "Ollama", appPath: "/Applications/Ollama.app", cask: "ollama", version: () => out("defaults read /Applications/Ollama.app/Contents/Info.plist CFBundleShortVersionString") },
    { name: "Zoom", appPath: "/Applications/zoom.us.app", cask: "zoom", version: () => out("defaults read /Applications/zoom.us.app/Contents/Info.plist CFBundleVersion") },
  ];

  for (const app of caskApps) {
    step(app.name);
    if (!existsSync(app.appPath)) {
      missing(app.name);
      issues++;
      if (fix) run(`brew install --cask ${app.cask}`);
    } else {
      ok(app.name, app.version());
    }
  }

  step("Kiro IDE");
  const kiroInstalled = existsSync("/Applications/Kiro.app");
  const kiroPage = out("curl -fsSL https://kiro.dev/downloads/");
  const kiroMatch = kiroPage.match(/Latest IDE([\d.]+)/);
  if (!kiroInstalled) {
    missing("Kiro IDE");
    issues++;
    if (fix && kiroMatch) {
      const arch = out("uname -m") === "arm64" ? "arm64" : "x64";
      const version = kiroMatch[1];
      const dmg = `kiro-ide-${version}-stable-darwin-${arch}.dmg`;
      const url = `https://prod.download.desktop.kiro.dev/releases/stable/darwin-${arch}/signed/${version}/${dmg}`;
      installDmg("Kiro", url, dmg);
      console.log("    Sign in with AWS in Kiro to configure SSO before continuing.");
    }
  } else {
    const installed = out("defaults read /Applications/Kiro.app/Contents/Info.plist CFBundleShortVersionString");
    if (kiroMatch && kiroMatch[1] !== installed) {
      console.log(`    ${yellow(`Kiro IDE ${installed} → ${kiroMatch[1]} available`)}`);
      issues++;
      if (fix) {
        const arch = out("uname -m") === "arm64" ? "arm64" : "x64";
        const version = kiroMatch[1];
        const dmg = `kiro-ide-${version}-stable-darwin-${arch}.dmg`;
        const url = `https://prod.download.desktop.kiro.dev/releases/stable/darwin-${arch}/signed/${version}/${dmg}`;
        installDmg("Kiro", url, dmg);
      }
    } else {
      ok("Kiro IDE", installed);
    }
  }

  step("Vowen");
  const vowenInstalled = existsSync("/Applications/Vowen.app");
  const vowenPage = out("curl -fsSL https://vowen.ai/");
  const vowenMatch = vowenPage.match(/Vowen-([\d.]+)-arm64\.dmg/);
  if (!vowenInstalled) {
    missing("Vowen");
    issues++;
    if (fix && vowenMatch) {
      const version = vowenMatch[1];
      const dmg = `Vowen-${version}-arm64.dmg`;
      installDmg("Vowen", `https://assets.vowen.ai/${dmg}`, dmg);
    }
  } else {
    const installed = out("defaults read /Applications/Vowen.app/Contents/Info.plist CFBundleShortVersionString");
    if (vowenMatch && vowenMatch[1] !== installed) {
      console.log(`    ${yellow(`Vowen ${installed} → ${vowenMatch[1]} available`)}`);
      issues++;
      if (fix) {
        const version = vowenMatch[1];
        const dmg = `Vowen-${version}-arm64.dmg`;
        installDmg("Vowen", `https://assets.vowen.ai/${dmg}`, dmg);
      }
    } else {
      ok("Vowen", installed);
    }
  }
}

// --- npm globals ---

const npmGlobals: Array<{ name: string; pkg: string; cmd: string; version: () => string }> = [
  { name: "AWS CDK", pkg: "aws-cdk", cmd: "cdk", version: () => spawnSync("cdk --version", { shell: true }).stdout?.toString().trim().split(" ")[0] },
  { name: "Claude Code", pkg: "@anthropic-ai/claude-code", cmd: "claude", version: () => spawnSync("claude --version", { shell: true }).stdout?.toString().trim().split(" ")[0] },
  { name: "Lighthouse", pkg: "lighthouse", cmd: "lighthouse", version: () => spawnSync("lighthouse --version", { shell: true }).stdout?.toString().trim() },
  { name: "npm-check-updates", pkg: "npm-check-updates", cmd: "ncu", version: () => spawnSync("ncu --version", { shell: true }).stdout?.toString().trim() },
  { name: "OpenCode", pkg: "opencode-ai", cmd: "opencode", version: () => spawnSync("opencode --version", { shell: true }).stdout?.toString().trim() },
  { name: "Wrangler", pkg: "wrangler", cmd: "wrangler", version: () => spawnSync("wrangler --version", { shell: true }).stdout?.toString().trim() },
];

for (const g of npmGlobals) {
  step(g.name);
  const v = g.version();
  if (!v) {
    missing(g.name);
    issues++;
    if (fix) run(`npm install -g ${g.pkg}`);
  } else {
    ok(g.cmd, v);
  }
}

// --- Outdated ---

step("Homebrew outdated");
const brewOutdated = spawnSync("brew outdated --verbose", { shell: true }).stdout?.toString().trim();
if (brewOutdated) {
  for (const line of brewOutdated.split("\n")) console.log(`    ${yellow(line)}`);
  issues += brewOutdated.split("\n").length;
  if (fix) run("brew upgrade");
} else {
  console.log("    All formulae and casks up to date");
}

step("npm globals outdated");
const npmOutdated = spawnSync("npm outdated -g --long", { shell: true }).stdout?.toString().trim();
if (npmOutdated) {
  for (const line of npmOutdated.split("\n")) console.log(`    ${yellow(line)}`);
  issues += npmOutdated.split("\n").length - 1;
  if (fix) run("npm update -g");
} else {
  console.log("    All global packages up to date");
}

// --- MCP servers ---

step("GitHub MCP server");
const claudeJson = `${homedir()}/.claude.json`;
const claudeConfig = existsSync(claudeJson) ? JSON.parse(readFileSync(claudeJson, "utf8")) : {};
const mcpServers = claudeConfig.mcpServers ?? {};
if (mcpServers.github?.url === "https://api.githubcopilot.com/mcp/") {
  console.log("    ✓ github → https://api.githubcopilot.com/mcp/");
} else {
  console.log(`    ${red("github MCP server not configured")}`);
  issues++;
  if (fix) {
    run("claude mcp add --transport http github https://api.githubcopilot.com/mcp/ --scope user");
    console.log(green("    + github → https://api.githubcopilot.com/mcp/"));
  }
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
if (fix && settingsChanged) writeFileSync(claudeSettings, JSON.stringify(desiredClaudeSettings, null, 2) + "\n");
for (const key of ["allow", "deny", "ask"] as const) {
  const existing = new Set(existingClaudeSettings.permissions?.[key] ?? []);
  for (const rule of desiredClaudeSettings.permissions[key] ?? []) {
    if (existing.has(rule)) {
      console.log(`    ✓ ${key} ${rule}`);
    } else {
      console.log(fix ? green(`    + ${key} ${rule}`) : `    ${red(`missing ${key} ${rule}`)}`);
      if (!fix) issues++;
    }
  }
}
const existingHooks = existingClaudeSettings.hooks ?? {};
for (const [event, matchers] of Object.entries(desiredClaudeSettings.hooks) as [string, any[]][]) {
  for (const entry of matchers) {
    const label = entry.matcher ? `${event}(${entry.matcher})` : event;
    const existingMatchers = existingHooks[event] ?? [];
    const existed = existingMatchers.some((e: any) => JSON.stringify(e) === JSON.stringify(entry));
    if (existed) {
      console.log(`    ✓ hook ${label}`);
    } else {
      console.log(fix ? green(`    + hook ${label}`) : `    ${red(`missing hook ${label}`)}`);
      if (!fix) issues++;
    }
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
    console.log(fix ? green(`    + ${credentialLabel}`) : `    ${red(`missing ${credentialLabel}`)}`);
    if (!fix) issues++;
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
    console.log(fix ? green(`    + ${label}`) : `    ${red(`missing ${label}`)}`);
    if (!fix) issues++;
  } else if (expand(match[1]) !== expand(path)) {
    console.log(green(`    ✓ ${label} (was ${match[1]})`));
  } else {
    console.log(`    ✓ ${label}`);
  }
  if (match) remainder = remainder.replace(blockRegex, "");
}
const sortedBlocks = includes.map(({ dir, path }) => `[includeIf "gitdir:${dir}"]\n\tpath = ${path}\n`).join("");

const gitconfigContents = sortedBlocks + remainder;
if (fix && gitconfigContents !== existingGitconfig) writeFileSync(gitconfig, gitconfigContents);

for (const { path } of includes) {
  const fsPath = expand(path);
  if (fix && !existsSync(fsPath)) writeFileSync(fsPath, "");
  if (existsSync(fsPath) && readFileSync(fsPath, "utf8").includes("[user]")) {
    console.log(`    ✓ ${path}`);
  } else {
    console.log(`    ${yellow(`! ${path} — add [user] name and email`)}`);
  }
}

// --- Shell profile ---

const existingProfile = existsSync(os.profile) ? readFileSync(os.profile, "utf8") : "";
const evals: string[] = [];
const envs: string[] = [];
const aliases: string[] = [];
const ensureInProfile = (line: string) => {
  const already = existingProfile.includes(line);
  console.log(`    ${already ? "✓" : fix ? "+" : red("missing")} ${line}`);
  if (!already && !fix) issues++;
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

if (fix && writeProfile()) console.log(`    ${os.profile} was updated. Restart terminal or run: source ${os.profile}`);

// --- Summary ---

console.log();
if (issues > 0) {
  console.log(fix ? green("Fixed!") : red(`${issues} issue${issues > 1 ? "s" : ""} found. Run with --fix / -f to resolve.`));
} else {
  console.log(green("Everything up to date"));
}
