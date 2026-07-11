import { Command } from 'commander';
import chalk from 'chalk';
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'fs';
import { resolve as pathResolve } from 'path';
import { searchArticles } from './search.js';
import { lintArticles } from './lint.js';
import { listInbox, createStubArticle } from './ingest.js';
import { compileConfigs, type CompileTarget } from './compile.js';
import { generateIndex, titleCase } from './index-gen.js';
import { initProject } from './init.js';
import { KB_ROOT } from './constants.js';
import { loadConfig } from './config.js';
import { listUnevaluatedBookmarks, stampVerdicts, type HarvestVerdict } from './harvest.js';

interface IndexTarget {
  project: string;
  wikiDir: string;
}

/**
 * Resolves which project wikis to (re)generate `_index.md` for: driven by
 * kb.config.json when one exists (same resolution `compile` uses), otherwise
 * every direct subdirectory of KB_ROOT that isn't hidden/tooling.
 */
function resolveIndexTargets(projectFilter?: string): IndexTarget[] {
  const loaded = loadConfig(KB_ROOT);
  let targets: IndexTarget[];

  if (loaded && loaded.config.projects && loaded.config.projects.length > 0) {
    targets = loaded.config.projects.map((p) => ({
      project: p.name,
      wikiDir: pathResolve(KB_ROOT, p.wikiPath ?? p.name),
    }));
  } else {
    targets = readdirSync(KB_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => ({ project: d.name, wikiDir: pathResolve(KB_ROOT, d.name) }));
  }

  return projectFilter ? targets.filter((t) => t.project === projectFilter) : targets;
}

function regenerateIndexes(targets: IndexTarget[]): string[] {
  const written: string[] = [];
  for (const target of targets) {
    if (!existsSync(target.wikiDir)) continue;
    // Title-case the config project slug ("widget-api" -> "Widget Api",
    // "acmecorp" -> "Acmecorp") — generateIndex still prefers whatever title
    // an existing _index.md already has over this.
    const content = generateIndex(target.wikiDir, titleCase(target.project));
    const indexPath = pathResolve(target.wikiDir, '_index.md');
    writeFileSync(indexPath, content);
    written.push(indexPath);
  }
  return written;
}

const program = new Command();

program
  .name('kb')
  .description('Knowledge base CLI for managing an agent-facing wiki')
  .version('1.0.0');

program
  .command('search <query>')
  .description('Search wiki articles')
  .option('-p, --project <name>', 'Filter by project')
  .option('-c, --confidence <level>', 'Filter by confidence (high|medium|low|unverified)')
  .option('-s, --stale', 'Only show stale articles')
  .action((query: string, opts: { project?: string; confidence?: string; stale?: boolean }) => {
    const results = searchArticles(query, KB_ROOT, opts);

    if (results.length === 0) {
      console.log(chalk.yellow('No articles found.'));
      return;
    }

    console.log(chalk.bold(`Found ${results.length} article(s):\n`));
    for (const r of results) {
      const conf = r.article.frontmatter.confidence ?? 'unverified';
      const confColor =
        conf === 'high' ? chalk.green : conf === 'medium' ? chalk.yellow : chalk.red;

      console.log(
        `  ${chalk.bold(r.article.frontmatter.title ?? r.article.relativePath)} ${confColor(`[${conf}]`)} ${chalk.dim(`(score: ${r.score.toFixed(1)})`)}`
      );
      console.log(`  ${chalk.dim(r.article.relativePath)}`);
      if (r.matchedLines.length > 0) {
        console.log(`  ${chalk.dim(r.matchedLines[0].slice(0, 100))}`);
      }
      console.log();
    }
  });

