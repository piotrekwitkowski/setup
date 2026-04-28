import { spawnSync, execSync } from "child_process";

const run = (cmd: string) => spawnSync(cmd, { shell: true, stdio: "inherit" });
const out = (cmd: string) => execSync(cmd).toString().trim();

export const installDmg = (appName: string, dmgUrl: string, dmgFile: string) => {
  run(`curl -fsSL "${dmgUrl}" -o /tmp/${dmgFile}`);
  run(`hdiutil attach /tmp/${dmgFile} -quiet`);
  const volume = out(`ls /Volumes | grep -i ${appName}`);
  run(`rm -rf "/Applications/${appName}.app"`);
  run(`cp -R "/Volumes/${volume}/${appName}.app" /Applications/`);
  run(`hdiutil detach "/Volumes/${volume}" -quiet`);
  run(`rm /tmp/${dmgFile}`);
};
