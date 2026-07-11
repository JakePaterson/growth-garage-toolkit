---
title: "Example Project — Summary"
project: example-project
category: domain
description: "Overview of the example vault shipped with agent-kb: widget API, auth flow, deprecated endpoint, rate-limit policy"
confidence: high
last_verified: "2026-07-01"
last_updated: "2026-07-01"
---

# Example Project — Summary

This is a minimal example vault shipped with `agent-kb` so you can try the CLI
against real files before wiring up your own knowledge base.

## What's here
- [[widget-api]] — the current widget API (high confidence, fresh).
- [[auth-flow]] — the auth pattern the widget API depends on (medium confidence).
- [[legacy-endpoint]] — a deprecated endpoint, deliberately stale and low-confidence
  so `kb lint` has something to flag.
- [[rate-limit-policy]] — a settled decision marked `reverify_after: never`, so
  `kb lint` never flags it stale no matter how old `last_updated` gets.

## Try it

```bash
KB_ROOT=examples/vault kb search widget
KB_ROOT=examples/vault kb lint
KB_ROOT=examples/vault kb index
KB_ROOT=examples/vault kb compile
```
