# living-system-map

**An interactive map of how your whole codebase actually fits together — one self-contained HTML file, no dependencies, no server.**

Click any feature and everything unrelated fades out, so you can see exactly what it touches and what touches it. Click again to drop into that feature's step-by-step flow.

Built for the moment someone asks "what happens when a user does X?" and the honest answer is that nobody has held the whole thing in their head for months.

---

## Why this instead of an import graph

Tools that parse your imports produce a hairball. They can tell you `checkout.ts` requires `stock.ts`; they cannot tell you *"a paid order reserves copies in Stock & Warehouse."*

That sentence is the product. So the mapping is done by an AI agent reading your code, not by a parser — which also means it works on any language, any stack, any mix of the two.

The result is a picture at the altitude people actually think at: features, not files.

---

## What you get

- **One HTML file.** Open it, email it, drop it in a wiki. No build tooling to view, no CDN, no fonts to fetch, works offline.
- **Focus mode.** Click a feature, everything unconnected drops to 4% opacity.
- **Colour-coded connections.** Five relationship types — triggers, feeds, calls, reads, emits — so you can see at a glance whether something *starts* another thing or just *reads* it.
- **Honest status.** Every node carries how finished it really is. The half-built and admin-only ones are usually the most useful things on the board.
- **Drill-down.** Any feature can carry a step-by-step flow with prompts, fallbacks, quirks, cost notes and key file paths.
- **Light and dark**, keyboard-dismissable, respects `prefers-reduced-motion`.

---

## Use it

Copy this folder anywhere, or clone the toolkit:

```bash
git clone https://github.com/JakePaterson/growth-garage-toolkit.git
cd growth-garage-toolkit/skills/living-system-map
```

**See it working first** — the example is a made-up online bookshop:

```bash
cd example && node ../build.js && open system-map.html
```

**Then map your own repo.** Hand `SKILL.md` to your coding agent (Claude Code, Cursor, whatever you use) and point it at your codebase. It walks the survey → confirm → trace → connect → build loop, and writes `system-map.data.js` for you.

Or write the data file by hand: it is one plain JS object, documented in [SCHEMA.md](./SCHEMA.md).

```bash
node build.js                        # reads ./system-map.data.js
node build.js path/to/data.js -o out.html
```

The build validates before it writes. Unknown node ids, duplicate ids and bad edge kinds are hard errors, because every one of them is a way to end up with a map that silently drops a connection or renders blank. It also warns about the things that are usually real gaps — a feature with no connections at all, an edge with no label.

---

## Keeping it honest

A map is a snapshot of the day it was made, and a polished interactive one is *more* dangerous when stale than a rough sketch, because it looks current.

Two ways to handle it, and they are not equivalent:

- **A line in your agent instructions** (`CLAUDE.md`, `AGENTS.md`): when you ship something that adds a feature or changes what talks to what, update the data file and rerun the build. It is a rule, and rules get skipped.
- **A CI step or commit hook** that rebuilds and fails when the data file is older than the source it describes. Mechanical, so it does not get skipped.

Either way, put the trace date in the `subtitle`. A stale map should say so out loud.

---

## Files

| file | what it is |
|---|---|
| `SKILL.md` | the agent-facing instructions — how to survey a repo and decide what the nodes and edges are |
| `SCHEMA.md` | full data file reference |
| `build.js` | the builder, zero dependencies, Node 14+ |
| `template.html` | the rendering engine |
| `example/` | a complete made-up map you can build and click through |

---

MIT. Part of the [Growth Garage Toolkit](https://github.com/JakePaterson/growth-garage-toolkit).
