---
name: living-system-map
description: Use when someone wants to see how a whole codebase fits together — a system map, architecture overview, "what talks to what here?", an onboarding picture of a large unfamiliar repo, or a refresh of a diagram that has gone stale.
---

# Living System Map

Produces one self-contained HTML file: an interactive map of a codebase's real features and the connections between them. Click any feature and everything unrelated dims, so you can trace exactly what it touches.

The renderer is solved. **The work is deciding what the nodes and edges are** — that judgment is the whole product, and it is why a model does this rather than a parser. An import graph tells you `fileA` requires `fileB` and produces a hairball. This tells you "Checkout *reserves copies in* Stock & Warehouse," which someone can actually read.

## What you are producing

One file, `system-map.data.js`, whose contents are:

- **15-40 nodes.** Each is a *feature* — a thing the business or a user would name out loud. "Checkout." "Rental Car Search." "Analytics Pipeline."
- **A one-sentence `role` per node**, in plain English, written for someone who has never seen the code.
- **A `status` per node** saying how finished it really is.
- **Every edge you can verify**, each with a label that finishes the sentence `<from> ___ <to>`.

Then `node build.js` renders it. Full field reference: **SCHEMA.md**.

## The two calls that decide whether the map is any good

**1. Nodes are features, not files.** If your list reads `auth/`, `lib/`, `components/`, `api/` you have listed directories. If it reads `Login & Sessions`, `Checkout`, `Search`, `Admin Console` you have listed features. A large app lands around 15-40. A focused tool may have only 6-10, and that is a real answer — **do not pad the list to hit a number.** Over 50 means you listed modules.

Shared plumbing — a parser, a config loader, a command dispatcher — is a layer, not a feature, so it starts out excluded. Include it only when leaving it out would strand real features as unconnected islands. The test: *does adding this node let me draw connections I otherwise could not?* If yes, add it to the cross-cutting band and name it for what it does. If no, leave it out.

**2. Stages are the journey through the product, not the architecture.** Bands should read like the path a user or a piece of work takes: `Browse → Buy → Fulfil → Aftercare`. Not `Frontend → API → Database`. Layers produce a map that tells you nothing you couldn't guess. Add one final band with `numbered: false` for the things that sit under everything — auth, analytics, email, admin.

No user journey? Pick by shape:

- **A pipeline** (compiler, ETL, build tool) — the path data takes through it: `Parse → Analyse → Transform → Emit`.
- **A set of independent commands** (most CLIs, most libraries) — *not* the order the commands run in, because there isn't one. Use the life of the thing the tool operates on. A knowledge-base CLI becomes `Bootstrap → Capture → Validate → Organise → Publish → Retrieve`, and each command sits at the point of that life it touches. Ask: "what does this act *on*, and what happens to that thing over time?"

If neither fits, use the sequence you would walk a new hire through on their first day. Anything beats layers.

## Process

**1. Survey.** Read the README, `package.json`/`pyproject.toml`/`go.mod`, the route table or entry points, top-level directories, env var names, and the DB schema if there is one. Env vars and third-party keys are the fastest way to find integrations that directories hide.

**2. Draft the node list and show it to the human before going further.** A list of feature names, one line each. This is cheap to fix now and expensive to fix after you have traced thirty things. Ask directly whether anything is missing, misnamed, or actually two things.

**3. Trace each feature.** Delegate these in parallel — one sub-agent per feature, each returning a short structured summary, not file dumps. For each: what it does in one plain sentence, how finished it is, its key files, and any surprises. Give every sub-agent the same instruction to prefer code over documentation.

**4. Do the connection pass separately.** This is its own deliberate step and it is where maps are won or lost. Do not infer edges from vibes. For each candidate pair ask: *does A actually hand something to B, and what?* Then go find the code that proves it. An edge you cannot point at code for does not go in the file.

**Direction follows behaviour, not imports.** The proof is often not a direct call — frequently some third file calls A and then B, and that orchestration is the real relationship. Record what actually happens between the features. When a code import runs the *opposite* way to the behaviour (B borrows a helper from A while A is the thing driving B), the import is noise; the behaviour is the edge.

Pick the kind by what actually happens:

| kind | means | example label |
|---|---|---|
| `triggers` | A starts B running | "a paid order reserves copies in" |
| `feeds` | A hands B data | "candidates fill the results list in" |
| `calls` | A invokes B and waits | "staff approve refunds in" |
| `reads` | A reads B's data without changing it | "the dashboard reads from" |
| `emits` | A fires an event B consumes | "sends the purchase event into" |

**5. Build and look at it.** `node build.js`, then open the HTML. Click through five or six nodes. A node with no edges is almost always a missed connection, not an isolated feature — the build warns you about these.

**6. Add depth where it earns it.** A few nodes deserve a `steps` breakdown or a `how` write-up; most do not. Spend that effort on the two or three systems people actually get wrong.

## Writing the roles

The `role` line is what someone reads when they click. One sentence, no jargon, no repeating the node's own name back.

- ✅ "Takes payment and turns a cart into a real order."
- ✅ "A browser-automation robot that books through our own account. Orphaned, unreachable today."
- ❌ "Handles checkout logic." (says nothing)
- ❌ "Orchestrates the PaymentIntent lifecycle via the Stripe SDK adapter layer." (jargon)

Mark the status honestly. A map whose every node says "Live" is a map nobody trusts twice. Half-built, admin-only, and behind-a-flag are the most useful things on it.

## Keeping it alive

The map is a snapshot of the day it was built, and a polished interactive snapshot is *more* dangerous when stale than a rough one, because it looks current. Two ways to handle that, and they are different in kind:

- **A line in the repo's agent instructions** (CLAUDE.md / AGENTS.md): when you ship something that adds a feature or changes what talks to what, update `system-map.data.js` and rerun the build. This is a rule, and rules get skipped.
- **A commit hook or CI step** that rebuilds the map and fails if the data file is older than the source it describes. Mechanical, so it does not get skipped.

Whichever you choose, put the build date in the `subtitle` so a stale map admits it.

## Common mistakes

| Mistake | What it looks like | Fix |
|---|---|---|
| Nodes are directories | `src/lib`, `src/api` on the board | Ask "would a colleague say this word?" |
| Stages are layers | Bands named Frontend / Backend / DB | Use the journey through the product |
| Invented edges | "Analytics probably tracks checkout" | Find the line, or drop the edge |
| Lazy labels | Every edge says "uses" | Finish the sentence `<from> ___ <to>` |
| Everything is "Live" | One status value across the board | Go check what is actually shipped |
| Depth everywhere | 30 nodes with full step breakdowns | Depth on the 2-3 that people get wrong |
