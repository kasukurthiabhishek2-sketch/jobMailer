---
id: T-0002
title: Per-recipient role and JD tailored batch email generation
summary: <one line>
status: in_progress
owner: agent-gemini-0002
claimed_at: 2026-09-29T20:26Z
heartbeat: 2026-09-29T20:26Z
lease_minutes: 45
size: M
scope: [server/index.js, client/src/components/EmailPreview.jsx, server/test_*.js]
depends_on: []
branch: agent/T-0000
updated: 2026-09-29T20:26Z
tags: [task]
created: 2026-09-29T20:26Z
---
## Goal
Enable per-recipient role and JD tailored batch email generation so that recipients with specific roles or JDs receive tailored cold email bodies rather than one generic email body with swapped names.

## Acceptance (verifiable)
- [x] `cd server && npm test` passes cleanly with new role-partitioning tests.
- [x] `cd client && npm run lint` and `cd client && npm test -- --run` pass cleanly.
- [x] Recipients with `role` but empty `jobDescription` receive role-tailored prompt calls instead of being collapsed into a generic email.
- [x] Single regenerate in `EmailPreview.jsx` preserves `currentRecipient.jobDescription`.

## Plan (<= 10 lines, filled before coding)
1. Update `server/index.js` `POST /api/ai/batch-generate`: partition based on `hasSpecificJd || hasSpecificRole`.
2. Fall back to shared `jobDescription` when recipient has specific role but no individual JD.
3. Update `adaptGenericEmailForRecipient` to replace `[Role]` in body if present.
4. Update `server/index.js` `POST /api/ai/generate` to respect `recipient.jobDescription`.
5. Update `client/src/components/EmailPreview.jsx` single regenerate to use `currentRecipient.jobDescription || jobDescription`.
6. Update and add test coverage in `server/test_jd_parser.js` and `server/test_batch_concurrency.js`.
7. Run all test suites and verify.

## Checkpoint (overwrite in place, <= 25 lines)
Done:
- Updated /api/ai/batch-generate to partition tailored recipients by JD or role.
- Propagated fallback shared JD when recipient has role but no individual JD.
- Updated /api/ai/generate to respect recipient.jobDescription if omitted.
- Updated adaptGenericEmailForRecipient to replace [Role] in body.
- Updated handleRegenerateCurrent in EmailPreview.jsx to preserve currentRecipient.jobDescription.
- Added tests in server/test_batch_concurrency.js, server/test_jd_parser.js, and client/src/__tests__/EmailPreview.test.jsx.
Now: Staging surgical files.
Next: Commit and declare done.
Verify: cd server && npm test (28 passed) && cd client && npm test -- --run (21 passed)
Decisions: Purely blank role & JD recipients remain in generic pool for rate-limit efficiency.
Gotchas / dead ends: None.
Blockers: None.

## Notes (unrelated findings; do not fix here)
