import { execSync, spawn, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir, platform } from "os";

// --- Profile types ---

// setup.personal.ts (committed) and setup.work.ts (gitignored, optional) each default-export a Profile that
// lists what this script installs and configures. Their lists are combined. For a program defined in both,
// or a single value set in both, setup.work.ts wins.

// Repos under `dir` include the config file at `path`; `user` is the identity written into that file
export type GitInclude = { dir: string; path: string; user?: { name: string; email: string } };

// macOS app bundle, installed with `brew install --cask <cask>` when `appPath` doesn't exist
export type App = {
  name: string;
  cask: string;
  appPath: string;
  // Info.plist key holding the displayed version (default: CFBundleShortVersionString)
  versionKey?: string;
};

// Command-line tool, installed with `brew install <formula>` when `command` (default `name`) isn't on PATH.
// `formula` can be `--cask <cask>` for a cask that ships only a command, like kiro-cli.
export type Cli = {
  name: string;
  formula: string;
  command?: string;
  versionCmd: string;
  parseVersion?: (output: string) => string;
  mac?: boolean;
};

// Installed with `npm install -g <pkg>` when `versionCmd` prints nothing
export type NpmPackage = {
  name: string;
  pkg: string;
  cmd: string;
  versionCmd: string;
  parseVersion?: (output: string) => string;
};

// What to install, grouped apart from configuration
export type Programs = { apps?: App[]; clis?: Cli[]; npm?: NpmPackage[] };

export type ClaudeHook = { matcher?: string; hooks: Array<{ type: "command"; command: string }> };

// stdio MCP server, registered with `claude mcp add -s user` when ~/.claude.json doesn't list `name`
export type ClaudeMcp = { name: string; command: string; args?: string[] };

export type Profile = {
  programs?: Programs;
  claudeAllow?: string[];
  claudeHooks?: Record<string, ClaudeHook[]>;
  claudeMcp?: ClaudeMcp[];
  // GitHub "owner/repo" whose README is installed as ~/.claude/CLAUDE.md
  claudeMdReadme?: string;
  gitIncludes?: GitInclude[];
  macProfileLines?: string[];
  profileLines?: string[];
  sandboxDomains?: string[];
  sandboxExcludedCommands?: string[];
};

const fix = process.argv.includes("--fix") || process.argv.includes("-f");

// --- Profiles: everything to install and configure comes from these files ---

const loadProfile = async (file: string): Promise<Profile> => {
  const url = new URL(file, import.meta.url);
  return existsSync(url) ? (await import(url.href)).default : {};
};
const profiles = [await loadProfile("./setup.personal.ts"), await loadProfile("./setup.work.ts")];
const strings = (pick: (p: Profile) => string[] | undefined) => [...new Set(profiles.flatMap(p => pick(p) ?? []))];
// A later profile replaces an earlier entry with the same name
const byName = <T extends { name: string }>(pick: (p: Profile) => T[] | undefined) =>
  [...new Map(profiles.flatMap(p => pick(p) ?? []).map(item => [item.name, item] as const)).values()];
const claudeHooks: Record<string, ClaudeHook[]> = {};
for (const p of profiles) {
  for (const [event, entries] of Object.entries(p.claudeHooks ?? {})) claudeHooks[event] = [...(claudeHooks[event] ?? []), ...entries];
}
const profile = {
  programs: {
    apps: byName(p => p.programs?.apps),
    clis: byName(p => p.programs?.clis),
    npm: byName(p => p.programs?.npm),
  },
  claudeAllow: strings(p => p.claudeAllow),
  claudeHooks,
  claudeMcp: byName(p => p.claudeMcp),
  claudeMdReadme: profiles.reduce<string | undefined>((value, p) => p.claudeMdReadme ?? value, undefined),
  gitIncludes: profiles.flatMap(p => p.gitIncludes ?? []),
  macProfileLines: strings(p => p.macProfileLines),
  profileLines: strings(p => p.profileLines),
  sandboxDomains: strings(p => p.sandboxDomains).sort(),
  sandboxExcludedCommands: strings(p => p.sandboxExcludedCommands),
};
const appVersionCmd = (app: App) =>
  `defaults read "${app.appPath}/Contents/Info.plist" ${app.versionKey ?? "CFBundleShortVersionString"}`;

