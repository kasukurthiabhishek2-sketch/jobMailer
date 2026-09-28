# JDMail Product & Engineering Backlog

**Current Cycle:** Cycle 3  
**Cycle 1 Status:** Complete (10 tickets shipped, overall rating: 9.10/10)  
**Cycle 2 Status:** Complete (Transferred & expanded into Cycle 3)  
**Cycle 3 Status:** **Complete** (24 tickets shipped, 16 server suites PASSED, 35 client tests PASSED, 0 lint warnings/errors)  
**Synthesized from:**
- Cycle 3 Master Engineering Prompt
- Comprehensive Architectural Audit (`cycle-3-ground-truth.md`)
- Research & UX Audits (`cycle-3-research.md`, `cycle-3-pain-points.md`, `cycle-3-frontend-test-proposal.md`)

---

## Cycle 3 Ticket Inventory & Execution Status

| Ticket ID | Workstream | Title | Priority | Status | Owning Agent |
|---|---|---|---|---|---|
| **TICK-CYC3-01** | Core Sec | Hardware-Bound Local Storage Architecture (Option 1) | **Critical** | **Shipped** | `security-engineer` |
| **TICK-CYC3-02** | Workstream A | Concurrent Batch Generation in `EmailPreview.jsx` | **Critical** | **Shipped** | `ai-integration-engineer` |
| **TICK-CYC3-03** | Workstream A | Surface Hallucination Guardrail in `EmailPreview.jsx` | **High** | **Shipped** | `ai-integration-engineer` |
| **TICK-CYC3-04** | Workstream A | Step Numbering Alignment (5-Step Canonical Wizard) | **High** | **Shipped** | `frontend-architect` |
| **TICK-CYC3-05** | Workstream A | AI Provider HTTP 429 Exponential Backoff Retries | **High** | **Shipped** | `ai-integration-engineer` |
| **TICK-CYC3-06** | Core Sec | Backend API Authentication Middleware (`requireAuth`) | **High** | **Shipped** | `security-engineer` |
| **TICK-CYC3-07** | Workstream B | Centralize Canonical `WIZARD_STEPS` Source of Truth | **High** | **Shipped** | `frontend-architect` |
| **TICK-CYC3-08** | Workstream B | Decompose `App.jsx` (`useWizardState`, `useCampaignStream`) | **High** | **Shipped** | `frontend-architect` |
| **TICK-CYC3-09** | Workstream B | Modular Decomposition of `SettingsModal.jsx` (5 Tabs) | **High** | **Shipped** | `senior-react-engineer` |
| **TICK-CYC3-10** | Workstream C | Accessible Step Progression Bar & ARIA Navigation | **Medium** | **Shipped** | `senior-react-engineer` |
| **TICK-CYC3-11** | Workstream C | Eliminate Duplicate Completed Card Stacks in App Shell | **Medium** | **Shipped** | `senior-react-engineer` |
| **TICK-CYC3-12** | Workstream C | Daily Provider Quota Budget Tracker & Warning System | **High** | **Shipped** | `deliverability-lead` |
| **TICK-CYC3-13** | Workstream C | Ephemeral Resume Deletion Endpoint & UI Action | **Medium** | **Shipped** | `backend-engineer` |
| **TICK-CYC3-14** | Workstream C | Firebase Auth Timeout Graceful Fallback & Local Mode Toggle | **High** | **Shipped** | `senior-react-engineer` |
| **TICK-CYC3-15** | Workstream C | Job Description Accidental Clear Safeguard | **Medium** | **Shipped** | `senior-react-engineer` |
| **TICK-CYC3-16** | Workstream C | Cross-Session Duplicate Recipient Audit Guard | **Medium** | **Shipped** | `backend-engineer` |
| **TICK-CYC3-17** | Workstream C | Recipient Import Mandatory Authorization Micro-Interaction Shake | **Medium** | **Shipped** | `senior-react-engineer` |
| **TICK-CYC3-18** | Workstream C | Reactive SMTP Provider Quota Live-Refresh | **Medium** | **Shipped** | `deliverability-lead` |
| **TICK-CYC3-19** | Workstream C | Non-Blocking Minimized Floating Pill Dock for Campaign Dispatch | **Medium** | **Shipped** | `senior-react-engineer` |
| **TICK-CYC3-20** | Debloat | Dead Code Sweep, Anti-Slop Audit & React Compiler Lint Zero | **High** | **Shipped** | `qa-lead` / `tech-lead` |
| **TICK-CYC3-21** | Workstream D | Deep Architectural Research Track Report | **Research** | **Shipped** | `ai-integration-engineer` |
| **TICK-CYC3-22** | Workstream D | 14-Screen Pain Points & Interaction UX Audit | **Research** | **Shipped** | `product-designer` |
| **TICK-CYC3-23** | Workstream D | Frontend Test Harness Proposal & Vitest Suite Setup | **Research** | **Shipped** | `qa-lead` |
| **TICK-CYC3-24** | Workstream C | Resilient SMTP Sending Pipeline (Controlled Concurrency, RFC 5321 Response Recording, Slowdown, Smart Retries) | **Critical** | **Shipped** | `deliverability-lead` |

