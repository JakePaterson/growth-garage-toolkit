export interface ArticleSource {
  url: string;
  fetched: string;
}

export interface ArticleFrontmatter {
  title: string;
  /** Single-line, factual, ≤160-char summary of what the article covers. Powers `_index.md` entries. */
  description?: string;
  project?: string;
  category?: string;
  tags?: string[];
  sources?: ArticleSource[];
  confidence?: 'high' | 'medium' | 'low' | 'unverified';
  last_verified?: string;
  last_updated?: string;
  /** e.g. "30d", or "never" for evergreen content that should never be flagged stale. */
  reverify_after?: string;
  status?: 'current' | 'migrating' | 'deprecated' | 'planned';
}

export interface Article {
  path: string;
  relativePath: string;
  frontmatter: ArticleFrontmatter;
  content: string;
  summary: string;
  wikilinks: string[];
}

export interface SearchResult {
  article: Article;
  score: number;
  matchedLines: string[];
}

export type LintSeverity = 'error' | 'warning' | 'suggestion';

export type LintIssueType =
  | 'stale'
  | 'low_confidence'
  | 'broken_link'
  | 'orphan'
  | 'connection'
  | 'coverage_gap'
  | 'missing_title'
  | 'missing_field'
  | 'description_length'
  | 'duplicate_slug';

export interface LintIssue {
  type: LintIssueType;
  severity: LintSeverity;
  file: string;
  message: string;
  suggestion?: string;
}

export interface LintReport {
  issues: LintIssue[];
  stats: {
    totalArticles: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    unverified: number;
    averageFreshnessDays: number;
  };
}
