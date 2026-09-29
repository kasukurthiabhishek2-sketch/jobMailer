# copilotService.js

> 31 nodes · cohesion 0.08

## Key Concepts

- **copilotService.js** (18 connections) — `server/services/copilotService.js`
- **Detailed Audit Findings** (8 connections) — `docs/agent-reports/security-audit-cycle1.md`
- **clearSessionCache()** (5 connections) — `server/services/copilotService.js`
- **getCopilotSessionToken()** (4 connections) — `server/services/copilotService.js`
- **1. Summary of Changes** (3 connections) — `docs/agent-reports/impl-copilot-fix-cycle1.md`
- **Implementation Report: TICK-01 (Copilot AI Dispatch Bug)** (3 connections) — `docs/agent-reports/impl-copilot-fix-cycle1.md`
- **1. Summary of Changes** (3 connections) — `docs/agent-reports/impl-danger-zone-purge-cycle1.md`
- **Implementation Report: TICK-05 (Complete Danger-Zone Purge)** (3 connections) — `docs/agent-reports/impl-danger-zone-purge-cycle1.md`
- **Application Security Audit Report — Cycle 1** (3 connections) — `docs/agent-reports/security-audit-cycle1.md`
- **clearPendingDeviceFlow()** (3 connections) — `server/services/copilotService.js`
- **getSessionCache()** (3 connections) — `server/services/copilotService.js`
- **testCopilotConnection()** (3 connections) — `server/services/copilotService.js`
- **SEC-01: Runtime Bug & Undefined Symbol in Copilot AI Dispatch** (2 connections) — `docs/agent-reports/security-audit-cycle1.md`
- **SEC-02: Cryptographic Bypass & Plaintext Fallback in `decrypt()`** (2 connections) — `docs/agent-reports/security-audit-cycle1.md`
- **SEC-03: Incomplete Danger-Zone Data Purge Leaves PII Resumes on Disk & Stale Token Cache** (2 connections) — `docs/agent-reports/security-audit-cycle1.md`
- **checkDeviceStatus()** (2 connections) — `server/services/copilotService.js`
- **impl-copilot-fix-cycle1.md** (1 connections) — `docs/agent-reports/impl-copilot-fix-cycle1.md`
- **2. Test Execution** (1 connections) — `docs/agent-reports/impl-copilot-fix-cycle1.md`
- **impl-danger-zone-purge-cycle1.md** (1 connections) — `docs/agent-reports/impl-danger-zone-purge-cycle1.md`
- **2. Test Execution** (1 connections) — `docs/agent-reports/impl-danger-zone-purge-cycle1.md`
- **security-audit-cycle1.md** (1 connections) — `docs/agent-reports/security-audit-cycle1.md`
- **Executive Summary** (1 connections) — `docs/agent-reports/security-audit-cycle1.md`
- **SEC-04: SMTP TLS Certificate Verification Disabled (`rejectUnauthorized: false`)** (1 connections) — `docs/agent-reports/security-audit-cycle1.md`
- **SEC-05: Missing Rate Limiting on Public Express Routes** (1 connections) — `docs/agent-reports/security-audit-cycle1.md`
- **SEC-06: High Severity Vulnerabilities in Direct Dependencies (`xlsx` & `nodemailer`)** (1 connections) — `docs/agent-reports/security-audit-cycle1.md`
- *... and 6 more nodes in this community*

## Relationships

- [callCopilotChat](callCopilotChat.md) (4 shared connections)
- [decrypt](decrypt.md) (1 shared connections)
- [index.js](index.js.md) (1 shared connections)
- [aiService.js](aiService.js.md) (1 shared connections)
- [ref_assert](ref_assert.md) (1 shared connections)
- [auditDraftClaims](auditDraftClaims.md) (1 shared connections)
- [test_danger_zone.js](test_danger_zone.js.md) (1 shared connections)
- [test_security_guardrails.js](test_security_guardrails.js.md) (1 shared connections)
- [storageService.js](storageService.js.md) (1 shared connections)

## Source Files

- `docs/agent-reports/impl-copilot-fix-cycle1.md`
- `docs/agent-reports/impl-danger-zone-purge-cycle1.md`
- `docs/agent-reports/security-audit-cycle1.md`
- `server/services/copilotService.js`

## Audit Trail

- EXTRACTED: 30 (64%)
- INFERRED: 17 (36%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*