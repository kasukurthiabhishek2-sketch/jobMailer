# Cycle 3 Ground-Truth Protocol & Baseline Report

- **Date:** 2026-09-28
- **Agent:** Tech Lead (`agent-orchestrator`)
- **Active Branch:** `agent/cycle-2-ui-refinement`
- **Initial Verification Gate Baseline:**
  - `cd server && npm test`: **FAILED** (7 Passed, 6 Failed, 1 Skipped across 14 test suites)
  - `cd client && npm run lint`: **PASSED** (0 errors, 0 warnings across 20 files with 104 oxlint rules)

---

## 1. Baseline Test Failure Breakdown (Ground-Truth Deltas)

The working tree was found in a dirty, uncommitted state on branch `agent/cycle-2-ui-refinement` with 42 modified/deleted/untracked files. The untouched test suite failed on 6 suites due to two primary root causes:

1. **`xlsx` Dependency Stripped While Still Required:**
   - In `server/package.json`, `"xlsx": "^0.18.5"` was removed and `"exceljs": "^4.4.0"` was added.
   - However, `server/services/sheetParser.js`, `server/test_sheet_parser_full.js`, `server/test_cross_session_dedup.js`, and `server/test_ephemeral_uploads.js` still explicitly `require('xlsx')`.
   - Result: `MODULE_NOT_FOUND: Cannot find module 'xlsx'`.
   - `exceljs` is not imported or used anywhere in the codebase.

2. **Incomplete Copilot Deletion / In-Flight Refactor:**
   - `server/services/copilotService.js` and `server/test_copilot_dispatch.js` were deleted unstaged in the working directory.
   - However, `server/services/aiService.js` still has `const copilotService = require('./copilotService')` at line 5.
   - `server/test_danger_zone.js`, `server/test_ai_guardrail.js`, and `server/test_security_guardrails.js` all depend directly or transitively on `copilotService`.
   - Result: `MODULE_NOT_FOUND: Cannot find module './copilotService'`.

3. **Suite-by-Suite Baseline Status:**
   - `test_sheet_parser_full.js`: ❌ FAILED (`Cannot find module 'xlsx'`)
   - `test_crypto.js`: ✅ PASSED (39ms)
   - `test_storage.js`: ✅ PASSED (39ms)
   - `test_smtp_resilience.js`: ✅ PASSED (78ms)
   - `test_copilot_dispatch.js`: ⚪ SKIPPED (file deleted)
   - `test_ai_guardrail.js`: ❌ FAILED (`Cannot find module './copilotService'`)
   - `test_batch_concurrency.js`: ✅ PASSED (101ms)
   - `test_cross_session_dedup.js`: ❌ FAILED (`Cannot find module 'xlsx'`)
   - `test_danger_zone.js`: ❌ FAILED (`Cannot find module './services/copilotService'`)
   - `test_resume_parser.js`: ✅ PASSED (108ms)
   - `test_design_tokens.js`: ✅ PASSED (32ms)
   - `test_firebase_migration.js`: ✅ PASSED (43ms)
   - `test_security_guardrails.js`: ❌ FAILED (`Cannot find module './copilotService'`)
   - `test_ephemeral_uploads.js`: ❌ FAILED (`Cannot find module 'xlsx'`)

---

## 2. Verification of Audit Findings in Code

All major audit citations were inspected against current file contents:

- **Section 7.3 (Firestore Plaintext Credentials):**
  - Confirmed. In `client/src/lib/settings.js` and `App.jsx`, user settings including plaintext `apiKey` and SMTP `appPassword` / `password` are persisted directly to Firestore (`users/{uid}/app/settings`).
  - `/api/config/migration-export` in `server/index.js` returns fully decrypted secrets over HTTP.
  - `POST /api/send/stream` in `server/index.js` accepts client-provided unencrypted SMTP passwords.

- **Section 7.4 (Step-Numbering Mismatch):**
  - Confirmed. In `client/src/components/Header.jsx`, Quick-Start card 2 is labeled "Recipient Management" and card 3 is "Tailored Job Description", reversing the real workflow order.
  - In `client/src/components/EmailPreview.jsx`, line 183 toasts: `"Please add at least one recipient in Step 2"`, whereas Recipients is Step 3.

- **Workstream A1 & A2 (Batch Concurrency & Hallucination Guardrail in `EmailPreview.jsx`):**
  - Confirmed. `EmailPreview.jsx` (lines 208-232) currently iterates through recipients with a sequential `for...of` calling `generateColdEmail()` one-by-one.
  - Lines 220-224 discard `res.groundingAudit` from the response payload, storing only `subject`, `body`, and `generatedAt`.

- **Workstream B2 (`App.jsx` Line Count & Hook Extraction):**
  - Confirmed. `App.jsx` is 620 lines, coordinating wizard navigation, collapsed card rendering, Firebase auth lifecycle, and campaign stream SSE.

- **Workstream B3 (`SettingsModal.jsx` Splitting):**
  - Confirmed. `SettingsModal.jsx` is 2,028 lines containing all tab logic (AI providers, SMTP accounts, preferences, logs, danger zone) inline.

- **Workstream B4 (`requireAuth` Placement):**
  - Confirmed. `requireAuth` middleware is only mounted on `GET /api/config/migration-export`. All other mutating routes (`/api/ai/*`, `/api/upload/*`, `/api/send/*`, `/api/config/*`) lack auth enforcement.

- **Workstream C2 (Step Bar Duplication on Session Start):**
  - Diagnosed in code. In `App.jsx`, `<StepIndicator>` is permanently rendered at line 343, and when `currentStep > 1`, lines 356-437 render an additional vertical stack of `.wizard-collapsed-step` elements directly below the step bar, creating a visual duplicate/stacked appearance of step navigation.

---

## 3. Recommended Actions Prior to Phase 1 Execution

1. **Restore baseline test green state:**
   - Reinstall/re-add `xlsx` to resolve the 4 spreadsheet and upload test failures.
   - Cleanly resolve the `copilotService` status (restore `copilotService.js` and `test_copilot_dispatch.js` so that all 14 suites pass, or complete its formal deprecation with updated tests).
2. **Present Section 5 Architecture Decision (TICK-CYC3-01) to User:**
   - Present Option 1 (local AES-encrypted secrets, Firestore for profile/preferences only) vs Option 2 (client-side encrypted secrets) before writing migration code.
