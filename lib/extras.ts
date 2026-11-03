// Machine-specific additions, loaded from the gitignored setup.work.ts when it exists
export type Extras = {
  claudeAllow?: string[];
  sandboxDomains?: string[];
  gitIncludes?: Array<{ dir: string; path: string }>;
  macProfileLines?: string[];
};
