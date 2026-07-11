---
title: "Auth Flow"
project: example-project
category: patterns
tags: [auth, tokens]
description: "OAuth client-credentials flow used by the widget API — access tokens, refresh rotation, introspection"
confidence: medium
last_verified: "2026-06-20"
last_updated: "2026-06-20"
---

# Auth Flow

## Summary
Clients exchange a client ID/secret for a short-lived bearer token, used by the [[widget-api]] and other internal services. Refresh tokens are long-lived and rotate on use.

## Details
1. `POST /oauth/token` with `grant_type=client_credentials` returns an access token (15 min TTL) and a refresh token (30 day TTL).
2. Access tokens are opaque — validate them via the introspection endpoint, not by decoding.
3. Refresh token rotation: each refresh invalidates the previous refresh token, so store only the newest one.

This pattern largely mirrors the deprecated [[legacy-endpoint]] flow it replaced, but with rotation added.

## Known Gaps
- [ ] Clock-skew tolerance for token expiry is not documented.
