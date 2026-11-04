import { execSync, spawn, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir, platform } from "os";
import type { Extras } from "./lib/extras";

const fix = process.argv.includes("--fix") || process.argv.includes("-f");
const workFile = new URL("./setup.work.ts", import.meta.url);
const extras: Extras = existsSync(workFile) ? (await import(workFile.href)).default : {};
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

  "aws --version",
  "codex --version",
  "gh --version",
  "brew list --versions git-secrets",
  "glab --version",
  "go version",
  "kiro-cli --version",
  "tofu --version",
  "defaults read /Applications/Claude.app/Contents/Info.plist CFBundleShortVersionString",
  "defaults read /Applications/Kiro.app/Contents/Info.plist CFBundleShortVersionString",
  "defaults read /Applications/Ollama.app/Contents/Info.plist CFBundleShortVersionString",
  "defaults read /Applications/zoom.us.app/Contents/Info.plist CFBundleVersion",

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

const brewClis: Array<{ name: string; formula: string; versionCmd: string; parseVersion: (output: string) => string; mac?: boolean }> = [
  { name: "aws", formula: "awscli", versionCmd: "aws --version", parseVersion: output => output.split(" ")[0].split("/")[1] },
  { name: "codex", formula: "--cask codex", versionCmd: "codex --version", parseVersion: output => output.split(" ").pop() ?? output, mac: true },
  { name: "gh", formula: "gh", versionCmd: "gh --version", parseVersion: output => output.split(" ")[2] },
  { name: "git-secrets", formula: "git-secrets", versionCmd: "brew list --versions git-secrets", parseVersion: output => output.split(" ")[1] },
  { name: "glab", formula: "glab", versionCmd: "glab --version", parseVersion: output => output.split(" ")[2] },
  { name: "go", formula: "go", versionCmd: "go version", parseVersion: output => output.split(" ")[2].replace("go", "") },
  { name: "kiro-cli", formula: "--cask kiro-cli", versionCmd: "kiro-cli --version", parseVersion: output => output.split(" ")[1], mac: true },
  { name: "tofu", formula: "opentofu", versionCmd: "tofu --version", parseVersion: output => output.split("\n")[0].split(" ")[1].replace("v", "") },
];

const brewCliChecks = await Promise.all(brewClis.filter(cli => os.mac || !cli.mac).map(async cli => ({
  ...cli,
  installed: exists(cli.name),
  version: await get(cli.versionCmd).catch(() => ""),
})));

for (const cli of brewCliChecks) {
  step(cli.name);
  if (!cli.installed) {
    missing(cli.name);
    issues++;
    if (fix) run(`${brew} install ${cli.formula}`);
  } else {
    ok(cli.name, cli.parseVersion(cli.version));
  }
}

// --- Session Manager Plugin ---

step("session-manager-plugin");
const smpBinary = `${homedir()}/.local/sessionmanagerplugin/bin/session-manager-plugin`;
if (existsSync(smpBinary)) {
  ok("session-manager-plugin", out(`${smpBinary} --version`));
} else {
  missing("session-manager-plugin");
  issues++;
  if (fix) {
    const arch = out("uname -m") === "arm64" ? "arm64" : "64bit";
    const osPart = os.mac ? `mac_${arch}` : `ubuntu_${arch}`;
    const url = `https://s3.amazonaws.com/session-manager-downloads/plugin/latest/${osPart}/sessionmanager-bundle.zip`;
    run(`curl -fsSL "${url}" -o /tmp/sessionmanager-bundle.zip`);
    run(`unzip -o /tmp/sessionmanager-bundle.zip -d /tmp/`);
    run(`mkdir -p ${homedir()}/.local/sessionmanagerplugin/bin`);
    run(`cp /tmp/sessionmanager-bundle/bin/session-manager-plugin ${smpBinary}`);
    run(`rm -rf /tmp/sessionmanager-bundle /tmp/sessionmanager-bundle.zip`);
    console.log(green("    + session-manager-plugin installed"));
  }
}

// --- Mac-only apps ---

