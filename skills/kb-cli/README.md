# agent-kb

A knowledge base for AI coding agents that **maintains itself**.

Every article carries a confidence level and a "last verified" date, so the
wiki can tell you — and your agent — when it's rotting, instead of quietly
going stale in the background. One command compiles that wiki into every
IDE's config file. Another searches it, ranked by how much you should trust
what it finds.

## The problem

Agents accumulate project context in CLAUDE.md, AGENTS.md, README files,
Cursor rules — and all of it goes stale the moment the code changes. Nobody
re-reads a 400-line CLAUDE.md to check if paragraph twelve is still true.
The result: agents either work from outdated assumptions, or re-derive
things from scratch every session because nothing durable was ever written
down.

`agent-kb` treats knowledge as data with a shelf life, not prose you trust
forever:

## Three things it does

**1. Tracks staleness and confidence, so the KB flags its own rot.**
Every article's frontmatter records `confidence` (`high` / `medium` / `low`
/ `unverified`) and `last_verified`. `kb lint` reports every article overdue
for a recheck, everything below a confidence bar, broken wiki-links, and
orphaned articles nothing else points to — a health report for a wiki, not
just a spellcheck.

**2. Compiles one source into every IDE's config file.**
Write the knowledge once. `kb compile` renders it through Handlebars
templates and injects the result into `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`,
`.cursor/rules/*.mdc`, `.cline/rules/*.md` — whatever your team's mix of
editors happens to be — between `<!-- KB:START -->` / `<!-- KB:END -->`
markers, so hand-written context above and below survives every
regeneration.

**3. Searches ranked by confidence, not just keyword match.**
`kb search "<query>"` full-text-and-frontmatter searches the vault and
scores results up for `high`-confidence articles and down for
`unverified` ones, so the top hit is the thing most likely to be true, not
just the thing that matched the most words.

In production, a deployment of this exact tool manages 107 articles across
several project wikis, with an average article freshness of about 29 days,
and auto-generates IDE config for 3 projects across multiple editors on
every `kb compile` run.

## Install

```bash
git clone <this-repo> agent-kb
cd agent-kb
npm install
```

`kb` runs directly against TypeScript source via `tsx` — there's no build
step. Link it onto your `PATH` if you want a bare `kb`:

```bash
npm link
```

Requires Node 18+.

## Quick start

Try it against the bundled example vault at `examples/vault/` before
touching your own docs:

```bash
KB_ROOT=examples/vault ./bin/kb search widget
KB_ROOT=examples/vault ./bin/kb lint
KB_ROOT=examples/vault ./bin/kb index
KB_ROOT=examples/vault ./bin/kb compile
```

`lint` should report the deliberately-stale, low-confidence example article
(`legacy-endpoint.md`) as both stale and low-confidence — nothing else.
`index` regenerates `examples/vault/_index.md` (already shipped, generated,
so this is idempotent). `compile` reads `examples/vault/kb.config.json` and
writes/injects `CLAUDE.md` and `AGENTS.md` into a throwaway
`examples/target-project/` directory (created on first run) — it also
regenerates `_index.md` first, since compiling rebuilds the index, then the
IDE configs.

To start your own vault: copy `examples/vault/` somewhere, replace the
articles, and edit `kb.config.json` to point at your real project
directories. Then either `export KB_ROOT=/path/to/your/vault` or run `kb`
from inside it.

## Frontmatter schema

Every article is markdown with YAML frontmatter up top, validated against
[`schema.json`](./schema.json) — copy that file into your vault's
`.wiki-meta/` (or wherever you keep tooling internals) as your starting
schema and tighten it from there (e.g. turn `project`/`category` into
enums once you know your project/category set):

```yaml
---
title: "Widget Auth API"               # required
description: "One-line, factual summary of what this article covers"  # ≤160 chars — feeds `kb index`
project: widget-api                    # matches a project `name` in kb.config.json
category: apis                         # apis | frameworks | services | patterns |
                                        #   domain | architecture | decisions | _business
tags: [auth, tokens]
sources:                               # optional — where the info came from
  - url: https://docs.example.com/widget-auth-api/
    fetched: "2026-07-01"
confidence: high                       # high | medium | low | unverified
last_verified: "2026-07-01"            # bump when you re-check this against the source/API
last_updated: "2026-07-01"             # bump whenever content changes
reverify_after: "30d"                  # optional — override the category default, or "never" for evergreen content
status: current                       # current | migrating | deprecated | planned
---
```

Default staleness windows by category (override per-article with
`reverify_after`):

| category | days |
|---|---|
| apis, services | 30 |
| domain | 45 |
| frameworks, architecture, _business | 90 |
| patterns | 180 |
| decisions | 365 |
| (anything else) | 45 |

Body `[[wikilinks]]` are the only link system — there's no `related:`
frontmatter field. If two articles are meaningfully connected, link them in
the body; `kb lint --connections` also suggests links between same-tagged
articles that aren't yet linked to each other.

## Commands

