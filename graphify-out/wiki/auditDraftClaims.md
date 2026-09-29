# auditDraftClaims

> 16 nodes · cohesion 0.18

## Key Concepts

- **auditDraftClaims()** (17 connections) — `server/services/aiService.js`
- **buildPrompts()** (14 connections) — `server/services/aiService.js`
- **generateColdEmail()** (12 connections) — `server/services/aiService.js`
- **test_ai_guardrail.js** (9 connections) — `server/test_ai_guardrail.js`
- **test_copilot_dispatch.js** (8 connections) — `server/test_copilot_dispatch.js`
- **runTests()** (5 connections) — `server/test_ai_guardrail.js`
- **1. Summary of Changes** (4 connections) — `docs/agent-reports/impl-ai-guardrail-cycle1.md`
- **Implementation Report: TICK-10 (AI Hallucination Guardrail)** (3 connections) — `docs/agent-reports/impl-ai-guardrail-cycle1.md`
- **runTests()** (2 connections) — `server/test_copilot_dispatch.js`
- **impl-ai-guardrail-cycle1.md** (1 connections) — `docs/agent-reports/impl-ai-guardrail-cycle1.md`
- **2. Test Execution** (1 connections) — `docs/agent-reports/impl-ai-guardrail-cycle1.md`
- **assert** (1 connections) — `server/test_ai_guardrail.js`
- **{
  auditDraftClaims,
  buildPrompts,
  cleanJsonOutput,
  generateColdEmail
}** (1 connections) — `server/test_ai_guardrail.js`
- **assert** (1 connections) — `server/test_copilot_dispatch.js`
- **copilotService** (1 connections) — `server/test_copilot_dispatch.js`
- **{ generateColdEmail }** (1 connections) — `server/test_copilot_dispatch.js`

## Relationships

- [aiService.js](aiService.js.md) (8 shared connections)
- [App.jsx](App.jsx.md) (6 shared connections)
- [decrypt](decrypt.md) (4 shared connections)
- [test_e2e_pipeline.js](test_e2e_pipeline.js.md) (2 shared connections)
- [test_e2e_suite.js](test_e2e_suite.js.md) (2 shared connections)
- [callCopilotChat](callCopilotChat.md) (2 shared connections)
- [index.js](index.js.md) (2 shared connections)
- [callOpenAiCompatible](callOpenAiCompatible.md) (2 shared connections)
- [ref_assert](ref_assert.md) (2 shared connections)
- [3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)](3.1_Multi-Provider_AI_Studio_`aiService.js`,_`copilotService.js`.md) (1 shared connections)
- [Full End-of-Cycle QA Report: Cycle 1](Full_End-of-Cycle_QA_Report-_Cycle_1.md) (1 shared connections)
- [2. Detailed Ticket-by-Ticket Diff Review](2._Detailed_Ticket-by-Ticket_Diff_Review.md) (1 shared connections)

## Source Files

- `docs/agent-reports/impl-ai-guardrail-cycle1.md`
- `server/services/aiService.js`
- `server/test_ai_guardrail.js`
- `server/test_copilot_dispatch.js`

## Audit Trail

- EXTRACTED: 46 (78%)
- INFERRED: 13 (22%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*