import { globSync } from 'glob';
import { basename, dirname } from 'path';
import { parseArticle } from './parser.js';
import { isStale } from './search.js';
import { FRESHNESS_DEFAULTS, FRESHNESS_DEFAULT_FALLBACK, parseReverifyAfter } from './constants.js';
import type { Article, ArticleFrontmatter, LintIssue, LintReport } from './types.js';

/** Core fields every content article is expected to carry — missing any one is a warning, not an error. */
const REQUIRED_CONTENT_FIELDS: { key: keyof ArticleFrontmatter; label: string }[] = [
  { key: 'project', label: 'project' },
  { key: 'category', label: 'category' },
  { key: 'confidence', label: 'confidence' },
  { key: 'last_updated', label: 'last_updated' },
  { key: 'description', label: 'description' },
];

const MAX_DESCRIPTION_LENGTH = 160;

export interface LintOptions {
  project?: string;
  staleOnly?: boolean;
  connections?: boolean;
}

/** Classify navigation files. `_index.md` = link catalog, `_summary.md` = curated overview. */
function navKind(relativePath: string): 'index' | 'summary' | null {
  const b = basename(relativePath).toLowerCase();
  if (b === '_index.md') return 'index';
  if (b === '_summary.md') return 'summary';
  return null;
}

/**
 * All right-anchored path suffixes of a slash path, lowercased — mirrors how
 * Obsidian resolves a short link like `[[client-a/_summary]]` against a full path.
 * "parent/client-a/_summary" -> ["_summary", "client-a/_summary", "parent/client-a/_summary"]
 */
function pathSuffixes(relNoExt: string): string[] {
  const parts = relNoExt.toLowerCase().split('/');
  const out: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    out.push(parts.slice(i).join('/'));
  }
  return out;
}