---

## Detailed Cycle 3 Shipped Ticket Specifications

### TICK-CYC3-01: Hardware-Bound Local Storage Architecture (Option 1)
- **Problem:** API keys and SMTP passwords in cloud Firestore documents (`users/{uid}/app/settings`) and `/api/config/migration-export` risked plaintext exposure in multi-device sync.
- **Solution:** Adopted Option 1 (Hardware-Bound Local Storage). Cloud Firestore stores strictly non-sensitive metadata (`candidateProfile`, `tonePreferences`, `theme`). Implemented `stripSecrets()` to purge credentials before Firestore writes. Masked `/api/config/migration-export`. Preserved AES-256-GCM local storage as the sole residence for sensitive credentials.
- **Verification:** `server/test_firebase_migration.js` verifies zero plaintext secrets in Firestore payloads and export data.

### TICK-CYC3-02: Concurrent Batch Generation in `EmailPreview.jsx`
- **Problem:** `EmailPreview.jsx` looped sequentially through recipients calling `/api/ai/generate`, ignoring the backend 4-worker concurrent pool.
- **Solution:** Added `batchGenerateColdEmails` to `client/src/services/api.js` and wired `handleGenerateAll()` to `POST /api/ai/batch-generate`. Sequential fallback was completely excised.
- **Verification:** `server/test_batch_concurrency.js` verifies 4-worker pool ordering and throughput.

### TICK-CYC3-03: Surface Hallucination Guardrail in `EmailPreview.jsx`
- **Problem:** `aiService.js` generated `groundingAudit` metadata, but `EmailPreview.jsx` discarded it upon receipt.
- **Solution:** Stored `groundingAudit` in generated draft state. Rendered a claim-grounding pill (green check for verified, amber badge with claim count for ungrounded). Added interactive accordion detailing ungrounded metrics and resume corroboration.
- **Verification:** `server/test_ai_guardrail.js` verifies claim extraction and audit tagging.

### TICK-CYC3-04: Step Numbering Alignment (5-Step Canonical Wizard)
- **Problem:** Components referenced varying step numbers (e.g., EmailPreview called itself Step 3 while StepIndicator listed it as Step 4).
- **Solution:** Re-indexed all step references across `Header.jsx`, `EmailPreview.jsx`, and `StepIndicator.jsx` to the canonical 1–5 sequence.
- **Verification:** `client/src/__tests__/wizardSteps.test.js` tests step numbers 1 through 5.

### TICK-CYC3-05: AI Provider HTTP 429 Exponential Backoff Retries
- **Problem:** Hitting provider RPM or rate limits during batch generation failed recipient drafts instantly.
- **Solution:** Wrapped `callGemini` and `callOpenAiCompatible` in `server/services/aiService.js` with an automated exponential backoff retry handler (up to 3 retries, randomized jitter).
- **Verification:** `server/test_ai_retry.js` simulates 429 status codes and verifies seamless recovery.

### TICK-CYC3-06: Backend API Authentication Middleware (`requireAuth`)
- **Problem:** Backend mutating routes were unauthenticated, relying solely on client-side routing.
- **Solution:** Implemented `requireAuth` middleware verifying Firebase ID tokens when Firebase is active, permitting local requests in offline mode.
- **Verification:** `server/test_security_guardrails.js` verifies 401 rejection on unauthorized access.

### TICK-CYC3-07: Centralize Canonical `WIZARD_STEPS` Source of Truth
- **Problem:** Wizard step definitions, labels, and unlock conditions were duplicated across multiple components.
- **Solution:** Created `client/src/constants/wizardSteps.js` defining canonical step identities, labels, descriptions, and gating predicates.
- **Verification:** `client/src/__tests__/wizardSteps.test.js` validates all predicates and ordering.

