// Repos under `dir` include the config file at `path`; `user` is the identity written into that file
export type GitInclude = { dir: string; path: string; user?: { name: string; email: string } };

// Machine-specific additions, loaded from the gitignored setup.work.ts when it exists
export type Extras = {
  claudeAllow?: string[];
  sandboxDomains?: string[];
  gitIncludes?: GitInclude[];
  macProfileLines?: string[];
};