program
  .command('lint')
  .description('Run wiki health checks')
  .option('-p, --project <name>', 'Filter by project')
  .option('-s, --stale-only', 'Only check freshness')
  .option('--connections', 'Include connection suggestions')
  .action((opts: { project?: string; staleOnly?: boolean; connections?: boolean }) => {
    const report = lintArticles(KB_ROOT, opts);

    if (report.issues.length === 0) {
      console.log(chalk.green('Wiki is healthy! No issues found.'));
    } else {
      console.log(chalk.bold('Wiki Health Report\n'));

      const grouped: Record<string, typeof report.issues> = {};
      for (const issue of report.issues) {
        (grouped[issue.type] ??= []).push(issue);
      }

      const labels: Record<string, string> = {
        stale: 'STALE',
        low_confidence: 'LOW CONFIDENCE',
        broken_link: 'BROKEN LINKS',
        orphan: 'ORPHANS',
        connection: 'SUGGESTED CONNECTIONS',
        coverage_gap: 'COVERAGE GAPS',
        missing_title: 'MISSING TITLE',
        missing_field: 'MISSING FIELDS',
        description_length: 'DESCRIPTION TOO LONG',
        duplicate_slug: 'DUPLICATE SLUGS',
      };

      for (const [type, issues] of Object.entries(grouped)) {
        console.log(chalk.bold.underline(labels[type] ?? type));
        for (const issue of issues) {
          const icon =
            issue.severity === 'error'
              ? chalk.red('x')
              : issue.severity === 'warning'
                ? chalk.yellow('!')
                : chalk.blue('*');
          console.log(`  ${icon} ${chalk.dim(issue.file)}`);
          console.log(`    ${issue.message}`);
          if (issue.suggestion) console.log(`    ${chalk.dim(issue.suggestion)}`);
        }
        console.log();
      }
    }

    console.log(chalk.bold('STATS'));
    console.log(`  Total articles: ${report.stats.totalArticles}`);
    console.log(
      `  High: ${report.stats.highConfidence} | Medium: ${report.stats.mediumConfidence} | Low: ${report.stats.lowConfidence} | Unverified: ${report.stats.unverified}`
    );
    console.log(`  Average freshness: ${report.stats.averageFreshnessDays} days`);
  });

program
  .command('ingest')
  .description('Process raw/inbox items into wiki articles')
  .option('--url <url>', 'Fetch a URL and save to inbox (stub only)')
  .action((opts: { url?: string }) => {
    if (opts.url) {
      console.log(chalk.yellow('URL ingestion creates a stub. The LLM should compile the full article.'));
      const stub = createStubArticle({
        title: 'Untitled — needs LLM compilation',
        sourceUrl: opts.url,
      });
      const slug = 'stub-' + Date.now();
      const dest = pathResolve(KB_ROOT, 'raw', 'inbox', `${slug}.md`);
      writeFileSync(dest, stub);
      console.log(chalk.green(`Stub saved to ${dest}`));
      console.log(chalk.dim('Run kb ingest again to file it into a project wiki.'));
      return;
    }

    const items = listInbox(KB_ROOT);
    if (items.length === 0) {
      console.log(chalk.yellow('Inbox is empty.'));
      return;
    }
    console.log(chalk.bold(`${items.length} item(s) in inbox.`));
    console.log(chalk.dim('Items need to be filed by the LLM with project/category targets.'));
    for (const item of items) {
      console.log(`  - ${item}`);
    }
  });

