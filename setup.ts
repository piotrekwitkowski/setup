import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";

const run = (cmd: string) => spawnSync(cmd, { shell: true, stdio: "inherit" });
const exists = (cmd: string) => spawnSync(`command -v ${cmd}`, { shell: true }).status === 0;
const out = (cmd: string) => execSync(cmd).toString().trim();

const step = (label: string) => console.log(`\n>>> ${label}`);
const ok = (name: string, version: string) => console.log(`    ${name} ${version}`);

let zprofileModified = false;
const ensureInZprofile = (line: string) => {
  const zprofile = `${homedir()}/.zprofile`;
  const contents = existsSync(zprofile) ? readFileSync(zprofile, "utf8") : "";
  if (!contents.includes(line)) {
    writeFileSync(zprofile, contents + `\n${line}\n`);
    zprofileModified = true;
  }
};

// Homebrew
step("Homebrew");
if (!exists("brew")) {
  console.log("Installing...");
  run('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
  run('eval "$(/opt/homebrew/bin/brew shellenv)"');
} else {
  ok("brew", out("brew --version").split(" ")[1]);
}

// gh CLI
step("gh CLI");
if (!exists("gh")) {
  console.log("Installing...");
  run("brew install gh");
} else {
  ok("gh", out("gh --version").split(" ")[2]);
}

// Kiro IDE (install before Claude/OpenCode so AWS SSO is configured)
step("Kiro IDE");
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
  run(`cp -R "/Volumes/Kiro/Kiro.app" /Applications/`);
  run(`hdiutil detach "/Volumes/Kiro" -quiet`);
  run(`rm /tmp/${dmg}`);
  ok("Kiro", version);
  console.log("    Sign in with AWS in Kiro to configure SSO before continuing.");
} else {
  ok("Kiro", out("defaults read /Applications/Kiro.app/Contents/Info.plist CFBundleShortVersionString"));
}
ensureInZprofile(`alias kiro='/Applications/Kiro.app/Contents/Resources/app/bin/code'`);

// Vowen
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
  const volume = out(`ls /Volumes | grep -i vowen`);
  run(`cp -R "/Volumes/${volume}/Vowen.app" /Applications/`);
  run(`hdiutil detach "/Volumes/${volume}" -quiet`);
  run(`rm /tmp/${dmg}`);
  ok("Vowen", version);
} else {
  ok("Vowen", out("defaults read /Applications/Vowen.app/Contents/Info.plist CFBundleShortVersionString"));
}


// Zoom
step("Zoom");
if (!existsSync("/Applications/zoom.us.app")) {
  console.log("Installing...");
  run(`curl -fsSL "https://zoom.us/client/latest/ZoomInstallerIT.pkg" -o /tmp/zoom.pkg`);
  run(`sudo installer -pkg /tmp/zoom.pkg -target /`);
  run(`rm /tmp/zoom.pkg`);
  ok("Zoom", out("defaults read /Applications/zoom.us.app/Contents/Info.plist CFBundleVersion"));
} else {
  ok("Zoom", out("defaults read /Applications/zoom.us.app/Contents/Info.plist CFBundleVersion"));
}


// Claude Code
step("Claude Code");
const claudeVersion = spawnSync("claude --version", { shell: true }).stdout?.toString().trim().split(" ")[0];
if (!claudeVersion) {
  console.log("Installing...");
  run("npm install -g @anthropic-ai/claude-code");
} else {
  ok("claude", claudeVersion);
}

// OpenCode
step("OpenCode");
if (!exists("opencode")) {
  console.log("Installing...");
  run("curl -fsSL https://opencode.ai/install | bash");
} else {
  ok("opencode", out("opencode --version 2>/dev/null"));
}
ensureInZprofile(`export PATH="$HOME/.opencode/bin:$PATH"`);
ensureInZprofile(`eval "$(fnm env)"`);

step("Done!");
if (zprofileModified) console.log("    Run `source ~/.zprofile` to apply PATH changes.");
