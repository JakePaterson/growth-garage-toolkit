import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { generateIndex, titleCase } from './index-gen.js';

export interface InitResult {
  success: boolean;
  message: string;
  summaryPath?: string;
  indexPath?: string;
}

/**
 * Scaffolds `<kbRoot>/<project>/_summary.md` (a minimal TODO template) plus an
 * initial generated `_index.md`, and appends a project entry to
 * `kb.config.json` if one exists at `kbRoot`. Refuses if the project
 * directory already exists — this only creates new wikis.
 */
export function initProject(kbRoot: string, project: string, displayName?: string): InitResult {
  // The project name becomes a directory name, so it must not be able to escape
  // kbRoot — `kb init ../../etc` would otherwise scaffold outside the vault.
  if (!/^[A-Za-z0-9._-]+$/.test(project) || project === '.' || project === '..') {
    return {
      success: false,
      message: `Invalid project name "${project}". Use letters, numbers, dots, dashes or underscores — no path separators.`,
    };
  }

  const wikiDir = resolve(kbRoot, project);
  if (existsSync(wikiDir)) {
    return {
      success: false,
      message: `"${project}" already exists at ${wikiDir} — refusing to overwrite. Delete it first if you want to start over.`,
    };
  }

  const title = displayName ?? titleCase(project);
  const today = new Date().toISOString().split('T')[0];

  mkdirSync(wikiDir, { recursive: true });

  const summary = [
    '---',
    `title: "${title} — Summary"`,
    `project: ${project}`,
    'category: domain',
    'confidence: unverified',
    `last_updated: "${today}"`,
    '---',
    '',
    `# ${title} — Summary`,
    '',
    '## Overview',
    '',
    'TODO: what this project is, in 2-3 sentences.',
    '',
    '## Active work',
    '',
    'TODO: what is currently in progress.',
    '',
    '## Critical rules',
    '',
    'TODO: anything an agent must never get wrong about this project.',
    '',
  ].join('\n');

  const summaryPath = resolve(wikiDir, '_summary.md');
  writeFileSync(summaryPath, summary);

  const indexPath = resolve(wikiDir, '_index.md');
  writeFileSync(indexPath, generateIndex(wikiDir, title));

  const configPath = resolve(kbRoot, 'kb.config.json');
  let configMessage = '';
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      config.projects = config.projects ?? [];
      const alreadyThere = config.projects.some((p: { name?: string }) => p.name === project);
      if (!alreadyThere) {
        config.projects.push({
          name: project,
          wikiPath: project,
          path: project,
          ideConfigs: [],
        });
        writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
        configMessage = ` Added a "${project}" entry to kb.config.json — review its "path" and "ideConfigs" before running \`kb compile\`.`;
      }
    } catch {
      configMessage = ' kb.config.json exists but could not be parsed — add the project entry manually.';
    }
  }

  return {
    success: true,
    message: `Scaffolded ${wikiDir} (_summary.md, _index.md).${configMessage}`,
    summaryPath,
    indexPath,
  };
}
