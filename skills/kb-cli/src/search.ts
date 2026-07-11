import { globSync } from 'glob';
import { parseArticle } from './parser.js';
import { FRESHNESS_DEFAULTS, FRESHNESS_DEFAULT_FALLBACK, KB_ROOT, parseReverifyAfter } from './constants.js';
import type { Article, SearchResult } from './types.js';

export interface SearchOptions {
  project?: string;
  confidence?: string;
  stale?: boolean;
}

export function searchArticles(
  query: string,
  basePath: string = KB_ROOT,
  options: SearchOptions = {}
): SearchResult[] {
  const mdFiles = globSync('**/*.md', {
    cwd: basePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/raw/**', '**/outputs/**', '**/docs/**', '**/.obsidian/**', '**/_index.md', '**/_summary.md'],
  });

  const articles = mdFiles
    .map((f) => {
      try {
        return parseArticle(f, basePath);
      } catch {
        return null;
      }
    })
    .filter((a): a is Article => a !== null);

  const filtered = articles.filter((a) => {
    if (options.project && a.frontmatter.project !== options.project) return false;
    if (options.confidence && a.frontmatter.confidence !== options.confidence) return false;
    if (options.stale && !isStale(a)) return false;
    return true;
  });

  const queryTerms = query.toLowerCase().split(/\s+/);

  const scored: SearchResult[] = filtered
    .map((article) => {
      const { score, matchedLines } = scoreArticle(article, queryTerms);
      return { article, score, matchedLines };
    })
    .filter((r) => r.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function scoreArticle(
  article: Article,
  queryTerms: string[]
): { score: number; matchedLines: string[] } {
  let score = 0;
  const matchedLines: string[] = [];
  const titleLower = (article.frontmatter.title ?? '').toLowerCase();
  const tagsLower = (article.frontmatter.tags ?? []).map((t) => t.toLowerCase());

  for (const term of queryTerms) {
    if (titleLower.includes(term)) score += 10;
    if (tagsLower.some((t) => t.includes(term))) score += 5;
    if (article.summary.toLowerCase().includes(term)) score += 3;

    const lines = article.content.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes(term)) {
        score += 1;
        if (matchedLines.length < 3 && line.trim()) {
          matchedLines.push(line.trim());
        }
      }
    }
  }

  if (article.frontmatter.confidence === 'high') score *= 1.2;
  if (article.frontmatter.confidence === 'low') score *= 0.7;
  if (article.frontmatter.confidence === 'unverified') score *= 0.5;

  return { score, matchedLines };
}

export function isStale(article: Article): boolean {
  const reverify = parseReverifyAfter(article.frontmatter.reverify_after);
  if (reverify === null) return false; // reverify_after: never — evergreen, skip freshness entirely

  if (!article.frontmatter.last_verified) return true;

  const verified = new Date(article.frontmatter.last_verified);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - verified.getTime()) / (1000 * 60 * 60 * 24));

  const category = article.frontmatter.category ?? '';
  const maxDays = reverify ?? (FRESHNESS_DEFAULTS[category] ?? FRESHNESS_DEFAULT_FALLBACK);

  return daysSince > maxDays;
}
