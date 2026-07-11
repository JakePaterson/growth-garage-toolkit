import { describe, it, expect } from 'vitest';
import { renderTemplate, extractKeyArticles, injectMarkerBlock } from '../src/compile.js';
import { resolve } from 'path';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');
const TEMPLATES = resolve(import.meta.dirname, '../templates');

describe('extractKeyArticles', () => {
  it('extracts articles with title and summary', () => {
    const articles = extractKeyArticles(FIXTURES);
    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0]).toHaveProperty('name');
    expect(articles[0]).toHaveProperty('description');
  });
});

describe('renderTemplate', () => {
  it('renders a handlebars template with project and key articles', () => {
    const result = renderTemplate(resolve(TEMPLATES, 'claude-md.hbs'), {
      project: 'example-project',
      keyArticles: [
        { name: 'token-refresh-flow', description: 'Core auth token lifecycle' },
        { name: 'widget-auth-api', description: 'Widget platform auth API' },
      ],
    });
    expect(result).toContain('~/knowledge-base/example-project/');
    expect(result).toContain('token-refresh-flow');
    expect(result).toContain('Widget platform auth API');
    expect(result).toContain('KB:START');
    expect(result).toContain('KB:END');
  });
});

describe('injectMarkerBlock', () => {
  it('injects content between KB markers in existing text', () => {
    const existing = 'Line 1\n<!-- KB:START -->\nold content\n<!-- KB:END -->\nLine 2';
    const newBlock = '<!-- KB:START -->\nnew content\n<!-- KB:END -->';
    const result = injectMarkerBlock(existing, newBlock);
    expect(result).toContain('new content');
    expect(result).not.toContain('old content');
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 2');
  });

  it('appends if no existing markers found', () => {
    const existing = 'Line 1\nLine 2';
    const newBlock = '<!-- KB:START -->\nnew content\n<!-- KB:END -->';
    const result = injectMarkerBlock(existing, newBlock);
    expect(result).toContain('Line 1');
    expect(result).toContain('new content');
  });
});
