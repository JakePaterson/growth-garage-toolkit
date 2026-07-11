import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import matter from 'gray-matter';
import { listUnevaluatedBookmarks, stampVerdicts } from '../src/harvest.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(resolve(tmpdir(), 'harvest-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

function writeNote(name: string, fm: Record<string, unknown>, body = '') {
  const p = resolve(dir, name);
  writeFileSync(p, matter.stringify(body, fm));
  return p;
}

describe('listUnevaluatedBookmarks', () => {
  it('returns only bookmark notes lacking kb_evaluated', () => {
    writeNote('a.md', { bookmark_id: 'note:1', title: 'Idea A', url: 'https://example.com/a', bookmark_category: 'ai' }, 'body A');
    writeNote('b.md', { bookmark_id: 'note:2', title: 'Done B', kb_evaluated: '2026-06-16' });
    writeNote('c.md', { type: 'person' });
    const got = listUnevaluatedBookmarks(dir);
    expect(got.map((n) => n.id)).toEqual(['note:1']);
    expect(got[0].title).toBe('Idea A');
    expect(got[0].body).toBe('body A');
  });

  it('returns an empty array when the directory does not exist', () => {
    const got = listUnevaluatedBookmarks(resolve(dir, 'does-not-exist'));
    expect(got).toEqual([]);
  });
});

describe('stampVerdicts', () => {
  it('merges kb_* keys while preserving existing frontmatter and body', () => {
    const p = resolve(dir, 'a.md');
    writeFileSync(p, matter.stringify('note body', { bookmark_id: 'note:1', title: 'Idea A', author: 'someone' }));
    const res = stampVerdicts(
      [{ path: p, decision: 'keep', kbArticle: 'commons/patterns/foo.md', reason: 'verified vs docs' }],
      '2026-06-16',
    );
    expect(res[0].success).toBe(true);
    const { data, content } = matter(readFileSync(p, 'utf-8'));
    expect(data.bookmark_id).toBe('note:1');
    expect(data.title).toBe('Idea A');
    expect(data.kb_status).toBe('kept');
    expect(data.kb_article).toBe('commons/patterns/foo.md');
    expect(data.kb_reason).toBe('verified vs docs');
    expect(data.kb_evaluated).toBe('2026-06-16');
    expect(content.trim()).toBe('note body');
  });

  it('records discards with null kb_article', () => {
    const p = resolve(dir, 'b.md');
    writeFileSync(p, matter.stringify('', { bookmark_id: 'note:2', title: 'Noise' }));
    stampVerdicts([{ path: p, decision: 'discard', kbArticle: null, reason: 'hype, no durable substance' }], '2026-06-16');
    const { data } = matter(readFileSync(p, 'utf-8'));
    expect(data.kb_status).toBe('discarded');
    expect(data.kb_article).toBeNull();
  });
});
