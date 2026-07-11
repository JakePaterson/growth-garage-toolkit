import { readFileSync, existsSync } from 'fs';
import { basename, resolve, dirname, relative, sep } from 'path';
import { globSync } from 'glob';
import matter from 'gray-matter';
import { parseArticle } from './parser.js';
import { cleanDescription } from './compile.js';
import type { Article } from './types.js';

/** Glob ignores shared by both the section scan and the article scan. */
const COMMON_IGNORES = [
  '**/node_modules/**',
  '**/raw/**',
  '**/outputs/**',
  '**/docs/**',
  '**/.obsidian/**',
];

/** "widget-api" -> "Widget Api", "acmecorp" -> "Acmecorp" — a best-effort fallback, not a real title-casing algorithm. */
export function titleCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Reads the `title:` frontmatter of an `_index.md` at an exact path, if it exists. */
function readIndexTitle(indexPath: string): string | null {
  if (!existsSync(indexPath)) return null;
  try {
    const { data } = matter(readFileSync(indexPath, 'utf-8'));
    return typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null;
  } catch {
    return null;
  }
}

function deriveTitle(wikiDir: string, projectDisplayName?: string): string {
  const existing = readIndexTitle(resolve(wikiDir, '_index.md'));
  if (existing) return existing;
  const name = projectDisplayName ?? titleCase(basename(resolve(wikiDir)));
  return `${name} Index`;
}

export interface WikiSection {
  /** Path to the nested section's folder, relative to wikiDir, POSIX-separated (e.g. "acmecorp"). */
  relDir: string;
  /** The nested section's own `_index.md` title (or a title-cased fallback of the folder name). */
  title: string;
}

/**
 * Finds nested "sub-wikis": folders below `wikiDir` (at any depth) that carry
 * their own `_index.md`. Only the topmost such folder on each branch is
 * returned — a deeper `_index.md` nested inside another section belongs to
 * that section to manage, not to `wikiDir` directly.
 */
export function findNestedSections(wikiDir: string): WikiSection[] {
  const topIndexPath = resolve(wikiDir, '_index.md');

  const nestedIndexFiles = globSync('**/_index.md', {
    cwd: wikiDir,
    absolute: true,
    ignore: COMMON_IGNORES,
  }).filter((f) => f !== topIndexPath);

  const candidateDirs = [...new Set(nestedIndexFiles.map((f) => dirname(f)))];

  // Keep only the topmost dirs on each branch — drop any candidate that lives
  // underneath another candidate (that ancestor section owns it instead).
  const topmost = candidateDirs.filter(
    (dir) => !candidateDirs.some((other) => other !== dir && dir.startsWith(other + sep))
  );

  return topmost
    .map((dir) => {
      const relDir = relative(wikiDir, dir).split(sep).join('/');
      const title = readIndexTitle(resolve(dir, '_index.md')) ?? titleCase(basename(dir));
      return { relDir, title };
    })
    .sort((a, b) => a.relDir.localeCompare(b.relDir));
}

/**
 * Builds the full content of a project's `_index.md`: content articles only
 * (never `_index.md`/`_summary.md` themselves), grouped by `category`
 * (missing category -> "Other"), each group sorted alphabetically by slug,
 * with a one-line description per article.
 */
export function generateIndex(wikiDir: string, projectDisplayName?: string): string {
  const title = deriveTitle(wikiDir, projectDisplayName);
  const sections = findNestedSections(wikiDir);

  const mdFiles = globSync('**/*.md', {
    cwd: wikiDir,
    absolute: true,
    ignore: [
      ...COMMON_IGNORES,
      '**/_index.md',
      '**/_summary.md',
      // Nested sections manage their own articles — exclude them here so the
      // parent index doesn't duplicate what the child section's index lists.
      ...sections.map((s) => `${s.relDir}/**`),
    ],
  });

  const articles = mdFiles
    .map((f) => {
      try {
        return parseArticle(f, wikiDir);
      } catch {
        return null;
      }
    })
    .filter((a): a is Article => a !== null);

  const groups = new Map<string, Article[]>();
  for (const a of articles) {
    const category = a.frontmatter.category?.trim() || 'Other';
    const list = groups.get(category) ?? [];
    list.push(a);
    groups.set(category, list);
  }

  const lines: string[] = ['---', `title: "${title}"`, '---', '', `# ${title}`, ''];

  if (sections.length > 0) {
    lines.push(`## Sections (${sections.length})`);
    lines.push('');
    for (const s of sections) {
      lines.push(`- [[${s.relDir}/_index]] — ${s.title}`);
    }
    lines.push('');
  }

  const categories = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  for (const category of categories) {
    const items = groups
      .get(category)!
      .slice()
      .sort((a, b) => basename(a.relativePath, '.md').localeCompare(basename(b.relativePath, '.md')));

    lines.push(`## ${category} (${items.length})`);
    lines.push('');
    for (const a of items) {
      const slug = basename(a.relativePath, '.md');
      const description = a.frontmatter.description?.trim() || cleanDescription(a.summary);
      lines.push(description ? `- [[${slug}]] — ${description}` : `- [[${slug}]]`);
    }
    lines.push('');
  }

  lines.push('<!-- Generated by `kb index`. Do not edit by hand. -->');
  lines.push('');

  return lines.join('\n');
}