const run = (cmd: string) => spawnSync(cmd, { shell: true, stdio: "inherit" });
// TERM=dumb makes brew print one line per finished download instead of redrawing progress frames,
// which pile up in output panes that ignore cursor moves
const brew = "TERM=dumb brew";
const exists = (cmd: string) => spawnSync(`command -v ${cmd}`, { shell: true }).status === 0;
const out = (cmd: string) => execSync(cmd).toString().trim();
const prefetch = (cmd: string) => {
  let buf = "";
  const child = spawn(cmd, { shell: true, stdio: ["ignore", "pipe", "ignore"] });
  child.stdout.on("data", (chunk: Buffer) => { buf += chunk.toString(); });
  return new Promise<string>(resolve => child.on("close", () => resolve(buf.trim())));
};

// Prefetch all slow checks immediately, await results where needed
const prefetched = new Map<string, Promise<string>>();
const prefetchAll = (...cmds: string[]) => cmds.forEach(cmd => prefetched.set(cmd, prefetch(cmd)));
const get = (cmd: string) => prefetched.get(cmd)!;

prefetchAll(
  // brew outdated reads brew's cached package index, so refresh it first or new releases go unnoticed
  "brew update --quiet >/dev/null; brew outdated --verbose",
  "npm outdated -g --parseable",

  ...profile.programs.clis.map(cli => cli.versionCmd),
  ...profile.programs.apps.map(appVersionCmd),
);

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
ok("fnm", out("fnm --version").replace("fnm ", ""));

step("Node.js LTS");
const currentNode = out("node --version").replace("v", "");
const latestLts = out("fnm ls-remote --lts | tail -1").replace("v", "").split(" ")[0];
// Set when this run installs a new Node. fnm gives each version its own
// lib/node_modules and this shell's PATH still points at the old version, so
// npm globals must be reinstalled into the new one explicitly (see below).
let nodeUpgraded = false;
if (currentNode === latestLts) {
  ok("node", `${currentNode} (latest LTS), npm ${out("npm --version")}`);
} else {
  console.log(`    ${yellow(`node ${currentNode} → ${latestLts} available`)}`);
  issues++;
  if (fix) {
    run("fnm install --lts");
    run("fnm default lts-latest");
    nodeUpgraded = true;
  }
}

// --- Brew CLIs ---

const cliChecks = await Promise.all(profile.programs.clis.filter(cli => os.mac || !cli.mac).map(async cli => ({
  ...cli,
  installed: exists(cli.command ?? cli.name),
  version: await get(cli.versionCmd).catch(() => ""),
})));

for (const cli of cliChecks) {
  step(cli.name);
  if (!cli.installed) {
    missing(cli.name);
    issues++;
    if (fix) run(`${brew} install ${cli.formula}`);
  } else {
    ok(cli.name, cli.parseVersion ? cli.parseVersion(cli.version) : cli.version);
  }
}

// --- Mac-only apps ---

if (os.mac) {
  const appChecks = await Promise.all(profile.programs.apps.map(async app => ({
    ...app,
    installed: existsSync(app.appPath),
    version: await get(appVersionCmd(app)).catch(() => ""),
  })));

  for (const app of appChecks) {
    step(app.name);
    if (!app.installed) {
      missing(app.name);
      issues++;
      if (fix) run(`${brew} install --cask ${app.cask}`);
    } else {
      ok(app.name, app.version);
    }
  }
}

// --- npm globals ---

const npmChecks = await Promise.all(profile.programs.npm.map(async pkg => ({
  ...pkg,
  version: await prefetch(pkg.versionCmd).catch(() => ""),
})));

const missingNpmPkgs: string[] = [];
for (const pkg of npmChecks) {
  step(pkg.name);
  const version = pkg.parseVersion ? pkg.parseVersion(pkg.version) : pkg.version;
  if (!version) {
    missing(pkg.name);
    issues++;
    missingNpmPkgs.push(pkg.pkg);
  } else {
    ok(pkg.cmd, version);
  }
}
if (fix && nodeUpgraded) {
  // The checks above ran against the outgoing Node, so missingNpmPkgs says
  // nothing about the new version. Install the whole list into it.
  run(`fnm exec --using=lts-latest npm install -g ${profile.programs.npm.map(pkg => pkg.pkg).join(" ")}`);
} else if (fix && missingNpmPkgs.length) {
  run(`npm install -g ${missingNpmPkgs.join(" ")}`);
}


// --- Outdated ---

