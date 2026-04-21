import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";

const run = (cmd: string) => spawnSync(cmd, { shell: true, stdio: "inherit" });
const exists = (cmd: string) => {
  const r = spawnSync(`command -v ${cmd}`, { shell: true });
  return r.status === 0;
};

let zprofileModified = false;

const ensureInZprofile = (line: string) => {
  const zprofile = `${homedir()}/.zprofile`;
  const contents = existsSync(zprofile) ? readFileSync(zprofile, "utf8") : "";
  if (!contents.includes(line)) {
    writeFileSync(zprofile, contents + `\n${line}\n`);
    console.log(`Added to ~/.zprofile: ${line}`);
    zprofileModified = true;
  } else {
    console.log(`Already in ~/.zprofile: ${line}`);
  }
};

const step = (label: string) => console.log(`\n>>> ${label}`);

// Homebrew
step("Homebrew");
if (!exists("brew")) {
  console.log("Installing Homebrew...");
  run('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
  run('eval "$(/opt/homebrew/bin/brew shellenv)"');
} else {
  console.log(`Already installed: ${execSync("brew --version").toString().trim().split("\n")[0]}`);
}

// gh CLI
step("gh CLI");
if (!exists("gh")) {
  console.log("Installing gh...");
  run("brew install gh");
} else {
  console.log(`Already installed: ${execSync("gh --version").toString().trim().split("\n")[0]}`);
}

// Claude Code
step("Claude Code CLI");
if (!exists("claude")) {
  console.log("Installing Claude Code...");
  run("npm install -g @anthropic-ai/claude-code");
} else {
  console.log(`Already installed: ${execSync("claude --version 2>/dev/null || echo unknown").toString().trim()}`);
}

// OpenCode
step("OpenCode CLI");
if (!exists("opencode")) {
  console.log("Installing OpenCode...");
  run("curl -fsSL https://opencode.ai/install | bash");
} else {
  console.log(`Already installed: ${execSync("opencode --version 2>/dev/null || echo unknown").toString().trim()}`);
}
ensureInZprofile(`export PATH="$HOME/.opencode/bin:$PATH"`);

// Kiro IDE
step("Kiro IDE");
if (!existsSync("/Applications/Kiro.app")) {
  console.log("Installing Kiro IDE...");
  const arch = execSync("uname -m").toString().trim() === "arm64" ? "arm64" : "x64";
  const page = execSync("curl -fsSL https://kiro.dev/downloads/").toString();
  const match = page.match(/Latest IDE([\d.]+)/);
  if (!match) throw new Error("Could not determine latest Kiro version");
  const version = match[1];
  const dmg = `kiro-ide-${version}-stable-darwin-${arch}.dmg`;
  const url = `https://prod.download.desktop.kiro.dev/releases/stable/darwin-${arch}/signed/${version}/${dmg}`;
  console.log(`Downloading Kiro ${version}...`);
  run(`curl -fsSL "${url}" -o /tmp/${dmg}`);
  run(`hdiutil attach /tmp/${dmg} -quiet`);
  run(`cp -R "/Volumes/Kiro/Kiro.app" /Applications/`);
  run(`hdiutil detach "/Volumes/Kiro" -quiet`);
  run(`rm /tmp/${dmg}`);
  console.log("Kiro installed to /Applications/Kiro.app");
} else {
  console.log("Already installed: Kiro.app");
}
ensureInZprofile(`alias kiro='/Applications/Kiro.app/Contents/Resources/app/bin/code'`);

step("Done!");
if (zprofileModified) console.log("Run `source ~/.zprofile` to apply PATH changes in the current session.");
