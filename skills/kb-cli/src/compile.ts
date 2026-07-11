import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';
import Handlebars from 'handlebars';
import { parseArticle } from './parser.js';
import type { Article } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Templates ship inside the package (templates/*.hbs next to src/), not in the vault. */
export const DEFAULT_TEMPLATES_DIR = resolve(__dirname, '..', 'templates');

export interface KeyArticle {
  name: string;
  description: string;
}

export function extractKeyArticles(basePath: string): KeyArticle[] {
  const mdFiles = globSync('**/*.md', {
    cwd: basePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/raw/**', '**/outputs/**', '**/docs/**', '**/.obsidian/**', '**/_index.md', '**/_summary.md'],
  });

  const articles = mdFiles
    .map((f) => {
      try {
        return parseArticle(f, basePath);
      } catch {
        return null;
      }
    })
    .filter((a): a is Article => a !== null);

  // Score by: number of inbound links (popularity) + recency
  const linkCounts = new Map<string, number>();
  for (const a of articles) {
    for (const link of a.wikilinks) {
      linkCounts.set(link.toLowerCase(), (linkCounts.get(link.toLowerCase()) ?? 0) + 1);
    }
  }

  // Only promote articles that are actually ready to read — never stubs,
  // planned/deprecated articles, or low-confidence notes.
  const eligible = articles.filter((a) => {
    const conf = a.frontmatter.confidence;
    const status = a.frontmatter.status;
    if (conf === 'low' || conf === 'unverified') return false;
    if (status === 'planned' || status === 'deprecated') return false;
    return true;
  });

  const scored = eligible.map((a) => {
    const name = basename(a.relativePath, '.md').toLowerCase();
    const inboundLinks = linkCounts.get(name) ?? 0;
    const recencyScore = a.frontmatter.last_updated
      ? Math.max(0, 30 - daysSince(a.frontmatter.last_updated))
      : 0;
    return {
      article: a,
      score: inboundLinks * 3 + recencyScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 8).map((s) => ({
    name: basename(s.article.relativePath, '.md'),
    description: cleanDescription(s.article.summary),
  }));
}

/** First clean sentence/line of a summary — strip markdown noise, truncate on a word boundary. */
export function cleanDescription(summary: string, max = 110): string {
  const firstLine = summary
    .split('\n')
    .map((l) => l.replace(/^[>#*\-\s]+/, '').trim())
    .find((l) => l.length > 0) ?? '';
  if (firstLine.length <= max) return firstLine;
  const cut = firstLine.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function renderTemplate(
  templatePath: string,
  data: { project: string; keyArticles: KeyArticle[] }
): string {
  const source = readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(source);
  return template(data);
}

export function injectMarkerBlock(existing: string, newBlock: string): string {
  const markerPattern = /<!-- KB:START[\s\S]*?<!-- KB:END -->/;
  if (markerPattern.test(existing)) {
    return existing.replace(markerPattern, newBlock.trim());
  }
  return existing.trimEnd() + '\n\n' + newBlock.trim() + '\n';
}

export interface CompileTarget {
  /** Display name — passed to templates as `{{project}}` and matched by `--project`. */
  project: string;
  /** Absolute path to the directory holding this project's wiki articles. */
  wikiDir: string;
  projectDir: string;
  ides: {
    templateName: string;
    outputPath: string;
    mode: 'inject' | 'write';
  }[];
}

/**
 * @param targets Which projects/IDE files to (re)generate.
 * @param templatesDir Where to find the .hbs templates. Defaults to the bundled templates/ dir.
 */
export function compileConfigs(
  targets: CompileTarget[],
  templatesDir: string = DEFAULT_TEMPLATES_DIR
): { generated: string[]; errors: string[] } {
  const generated: string[] = [];
  const errors: string[] = [];

  for (const target of targets) {
    const keyArticles = existsSync(target.wikiDir) ? extractKeyArticles(target.wikiDir) : [];

    for (const ide of target.ides) {
      try {
        const templatePath = resolve(templatesDir, ide.templateName);
        if (!existsSync(templatePath)) {
          errors.push(`Template not found: ${ide.templateName}`);
          continue;
        }

        const rendered = renderTemplate(templatePath, {
          project: target.project,
          keyArticles,
        });

        const outputDir = resolve(ide.outputPath, '..');
        mkdirSync(outputDir, { recursive: true });

        if (ide.mode === 'inject' && existsSync(ide.outputPath)) {
          const existing = readFileSync(ide.outputPath, 'utf-8');
          const updated = injectMarkerBlock(existing, rendered);
          writeFileSync(ide.outputPath, updated);
        } else {
          writeFileSync(ide.outputPath, rendered);
        }

        generated.push(ide.outputPath);
      } catch (err) {
        errors.push(`${ide.outputPath}: ${err}`);
      }
    }
  }

  return { generated, errors };
}