step("Homebrew outdated");
const brewOutdated = await get("brew update --quiet >/dev/null; brew outdated --verbose");
if (brewOutdated) {
  for (const line of brewOutdated.split("\n")) console.log(`    ${yellow(line)}`);
  issues += brewOutdated.split("\n").length;
  if (fix) run(`yes | ${brew} upgrade`);
} else {
  console.log("    All formulae and casks up to date");
}

step("npm globals outdated");
const npmOutdated = await prefetch("npm outdated -g --parseable");
if (npmOutdated) {
  const outdatedPkgs: string[] = [];
  for (const line of npmOutdated.split("\n")) {
    const parts = line.split(":");
    const current = parts[2];
    const latest = parts[3];
    const name = current.replace(/@[^@]+$/, "");
    const currentVer = current.split("@").pop();
    const latestVer = latest.split("@").pop();
    console.log(`    ${yellow(`${name} ${currentVer} → ${latestVer}`)}`);
    outdatedPkgs.push(name);
  }
  issues += outdatedPkgs.length;
  // On a Node upgrade these versions describe the outgoing version's globals,
  // which the fresh install above already superseded with @latest.
  if (fix && !nodeUpgraded) run(`npm install -g ${outdatedPkgs.join(" ")}`);
} else {
  console.log("    All global packages up to date");
}


// --- Claude Code settings ---

step("Claude Code settings");
const claudeSettings = `${homedir()}/.claude/settings.json`;
const existingClaudeSettings = existsSync(claudeSettings) ? JSON.parse(readFileSync(claudeSettings, "utf8")) : {};
const desiredClaudeSettings = {
  ...existingClaudeSettings,
  permissions: {
    ...existingClaudeSettings.permissions,
    allow: profile.claudeAllow,
  },
  sandbox: {
    ...existingClaudeSettings.sandbox,
    excludedCommands: profile.sandboxExcludedCommands,
    network: {
      ...existingClaudeSettings.sandbox?.network,
      // tsx opens a local IPC socket
      allowLocalBinding: true,
      allowedDomains: profile.sandboxDomains,
    },
  },
  hooks: {
    ...existingClaudeSettings.hooks,
    ...profile.claudeHooks,
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
      issues++;
    }
  }
}
const existingDomains = new Set(existingClaudeSettings.sandbox?.network?.allowedDomains ?? []);
for (const domain of desiredClaudeSettings.sandbox.network.allowedDomains) {
  if (existingDomains.has(domain)) {
    console.log(`    ✓ sandbox domain ${domain}`);
  } else {
    console.log(fix ? green(`    + sandbox domain ${domain}`) : `    ${red(`missing sandbox domain ${domain}`)}`);
    issues++;
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
      issues++;
    }
  }
}

// --- Claude Code MCP servers ---

step("Claude Code MCP servers");
const claudeJson = `${homedir()}/.claude.json`;
const existingMcp = existsSync(claudeJson) ? JSON.parse(readFileSync(claudeJson, "utf8")).mcpServers ?? {} : {};
for (const server of profile.claudeMcp) {
  if (existingMcp[server.name]) {
    console.log(`    ✓ ${server.name}`);
    continue;
  }
  console.log(fix ? green(`    + ${server.name}`) : `    ${red(`missing ${server.name}`)}`);
  issues++;
  if (fix) run(`claude mcp add -s user ${server.name} -- ${[server.command, ...(server.args ?? [])].join(" ")}`);
}

// --- Claude Code CLAUDE.md ---