```bash
kb search "<query>"                       # full-text + frontmatter search, scored by confidence
kb search "<q>" --project <name> --confidence high --stale

kb lint                                   # stale / low-confidence / broken-link / orphan report
kb lint --project <name>
kb lint --connections                     # also suggest links between same-tagged, unlinked articles

kb ingest --url "<url>"                   # stub a new article into raw/inbox/ for later compilation
kb ingest                                 # list items waiting in the inbox

kb index                                  # regenerate _index.md for every project wiki
kb index --project <name>                 # scope to one project

kb compile                                # regenerate _index.md, then IDE configs, driven by kb.config.json
kb compile --project <name> --ide claude  # scope to one project and/or one IDE

kb init <project>                         # scaffold a new project wiki: _summary.md + a generated _index.md
kb init <project> --name "Display Name"   # override the derived title

kb harvest list                           # example integration, see below
kb harvest stamp <verdicts.json>          # example integration, see below
```

### `kb index` and `_index.md`

`_index.md` is a **generated** catalog — every content article, grouped by
`category` (missing category → "Other"), each category sorted alphabetically
by slug, one line per article: `- [[slug]] — description`. It always ends
with `<!-- Generated by \`kb index\`. Do not edit by hand. -->`; treat that
line as a signal not to hand-edit the file.

`kb index` resolves which project wikis to regenerate the same way `compile`
does — from `kb.config.json` if one exists, otherwise every direct
subdirectory of `KB_ROOT`. It preserves an existing `_index.md`'s `title:` if
one is already there, rather than re-deriving it every run — so if you
hand-pick a title once, regeneration won't clobber it.

`kb compile` calls this internally before rendering IDE configs, so a
`_index.md` regenerated by `compile` reflects the current wiki state, not a
stale snapshot.

### Obsidian display

Hub files are deliberately named `_index.md` and `_summary.md` — predictable,
sortable-to-the-top filenames an agent can find without guessing. If you
browse the vault in Obsidian, that means the graph view and quick switcher
show "_index" / "_summary" by filename instead of a readable title. Install
the **Front Matter Title** community plugin (Settings → Community plugins)
to have Obsidian display each file's `title:` frontmatter instead — it
doesn't rename anything on disk, so `kb` keeps working exactly the same.

### kb.config.json

`kb compile` reads `kb.config.json` from `KB_ROOT` (or the current
directory) — there is no hardcoded project list in the tool itself:

```json
{
  "projects": [
    {
      "name": "example-project",
      "wikiPath": ".",
      "path": "../target-project",
      "ideConfigs": [
        { "template": "claude-md.hbs", "output": "CLAUDE.md", "mode": "inject" },
        { "template": "agents-md.hbs", "output": "AGENTS.md", "mode": "inject" },
        { "template": "cursorrules.hbs", "output": ".cursor/rules/wiki-context.mdc", "mode": "write" }
      ]
    }
  ],
  "bookmarkSource": "./bookmarks-example"
}
```

- `name` — identifies the project; matches the `project:` frontmatter field
  on its articles, and is what `--project` filters against.
- `wikiPath` — directory (relative to `KB_ROOT`) holding this project's
  articles. Defaults to `name` if omitted.
- `path` — directory (relative to `kb.config.json`) where this project's IDE
  config files live.
- `ideConfigs[].mode` — `inject` rewrites only the `KB:START`/`KB:END` block
  (creating the file on first run); `write` overwrites the whole file.
  Templates are bundled with the package at `templates/*.hbs` — bring your
  own by adding more `.hbs` files there and referencing them by filename.

The bundled templates reference `~/knowledge-base/` as the conventional vault
location in their prose (e.g. "Read `~/knowledge-base/<project>/_summary.md`").
If your vault lives somewhere else, edit `templates/*.hbs` to match — they're
plain Handlebars files, not code.

### harvest — an example integration

`kb harvest` triages markdown notes with a `bookmark_id` frontmatter field
(as exported by some bookmarking tool) into "keep" (file into the wiki) or
"discard" verdicts, then stamps the result back onto the note. It's shipped
as a worked example of "feed an external source into the KB," not a
maintained integration for any specific bookmarking service — point
`bookmarkSource` in `kb.config.json` at wherever your own export lives, or
skip the command entirely if you don't need it.

## Recommended usage: reading without blowing the context budget

This is a convention the tool encourages, not something it enforces: as a
vault grows, don't have an agent load the whole thing into context. Instead:

1. Read `llms.txt` at the vault root first — the entry point.
2. Then the relevant project's `_summary.md` — overview and active work.
3. Then `_index.md` if present — the article list.
4. Only then open the specific article(s) actually needed.

For broad questions ("how does the whole X system work?"), delegate to a
sub-agent that reads widely and returns a short distilled summary instead of
pulling many raw articles into the main conversation.

See [`CONVENTIONS.md`](./CONVENTIONS.md) for the full generic write-up of
this workflow (layout, the reading spine, the confidence/verification model,
hygiene rules) — copy it into your own vault as a starting contributing
guide and adapt it to your project names and categories.

## Development

```bash
npm test          # vitest
npm run test:watch
```

## License

MIT — see `LICENSE`.
