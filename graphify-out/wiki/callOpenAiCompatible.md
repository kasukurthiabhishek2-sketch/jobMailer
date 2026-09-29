# callOpenAiCompatible

> 9 nodes · cohesion 0.36

## Key Concepts

- **callOpenAiCompatible()** (9 connections) — `server/services/aiService.js`
- **callGemini()** (8 connections) — `server/services/aiService.js`
- **test_ai_retry.js** (7 connections) — `server/test_ai_retry.js`
- **HTTP 429 Exponential Backoff & Retry Handling** (3 connections) — `ARCHITECTURE.md`
- **1.2 AI Provider Rate-Limit Resilience (Currently 9.0 / 10)** (3 connections) — `docs/agent-reports/phase1-research-cycle2.md`
- **TICK-CYC3-05: AI Provider HTTP 429 Exponential Backoff Retries** (3 connections) — `docs/BACKLOG.md`
- **runTests()** (3 connections) — `server/test_ai_retry.js`
- **assert** (1 connections) — `server/test_ai_retry.js`
- **{ callGemini, callOpenAiCompatible }** (1 connections) — `server/test_ai_retry.js`

## Relationships

- [aiService.js](aiService.js.md) (5 shared connections)
- [auditDraftClaims](auditDraftClaims.md) (2 shared connections)
- [3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)](3.1_Multi-Provider_AI_Studio_`aiService.js`,_`copilotService.js`.md) (1 shared connections)
- [1. Audit of Remaining Gaps & Opportunities](1._Audit_of_Remaining_Gaps_&_Opportunities.md) (1 shared connections)
- [Detailed Cycle 3 Shipped Ticket Specifications](Detailed_Cycle_3_Shipped_Ticket_Specifications.md) (1 shared connections)
- [7. Agent Onboarding & Modification Cheatsheet](7._Agent_Onboarding_&_Modification_Cheatsheet.md) (1 shared connections)
- [ref_assert](ref_assert.md) (1 shared connections)

## Source Files

- `ARCHITECTURE.md`
- `docs/BACKLOG.md`
- `docs/agent-reports/phase1-research-cycle2.md`
- `server/services/aiService.js`
- `server/test_ai_retry.js`

## Audit Trail

- EXTRACTED: 16 (64%)
- INFERRED: 9 (36%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*