program
  .command('compile')
  .description('Generate IDE config files from wiki, driven by kb.config.json')
  .option('-p, --project <name>', 'Only compile for one project')
  .option('--ide <name>', 'Only compile for one IDE (claude|cursor|cline|codex|gemini)')
  .action((opts: { project?: string; ide?: string }) => {
    const loaded = loadConfig(KB_ROOT);

    if (!loaded || !loaded.config.projects || loaded.config.projects.length === 0) {
      console.log(
        chalk.yellow(
          'No kb.config.json found (checked KB_ROOT and the current directory).'
        )
      );
      console.log(
        chalk.dim(
          'Create one that defines { "projects": [{ "name", "path", "ideConfigs": [...] }] } — see README.md and examples/vault/kb.config.json.'
        )
      );
      return;
    }

    const { config, configDir } = loaded;

    let allTargets: CompileTarget[] = config.projects.map((p) => ({
      project: p.name,
      wikiDir: pathResolve(KB_ROOT, p.wikiPath ?? p.name),
      projectDir: pathResolve(configDir, p.path),
      ides: p.ideConfigs.map((ide) => ({
        templateName: ide.template,
        outputPath: pathResolve(configDir, p.path, ide.output),
        mode: ide.mode,
      })),
    }));

    let targets = allTargets;
    if (opts.project) {
      targets = targets.filter((t) => t.project === opts.project);
    }
    if (opts.ide) {
      const ideMap: Record<string, string> = {
        claude: 'claude-md.hbs',
        cursor: 'cursorrules.hbs',
        cline: 'cline-rules.hbs',
        codex: 'agents-md.hbs',
        gemini: 'gemini-md.hbs',
      };
      const templateName = ideMap[opts.ide];
      if (templateName) {
        targets = targets.map((t) => ({
          ...t,
          ides: t.ides.filter((i) => i.templateName === templateName),
        }));
      }
    }

    // compile = rebuild indexes THEN IDE configs, so key-article extraction
    // and the generated _index.md both reflect the current wiki state.
    const indexesWritten = regenerateIndexes(targets.map((t) => ({ project: t.project, wikiDir: t.wikiDir })));
    if (indexesWritten.length > 0) {
      console.log(chalk.bold.green(`Regenerated ${indexesWritten.length} _index.md file(s):`));
      for (const i of indexesWritten) {
        console.log(`  ${chalk.dim(i)}`);
      }
    }

    const { generated, errors } = compileConfigs(targets);

    if (generated.length > 0) {
      console.log(chalk.bold.green(`Generated ${generated.length} config file(s):`));
      for (const g of generated) {
        console.log(`  ${chalk.dim(g)}`);
      }
    }
    if (errors.length > 0) {
      console.log(chalk.bold.red(`${errors.length} error(s):`));
      for (const e of errors) {
        console.log(`  ${chalk.red(e)}`);
      }
    }
  });

program
  .command('index')
  .description('Regenerate _index.md for each project wiki (grouped by category, with descriptions)')
  .option('-p, --project <name>', 'Only regenerate for one project')
  .action((opts: { project?: string }) => {
    const targets = resolveIndexTargets(opts.project);

    if (targets.length === 0) {
      console.log(chalk.yellow('No project wikis found to index.'));
      return;
    }

    const written = regenerateIndexes(targets);
    if (written.length === 0) {
      console.log(chalk.yellow('No wiki directories existed on disk — nothing written.'));
      return;
    }

    console.log(chalk.bold.green(`Wrote ${written.length} _index.md file(s):`));
    for (const w of written) {
      console.log(`  ${chalk.dim(w)}`);
    }
  });

program
  .command('init <project>')
  .description('Scaffold a new project wiki: _summary.md + a generated _index.md')
  .option('--name <displayName>', 'Human-friendly project name (defaults to Title Case of the project slug)')
  .action((project: string, opts: { name?: string }) => {
    const result = initProject(KB_ROOT, project, opts.name);
    if (!result.success) {
      console.log(chalk.yellow(result.message));
      return;
    }
    console.log(chalk.green(result.message));
  });

const harvest = program
  .command('harvest')
  .description('Triage bookmark/note files into the KB — an example integration, see README');

harvest
  .command('list')
  .description('Print bookmark notes not yet evaluated, as JSON')
  .action(() => {
    const loaded = loadConfig(KB_ROOT);
    const bookmarkSource = loaded?.config.bookmarkSource;
    if (!loaded || !bookmarkSource) {
      console.log(
        chalk.yellow(
          'No "bookmarkSource" configured in kb.config.json. This command is an example integration — set bookmarkSource to your own bookmark-export directory.'
        )
      );
      return;
    }
    const dir = pathResolve(loaded.configDir, bookmarkSource);
    console.log(JSON.stringify(listUnevaluatedBookmarks(dir), null, 2));
  });

harvest
  .command('stamp <verdictsJson>')
  .description('Apply triage verdicts (JSON file: HarvestVerdict[]) to bookmark frontmatter')
  .action((verdictsJson: string) => {
    const verdicts = JSON.parse(readFileSync(verdictsJson, 'utf-8')) as HarvestVerdict[];
    const results = stampVerdicts(verdicts);
    const ok = results.filter((r) => r.success).length;
    console.log(chalk.green(`Stamped ${ok}/${results.length} notes.`));
    for (const r of results.filter((r) => !r.success)) {
      console.log(chalk.red(`  ${r.path}: ${r.error}`));
    }
  });

program.parse();
