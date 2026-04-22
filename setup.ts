import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";

const run = (cmd: string) => spawnSync(cmd, { shell: true, stdio: "inherit" });
const exists = (cmd: string) => spawnSync(`command -v ${cmd}`, { shell: true }).status === 0;
const out = (cmd: string) => execSync(cmd).toString().trim();

const step = (label: string) => console.log(`\n>>> ${label}`);
const ok = (name: string, version: string) => console.log(`    ${name} ${version}`);

const zprofileLines = { evals: [], exports: [], aliases: [] };
const ensureInZprofile = (line: string) => {
  if (line.startsWith("eval ")) {
    if (!zprofileLines.evals.includes(line)) zprofileLines.evals.push(line);
  } else if (line.startsWith("export ")) {
    if (!zprofileLines.exports.includes(line)) zprofileLines.exports.push(line);
  } else if (line.startsWith("alias ")) {
    if (!zprofileLines.aliases.includes(line)) zprofileLines.aliases.push(line);
  }
};

const writeZprofile = () => {
  const zprofile = `${homedir()}/.zprofile`;
  const existingContents = existsSync(zprofile) ? readFileSync(zprofile, "utf8") : "";
  const newContents = [
    ...zprofileLines.evals,
    "",
    ...zprofileLines.exports.sort(),
    "",
    ...zprofileLines.aliases
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
ensureInZprofile(`eval "$(/opt/homebrew/bin/brew shellenv zsh)"`);

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

step("Go");
if (!exists("go")) {
  console.log("Installing...");
  run("brew install go");
} else {
  ok("go", out("go version").split(" ")[2].replace("go", ""));
}

step("jq");
if (!exists("jq")) {
  console.log("Installing...");
  run("brew install jq");
} else {
  ok("jq", out("jq --version").replace("jq-", ""));
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
ensureInZprofile(`alias kiro='/Applications/Kiro.app/Contents/Resources/app/bin/code'`);

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
  run(`curl -fsSL "https://zoom.us/client/latest/ZoomInstallerIT.pkg" -o /tmp/zoom.pkg`);
  run(`sudo installer -pkg /tmp/zoom.pkg -target /`);
  run(`rm /tmp/zoom.pkg`);
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
ensureInZprofile(`export CLAUDE_CODE_USE_BEDROCK=1`);
ensureInZprofile(`export AWS_REGION=eu-west-2`);

step("OpenCode");
const opencodeVersion = spawnSync("opencode --version", { shell: true }).stdout?.toString().trim();
if (!opencodeVersion) {
  console.log("Installing...");
  run("npm install -g opencode-ai");
} else {
  ok("opencode", opencodeVersion);
}
ensureInZprofile(`export PATH="$HOME/.opencode/bin:$PATH"`);
ensureInZprofile(`eval "$(fnm env)"`);

step("Wrangler");
const wranglerVersion = spawnSync("wrangler --version", { shell: true }).stdout?.toString().trim();
if (!wranglerVersion) {
  console.log("Installing...");
  run("npm install -g wrangler");
} else {
  ok("wrangler", wranglerVersion);
}
ensureInZprofile(`export WRANGLER_HOME="$HOME/.wrangler"`);

step("Done!");
if (writeZprofile()) console.log("    ~/.zprofile was updated. Restart terminal or run: source ~/.zprofile");