### TICK-CYC3-08: Decompose `App.jsx` (`useWizardState`, `useCampaignStream`)
- **Problem:** `App.jsx` exceeded 620 lines, mixing wizard navigation, draft state, and SSE dispatch logic.
- **Solution:** Extracted `useWizardState` (wizard navigation, gating, state) and `useCampaignStream` (SSE streaming, anti-abuse pacing, safety checks). `App.jsx` dropped to clean modular layout.
- **Verification:** `client/src/__tests__/hooks.test.js` covers hook transitions and dispatch lifecycle.

### TICK-CYC3-09: Modular Decomposition of `SettingsModal.jsx` (5 Tabs)
- **Problem:** `SettingsModal.jsx` was 2,028 lines of tightly-coupled code across 5 disparate functional domains.
- **Solution:** Decomposed into `client/src/components/settings/`:
  - `AiProvidersTab.jsx`
  - `SmtpAccountsTab.jsx`
  - `PreferencesTab.jsx`
  - `AuditLogsTab.jsx`
  - `DangerZoneTab.jsx`
  Modal shell dropped to ~150 lines.
- **Verification:** `client/src/__tests__/SettingsModal.test.jsx` tests tab switching and isolated mounting.

### TICK-CYC3-10: Accessible Step Progression Bar & ARIA Navigation
- **Problem:** `StepIndicator.jsx` lacked keyboard navigation, ARIA semantics, and locked-step explanations.
- **Solution:** Enhanced `StepIndicator.jsx` with `role="tablist"`, `aria-selected`, tooltips explaining unlock prerequisites, and click-to-navigate for unlocked steps.
- **Verification:** `client/src/__tests__/StepIndicator.test.jsx` tests accessibility attributes.

### TICK-CYC3-11: Eliminate Duplicate Completed Card Stacks in App Shell
- **Problem:** `App.jsx` rendered duplicate `.wizard-completed-stack` cards alongside the active wizard step.
- **Solution:** Removed stacked duplicate cards in `App.jsx`, ensuring a focused single active step view.
- **Verification:** Verified in component hierarchy and browser DOM testing.

### TICK-CYC3-12: Daily Provider Quota Budget Tracker & Warning System
- **Problem:** Users could accidentally exceed provider daily limits (e.g., 500/day on Gmail, 300/day on Outlook) without warning.
- **Solution:** Added `getDailySendingStats()` in `storageService.js`, mounted `GET /api/send/daily-stats`, and added usage badge + amber warning banner in `SendStep.jsx`.
- **Verification:** `server/test_storage.js` tests 24-hour quota calculation across log timestamps.

### TICK-CYC3-13: Ephemeral Resume Deletion Endpoint & UI Action
- **Problem:** Uploaded resumes remained on disk until factory reset.
- **Solution:** Implemented `DELETE /api/upload/resume` in `server/index.js`, added `deleteEphemeralResume()` in `api.js`, and added "Remove Resume" button in `ResumeUpload.jsx`.
- **Verification:** `server/test_ephemeral_uploads.js` verifies physical file unlinking.

### TICK-CYC3-14: Firebase Auth Timeout Graceful Fallback & Local Mode Toggle
- **Problem:** A 2.5-second blind timeout previously switched users to offline mode without clear status.
- **Solution:** Eliminated blind fallback. Added explicit "Unable to Reach Firebase Authentication" screen with `[Retry Connection]` and `[Continue in Local Mode]` actions.
- **Verification:** Verified state transitions and retry handler in `App.jsx`.

### TICK-CYC3-15: Job Description Accidental Clear Safeguard
- **Problem:** Clicking "Clear" on a large pasted JD immediately wiped user content without confirmation.
- **Solution:** Added a confirmation banner in `JobDescriptionInput.jsx` before clearing if content exceeds 50 words.
- **Verification:** Tested word threshold and cancellation behavior.

### TICK-CYC3-16: Cross-Session Duplicate Recipient Audit Guard
- **Problem:** Manual recipient entry did not check against historical dispatches in `logs.json`.
- **Solution:** Integrated 30-day deduplication check in `RecipientManager.jsx` against `logs.json` with an amber warning badge for previously-contacted leads.
- **Verification:** `server/test_cross_session_dedup.js` verifies cross-session matching.

### TICK-CYC3-17: Recipient Import Mandatory Authorization Micro-Interaction Shake
- **Problem:** Users clicking Import without checking the mandatory authorization box had no clear feedback.
- **Solution:** Added `@keyframes shake` in `index.css` and amber highlight on the checkbox with an alert prompt.
- **Verification:** Manual UI and CSS token validation.

### TICK-CYC3-18: Reactive SMTP Provider Quota Live-Refresh
- **Problem:** Changing SMTP accounts in SendStep did not refresh the displayed quota stats.
- **Solution:** Added reactive `useEffect` in `SendStep.jsx` re-fetching `/api/send/daily-stats` whenever the selected SMTP profile changes.
- **Verification:** Verified live stats re-query on account switch.

