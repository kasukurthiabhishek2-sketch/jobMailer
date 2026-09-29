---
title: ADR-0002 Server-Enforced Send Approval
summary: Both send endpoints reject batches without strict recipient approval and explicit send confirmation
updated: 2026-09-30
tags: [adr, security]
---
## Context
The UI checked approvals but dropped the flags before dispatch; direct API calls bypassed the gate.

## Decision
- Both send routes require `sendApproved === true` and `isApproved === true` for every recipient.
- Reject the whole batch before loading credentials, opening SSE, or dispatching messages.
- The explicit UI send action preserves recipient approvals and includes confirmation.

## Consequences
- Direct API clients must include both boolean fields; omitted or truthy non-boolean values fail.
- These fields enforce request intent, not independent proof of a human click.
- Durable draft-bound approvals and replay protection remain separate campaign-record work.
- [[api-server]] owns validation; SMTP delivery behavior is unchanged.