step("Claude Code CLAUDE.md");
const claudeMd = `${homedir()}/.claude/CLAUDE.md`;
if (existsSync(claudeMd)) {
  console.log(`    ✓ ${claudeMd}`);
} else if (!profile.claudeMdReadme) {
  console.log(`    ${yellow(`! ${claudeMd} missing — set claudeMdReadme in setup.personal.ts to install one`)}`);
} else {
  console.log(fix ? green(`    + ${claudeMd}`) : `    ${red(`missing ${claudeMd}`)}`);
  issues++;
  if (fix) {
    const result = spawnSync(
      `gh api repos/${profile.claudeMdReadme}/readme -H 'Accept: application/vnd.github.raw'`,
      { shell: true, encoding: "utf8" },
    );
    if (result.status === 0 && result.stdout) {
      writeFileSync(claudeMd, result.stdout);
    } else {
      console.log(`    ${red("failed to fetch README — ensure gh is authenticated: gh auth login")}`);
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
    issues++;
    remainder += `[credential]\n\thelper = osxkeychain\n`;
  }
}

// Without this, repos outside the includeIf folders get an identity guessed from login and hostname
const useConfigOnlyLabel = "user.useConfigOnly = true";
if (/\[user\][^[]*useConfigOnly\s*=\s*true/i.test(remainder)) {
  console.log(`    ✓ ${useConfigOnlyLabel}`);
} else {
  console.log(fix ? green(`    + ${useConfigOnlyLabel}`) : `    ${red(`missing ${useConfigOnlyLabel}`)}`);
  issues++;
  remainder += `[user]\n\tuseConfigOnly = true\n`;
}

const includes: GitInclude[] = [...profile.gitIncludes].sort((a, b) => a.dir.localeCompare(b.dir));

for (const { dir, path } of includes) {
  const label = `${dir} → ${path}`;
  const blockRegex = new RegExp(`\\[includeIf "gitdir:${dir.replace(/[.*+?^${}()|[\\\]\\\\]/g, "\\\\$&")}"\\]\\n\\tpath = (.*)\\n`);
  const match = remainder.match(blockRegex);
  if (!match) {
    console.log(fix ? green(`    + ${label}`) : `    ${red(`missing ${label}`)}`);
    issues++;
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

// One entry per included file; the first include that names a user decides that file's identity
const includeFiles = new Map<string, GitInclude["user"]>();
for (const { path, user } of includes) includeFiles.set(path, includeFiles.get(path) ?? user);

for (const [path, user] of includeFiles) {
  const fsPath = expand(path);
  const existing = existsSync(fsPath) ? readFileSync(fsPath, "utf8") : "";
  if (!user) {
    if (fix && !existsSync(fsPath)) writeFileSync(fsPath, "");
    if (existing.includes("[user]")) console.log(`    ✓ ${path}`);
    else console.log(`    ${yellow(`! ${path} — add [user] name and email`)}`);
    continue;
  }
  const label = `${path} — ${user.name} <${user.email}>`;
  const userBlock = `[user]\n\tname = ${user.name}\n\temail = ${user.email}\n`;
  if (existing.includes(userBlock)) {
    console.log(`    ✓ ${label}`);
    continue;
  }
  console.log(fix ? green(`    + ${label}`) : `    ${red(`missing ${label}`)}`);
  issues++;
  // Replace an existing [user] section (header plus its indented lines), otherwise prepend one
  const userSection = /\[user\]\n(?:[ \t]+[^\n]*\n?)*/;
  if (fix) writeFileSync(fsPath, userSection.test(existing) ? existing.replace(userSection, userBlock) : userBlock + existing);
}

// --- Shell profile ---

const existingProfile = existsSync(os.profile) ? readFileSync(os.profile, "utf8") : "";
const missingEvals: string[] = [];
const missingEnvs: string[] = [];
const missingAliases: string[] = [];
const missingFunctions: string[] = [];
const ensureInProfile = (line: string) => {
  const already = existingProfile.includes(line);
  console.log(`    ${already ? "✓" : fix ? "+" : red("missing")} ${line}`);
  if (already) return;
  issues++;
  if (line.startsWith("eval ")) missingEvals.push(line);
  else if (line.startsWith("export ")) missingEnvs.push(line);
  else if (line.startsWith("alias ")) missingAliases.push(line);
  else missingFunctions.push(line);
};

const appendToProfile = () => {
  const linesToAdd = [...missingEvals, ...missingEnvs.sort(), ...missingAliases, ...missingFunctions];
  if (linesToAdd.length === 0) return false;
  const suffix = "\n" + linesToAdd.join("\n") + "\n";
  for (const line of linesToAdd) console.log(green(`    + ${line}`));
  writeFileSync(os.profile, existingProfile.trimEnd() + suffix);
  return true;
};

step(os.shell === "zsh" ? ".zprofile" : ".bash_profile");

ensureInProfile(`eval "$(${os.brewPrefix}/bin/brew shellenv ${os.shell})"`);
ensureInProfile(`eval "$(fnm env)"`);
for (const line of profile.profileLines) ensureInProfile(line);
if (os.mac) for (const line of profile.macProfileLines) ensureInProfile(line);

if (fix && appendToProfile()) console.log(`    ${os.profile} was updated. Restart terminal or run: source ${os.profile}`);

// --- Summary ---

console.log();
if (issues > 0) {
  console.log(fix ? green("Fixed!") : red(`${issues} issue${issues > 1 ? "s" : ""} found. Run with --fix / -f to resolve.`));
} else {
  console.log(green("Everything up to date"));
}