if (os.mac) {
  const caskApps: Array<{ name: string; appPath: string; cask: string; versionCmd: string }> = [
    { name: "Claude Desktop", appPath: "/Applications/Claude.app", cask: "claude", versionCmd: "defaults read /Applications/Claude.app/Contents/Info.plist CFBundleShortVersionString" },
    { name: "Kiro IDE", appPath: "/Applications/Kiro.app", cask: "kiro", versionCmd: "defaults read /Applications/Kiro.app/Contents/Info.plist CFBundleShortVersionString" },
    { name: "Ollama", appPath: "/Applications/Ollama.app", cask: "ollama", versionCmd: "defaults read /Applications/Ollama.app/Contents/Info.plist CFBundleShortVersionString" },
    { name: "Zoom", appPath: "/Applications/zoom.us.app", cask: "zoom", versionCmd: "defaults read /Applications/zoom.us.app/Contents/Info.plist CFBundleVersion" },
  ];

  const caskChecks = await Promise.all(caskApps.map(async app => ({
    ...app,
    installed: existsSync(app.appPath),
    version: await get(app.versionCmd).catch(() => ""),
  })));

  for (const app of caskChecks) {
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

const npmGlobals: Array<{ name: string; pkg: string; cmd: string; versionCmd: string; parseVersion?: (output: string) => string }> = [
  { name: "AWS CDK", pkg: "aws-cdk", cmd: "cdk", versionCmd: "cdk --version", parseVersion: output => output.split(" ")[0] },
  { name: "Claude Code", pkg: "@anthropic-ai/claude-code", cmd: "claude", versionCmd: "claude --version", parseVersion: output => output.split(" ")[1] },
  { name: "Lighthouse", pkg: "lighthouse", cmd: "lighthouse", versionCmd: "lighthouse --version" },
  { name: "npm-check-updates", pkg: "npm-check-updates", cmd: "ncu", versionCmd: "ncu --version" },
  { name: "OpenCode", pkg: "opencode-ai", cmd: "opencode", versionCmd: "opencode --version" },
];

const npmChecks = await Promise.all(npmGlobals.map(async pkg => ({
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
  run(`fnm exec --using=lts-latest npm install -g ${npmGlobals.map(pkg => pkg.pkg).join(" ")}`);
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
    allow: [
      "Bash(awk *)",
      "Bash(aws acm describe-certificate *)",
      "Bash(aws acm list-certificates *)",
      "Bash(aws apigateway get-rest-apis *)",
      "Bash(aws apigatewayv2 get-apis *)",
      "Bash(aws cloudformation describe-stack-events *)",
      "Bash(aws cloudformation describe-stacks *)",
      "Bash(aws cloudformation get-template *)",
      "Bash(aws cloudformation list-stack-resources *)",
      "Bash(aws cloudformation list-stacks *)",
      "Bash(aws cloudfront get-cache-policy *)",
      "Bash(aws cloudfront get-distribution *)",
      "Bash(aws cloudfront get-distribution-config *)",
      "Bash(aws cloudfront get-origin-request-policy *)",
      "Bash(aws cloudfront get-response-headers-policy *)",
      "Bash(aws cloudfront list-cache-policies *)",
      "Bash(aws cloudfront list-distributions *)",
      "Bash(aws cloudfront list-functions *)",
      "Bash(aws cloudfront list-origin-request-policies *)",
      "Bash(aws cloudfront list-response-headers-policies *)",
      "Bash(aws cloudwatch describe-alarm-history *)",
      "Bash(aws cloudwatch describe-alarms *)",
      "Bash(aws cloudwatch describe-alarms-for-metric *)",
      "Bash(aws cloudwatch describe-anomaly-detectors *)",
      "Bash(aws cloudwatch describe-insight-rules *)",
      "Bash(aws cloudwatch get-dashboard *)",
      "Bash(aws cloudwatch get-insight-rule-report *)",
      "Bash(aws cloudwatch get-metric-data *)",
      "Bash(aws cloudwatch get-metric-statistics *)",
      "Bash(aws cloudwatch get-metric-widget-image *)",
      "Bash(aws cloudwatch list-dashboards *)",
      "Bash(aws cloudwatch list-metrics *)",
      "Bash(aws cloudwatch list-tags-for-resource *)",
      "Bash(aws ec2 describe-instances *)",
      "Bash(aws ec2 describe-security-groups *)",
      "Bash(aws ec2 describe-subnets *)",
      "Bash(aws ec2 describe-vpcs *)",
      "Bash(aws elbv2 describe-listeners *)",
      "Bash(aws elbv2 describe-load-balancers *)",
      "Bash(aws elbv2 describe-target-groups *)",
      "Bash(aws globalaccelerator describe-accelerator *)",
      "Bash(aws globalaccelerator list-accelerators *)",
      "Bash(aws lambda get-alias *)",
      "Bash(aws lambda get-function *)",
      "Bash(aws lambda get-function-concurrency *)",
      "Bash(aws lambda get-function-configuration *)",
      "Bash(aws lambda get-function-url-config *)",
      "Bash(aws lambda get-layer-version *)",
      "Bash(aws lambda get-policy *)",
      "Bash(aws lambda list-aliases *)",
      "Bash(aws lambda list-event-source-mappings *)",
      "Bash(aws lambda list-function-url-configs *)",
      "Bash(aws lambda list-functions *)",
      "Bash(aws lambda list-layer-versions *)",
      "Bash(aws lambda list-layers *)",
      "Bash(aws lambda list-tags *)",
      "Bash(aws lambda list-versions-by-function *)",
      "Bash(aws logs describe-log-groups *)",
      "Bash(aws logs describe-log-streams *)",
      "Bash(aws logs filter-log-events *)",
      "Bash(aws logs get-log-events *)",
      "Bash(aws logs get-query-results *)",
      "Bash(aws logs tail *)",
      "Bash(aws route53 get-hosted-zone *)",
      "Bash(aws route53 list-hosted-zones *)",
      "Bash(aws route53 list-resource-record-sets *)",
      "Bash(aws rum get-app-monitor *)",
      "Bash(aws rum get-app-monitor-data *)",
      "Bash(aws rum list-app-monitors *)",
      "Bash(aws s3 ls *)",
      "Bash(aws s3api get-bucket-policy *)",
      "Bash(aws s3api get-bucket-website *)",
      "Bash(aws s3api list-buckets *)",
      "Bash(aws shield list-protections *)",
      "Bash(aws sts get-caller-identity)",
      "Bash(aws sts get-caller-identity *)",
      "Bash(aws wafv2 get-web-acl *)",
      "Bash(aws wafv2 list-web-acls *)",
      "Bash(basename *)",
      "Bash(cat *)",
      "Bash(cdk diff)",
      "Bash(cdk doctor)",
      "Bash(cdk ls)",
      "Bash(cdk synth)",
      "Bash(curl -s http://localhost*)",
      "Bash(diff *)",
      "Bash(dirname *)",
      "Bash(file *)",
      "Bash(find *)",
      "Bash(gh -R *)",
      "Bash(gh api *)",
      "Bash(gh auth status *)",
      "Bash(gh cache list *)",
      "Bash(gh issue list *)",
      "Bash(gh issue status *)",
      "Bash(gh issue view *)",
      "Bash(gh label list *)",
      "Bash(gh pr checks *)",
      "Bash(gh pr diff *)",
      "Bash(gh pr list *)",
      "Bash(gh pr status *)",
      "Bash(gh pr view *)",
      "Bash(gh project field-list *)",
      "Bash(gh project item-list *)",
      "Bash(gh project list *)",
      "Bash(gh project view *)",
      "Bash(gh release list *)",
      "Bash(gh release view *)",
      "Bash(gh repo view *)",
      "Bash(gh ruleset list *)",
      "Bash(gh ruleset view *)",
      "Bash(gh run list *)",
      "Bash(gh run view *)",
      "Bash(gh run watch *)",
      "Bash(gh search *)",
      "Bash(gh secret list *)",
      "Bash(gh status *)",
      "Bash(gh variable list *)",
      "Bash(gh workflow list *)",
      "Bash(gh workflow view *)",
      "Bash(git *)",
      "Bash(glab api *)",
      "Bash(glab ci list *)",
      "Bash(glab ci status *)",
      "Bash(glab ci view *)",
      "Bash(glab issue list *)",
      "Bash(glab issue view *)",
      "Bash(glab mr diff *)",
      "Bash(glab mr list *)",
      "Bash(glab mr view *)",
      "Bash(glab release list *)",
      "Bash(glab release view *)",
      "Bash(glab repo view *)",
      "Bash(go build)",
      "Bash(go list)",
      "Bash(go test *)",
      "Bash(go version)",
      "Bash(go vet)",
      "Bash(grep *)",
      "Bash(head *)",
      "Bash(jq *)",
      "Bash(lighthouse *)",
      "Bash(ls *)",
      "Bash(ncu *)",
      "Bash(npm audit)",
      "Bash(npm explain *)",
      "Bash(npm info *)",
      "Bash(npm list *)",
      "Bash(npm ls *)",
      "Bash(npm outdated)",
      "Bash(npm show *)",
      "Bash(npm t)",
      "Bash(npm test)",
      "Bash(npm version)",
      "Bash(npm view *)",
      "Bash(npm why *)",
      "Bash(npx astro *)",
      "Bash(npx npm-check-updates *)",
      "Bash(npx tsc *)",
      "Bash(npx vite *)",
      "Bash(pwd)",
      "Bash(realpath *)",
      "Bash(stat *)",
      "Bash(tail *)",
      "Bash(tofu fmt *)",
      "Bash(tofu init)",
      "Bash(tofu output *)",
      "Bash(tofu plan)",
      "Bash(tofu plan *)",
      "Bash(tofu providers)",
      "Bash(tofu show)",
      "Bash(tofu show *)",
      "Bash(tofu state list)",
      "Bash(tofu state show *)",
      "Bash(tofu validate)",
      "Bash(tofu version)",
      "Bash(tree *)",
      "Bash(wc *)",
      "Bash(which *)",
      "Read(//private/tmp/**)",
      "Read(//tmp/**)",
      "WebFetch(domain:aws.amazon.com)",
      "WebFetch(domain:caniuse.com)",
      "WebFetch(domain:cloudscape.design)",
      "WebFetch(domain:datatracker.ietf.org)",
      "WebFetch(domain:developers.cloudflare.com)",
      "WebFetch(domain:docs.aws.amazon.com)",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:npmjs.com)",
      "WebFetch(domain:raw.githubusercontent.com)",
      "WebFetch(domain:rfc-editor.org)",
      "WebFetch(domain:techdocs.akamai.com)",
      "mcp__chrome-devtools__get_console_message",
      "mcp__chrome-devtools__get_network_request",
      "mcp__chrome-devtools__list_console_messages",
      "mcp__chrome-devtools__list_extensions",
      "mcp__chrome-devtools__list_network_requests",
      "mcp__chrome-devtools__list_pages",
      "mcp__chrome-devtools__new_page",
      "mcp__chrome-devtools__performance_analyze_insight",
      "mcp__chrome-devtools__select_page",
      "mcp__chrome-devtools__take_memory_snapshot",
      "mcp__chrome-devtools__take_screenshot",
      "mcp__chrome-devtools__take_snapshot",
      "mcp__chrome-devtools__wait_for",
      "mcp__slack-mcp__post_draft",
      ...(extras.claudeAllow ?? []),
    ],
  },
  sandbox: {
    ...existingClaudeSettings.sandbox,
    // SSH remotes bypass the HTTP proxy, so fetch and pull run unsandboxed
    excludedCommands: [
      `${homedir()}/bin/pptx *`,
      "git -C * fetch *",
      "git -C * pull *",
      "git fetch *",
      "git pull *",
      "kiro *",
    ],
    network: {
      ...existingClaudeSettings.sandbox?.network,
      // tsx opens a local IPC socket
      allowLocalBinding: true,
      allowedDomains: [
        "*.amazonaws.com",
        "api.github.com",
        "aws.amazon.com",
        "codeload.github.com",
        "docs.aws.amazon.com",
        "files.pythonhosted.org",
        "github.com",
        "objects.githubusercontent.com",
        "public.ecr.aws",
        "pypi.org",
        "raw.githubusercontent.com",
        "registry.npmjs.org",
        "registry.yarnpkg.com",
        ...(extras.sandboxDomains ?? []),
      ].sort(),
    },
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

// --- Claude Code CLAUDE.md ---

step("Claude Code CLAUDE.md");
const claudeMd = `${homedir()}/.claude/CLAUDE.md`;
if (existsSync(claudeMd)) {
  console.log(`    ✓ ${claudeMd}`);
} else {
  console.log(fix ? green(`    + ${claudeMd}`) : `    ${red(`missing ${claudeMd}`)}`);
  issues++;
  if (fix) {
    const result = spawnSync(
      `gh api repos/piotrekwitkowski/piotrekwitkowski/readme -H 'Accept: application/vnd.github.raw'`,
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

const includes: Array<{ dir: string; path: string }> = [
  { dir: "~/@aws/", path: "~/.gitconfig-aws" },
  { dir: "~/@piotrek/", path: "~/.gitconfig-piotrek" },
  ...(extras.gitIncludes ?? []),
].sort((a, b) => a.dir.localeCompare(b.dir));

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

for (const path of [...new Set(includes.map(include => include.path))]) {
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
ensureInProfile(`export AWS_REGION=eu-west-2`);
ensureInProfile(`export CLAUDE_CODE_USE_BEDROCK=1`);
ensureInProfile(`export GIT_CONFIG_NOSYSTEM=1`);
ensureInProfile(`export GOPROXY=direct`);
ensureInProfile(`export HOMEBREW_NO_ANALYTICS=1`);
ensureInProfile(`export PATH="$HOME/.opencode/bin:$PATH"`);
if (os.mac) {
  for (const line of extras.macProfileLines ?? []) ensureInProfile(line);
}

if (fix && appendToProfile()) console.log(`    ${os.profile} was updated. Restart terminal or run: source ${os.profile}`);

// --- Summary ---

console.log();
if (issues > 0) {
  console.log(fix ? green("Fixed!") : red(`${issues} issue${issues > 1 ? "s" : ""} found. Run with --fix / -f to resolve.`));
} else {
  console.log(green("Everything up to date"));
}
