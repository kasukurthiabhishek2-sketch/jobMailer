---
title: SMTP Service
summary: Email dispatch with anti-spam throttling and SSE streaming
updated: 2026-09-29
tags: [module]
paths: [server/services/smtpService.js]
---
## Purpose
Sends approved emails through user-configured SMTP accounts via Nodemailer. Implements anti-spam rate limiting and streams per-recipient progress to the client via SSE.

## Public surface
`sendEmails()`, `classifySmtpError()`

## Invariants / contracts
- Only sends to recipients with `isApproved === true` (two-stage gate).
- SMTP passwords decrypted in-memory only at send time, never logged.
- `classifySmtpError()` categorizes failures for retry/skip decisions.

## Gotchas
- `classifySmtpError()` is a god node (17 edges).
- SSE connection must be kept alive during batch dispatch.

## Decisions
TODO(human)