/** Normalize a link target: drop alias (`|`), anchor (`#`), leading `./`, `.md`, lowercase. */
function normalizeTarget(link: string): string {
  const t = link.split('|')[0].split('#')[0].trim();
  return t.replace(/^\.\//, '').replace(/\.md$/i, '').toLowerCase();
}

/** Markdown links pointing at a local `.md` file, e.g. `[Next.js](frameworks/nextjs.md)`. */
function extractMarkdownLinkTargets(content: string): string[] {
  const out: string[] = [];
  for (const m of content.matchAll(/\]\(([^)]+?\.md)(?:#[^)]*)?\)/gi)) {
    out.push(m[1]);
  }
  return out;
}

export function lintArticles(
  basePath: string,
  options: LintOptions = {}
): LintReport {
  const mdFiles = globSync('**/*.md', {
    cwd: basePath,
    absolute: true,
    // NOTE: _index.md / _summary.md are intentionally NOT ignored — they are the
    // navigation backbone, so they must count as link sources/targets (else every
    // article reachable only via an index is a false orphan) and `_summary.md`
    // freshness must be checked (it is the most-read file in each wiki).
    ignore: [
      '**/node_modules/**',
      '**/raw/**',
      '**/outputs/**',
      '**/tools/**',
      '**/docs/**',
      '**/.obsidian/**',
      '**/CONTRIBUTING.md',
    ],
  });

  const all = mdFiles
    .map((f) => {
      try {
        return parseArticle(f, basePath);
      } catch {
        return null;
      }
    })
    .filter((a): a is Article => a !== null);

  // --- Link graph over ALL files, including _index/_summary as sources & targets ---
  // Used only to decide whether a broken link's target *exists somewhere* — nav
  // files are legitimate link sources for that check.

  // --- Link graph for orphan detection: content articles + curated _summary ---
  // A generated `_index.md` links to every article by construction, so counting
  // it as a source would mean nothing is ever an orphan again — it is excluded.
  // `_summary.md`, by contrast, is hand-curated: listing an article there is a
  // deliberate "this matters" signal, so it counts as legitimate reachability.
  // Thus an orphan = an article that neither another article nor any curated
  // summary points to (it exists only in the raw catalog).
  const contentLinkedTargets = new Set<string>();
  for (const a of all) {
    if (navKind(a.relativePath) === 'index') continue;
    for (const link of a.wikilinks) contentLinkedTargets.add(normalizeTarget(link));
    for (const link of extractMarkdownLinkTargets(a.content)) {
      contentLinkedTargets.add(normalizeTarget(link));
    }
  }

  // Each file registers all of its path suffixes so short/path-style links resolve.
  const articleKeys = new Set<string>();
  const suffixesByArticle = new Map<Article, string[]>();
  for (const a of all) {
    const relNoExt = a.relativePath.replace(/\.md$/i, '');
    const sufs = pathSuffixes(relNoExt);
    suffixesByArticle.set(a, sufs);
    for (const s of sufs) articleKeys.add(s);
  }

  const issues: LintIssue[] = [];
  const inProject = (a: Article) =>
    !options.project || a.frontmatter.project === options.project;

  for (const article of all) {
    if (!inProject(article)) continue;
    const kind = navKind(article.relativePath);

    // Freshness — content articles + _summary overviews (skip _index link catalogs)
    if (kind !== 'index' && isStale(article)) {
      const verified = article.frontmatter.last_verified;
      if (verified) {
        const daysSince = Math.floor(
          (Date.now() - new Date(verified).getTime()) / (1000 * 60 * 60 * 24)
        );
        const category = article.frontmatter.category ?? '';
        const reverify = parseReverifyAfter(article.frontmatter.reverify_after);
        // reverify === null ("never") can't reach here — isStale() already returned false for it.
        const limit = reverify ?? (FRESHNESS_DEFAULTS[category] ?? FRESHNESS_DEFAULT_FALLBACK);
        issues.push({
          type: 'stale',
          severity: 'warning',
          file: article.relativePath,
          message: `Stale: ${daysSince} days since verification (limit: ${limit}d)`,
        });
      } else {
        issues.push({
          type: 'stale',
          severity: 'warning',
          file: article.relativePath,
          message: 'Never verified — missing last_verified date',
        });
      }
    }

    // Low confidence — content articles + _summary (skip _index)
    if (
      kind !== 'index' &&
      (article.frontmatter.confidence === 'low' ||
        article.frontmatter.confidence === 'unverified')
    ) {
      issues.push({
        type: 'low_confidence',
        severity: 'warning',
        file: article.relativePath,
        message: `Confidence: ${article.frontmatter.confidence}`,
      });
    }

    // Broken links — all files (a dead link in an index/summary is a real problem)
    for (const link of article.wikilinks) {
      if (!articleKeys.has(normalizeTarget(link))) {
        issues.push({
          type: 'broken_link',
          severity: 'error',
          file: article.relativePath,
          message: `Broken link: [[${link}]] — target not found`,
        });
      }
    }

    // Orphans — content articles only, checked against content-sourced links only
    // (see contentLinkedTargets above: a generated _index.md must not mask orphans)
    if (kind === null) {
      const linked = (suffixesByArticle.get(article) ?? []).some((s) =>
        contentLinkedTargets.has(s)
      );
      if (!linked) {
        issues.push({
          type: 'orphan',
          severity: 'suggestion',
          file: article.relativePath,
          message: 'Orphan: no other article links to this one',
        });
      }
    }

    // Nav files must carry a title — it's what Obsidian's graph/quick-switcher
    // and the "Front Matter Title" plugin display instead of `_index`/`_summary`.
    if (kind !== null && !article.frontmatter.title) {
      issues.push({
        type: 'missing_title',
        severity: 'error',
        file: article.relativePath,
        message: `${basename(article.relativePath)} is missing required "title" in frontmatter`,
      });
    }

    // Core fields on content articles — one warning per missing field.
    if (kind === null) {
      for (const { key, label } of REQUIRED_CONTENT_FIELDS) {
        if (!article.frontmatter[key]) {
          issues.push({
            type: 'missing_field',
            severity: 'warning',
            file: article.relativePath,
            message: `Missing "${label}" in frontmatter`,
          });
        }
      }
    }

    // Description length — wherever a description is present, regardless of file kind.
    if (
      article.frontmatter.description &&
      article.frontmatter.description.length > MAX_DESCRIPTION_LENGTH
    ) {
      issues.push({
        type: 'description_length',
        severity: 'warning',
        file: article.relativePath,
        message: `description is ${article.frontmatter.description.length} chars (max recommended: ${MAX_DESCRIPTION_LENGTH})`,
      });
    }
  }

  // Duplicate slugs — same basename in different folders is an ambiguous
  // wikilink target. Content articles only: nav files are named `_index.md`/
  // `_summary.md` by design in every project and that collision is expected.
  const slugGroups = new Map<string, Article[]>();
  for (const article of all) {
    if (!inProject(article)) continue;
    if (navKind(article.relativePath) !== null) continue;
    const slug = basename(article.relativePath, '.md').toLowerCase();
    const group = slugGroups.get(slug) ?? [];
    group.push(article);
    slugGroups.set(slug, group);
  }
  for (const [slug, group] of slugGroups) {
    if (group.length < 2) continue;
    const folders = new Set(group.map((a) => dirname(a.relativePath)));
    if (folders.size < 2) continue;
    for (const article of group) {
      const others = group.filter((a) => a !== article).map((a) => a.relativePath);
      issues.push({
        type: 'duplicate_slug',
        severity: 'warning',
        file: article.relativePath,
        message: `Ambiguous slug "${slug}" — also used by ${others.join(', ')}`,
      });
    }
  }

  // Content articles in scope — the basis for stats and connection suggestions.
  const contentArticles = all.filter(
    (a) => navKind(a.relativePath) === null && inProject(a)
  );

  // Connection suggestions (optional)
  if (options.connections) {
    const tagMap = new Map<string, Article[]>();
    for (const a of contentArticles) {
      for (const tag of a.frontmatter.tags ?? []) {
        const existing = tagMap.get(tag) ?? [];
        existing.push(a);
        tagMap.set(tag, existing);
      }
    }
    for (const [tag, tagArticles] of tagMap) {
      if (tagArticles.length >= 2) {
        for (let i = 0; i < tagArticles.length; i++) {
          for (let j = i + 1; j < tagArticles.length; j++) {
            const a = tagArticles[i];
            const b = tagArticles[j];
            const aName = basename(a.relativePath, '.md').toLowerCase();
            const bName = basename(b.relativePath, '.md').toLowerCase();
            const aLinksB = a.wikilinks.some((l) => normalizeTarget(l) === bName);
            const bLinksA = b.wikilinks.some((l) => normalizeTarget(l) === aName);
            if (!aLinksB && !bLinksA) {
              issues.push({
                type: 'connection',
                severity: 'suggestion',
                file: a.relativePath,
                message: `Share tag "${tag}" with ${b.relativePath} but no link between them`,
                suggestion: `Add [[${basename(b.relativePath, '.md')}]] to ${a.relativePath}`,
              });
            }
          }
        }
      }
    }
  }

  // Stats
  const stats = {
    totalArticles: contentArticles.length,
    highConfidence: contentArticles.filter((a) => a.frontmatter.confidence === 'high').length,
    mediumConfidence: contentArticles.filter((a) => a.frontmatter.confidence === 'medium').length,
    lowConfidence: contentArticles.filter((a) => a.frontmatter.confidence === 'low').length,
    unverified: contentArticles.filter(
      (a) => !a.frontmatter.confidence || a.frontmatter.confidence === 'unverified'
    ).length,
    averageFreshnessDays: calculateAverageFreshness(contentArticles),
  };

  return { issues, stats };
}

function calculateAverageFreshness(articles: Article[]): number {
  const now = Date.now();
  const verified = articles.filter((a) => a.frontmatter.last_verified);
  if (verified.length === 0) return 0;
  const total = verified.reduce((sum, a) => {
    const d = new Date(a.frontmatter.last_verified!).getTime();
    return sum + Math.floor((now - d) / (1000 * 60 * 60 * 24));
  }, 0);
  return Math.round(total / verified.length);
}
