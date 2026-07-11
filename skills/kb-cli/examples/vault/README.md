# Example vault

A tiny, **fake** knowledge base so you can run `kb` against something real in 30 seconds —
before you build a vault of your own. None of this is production content; the articles are
invented (`widget-api`, `auth-flow`, …).

## Try it

From `skills/kb-cli/`:

```bash
npm install
KB_ROOT=examples/vault ./bin/kb lint
```

You should see a health report that flags **`legacy-endpoint.md`** — which is deliberately
stale and low-confidence, so the linter has something real to catch. That's the whole point
of the tool in one command.

Also worth running:

```bash
KB_ROOT=examples/vault ./bin/kb search widget   # confidence-weighted search
KB_ROOT=examples/vault ./bin/kb index           # regenerate _index.md from frontmatter
```

## What each file is for

| File | Why it's here |
|------|---------------|
| `widget-api.md`, `auth-flow.md`, `rate-limit-policy.md` | Healthy articles — normal frontmatter, good confidence. `rate-limit-policy` shows `reverify_after: never` for evergreen content. |
| `legacy-endpoint.md` | **Deliberately stale + low-confidence** so `kb lint` has something to flag. Don't "fix" it. |
| `_summary.md` | The curated overview — *"read me"*. What an agent loads for orientation. |
| `_index.md` | The generated catalog — *"search me"*. Rebuilt by `kb index`; don't hand-edit. |
| `llms.txt` | The front door — the entry point an agent reads first. |
| `kb.config.json` | Tells `kb` where the projects live and which IDE configs to compile. |

Together these demonstrate the reading spine the whole system is built on:
`llms.txt` → `_summary.md` → `_index.md` → article.

See [`CONVENTIONS.md`](../../CONVENTIONS.md) for the full frontmatter contract.
