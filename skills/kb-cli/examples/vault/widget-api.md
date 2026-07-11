---
title: "Widget API"
project: example-project
category: apis
tags: [api, widgets]
sources:
  - url: "https://docs.example.com/widget-api/"
    fetched: "2026-07-01"
description: "Create, list, and delete widgets for an account — REST endpoints, auth, pagination, rate limits"
confidence: high
last_verified: "2026-07-01"
last_updated: "2026-07-01"
---

# Widget API

## Summary
The Widget API lets a client create, list, and delete widgets for an account. All requests require a bearer token issued by the [[auth-flow]].

## Details
- `POST /widgets` — create a widget. Body: `{ name, color, size }`.
- `GET /widgets` — list widgets for the authenticated account.
- `DELETE /widgets/:id` — remove a widget.

Rate limit: 100 requests/minute per account (see [[rate-limit-policy]] for why). Responses are paginated at 50 items using `?cursor=`.

## Known Gaps
- [ ] Bulk-create endpoint behavior under partial failure is undocumented upstream.
