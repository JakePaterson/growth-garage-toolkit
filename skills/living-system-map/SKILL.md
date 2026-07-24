---
name: living-system-map
description: Use when someone wants to see how something works rather than read about it. A whole codebase, one flow, a pipeline, "what talks to what here?", onboarding to an unfamiliar repo, or refreshing a diagram that has gone stale.
---

# Living System Map

Produces one self-contained HTML file: an interactive map of real pieces and the connections between them. Click anything and everything unrelated dims, so you can trace exactly what it touches.

The renderer is solved. **The work is deciding what the nodes and edges are, and proving them.** That judgment is the whole product, and it is why a model does this rather than a parser. An import graph says `fileA` requires `fileB` and produces a hairball. This says "Checkout reserves copies in Stock & Warehouse via the `stock_holds` trigger," which someone can act on.

Full field reference: **SCHEMA.md**.

## First, scope it to the question

| Ask | Nodes | How |
|---|---|---|
| "How does checkout work?" | 6-12 | Trace that one flow. Skip the survey. One pass, no sub-agents. |
| "Map this pipeline" | 8-15 | Follow the data from entry to exit. |
| "Map the whole system" | 15-40 | The full process below. |

Most requests are the first row. Do not run a whole-repo survey to answer a question about one flow, and do not promise a whole-repo map and deliver one flow.

## What you are producing

One file, `system-map.data.js`, containing:

- **Nodes**, each a *thing someone would name out loud*. "Checkout." "Rental Car Search." "Analytics Pipeline."
- **A one-sentence `role` per node** in plain English, which states any gating in the sentence itself: "Admin-only feature that plans one linked trip across 2-5 cities." "A browser-automation robot that books through our own account. Orphaned, unreachable today."
- **A `status` per node** saying how finished it really is.
- **Edges you have proven**, each labelled with the actual mechanism.

Then `node build.js` renders it.

## The two calls that decide whether it is any good

**1. Nodes are features, not files.** If your list reads `auth/`, `lib/`, `components/`, `api/` you have listed directories. If it reads `Login & Sessions`, `Checkout`, `Search`, `Admin Console` you have listed features. A large app lands around 15-40. A focused tool may have only 6-10, and that is a real answer, so **do not pad the list to hit a number**. Over 50 means you listed modules.

Shared plumbing (a parser, a config loader, a command dispatcher) is a layer, not a feature, so it starts out excluded. Include it only when leaving it out would strand real features as unconnected islands. The test: *does adding this node let me draw connections I otherwise could not?*

**2. Stages are the journey, not the architecture.** Bands should read like the path a user or a piece of work takes: `Browse → Buy → Fulfil → Aftercare`. Not `Frontend → API → Database`. Layers produce a map that tells you nothing you could not guess. Add one final band with `numbered: false` for things that sit under everything: auth, analytics, email, admin.

No user journey? Pick by shape:

- **A pipeline** (compiler, ETL, build tool): the path data takes. `Parse → Analyse → Transform → Emit`.
- **A set of independent commands** (most CLIs, most libraries): *not* the order commands run in, because there isn't one. Use the life of the thing the tool acts on. A knowledge-base CLI becomes `Bootstrap → Capture → Validate → Organise → Publish → Retrieve`, and each command sits at the point of that life it touches.

If neither fits, use the sequence you would walk a new hire through on day one. Anything beats layers.

## Process

**1. Survey.** Read the README, the manifest (`package.json`, `pyproject.toml`, `go.mod`), the route table or entry points, top-level directories, env var names, and the DB schema. Env vars and third-party keys are the fastest way to find integrations that directory names hide.

**2. Draft the node list and show it to the human before going further.** Names only, one line each. Cheap to fix now, expensive after you have traced thirty things. Ask what is missing, misnamed, or actually two things.

**3. Trace each feature, and have each trace report its own connections.** Delegate in parallel, one sub-agent per feature, each returning a short structured summary rather than file dumps.

Require every trace to return, along with role, status and key files:

