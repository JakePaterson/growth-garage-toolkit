import { describe, it, expect } from 'vitest';
import { createStubArticle, processInboxItem } from '../src/ingest.js';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

describe('createStubArticle', () => {
  it('generates valid frontmatter with source URL', () => {
    const md = createStubArticle({
      title: 'Test API',
      sourceUrl: 'https://example.com/docs',
      project: 'widget-api',
      category: 'apis',
    });
    expect(md).toContain('title: "Test API"');
    expect(md).toContain('confidence: unverified');
    expect(md).toContain('https://example.com/docs');
    expect(md).toContain('## Summary');
    expect(md).toContain('## Needs Human Input');
  });
});

describe('processInboxItem', () => {
  const tmpBase = resolve(tmpdir(), 'kb-test-ingest-' + Date.now());

  it('moves a raw markdown file to the target project directory', () => {
    mkdirSync(resolve(tmpBase, 'raw/inbox'), { recursive: true });
    mkdirSync(resolve(tmpBase, 'widget-api/apis'), { recursive: true });

    const inboxFile = resolve(tmpBase, 'raw/inbox/test-doc.md');
    writeFileSync(
      inboxFile,
      '---\nsource_url: "https://example.com"\nclipped: "2026-04-04"\n---\n\n# Some API Doc\n\nContent here.'
    );

    const result = processInboxItem(inboxFile, tmpBase, {
      project: 'widget-api',
      category: 'apis',
      title: 'Some API Doc',
    });

    expect(result.success).toBe(true);
    expect(result.destination).toContain('widget-api/apis/some-api-doc.md');

    // Original should be gone from inbox
    expect(() => readFileSync(inboxFile)).toThrow();

    rmSync(tmpBase, { recursive: true, force: true });
  });
});
