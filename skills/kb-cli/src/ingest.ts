import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from 'fs';
import { resolve } from 'path';
import { globSync } from 'glob';
import matter from 'gray-matter';
import { KB_ROOT } from './constants.js';

export interface StubOptions {
  title: string;
  sourceUrl?: string;
  project?: string;
  category?: string;
}

export function createStubArticle(options: StubOptions): string {
  const today = new Date().toISOString().split('T')[0];
  const lines = [
    '---',
    `title: "${options.title}"`,
  ];
  if (options.project) lines.push(`project: ${options.project}`);
  if (options.category) lines.push(`category: ${options.category}`);
  if (options.sourceUrl) {
    lines.push('sources:');
    lines.push(`  - url: "${options.sourceUrl}"`);
    lines.push(`    fetched: "${today}"`);
  }
  lines.push('confidence: unverified');
  lines.push(`last_updated: "${today}"`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${options.title}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('*Stub — awaiting content.*');
  lines.push('');
  lines.push('## Details');
  lines.push('');
  lines.push('');
  lines.push('## Needs Human Input');
  lines.push('');
  lines.push('This article was auto-created as a stub. It needs:');
  if (options.sourceUrl) {
    lines.push(`- Full content from source: ${options.sourceUrl}`);
  }
  lines.push('- Verification and confidence upgrade');
  lines.push('- Wikilinks to related articles');
  lines.push('');
  return lines.join('\n');
}

export interface IngestTarget {
  project: string;
  category: string;
  title: string;
}

export interface IngestResult {
  success: boolean;
  destination?: string;
  error?: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function processInboxItem(
  filePath: string,
  basePath: string,
  target: IngestTarget
): IngestResult {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    const slug = slugify(target.title);
    const destDir = resolve(basePath, target.project, target.category);
    const destPath = resolve(destDir, `${slug}.md`);

    mkdirSync(destDir, { recursive: true });

    const today = new Date().toISOString().split('T')[0];
    const newFrontmatter: Record<string, unknown> = {
      title: target.title,
      project: target.project,
      category: target.category,
      confidence: 'unverified',
      last_updated: today,
    };

    if (data.source_url) {
      newFrontmatter.sources = [{ url: data.source_url, fetched: data.clipped ?? today }];
    }

    const newContent = matter.stringify(content, newFrontmatter);
    writeFileSync(destPath, newContent);
    unlinkSync(filePath);

    return { success: true, destination: destPath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function listInbox(basePath: string = KB_ROOT): string[] {
  const inboxDir = resolve(basePath, 'raw/inbox');
  if (!existsSync(inboxDir)) return [];
  return globSync('*.md', { cwd: inboxDir, absolute: true });
}
