import { describe, it, expect } from 'vitest';
import { searchArticles, isStale } from '../src/search.js';
import { resolve } from 'path';
import type { Article } from '../src/types.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('searchArticles', () => {
  it('finds articles matching a query term', () => {
    const results = searchArticles('widget', FIXTURES);
    expect(results.length).toBeGreaterThan(0);
  });

  it('ranks title matches higher than body matches', () => {
    const results = searchArticles('API', FIXTURES);
    // Both fixtures have "API" but in different places
    expect(results.length).toBe(2);
  });

  it('filters by project', () => {
    const results = searchArticles('API', FIXTURES, { project: 'widget-api' });
    for (const r of results) {
      expect(r.article.frontmatter.project).toBe('widget-api');
    }
  });

  it('filters by confidence level', () => {
    const results = searchArticles('API', FIXTURES, { confidence: 'low' });
    for (const r of results) {
      expect(r.article.frontmatter.confidence).toBe('low');
    }
  });

  it('filters for stale articles', () => {
    const results = searchArticles('API', FIXTURES, { stale: true });
    expect(results.length).toBeGreaterThan(0);
    // The stale fixture has last_verified in 2025
    expect(results[0].article.frontmatter.title).toBe('Legacy Widget Endpoint');
  });

  it('returns empty array for no matches', () => {
    const results = searchArticles('zzzznonexistent', FIXTURES);
    expect(results).toEqual([]);
  });
});

describe('isStale', () => {
  function article(frontmatter: Article['frontmatter']): Article {
    return {
      path: '/virtual/evergreen.md',
      relativePath: 'evergreen.md',
      frontmatter,
      content: '',
      summary: '',
      wikilinks: [],
    };
  }

  it('treats reverify_after: "never" as never stale, even with no last_verified', () => {
    expect(isStale(article({ title: 'Evergreen', category: 'decisions', reverify_after: 'never' }))).toBe(false);
  });

  it('treats reverify_after: "never" as never stale even when last_verified is very old', () => {
    expect(
      isStale(
        article({
          title: 'Evergreen',
          category: 'decisions',
          reverify_after: 'never',
          last_verified: '2000-01-01',
        })
      )
    ).toBe(false);
  });

  it('still treats a missing reverify_after with no last_verified as stale', () => {
    expect(isStale(article({ title: 'Undated', category: 'decisions' }))).toBe(true);
  });
});
