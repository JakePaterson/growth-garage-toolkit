import { describe, it, expect } from 'vitest';
import { parseArticle } from '../src/parser.js';
import { resolve } from 'path';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');
const BASE = resolve(FIXTURES, '../..');

describe('parseArticle', () => {
  const articlePath = resolve(FIXTURES, 'sample-article.md');

  it('parses frontmatter fields', () => {
    const article = parseArticle(articlePath, BASE);
    expect(article.frontmatter.title).toBe('Widget Auth API');
    expect(article.frontmatter.project).toBe('widget-api');
    expect(article.frontmatter.category).toBe('apis');
    expect(article.frontmatter.confidence).toBe('high');
    expect(article.frontmatter.tags).toEqual(['auth', 'tokens', 'widget']);
  });

  it('extracts summary section', () => {
    const article = parseArticle(articlePath, BASE);
    expect(article.summary).toContain('OAuth token issuance');
  });

  it('extracts wikilinks', () => {
    const article = parseArticle(articlePath, BASE);
    expect(article.wikilinks).toContain('token-refresh-flow');
    expect(article.wikilinks).toContain('commons/services/example-cache');
    expect(article.wikilinks).toHaveLength(2);
  });

  it('computes relative path from base', () => {
    const article = parseArticle(articlePath, BASE);
    expect(article.relativePath).toContain('tests/fixtures/sample-article.md');
  });
});
