---
name: agent-kb
description: Use when managing an agent-facing knowledge base — keeping docs fresh, checking for stale or low-confidence articles, compiling one wiki source into every IDE's config file (CLAUDE.md, AGENTS.md, GEMINI.md, Cursor/Cline rules), regenerating the article index, scaffolding a new project wiki, searching wiki articles by confidence, or filing new sources into a wiki. Trigger words include "kb search", "kb lint", "kb compile", "kb index", "kb init", "knowledge base", "wiki health", "stale docs", "update the wiki", "compile IDE config", "new project wiki".
author: jake@travelry.net
---

# agent-kb

`agent-kb` is a CLI (installed as `kb`) for running a markdown knowledge base
that an AI coding agent both reads from and writes back to. It exists so
project context doesn't quietly rot: every article tracks its own
confidence and freshness, and one wiki compiles into every IDE's config file
instead of being copy-pasted into each one separately.

## Mental model

- **The wiki is the territory; CLAUDE.md/AGENTS.md are the map.** Don't
  duplicate knowledge-base content into an IDE config file — link to the
  article instead. When a section in an IDE config grows past a paragraph,
  move the detail into an article.
- **Every article is a claim with a timestamp and a confidence level**, not
  just prose. That's what makes `kb lint` meaningful.
- **Reading is just-in-time.** Don't load the whole vault into context.
  Read `llms.txt` -> the project's `_summary.md` -> `_index.md` (if present)
  -> only the specific article(s) needed. For a broad survey ("how does the
  whole X system work?"), delegate to a sub-agent and have it return a
  distilled 1-2k-token summary instead of loading many raw articles.

## Commands

```bash
kb search "<query>"                       # full-text + frontmatter search, scored by confidence
kb search "<q>" --project <name> --confidence high
kb search "<q>" --stale                   # only stale articles

kb lint                                   # wiki health: stale / low-confidence / broken-link / orphan / missing-field
kb lint --project <name>
kb lint --connections                     # also suggest links between same-tagged, unlinked articles

kb ingest --url "<url>"                   # stub a new article into raw/inbox/ for later compilation
kb ingest                                 # list items waiting in the inbox to be filed

kb index                                  # regenerate _index.md (categorized catalog) for every project wiki
kb index --project <name>                 # only one project

kb compile                                # regenerate _index.md, then IDE configs, from kb.config.json
kb compile --project <name> --ide claude  # only one project/IDE

kb init <project>                         # scaffold a new project wiki: _summary.md + a generated _index.md

kb harvest list                           # example integration — list unevaluated bookmark notes
kb harvest stamp <verdicts.json>          # example integration — apply triage verdicts
```

Set `KB_ROOT` to point at a vault that isn't the current directory:
`KB_ROOT=/path/to/vault kb lint`.

## The frontmatter contract

Every article's YAML frontmatter is the thing `lint` and `search` actually
reason over — validated against `schema.json` (copy it into your vault as a
starting point):

```yaml
---
title: "Widget Auth API"              # required
description: "One-line, factual summary of what this article covers"  # ≤160 chars — feeds `kb index`
project: widget-api                   # matches a project name in kb.config.json
category: apis                        # apis | frameworks | services | patterns |
                                       #   domain | architecture | decisions | _business
tags: [auth, tokens]
sources:
  - url: https://docs.example.com/widget-auth-api/
    fetched: 2026-07-01
confidence: high                      # high | medium | low | unverified
last_verified: "2026-07-01"           # bump when you re-check this against the source
last_updated: "2026-07-01"            # bump whenever content changes
reverify_after: "30d"                 # optional override of the category default, or "never" for evergreen content
status: current                       # current | migrating | deprecated | planned
---
```

`kb lint` flags an article as stale once `last_verified` is older than
`reverify_after` (or the category default) — unless `reverify_after: never`,
which skips the freshness check entirely for genuinely evergreen content
(settled decisions, ADRs). It also warns when a content article is missing
`project`, `category`, `confidence`, `last_updated`, or `description`, when a
`description` runs over 160 characters, and when two articles in different
folders share the same basename (an ambiguous `[[wikilink]]` target).

Body `[[wikilinks]]` are the only link system — there's no `related:`
frontmatter field. Add a `[[wikilink]]` in the body if you want the article
graph to actually connect two articles.

`_index.md` is generated by `kb index` (also run by `kb compile`) — a
categorized catalog of every article with a one-line description each.
Never hand-edit it; regenerate it instead.

## When an agent should run these

- **Before touching an unfamiliar integration or architecture** — run
  `kb search "<topic>"` first. Don't answer from training-data memory when
  a verified article exists.
- **After shipping anything non-trivial** (a feature, a schema change, a new
  integration, or fetching official API/framework docs mid-session) —
  update the relevant article: bump `last_updated`, and `last_verified` if
  you actually checked it against the source. Do this silently for factual
  updates (signatures, config, env vars); ask first if it contradicts an
  article currently marked `confidence: high`.
- **If the source is unreachable**, create a stub article with
  `confidence: low` rather than skip it — a visible gap beats a missing one.
- **After updating any article that feeds a compiled IDE config**, run
  `kb compile` so `CLAUDE.md`/`AGENTS.md`/etc. pick up the change. Never
  hand-edit the `<!-- KB:START -->...<!-- KB:END -->` block — it's
  regenerated, not authored.
- **Periodically, or when `kb lint` is mentioned**, run it and act on
  stale/broken-link findings for anything you're currently working near.
- **Starting a brand-new project wiki**, run `kb init <project>` instead of
  hand-creating `_summary.md`/`_index.md` — it scaffolds both and, if
  `kb.config.json` exists, adds the project entry for you.

See `README.md` for the config file format (`kb.config.json`) and setup.
