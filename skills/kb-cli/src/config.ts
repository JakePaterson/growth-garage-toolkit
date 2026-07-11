import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

export interface IdeConfigEntry {
  /** Handlebars template filename, resolved against the bundled templates/ dir. */
  template: string;
  /** Output file path, relative to this project's `path`. */
  output: string;
  /** 'inject' rewrites only the KB:START/KB:END block (creating the file if needed);
   *  'write' overwrites the whole file. */
  mode: 'inject' | 'write';
}

export interface ProjectConfig {
  /** Identifier used for --project filtering and to match each article's `project:` frontmatter. */
  name: string;
  /** Directory (relative to kb.config.json) where this project's IDE config files live. */
  path: string;
  /** Directory (relative to KB_ROOT) containing this project's wiki articles. Defaults to `name`. */
  wikiPath?: string;
  ideConfigs: IdeConfigEntry[];
}

export interface KbConfig {
  projects: ProjectConfig[];
  /** Directory of bookmark/note files for the `harvest` command. See README — example integration. */
  bookmarkSource?: string;
}

export interface LoadedConfig {
  config: KbConfig;
  /** Directory containing kb.config.json — all relative paths inside it resolve against this. */
  configDir: string;
  configPath: string;
}

/** Looks for kb.config.json in KB_ROOT, then the current working directory. Returns null if neither has one. */
export function loadConfig(kbRoot: string): LoadedConfig | null {
  const candidates = [resolve(kbRoot, 'kb.config.json'), resolve(process.cwd(), 'kb.config.json')];
  for (const p of candidates) {
    if (existsSync(p)) {
      const config = JSON.parse(readFileSync(p, 'utf-8')) as KbConfig;
      return { config, configDir: dirname(p), configPath: p };
    }
  }
  return null;
}
