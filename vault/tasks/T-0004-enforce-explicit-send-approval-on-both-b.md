---
id: T-0004
title: Enforce explicit send approval on both backend endpoints
summary: Require recipient approval and explicit send confirmation before either backend send endpoint dispatches
status: review
owner: codex-gpt6-a3f1
claimed_at: 2026-09-29T23:25Z
heartbeat: 2026-09-29T23:27Z
lease_minutes: 45
size: M
scope: [server/index.js, server/test_security_guardrails.js, client/src/hooks/useCampaignStream.js, client/src/services/api.js, client/src/__tests__/hooks.test.js, vault/architecture/modules/api-server.md, vault/decisions/ADR-0002-send-approval.md]
depends_on: []
branch: agent/T-0004-approval
updated: 2026-09-29T23:27Z
tags: [task]
created: 2026-09-29T23:24Z
acceptance: Unapproved or unconfirmed batches rejected before storage or SMTP; approved UI workflow preserved; backend and frontend tests and lint green
---
## Goal
Enforce the existing human approval workflow on both backend send endpoints.

## Acceptance
- Unapproved, mixed, malformed, and unconfirmed batches cause no credential access or SMTP dispatch.
- UI sends strict approval booleans and confirmation when the user triggers send.
- Backend suite, frontend suite, and lint pass.

## Plan
1. Preserve isApproved in UI payload and include explicit sendApproved confirmation.
2. Validate the entire batch before loading credentials or starting SSE/SMTP.
3. Exercise both route handlers and the hook-to-fetch workflow with synthetic data.
4. Record API contract decision, sync graph, verify and commit.

## Checkpoint
Done: Strict batch approval and send confirmation on both routes; UI payload preserved.
Verify: Regression reproduced bypass before fix. Backend 28/28 passed; frontend 305 passed,
4 skipped; lint and build passed (existing large-bundle warning).
Now: Graph sync and scoped commit.
Decisions: Entire invalid batch rejected before storage/SMTP; flags express authenticated caller intent.
Limitations: Durable draft binding/replay protection and ownership remain separate roadmap tasks.
Blockers: None.

## Notes
[[api-server]] [[ADR-0002-send-approval]]
