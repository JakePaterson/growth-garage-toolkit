import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { compileConfigs, isWithin } from '../src/compile.js';
import { initProject } from '../src/init.js';

/**
 * `kb.config.json` supplies template names and output paths, and `kb init` takes
 * a project name off the command line. All three become filesystem paths, so a
 * hostile or careless value must never be able to read or write outside its
 * allowed root. These tests are the proof.
 */
describe('path containment', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kb-sec-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('isWithin', () => {
    it('accepts a path inside the parent', () => {
      expect(isWithin('/a/b', '/a/b/c/d.md')).toBe(true);
    });

    it('rejects traversal out of the parent', () => {
      expect(isWithin('/a/b', '/a/b/../../etc/passwd')).toBe(false);
    });

    it('rejects an absolute path elsewhere', () => {
      expect(isWithin('/a/b', '/etc/passwd')).toBe(false);
    });

    it('rejects the parent itself (nothing to write there)', () => {
      expect(isWithin('/a/b', '/a/b')).toBe(false);
    });
  });

  describe('compileConfigs', () => {
    it('refuses to write outside the project dir (../ traversal)', () => {
      const projectDir = join(root, 'project');
      const wikiDir = join(root, 'wiki');
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(wikiDir, { recursive: true });

      // The file a hostile config would try to clobber.
      const victim = join(root, 'DOTFILE');
      writeFileSync(victim, 'original contents');

      const { generated, errors } = compileConfigs([
        {
          project: 'p',
          wikiDir,
          projectDir,
          ides: [
            {
              templateName: 'claude-md.hbs',
              outputPath: resolve(projectDir, '..', 'DOTFILE'),
              mode: 'write',
            },
          ],
        },
      ]);

      expect(generated).toHaveLength(0);
      expect(errors[0]).toMatch(/Refusing to write outside project dir/);
      // The victim file must be untouched.
      expect(existsSync(victim)).toBe(true);
      expect(readFileSync(victim, 'utf-8')).toBe('original contents');
    });

    it('refuses to read a template outside the templates dir', () => {
      const projectDir = join(root, 'project');
      const wikiDir = join(root, 'wiki');
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(wikiDir, { recursive: true });

      const { generated, errors } = compileConfigs([
        {
          project: 'p',
          wikiDir,
          projectDir,
          ides: [
            {
              templateName: '../../../../etc/passwd',
              outputPath: join(projectDir, 'CLAUDE.md'),
              mode: 'write',
            },
          ],
        },
      ]);

      expect(generated).toHaveLength(0);
      expect(errors[0]).toMatch(/Refusing to read template outside/);
    });
  });

  describe('initProject', () => {
    it('rejects a project name that traverses out of the vault', () => {
      const res = initProject(root, '../escaped');
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/Invalid project name/);
      expect(existsSync(resolve(root, '..', 'escaped'))).toBe(false);
    });

    it('rejects a project name containing a path separator', () => {
      const res = initProject(root, 'a/b');
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/Invalid project name/);
    });

    it('still accepts a normal project name', () => {
      const res = initProject(root, 'my-project');
      expect(res.success).toBe(true);
      expect(existsSync(join(root, 'my-project', '_summary.md'))).toBe(true);
    });
  });
});
