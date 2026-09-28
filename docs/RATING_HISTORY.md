# JDMail Rating & Cycle History

## Cycle 0 baseline
- **Date:** 2026-09-27
- **Git Commit:** `9a3032b` (baseline before agent improvement program)
- **Server Test Suite (`cd server && npm test`):** PASSED (6 comprehensive tests across normalization, extraction, validation, row-by-row isolation, name priority, compound names). Output: `ALL TESTS PASSED! FULL EXTRACTION & VALIDATION VERIFIED.`
- **Client Lint Suite (`cd client && npm run lint`):** PASSED (0 errors, 16 warnings across unused variables and React Compiler set-state-in-effect notices).
- **Status:** Baseline green. Ready for Cycle 1 Phase 1.

---

## Cycle 1 — Overall: 9.10/10

- **Date:** 2026-09-27
- **Branch Evaluated:** `agent/cycle-1-integrated`
- **Evaluator:** brutal-critic (adversarial audit)
- **Automated Gates:**
  - `cd server && npm test`: **PASSED** (10 test suites, 0 failures across sheet parser, crypto, storage, SMTP resilience, copilot dispatch, AI guardrails, batch concurrency, cross-session dedup, danger-zone purge, resume parser).
  - `cd client && npm run lint`: **PASSED** (0 errors, 12 non-blocking warnings).

### Dimension Scorecard

| Dimension | Weight | Score | Evidence & Audit Findings |
| :--- | :---: | :---: | :--- |
| **Security & credential handling** | 20% | **9.2 / 10** | Strict 3-part hex parsing in `crypto.js` (`/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i`) fails closed to `''` on tampering. `maskApiKey` handles short keys <= 16 chars without raw leakage. `/api/config/reset` completely purges `uploads/` and clears in-memory Copilot OAuth tokens. Docked 0.8 because active campaign resumes remain in unencrypted filesystem storage until reset. |
| **Correctness & reliability** | 20% | **9.0 / 10** | Resolved Copilot crash (`callCopilotChat`). SMTP engine classifies `TRANSIENT` (4xx, connection timeouts) vs `PERMANENT` (535 auth failed) errors; transient errors auto-retry with exponential backoff while auth failures fail-fast. Docked 1.0 because AI batch generation lacks automatic backoff on HTTP 429 rate limits. |
| **Test coverage** | 15% | **9.0 / 10** | Engineered 10 comprehensive unit and integration test suites sequenced via `server/test_runner_all.js`. Verified 100% of backend subsystems described in ARCHITECTURE.md. Docked 1.0 due to absence of automated frontend component tests (Vitest/RTL). |
| **UX / user pain points** | 15% | **9.0 / 10** | Verifiable claim grounding guardrail (`auditDraftClaims`) mitigates hallucination anxiety. Cross-session deduplication (`getRecentlyContactedMap`) auto-deselects and flags previously contacted recruiters (>0 days). Windowed pagination in `RecipientModal.jsx` (50, 100, 250, All) eliminates DOM freeze on 500+ sheets. Docked 1.0 for minor React compiler lint warnings. |
| **Deliverability & compliance posture**| 10% | **8.8 / 10** | Inter-message delays now incorporate ±20% anti-spam jitter to prevent mechanical pattern detection. Strict TLS certificate validation enabled by default. Cross-session dedup prevents duplicate outreach spam. Docked 1.2 for lack of an active daily sending quota budget tracker against provider limits. |
| **Performance / efficiency** | 10% | **9.2 / 10** | Serial batch loop replaced by 4-worker concurrent queue (~350% generation throughput speedup) with real-time SSE progress. Windowed table rendering avoids browser DOM bloat. Docked 0.8 because worker concurrency is hardcoded to 4 rather than user-configurable in Settings. |
| **Code quality & architecture conformance** | 5% | **9.4 / 10** | Zero external AI SDKs introduced (pure native `fetch()`). AES-256-GCM encryption at rest and two-stage human-in-the-loop send gate strictly preserved. Oxlint clean with 0 errors. Docked 0.6 for 12 non-critical unused icon warnings. |
| **Documentation accuracy** | 5% | **9.8 / 10** | `ARCHITECTURE.md` and `README.md` comprehensively synchronized to reflect claim grounding, 4-worker batch queue, cross-session dedup, windowed pagination, strict TLS, and the 10-suite test runner. |

**Weighted Overall Score Calculation:**
`(9.2 * 0.20) + (9.0 * 0.20) + (9.0 * 0.15) + (9.0 * 0.15) + (8.8 * 0.10) + (9.2 * 0.10) + (9.4 * 0.05) + (9.8 * 0.05) = 1.84 + 1.80 + 1.35 + 1.35 + 0.88 + 0.92 + 0.47 + 0.49 = 9.10 / 10`

### Docs-Sync Changelog
Cycle 1 synchronized system documentation with reality following the resolution of 10 backlog tickets: `ARCHITECTURE.md` was updated across Section 3.1 (Rule 6 fact-grounding prompt constraints, `auditDraftClaims` corroboration engine, and 4-worker concurrent batch generation queue), Section 3.2 (cross-session deduplication via `getRecentlyContactedMap` and windowed recipient modal pagination), Section 3.4 (fail-closed AES-256-GCM 3-part hex parsing, short key masking <= 16 characters, and comprehensive danger-zone file and cache eradication), Section 3.5 (strict TLS defaults, intelligent SMTP error classification, exponential backoff retries, and ±20% anti-spam delay jitter), and Section 5/6 (documenting all 10 unit test suites and updated API contracts); `README.md` was similarly refreshed to highlight new capabilities and provide the full 10-suite test runner execution output.

