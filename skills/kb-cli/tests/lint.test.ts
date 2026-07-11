import { describe, it, expect } from 'vitest';
import { lintArticles } from '../src/lint.js';
import { resolve } from 'path';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('lintArticles', () => {
  it('flags stale articles', () => {
    const report = lintArticles(FIXTURES);
    const staleIssues = report.issues.filter((i) => i.type === 'stale');
    expect(staleIssues.length).toBeGreaterThan(0);
    expect(staleIssues[0].message).toContain('days');
  });

  it('flags low confidence articles', () => {
    const report = lintArticles(FIXTURES);
    const lowConf = report.issues.filter((i) => i.type === 'low_confidence');
    expect(lowConf.length).toBeGreaterThan(0);
  });

  it('flags broken wikilinks', () => {
    const report = lintArticles(FIXTURES);
    const broken = report.issues.filter((i) => i.type === 'broken_link');
    // sample-article.md links to [[token-refresh-flow]] which doesn't exist in fixtures
    expect(broken.length).toBeGreaterThan(0);
  });

  it('detects orphan articles (no inbound links)', () => {
    const report = lintArticles(FIXTURES);
    const orphans = report.issues.filter((i) => i.type === 'orphan');
    // sample-stale.md is not linked by any other fixture
    expect(orphans.length).toBeGreaterThan(0);
  });

  it('calculates stats', () => {
    const report = lintArticles(FIXTURES);
    expect(report.stats.totalArticles).toBe(2);
    expect(report.stats.highConfidence).toBe(1);
    expect(report.stats.lowConfidence).toBe(1);
  });
});
