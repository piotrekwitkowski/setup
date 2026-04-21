import { execSync, spawnSync } from "child_process";

const run = (cmd: string) => spawnSync(cmd, { shell: true, stdio: "inherit" });
const exists = (cmd: string) => {
  const r = spawnSync(`command -v ${cmd}`, { shell: true });
  return r.status === 0;
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

step("Done!");
console.log(`
Add to ~/.zprofile if not already present:

  export PATH="$HOME/.opencode/bin:$PATH"
`);