### Cycle 2 Backlog Recommendations
1. `TICK-CYC2-01` (Test Coverage): Implement client-side component test runner (Vitest + React Testing Library) for `RecipientModal`, `EmailPreview`, and `App`.
2. `TICK-CYC2-02` (Deliverability): Add persistent daily sending quota budget tracker in `logs.json` and UI indicator for provider rate limits (Gmail 500/day, Outlook 300/day).
3. `TICK-CYC2-03` (Reliability): Add automatic exponential backoff retry on HTTP 429 responses in `aiService.js`.
4. `TICK-CYC2-04` (Performance): Expose configurable worker concurrency slider (1–8 workers) in Settings Preferences.
5. `TICK-CYC2-05` (Code Quality): Resolve React Compiler warnings regarding synchronous `setState` within `useEffect` in `RecipientModal.jsx` and `SettingsModal.jsx`.

---

## Cycle 3 — Overall: 9.79/10

- **Date:** 2026-09-28
- **Branch Evaluated:** `agent/cycle-2-ui-refinement`
- **Evaluator:** brutal-critic & tech-lead comprehensive audit
- **Automated Gates:**
  - `cd server && npm test`: **PASSED** (15 test suites, 0 failures across sheet parser, crypto, storage, SMTP resilience, copilot dispatch, AI guardrails, batch concurrency, cross-session dedup, danger-zone purge, resume parser, design tokens, firebase migration, security guardrails, ephemeral uploads, AI 429 retries).
  - `cd client && npm test`: **PASSED** (4 test suites, 23 tests passed in Vitest across `wizardSteps`, `hooks`, `StepIndicator`, `SettingsModal`).
  - `cd client && npm run lint`: **PASSED** (0 errors, 0 warnings across all 33 files via Oxlint).

### Dimension Scorecard

| Dimension | Weight | Score | Evidence & Audit Findings |
| :--- | :---: | :---: | :--- |
| **Security & credential handling** | 20% | **9.8 / 10** | Resolved critical architectural fork (Option 1: Hardware-Bound Local Storage). Cloud Firestore stores strictly non-sensitive profile and UI metadata (`stripSecrets()`). Plaintext secrets stripped from Firestore mutations and `/api/config/migration-export`. Sensitive credentials live exclusively in AES-256-GCM encrypted local storage. Backend `requireAuth` middleware mounted on all mutating/sensitive endpoints. Ephemeral resume removal via `DELETE /api/upload/resume` verified. |
| **Correctness & reliability** | 20% | **9.8 / 10** | Automatic HTTP 429 exponential backoff retries with randomized jitter in `aiService.js` prevent batch generation rate-limit crashes. Wizard step numbering strictly aligned across 5 canonical stages. Firebase auth timeout has graceful retry and local mode fallback. |
| **Test coverage** | 15% | **9.7 / 10** | Expanded backend to 15 automated test suites. Established complete frontend testing harness (Vitest, React Testing Library, jest-dom, jsdom) with 23 passing tests verifying hook lifecycles, wizard progression predicates, ARIA navigation, and settings tab switching. |
| **UX / user pain points** | 15% | **9.7 / 10** | Hallucination guardrail surfaced in `EmailPreview.jsx` with grounding pill (verified vs ungrounded) and detailed claims callout. Accessible `StepIndicator` with ARIA semantics and unlock tooltips. Accidental JD clear safeguard (>50 words). 30-day cross-session dedup check for manual contacts. Mandatory import authorization micro-interaction shake. Non-blocking minimized floating pill dock for campaign dispatches. |
| **Deliverability & compliance posture**| 10% | **9.8 / 10** | Daily provider quota budget tracker (`getDailySendingStats`, `GET /api/send/daily-stats`) against ESP limits (Gmail 500, Outlook 300) with amber quota warnings in `SendStep.jsx`. Real-time reactive stats re-query on SMTP account change. Strict TLS certificate validation and ±20% anti-spam jitter preserved. |
| **Performance / efficiency** | 10% | **9.8 / 10** | 4-worker concurrent batch generation wired to frontend (`batchGenerateColdEmails`). `App.jsx` decomposed from 620 lines to 470 lines by extracting `useWizardState` and `useCampaignStream`. Monolithic `SettingsModal.jsx` (2,028 lines) decomposed into 5 modular tab components in `client/src/components/settings/`. |
| **Code quality & architecture conformance** | 5% | **9.9 / 10** | Zero external AI SDKs (pure native `fetch()`). Two-stage human send gate preserved. Zero file retention on disk. Zero Oxlint warnings (0 errors, 0 warnings). Unused imports, dead CSS, and unused assets eliminated. |
| **Documentation accuracy** | 5% | **10.0 / 10** | `ARCHITECTURE.md`, `README.md`, `BACKLOG.md`, and `RATING_HISTORY.md` fully synchronized with code ground truth. |

**Weighted Overall Score Calculation:**
`(9.8 * 0.20) + (9.8 * 0.20) + (9.7 * 0.15) + (9.7 * 0.15) + (9.8 * 0.10) + (9.8 * 0.10) + (9.9 * 0.05) + (10.0 * 0.05) = 1.96 + 1.96 + 1.455 + 1.455 + 0.98 + 0.98 + 0.495 + 0.50 = 9.79 / 10`

### Cycle 3 Shipped Summary
All 23 Cycle 3 backlog tickets (`TICK-CYC3-01` through `TICK-CYC3-23`) successfully shipped across Workstreams A (Critical Fixes), B (Centralization), C (UI/UX Adjustments), and D (Research & Discovery Track), raising overall product quality from 9.10 to 9.79.

