# living-system-map

**Ask how something works. Get a map you can click, not six paragraphs you have to hold in your head.**

This gives your coding agent a way to *draw* instead of explain. You ask "how does checkout actually work?" or "what happens when this webhook fires?", and it hands back a real interactive diagram: every piece, every connection between them, and a step-by-step breakdown of the two or three parts that are genuinely fiddly.

It writes one self-contained HTML file. That means it publishes straight to an artifact link, opens from your desktop, or drops in a wiki, with nothing to install and nothing to serve.

---

## Why this is useful in practice

**Prose is the wrong shape for a system.** Ask any AI to explain a pipeline and you get a wall of numbered paragraphs. You read it once, follow about half, and cannot find the bit you needed twenty minutes later. A map you can click is the right shape: you see the whole thing at once, then poke at the part you care about.

**You get it on demand, not once a quarter.** This is not a documentation project you schedule. It runs mid-conversation. Someone asks a question, your agent traces the code and draws the answer.

**It goes as deep as the question needs, and no deeper.** Most things on the map are a card and one plain sentence. The two or three that people actually get wrong get opened up into a full step-by-step flow, each step carrying what it does, what it falls back to when it breaks, what it costs, and which files to look at. That selective depth is the point. A diagram that treats every box as equally important tells you nothing about where the risk lives.

**It works on any stack.** The tracing is done by a model reading your code, not by a parser, so a Python service and a TypeScript frontend and a pile of shell scripts all map the same way.

---

## What you can point it at

- **A whole codebase.** The onboarding picture. Every feature, how they connect, what is live and what is half-built.
- **One flow.** Checkout. Signup. A single cron job and everything downstream of it.
- **A pipeline.** Where data enters, what transforms it, where it lands.
- **A change you are planning.** Draw the system as it is, then as it would be, and look at both.

---

## What comes out

- **One HTML file.** No dependencies, no CDN, no fonts to fetch, works offline.
- **Focus mode.** Click anything and everything unconnected drops away, so you can trace one thing's blast radius.
- **Colour-coded connections.** Five relationship types, so you can tell at a glance whether one thing *starts* another or merely *reads* it.
- **Honest status.** Every piece carries how finished it really is. The half-built and admin-only ones are usually the most useful things on the board.
- **Drill-down where it earns it.** Any node can open into a sequential flow, with a parallel lane for the things that run alongside.
- **Light and dark**, keyboard dismissable, respects reduced-motion.

---

## Use it

```bash
git clone https://github.com/JakePaterson/growth-garage-toolkit.git
cd growth-garage-toolkit/skills/living-system-map
```

See it working first. The example is a made-up online bookshop:

```bash
cd example && node ../build.js && open system-map.html
```

Then point it at your own code. Hand `SKILL.md` to your agent (Claude Code, Cursor, whatever you use) and ask for a map of whatever you are trying to understand. It surveys, traces, and writes the data file; `build.js` renders it.

```bash
node build.js                          # reads ./system-map.data.js
node build.js path/to/data.js -o out.html
```

You can also write the data by hand. It is one plain JS object, documented in [SCHEMA.md](./SCHEMA.md).

The build validates before it writes a byte. Unknown ids, duplicate ids and bad connection types are hard errors, because each one is a way to end up with a map that silently drops a link or renders blank. It also warns about the things that usually mean a real gap, like a node with no connections at all.

---

## Keeping it honest

A map is a snapshot of the day it was drawn, and a polished interactive one is *more* dangerous when stale than a rough sketch, because it looks current.

If the map is a one-off answer to a question, that is fine. Read it, act on it, throw it away.

If you are keeping it, pick one:

- **A line in your agent instructions** (`CLAUDE.md`, `AGENTS.md`): when you ship something that adds a feature or changes what talks to what, update the data file and rebuild. It is a rule, and rules get skipped.
- **A CI step or commit hook** that rebuilds and fails when the data file is older than the code it describes. Mechanical, so it does not get skipped.

Either way, put the date in the `subtitle`. A stale map should say so out loud.

---

## Files

| file | what it is |
|---|---|
| `SKILL.md` | the agent-facing instructions: how to survey a repo and decide what the pieces and connections are |
| `SCHEMA.md` | full data file reference |
| `build.js` | the builder. Zero dependencies, Node 14+ |
| `template.html` | the rendering engine |
| `example/` | a complete made-up map you can build and click through |

---

MIT. Part of the [Growth Garage Toolkit](https://github.com/JakePaterson/growth-garage-toolkit).
