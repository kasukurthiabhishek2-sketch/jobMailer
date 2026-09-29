---
id: T-0003
title: Restrict authentication bypass to explicit test processes
summary: Production always verifies Firebase tokens; test bypass requires explicit test configuration
status: review
owner: codex-gpt6-a3f1
claimed_at: 2026-09-29T23:21Z
heartbeat: 2026-09-29T23:24Z
lease_minutes: 45
size: S
scope: [server/services/firebaseAdmin.js, server/test_security_guardrails.js, vault/architecture/modules/api-server.md]
depends_on: []
branch: agent/T-0003-auth
updated: 2026-09-29T23:24Z
tags: [task]
created: 2026-09-29T23:21Z
acceptance: Production rejects test tokens and ignores DISABLE_AUTH; verified Firebase identities work; backend tests and frontend lint pass
---
## Goal
Remove production authentication shortcuts without changing verified user identity handling.

## Acceptance (verifiable)
- Backend `npm test` and frontend `npm run lint` pass before and after.
- Tests reject test tokens and forged test UIDs outside explicit test mode.
- Valid Firebase tokens retain their verified UID and email.

## Plan
1. Trace requireAuth and existing tests.
2. Require NODE_ENV=test plus DISABLE_AUTH=true for the offline test bypass.
3. Remove the token-string bypass; add behavioral production/test coverage.
4. Verify, update graph and module note, commit scoped files.

## Checkpoint
Done: Removed production bypasses; behavioral regression failed before fix and passed after.
Verify: Isolated server `npm test`: 28/28 passed before and after; client `npm run lint`: passed.
Now: Graph sync and scoped commit.
Decisions: Bypass requires NODE_ENV=test AND DISABLE_AUTH=true; verified UID overrides test headers.
Gotchas: First baseline ran in workspace by mistake (storage tests restore originals;
server import performs upload cleanup). All subsequent backend runs isolated with synthetic .env.
Branch: agent/T-0003-auth (agent/T-0003 already belongs to unrelated work).
Blockers: None.

## Notes
[[api-server]]
