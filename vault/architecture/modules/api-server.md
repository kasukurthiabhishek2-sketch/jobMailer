---
title: API Server
summary: Express app with routes, CORS, SSE streaming, and middleware
updated: 2026-09-29
tags: [module]
paths: [server/index.js]
---
## Purpose
Express 4 HTTP server. Defines all REST API routes, CORS configuration with origin normalization, Helmet security headers, rate limiting, file upload handling (Multer), and SSE streaming for email dispatch progress.

## Public surface
All `/api/*` endpoints defined in `index.js`

## Invariants / contracts
- CORS origin matching normalizes trailing slashes on both sides.
- Rate limiting via `express-rate-limit`.
- File uploads are ephemeral (cleaned after processing).

## Gotchas
- Single-file server (`index.js`) — all routes in one place.

## Decisions
TODO(human)
