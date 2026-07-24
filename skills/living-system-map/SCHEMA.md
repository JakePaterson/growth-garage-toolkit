# Data file reference

`system-map.data.js` is a plain CommonJS module. One `module.exports` object, no dependencies, no build step of its own.

```js
module.exports = {
  title: 'Acme — System Map',   // browser tab
  kicker: 'System Map',          // small label left of the header text
  subtitle: 'How everything connects · traced 2026-07-24',

  layout: { perRow: 6 },         // optional, default 6 — nodes per row before wrapping

  stages:   [ ... ],
  domains:  [ ... ],
  statuses: [ ... ],
  nodes:    [ ... ],
  edges:    [ ... ],
};
```

Run `node build.js` and it validates everything below before writing a single byte. Unknown ids, duplicate ids and bad edge kinds are hard errors, because each one is a way to get a map that renders blank or silently drops a connection.

---

## `stages` — the horizontal bands

Top to bottom, in order. This is the journey through your product.

| field | required | notes |
|---|---|---|
| `id` | yes | referenced by `node.stage` |
| `label` | yes | shown on the band |
| `numbered` | no | `false` keeps it out of the 1-2-3 sequence — use it for the cross-cutting band |

```js
stages: [
  { id: 'browse', label: 'Browse' },
  { id: 'buy',    label: 'Buy' },
  { id: 'cross',  label: 'Cross-cutting', numbered: false },
]
```

## `domains` — the colour families

What kind of thing a node is, or who owns it. Three to six works; past that the colours stop being distinguishable.

| field | required | notes |
|---|---|---|
| `id` | yes | referenced by `node.domain` |
| `label` | yes | shown as the tag above the title in the side panel |
| `color` | no | hex for light mode; omit to take the built-in palette |
| `colorDark` | no | hex for dark mode; defaults to `color`, then the palette |

Omit colours entirely and domains are assigned, in order: indigo, teal, amber, pink, slate, violet, green, red — each with a lighter dark-mode twin. Statuses get green, amber, violet, grey, teal. The palettes vary lightness as well as hue so they stay distinguishable with colour-vision deficiency. Both live at the top of `build.js` if you want to change them globally.

## `statuses` — how finished each thing is

| field | required | notes |
|---|---|---|
| `id` | yes | referenced by `node.status` |
| `label` | yes | shown on the node and as a badge |
| `color` / `colorDark` | no | same rules as domains |

Keep it to three to five values you will actually use. `Live`, `Beta`, `Admin only`, `Half-built` covers most repos.

## `nodes` — the features

| field | required | notes |
|---|---|---|
| `id` | yes | referenced by edges; keep it kebab-case and stable |
| `name` | yes | what appears on the card |
| `stage` | yes | must match a `stages` id |
| `domain` | yes | must match a `domains` id |
| `status` | no | must match a `statuses` id if present |
| `role` | no (but do it) | one plain-English sentence, shown when clicked |
| `hub` | no | `true` adds a "● hub" marker for the two or three things everything routes through |
| `steps` | no | the step-by-step breakdown, below |
| `how` | no | an HTML string for the "How it works" panel |

`how` is raw HTML, injected as-is. `<p>`, `<ul>/<li>`, `<code>` and `<div class="sub">` are styled for you. It is your own file, so this is not a security boundary — but do not paste untrusted content into it.

## `nodes[].steps` — the drill-down

Optional, and worth doing for only a few nodes. Renders a vertical flow you can click through.

```js
steps: {
  spine: [ /* sequential steps, in order */ ],
  parallel: [ /* steps that run alongside the spine */ ],
  branchFrom: 'match',              // which spine step the parallel lane hangs off
  branchLabel: 'Runs in parallel',  // caption above the parallel lane
}
```

Each step:

| field | required | notes |
|---|---|---|
| `id` | yes | unique within this node |
| `name` | yes | the step's title |
| `tag` | no | small label above the title, e.g. `Step 2` |
| `chip` | no | short highlight on the card, e.g. a model or service name |
| `what` | no | one or two sentences on what this step does |
| `note` | no | anything worth knowing that is not a warning |
| `quirk` | no | a limit or gotcha — rendered in warning red |
| `cost` | no | a cost or rate-limit note |
| `fallback` | no | array of `{ when, then, why }` |
| `files` | no | array of `{ path, role }` |

## `edges` — the connections

```js
{ from: 'checkout', to: 'stock', kind: 'triggers', label: 'a paid order reserves copies in' }
```

| field | required | notes |
|---|---|---|
| `from` / `to` | yes | node ids — unknown ids are a build error |
| `kind` | yes | `triggers` · `feeds` · `calls` · `reads` · `emits` |
| `label` | no (but do it) | finishes the sentence `<from> ___ <to>` |

The five kinds are fixed, because they map to five fixed colours and a legend the reader has to learn once. If none of them fits, `feeds` is the honest default.

---

## What the build tells you

**Errors** stop the build: unknown or duplicate ids, a bad edge kind, a `branchFrom` that is not one of the node's steps, missing required fields.

**Warnings** still build, but each one is usually a real gap:

- a node with no connections at all (almost always a missed edge)
- an edge with no label
- a node with no role
- a stage with no nodes
- parallel steps with no `branchFrom`
