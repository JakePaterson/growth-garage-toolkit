# Knowledge Base Conventions

This is the generic workflow this tool assumes. Adopt it as-is, or use it as a
starting point and adjust to your own vault's layout — the CLI doesn't
enforce any of this beyond what `kb lint` checks.

The KB is the **authoritative source** for integration details, architecture,
domain knowledge, and decision history. Your IDE configs (CLAUDE.md,
AGENTS.md, GEMINI.md, Cursor/Cline rules) are the high-level map; the KB is
the detail.

---

## Layout

```
<KB_ROOT>/
├── .wiki-meta/               # tooling internals: schema.json, caches (don't hand-edit)
├── <project-a>/               # one project's wiki
├── <project-b>/
│   ├── _summary.md             #   overview, active work, critical rules
│   ├── _index.md                #   generated catalog — every article, one line each
│   └── apis/ architecture/ domain/ decisions/ frameworks/ services/ patterns/
├── raw/inbox/                 # ingested-but-not-yet-filed sources
└── kb.config.json             # maps projects to wiki dirs + IDE config targets
```

Each project wiki has:
- `_summary.md` — a hand-written overview: what the project is, what's
  actively in progress, and any critical rules an agent must never get
  wrong. This is the one file a human should keep accurate by hand.
- `_index.md` — a **generated** catalog of every article, grouped by
  category, with a one-line description each. Regenerate it with `kb index`
  (or `kb compile`, which regenerates it first). Never hand-edit it.
- Subdirectories by category: `apis/`, `architecture/`, `domain/`,
  `decisions/`, `frameworks/`, `services/`, `patterns/`, plus whatever
  categories fit your domain.

**The rule of thumb:** `_summary.md` is *read me* — a human curates it, an
agent reads it in full every session. `_index.md` is *search me* — a
machine generates it, an agent scans it to find the one or two articles
worth opening, and never reads the whole thing as prose.

---

## The reading spine (llms.txt → _summary → _index → article)

Don't load a whole vault into context. Read deliberately, in this order:

1. `llms.txt` at the vault root — the entry point. One paragraph orienting
   an agent to how this vault is organized and where to go next.
2. The relevant project's `_summary.md` — overview, active work, critical
   rules. Read this in full; it's short by design.
3. `_index.md` — scan the categorized list to find the specific article(s)
   that answer the question at hand.
4. Only then open the specific article(s) actually needed.

For a broad question ("how does the whole X system work?"), delegate to a
sub-agent that reads widely and returns a short distilled summary instead of
pulling many raw articles into the main conversation. Give every sub-agent
the same entry points (`llms.txt`, the project `_summary.md`/`_index.md`) so
parallel sub-agents share context and don't return conflicting assumptions.

---

## Article frontmatter

Every article is markdown with YAML frontmatter, validated against
`schema.json`:

```yaml
---
title: "Widget Auth API"              # required
description: "One-line, factual summary of what this article covers"  # ≤160 chars, powers _index.md entries
project: widget-api                   # matches a project name in kb.config.json
category: apis                        # apis | frameworks | services | patterns |
                                       #   domain | architecture | decisions | _business (or your own set)
tags: [auth, tokens]
sources:                              # optional — where the info came from
  - url: https://docs.example.com/widget-auth-api/
    fetched: 2026-07-01
confidence: high                      # high | medium | low | unverified
last_verified: "2026-07-01"           # bump when you re-check this against the source
last_updated: "2026-07-01"            # bump whenever content changes
reverify_after: "30d"                 # optional — override the category's default staleness window
status: current                       # current | migrating | deprecated | planned
---
```

`description` is the single-line, factual summary that feeds the generated
`_index.md` entry for this article — keep it to one line and under 160
characters. If omitted, `kb index` falls back to the first line of the
`## Summary` section, but an explicit `description` is preferred and `kb
lint` warns when it's missing.

Body `[[wikilinks]]` are the only link system — there is no `related:`
frontmatter field. If two articles are meaningfully connected, link them in
the body; `kb lint --connections` will also suggest links between
same-tagged articles that aren't yet linked.