> **Outbound:** what this feature starts, hands data to, calls, reads, or fires events into, with the file and line that does it.
> **Inbound:** what does the same to this feature.

This is the difference between a cheap map and an expensive one. The tracer is already reading the calling code, so collecting edges there costs nothing extra. **Do not compare every node against every other node afterwards.** Thirty nodes is 435 pairs, and almost all of them are nothing.

**4. Reconcile the edges.** Pool the self-reported connections and dedupe. Most will be reported from both ends, which is your confirmation. Investigate only the ones reported from a single side. You should be verifying tens of candidates, not hundreds.

Then collapse each relationship to **one** edge. If A triggers B and B returns a result to A, that is one arrow, not two. Two arrows between the same pair means you recorded a round trip, not two relationships.

Pick the kind by what actually happens:

| kind | means | example label |
|---|---|---|
| `triggers` | A starts B running | "a paid order reserves copies in" |
| `feeds` | A hands B data | "candidates fill the results list in" |
| `calls` | A invokes B and waits | "staff approve refunds in" |
| `reads` | A reads B's data without changing it | "the dashboard reads from" |
| `emits` | A fires an event B consumes | "sends the purchase event into" |

**Direction follows behaviour, not imports.** The proof is often not a direct call: some third file calls A and then B, and that orchestration is the real relationship. When an import runs the *opposite* way to the behaviour (B borrows a helper from A while A drives B), the import is noise and the behaviour is the edge.

**5. Build and look at it.** Run `node build.js`, open the file, click through several nodes. A node with no edges is almost always a missed connection rather than an isolated feature, and the build warns you about them.

**6. Add depth only where it earns it.** Pick the two or three systems people actually get wrong and give them a `steps` breakdown or a `how` write-up. Depth everywhere is depth nowhere, and it is the most expensive thing you can do.

Mark at most two or three nodes `hub: true`. It means "everything routes through this." If a third of your nodes are hubs, none of them are.

## Standard of evidence

This is what separates a map people trust from a map that reads well and quietly misleads.

**Name the mechanism.** A label that could have been guessed from the node names is not carrying information.

- ✅ "auto_stay trigger syncs pending expense"
- ✅ "claim_trip_atomic rewrites ownership"
- ❌ "uses" · "connects to" · "integrates with"

**Quote, do not paraphrase.** When a step involves a prompt, a threshold, a weight or a formula, take it verbatim from the code and cite the file. Reconstructed-from-memory numbers are how a map starts lying.

**Label what you could not confirm.** If a figure came from a comment, a doc, or an inference, say so in the text rather than presenting it as fact. An honest gap is worth more than a confident guess, and "unverified" is a legitimate thing to write.

**When docs and code disagree, code wins, and record it.** You will find stale claims in the README, in `CLAUDE.md`, and in the wiki. Keep a running list of every one, and hand it over with the map. That list is often more valuable than the map itself, and you are the only one positioned to produce it.

## Keeping it alive

A map is a snapshot of the day it was drawn, and a polished interactive one is *more* dangerous when stale than a rough sketch, because it looks current.

If it was a one-off answer to a question, that is fine. Read it, act, discard.

If it is being kept: either add a line to the repo's agent instructions (update the data file when you ship something that changes what talks to what), or add a CI step that rebuilds and fails when the data file is older than the code it describes. The first is a rule and rules get skipped; the second is mechanical. Put the date in the `subtitle` either way, so a stale map admits it.

## Red flags

Stop if you catch yourself doing any of these.

| Red flag | What it means |
|---|---|
| Writing an edge label you could have guessed without reading code | You are decorating, not documenting. Go find the mechanism. |
| Comparing node pairs to find connections | Collect edges during the trace instead. |
| A number in a write-up you did not copy from source | Quote it or mark it unverified. |
| Every node has a step breakdown | Depth belongs on the two or three that bite people. |
| Every status says "Live" | You have not checked what is actually shipped. |
| Both `A→B` and `B→A` for one behaviour | That is a round trip. Pick the direction that drives. |
