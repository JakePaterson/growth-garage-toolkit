import { describe, it, expect } from 'vitest';
import { lintArticles } from '../src/lint.js';
import { resolve } from 'path';

const FIXTURES = resolve(import.meta.dirname, 'lint-newrules-fixtures');

describe('lintArticles — new rule checks', () => {
  it('flags a nav file (_index.md) missing title as an error', () => {
    const report = lintArticles(FIXTURES);
    const missingTitle = report.issues.filter((i) => i.type === 'missing_title');
    expect(missingTitle.length).toBeGreaterThan(0);
    expect(missingTitle.every((i) => i.severity === 'error')).toBe(true);
  });

  it('flags a content article missing core fields as one warning per field', () => {
    const report = lintArticles(FIXTURES);
    const missingField = report.issues.filter(
      (i) => i.type === 'missing_field' && i.file.endsWith('incomplete.md')
    );
    // incomplete.md is missing category, confidence, and description
    expect(missingField.length).toBe(3);
    expect(missingField.every((i) => i.severity === 'warning')).toBe(true);
  });

  it('flags an over-long description as a warning', () => {
    const report = lintArticles(FIXTURES);
    const tooLong = report.issues.filter((i) => i.type === 'description_length');
    expect(tooLong.length).toBeGreaterThan(0);
    expect(tooLong[0].file).toContain('long-description.md');
  });

  it('flags duplicate basenames across folders as ambiguous slugs', () => {
    const report = lintArticles(FIXTURES);
    const dup = report.issues.filter((i) => i.type === 'duplicate_slug');
    // one issue per file in the colliding pair
    expect(dup.length).toBe(2);
    expect(dup.every((i) => i.severity === 'warning')).toBe(true);
  });

  it('does not let a nav-file link mask an orphan', () => {
    // only-linked-from-index.md is linked to only from _index.md (a nav file),
    // so it must still be reported as an orphan.
    const report = lintArticles(FIXTURES);
    const orphans = report.issues.filter(
      (i) => i.type === 'orphan' && i.file.endsWith('only-linked-from-index.md')
    );
    expect(orphans.length).toBe(1);
  });
});