---

## The confidence / verification model

Every article carries two independent signals:

- **`confidence`** — how much you should trust the content: `high` (verified
  against an authoritative source), `medium` (partially verified or inferred
  from code), `low` (inferred, not checked), `unverified` (a stub).
- **Freshness** (`last_verified` + `reverify_after`) — how long ago that
  trust was confirmed. `kb lint` flags an article stale once `last_verified`
  is older than `reverify_after` (or the category default below).

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

**Use `reverify_after: never` for genuinely evergreen content** — settled
decisions, ADRs, anything that won't quietly go out of date. It skips the
freshness check entirely; `kb lint` never flags it stale no matter how old
`last_updated` gets. Don't reach for this by default — most content does
rot — but for the rare article that truly won't, this stops it from
generating noise forever.

Set `confidence: high` only after verifying against an authoritative
source (an official API/framework doc, a live schema, a deployed config —
whatever "the source of truth" means for that fact). Use `medium` for
partial verification, `low` for inferred-from-code-only, `unverified` for
stubs.

---

## When to update the KB

Update **proactively** — don't wait to be asked. After any of:

- Shipping a feature or refactoring a pipeline
- Adding, removing, or archiving an integration
- Applying a schema migration
- Fetching official API/framework docs during the session
- Learning anything that contradicts an existing article

**Update silently** (no confirmation needed): factual changes — API
signatures, config options, env vars, DB columns, file paths; new or removed
integrations; schema migrations applied; bug fixes that change documented
behavior.

**Ask first**: design decisions that override existing documented patterns;
major architectural pivots; anything that contradicts an article currently
marked `confidence: high`.

**Stub if unverifiable**: source unreachable → create the article with
`confidence: low` (or `unverified`) so the gap is visible. A visible stub
beats a missing article.

After updating an article, bump `last_updated` and (if you verified against
the source) `last_verified`. If the article feeds a compiled IDE config, run
`kb compile` afterward so `CLAUDE.md`/`AGENTS.md`/etc. pick up the change.

---

## Hygiene

`kb lint` reports, in order of how much attention each deserves:

- **Errors** — broken `[[wikilinks]]`, and nav files (`_index.md`/
  `_summary.md`) missing a required `title`.
- **Warnings** — stale articles, low/unverified confidence, missing core
  fields (`project`, `category`, `confidence`, `last_updated`,
  `description`) on a content article, an over-long `description`, and
  ambiguous slugs (two articles in different folders sharing a basename —
  an ambiguous `[[wikilink]]` target).
- **Suggestions** — orphaned articles (nothing links to them) and, with
  `--connections`, same-tagged articles that aren't linked to each other.

If `kb lint` flags an article you're touching, fix it in the same change —
verify and bump `last_verified`, add the missing field, or shorten the
description.

Don't duplicate KB content into CLAUDE.md/AGENTS.md/GEMINI.md. Those are the
*map*; the KB is the *territory*. When a section in an IDE config grows past
a paragraph or two, move the detail into a KB article and link to it. Don't
hand-edit the `<!-- KB:START -->` ... `<!-- KB:END -->` block in any IDE
config, or the `_index.md` catalog — both are regenerated by `kb compile` /
`kb index`, not authored.

---

## Workflow recap

1. **Before coding** → `kb search "<topic>"` (or read the relevant article
   directly) for anything you're not certain about. Don't answer from
   training-data memory when a verified article exists.
2. **While coding** → if you fetch API docs or learn something new, note it.
3. **After shipping** → update or create the relevant article, bump
   `last_updated` / `last_verified`, then `kb compile` if the change touches
   a project whose IDE configs are generated from this vault.
4. **If `kb lint` complains about an article you touched** → fix it in the
   same change.

If you're not sure whether a fact belongs in the KB or in an IDE config: KB
if it's about *how a thing works*; the IDE config if it's about *how to
navigate this repo*.
