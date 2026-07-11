import matter from 'gray-matter';
import { readFileSync } from 'fs';
import { relative } from 'path';
import type { Article, ArticleFrontmatter } from './types.js';

export function parseArticle(filePath: string, basePath: string): Article {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const frontmatter = data as ArticleFrontmatter;

  const summary = extractSummary(content);
  const wikilinks = extractWikilinks(content);
  const relativePath = relative(basePath, filePath);

  return { path: filePath, relativePath, frontmatter, content, summary, wikilinks };
}

function extractSummary(content: string): string {
  // Try to find a ## Summary section
  const summaryMatch = content.match(
    /## Summary\n\n([\s\S]*?)(?=\n## |\n---|\Z)/
  );
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }
  // Fallback: first non-heading paragraph
  const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  return lines.slice(0, 3).join(' ').trim().slice(0, 300);
}

function extractWikilinks(content: string): string[] {
  const matches = [...content.matchAll(/\[\[([^\]]+)\]\]/g)];
  return matches.map((m) => m[1]);
}
