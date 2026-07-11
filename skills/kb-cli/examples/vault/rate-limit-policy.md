---
title: "Rate Limit Policy"
project: example-project
category: decisions
tags: [policy, widgets]
description: "Why the widget API caps requests at 100/minute per account — a settled decision, not a technical ceiling"
confidence: high
last_updated: "2026-07-01"
reverify_after: never
status: current
---

# Rate Limit Policy

## Summary
The [[widget-api]]'s 100 requests/minute per-account limit is a deliberate
product decision, not a technical ceiling. It won't change without a new
decision record — so this article is marked `reverify_after: never` and
`kb lint` will never flag it stale, no matter how old `last_updated` gets.

## Details
- The limit was set to keep single-account abuse from degrading the API for
  everyone else, not because the backend can't handle more.
- Raising it for a specific account is a support/sales conversation, not a
  config change — there is no per-account override today.
- If this policy ever changes, update this article's `last_updated` and drop
  the `reverify_after: never` line so it re-enters the normal freshness cycle.

## Known Gaps
- None — this is a settled decision. Re-litigate it via a new decision, not
  by editing this file in place.