### TICK-CYC3-19: Non-Blocking Minimized Floating Pill Dock for Campaign Dispatch
- **Problem:** `SendProgressModal.jsx` blocked the UI during large email campaigns.
- **Solution:** Added minimize capability with a floating bottom-right pill dock (`Minimize2`/`Maximize2`) displaying real-time progress.
- **Verification:** Verified clean minimizing/maximizing and 0 lint warnings.

### TICK-CYC3-20: Dead Code Sweep, Anti-Slop Audit & React Compiler Lint Zero
- **Problem:** Unused imports and React compiler `set-state-in-effect` warnings remained in code.
- **Solution:** Removed unused imports (`useEffect`, Lucide icons), cleaned up dead assets (`App.css`, sample SVGs), refactored render-time state derivation.
- **Verification:** `cd client && npm run lint` outputs 0 errors and 0 warnings.

### TICK-CYC3-21: Deep Architectural Research Track Report
- **Output:** `docs/agent-reports/cycle-3-research.md` detailing draft diffing, self-send testing, hotkeys, and table virtualization.

### TICK-CYC3-22: 14-Screen Pain Points & Interaction UX Audit
- **Output:** `docs/agent-reports/cycle-3-pain-points.md` detailing 14 UI walkthrough screens and interaction recommendations.

### TICK-CYC3-23: Client Vitest & React Testing Library Harness Proposal
- **Output:** `docs/agent-reports/cycle-3-frontend-test-proposal.md`, plus full implementation of Vitest harness with 23 passing tests.

### TICK-CYC3-24: Resilient SMTP Sending Pipeline (Controlled Concurrency, RFC 5321 Response Recording, Slowdown, Smart Retries)
- **Problem:** Email sending previously had fixed delays without adaptive pacing when ESPs throttle, lacked raw RFC 5321 SMTP response code auditing per message, lacked user-configurable worker concurrency, and risked spam blacklisting by retrying permanent 5xx failures.
- **Solution:** Implemented the full 4-stage resilient delivery pipeline:
  1. **Sequential & Controlled Concurrency:** Sequential worker dispatch by default (`concurrency: 1`), configurable up to 5 workers in `PreferencesTab.jsx` and `dispatchCampaign()`.
  2. **RFC 5321 Response Recording:** Accurately extracts 3-digit status codes and raw server banner text (`250 2.0.0 OK`, `452 Mailbox full`, `550 User unknown`) recorded in SSE events and persistent `logs.json`.
  3. **Adaptive Slowdown & Circuit Breaker:** Dynamically doubles inter-message pacing delay upon encountering transient 4xx or rate-limit responses; trips circuit breaker immediately to halt the queue if 3 consecutive transient failures or 2 quota limits occur, protecting sender domain reputation.
  4. **Smart RFC 5321 Retries:** Distinguishes between `250` (success), `4xx` / network transients (exponential backoff retry), `5xx` (fails fast immediately on attempt 1 without blind retries), and `535 / EAUTH` (immediate account abort).
  5. **UI Observability:** Added colored RFC 5321 badges (`250`, `4xx`, `5xx`) and transient slowdown alert banners in `SendProgressModal.jsx`, and SMTP response auditing in `AuditLogsTab.jsx`.
- **Verification:** `server/test_smtp_pipeline.js` comprehensive test suite (16 server suites pass, 35 client tests pass, 0 lint errors).

---

## Shipped Ticket Archive (Cycles 1 & 2)

### Cycle 1 Shipped Tickets (Archive)
- **TICK-01:** Fix Copilot AI dispatch undefined symbol `callCopilotChat`
- **TICK-02:** Transient vs Permanent SMTP Error Handling and Backoff Retry
- **TICK-03:** Comprehensive Test Suites for Subsystems (`crypto`, `storage`, `smtp`, `ai`)
- **TICK-04:** Cryptographic Fail-Closed Enforcement & Tampering Protection
- **TICK-05:** Complete Danger-Zone Purge (`server/uploads/` & `tokenCache`)
- **TICK-06:** Controlled Concurrency for Batch AI Generation (75% Speedup)
- **TICK-07:** Windowed Pagination in Recipient Modal
- **TICK-08:** Anti-Spam Sending Delay Jitter & Daily Send Counter Warning
- **TICK-09:** Cross-Session Recipient Deduplication Against Audit History
- **TICK-10:** AI Hallucination Guardrail & Claim Verification
