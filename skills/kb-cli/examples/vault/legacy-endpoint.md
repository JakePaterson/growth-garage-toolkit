---
title: "Legacy Token Endpoint"
project: example-project
category: apis
tags: [auth, deprecated]
description: "Deprecated /token endpoint issuing long-lived, non-rotating tokens — superseded by auth-flow"
confidence: low
last_verified: "2025-02-01"
last_updated: "2025-02-01"
status: deprecated
---

# Legacy Token Endpoint

## Summary
The old `/token` endpoint issued long-lived, non-rotating tokens. Superseded by the flow in [[auth-flow]], but left here since a couple of internal scripts still call it.

## Details
No refresh mechanism — tokens were valid for 1 year and had to be manually reissued. Do not build anything new against this endpoint.

## Known Gaps
- [ ] Exact sunset date for this endpoint has not been confirmed with the API owner.
