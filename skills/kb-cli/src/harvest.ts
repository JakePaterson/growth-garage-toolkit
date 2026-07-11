import { readFileSync, writeFileSync, existsSync } from 'fs';
import { globSync } from 'glob';
import matter from 'gray-matter';

export interface BookmarkNote {
  path: string;
  id: string;
  title: string;
  author: string;
  url: string;
  category: string;
  body: string;
}

/**
 * Reads bookmark/note files out of `xDir` and returns the ones not yet
 * evaluated into the KB (no `kb_evaluated` frontmatter field). This is an
 * example integration — point `xDir` at wherever your own bookmarking tool
 * exports markdown notes with frontmatter (see README).
 */
export function listUnevaluatedBookmarks(xDir: string): BookmarkNote[] {
  if (!existsSync(xDir)) return [];
  const files = globSync('*.md', { cwd: xDir, absolute: true });
  const out: BookmarkNote[] = [];
  for (const path of files) {
    const { data, content } = matter(readFileSync(path, 'utf-8'));
    if (!data.bookmark_id) continue;
    if (data.kb_evaluated) continue;
    out.push({
      path,
      id: String(data.bookmark_id),
      title: String(data.title ?? ''),
      author: String(data.author ?? ''),
      url: String(data.url ?? ''),
      category: String(data.bookmark_category ?? ''),
      body: content.trim(),
    });
  }
  return out;
}

export interface HarvestVerdict {
  path: string;
  decision: 'keep' | 'discard';
  kbArticle: string | null;
  reason: string;
}

export interface StampResult { path: string; success: boolean; error?: string; }

export function stampVerdicts(verdicts: HarvestVerdict[], today?: string): StampResult[] {
  const date = today ?? new Date().toISOString().split('T')[0];
  const results: StampResult[] = [];
  for (const v of verdicts) {
    try {
      const { data, content } = matter(readFileSync(v.path, 'utf-8'));
      data.kb_status = v.decision === 'keep' ? 'kept' : 'discarded';
      data.kb_article = v.kbArticle ?? null;
      data.kb_reason = v.reason;
      data.kb_evaluated = date;
      writeFileSync(v.path, matter.stringify(content, data));
      results.push({ path: v.path, success: true });
    } catch (err) {
      results.push({ path: v.path, success: false, error: String(err) });
    }
  }
  return results;
}
