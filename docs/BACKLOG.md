# JDMail Product & Engineering Backlog

**Current Cycle:** Cycle 2  
**Cycle 1 Status:** Complete (10 tickets shipped, overall rating: 9.10/10)  
**Cycle 2 Status:** Awaiting Human Checkpoint Approval (Phase 2 -> Phase 3 Gate)  
**Synthesized from:**
- `docs/agent-reports/phase1-research-cycle2.md`
- `docs/RATING_HISTORY.md` (Cycle 1 Audit Findings)

---

## Cycle 2 Prioritized Ticket Inventory

| Ticket ID | Title | Priority | Owning Agent | Risk Level |
|---|---|---|---|---|
| **TICK-CYC2-01** | Daily Provider Quota Budget Tracker & Warning System | **High** | `deliverability-lead` | Medium |
| **TICK-CYC2-02** | AI Provider HTTP 429 Exponential Backoff Retries | **High** | `ai-integration-engineer` | Low |
| **TICK-CYC2-03** | User-Configurable Batch Concurrency Slider in Preferences | **Medium** | `performance-engineer` | Low |
| **TICK-CYC2-04** | Active Resume File Deletion Endpoint & UI Action | **Medium** | `backend-engineer` | Low |
| **TICK-CYC2-05** | React Compiler Warning Elimination & Zero-Lint-Warning Cleanup | **Low** | `frontend-engineer` | Low |

---

## Cycle 2 Detailed Ticket Specifications

### TICK-CYC2-01: Daily Provider Quota Budget Tracker & Warning System
- **Priority:** High
- **Problem:** Email service providers impose strict daily limits (e.g. Gmail: 500 emails/day; Outlook: 300 emails/day). Exceeding these limits leads to 24-hour mailbox lockouts or domain reputation degradation. Currently, `logs.json` records individual dispatches, but does not aggregate rolling 24-hour totals or alert the user when approving more recipients than available quota.
- **Proposed Direction:**
  1. Add `getDailySendingStats(smtpAccountId)` in `server/services/storageService.js` counting successful dispatches in the past 24 hours.
  2. Expose `GET /api/logs/stats` returning daily count, estimated provider limit, and remaining quota.
  3. In `client/src/components/RecipientManager.jsx` and `client/src/components/SendProgressModal.jsx`, display a quota progress pill (e.g., "Sent 45 / 500 today on Gmail (455 remaining)") with an alert if approved recipients exceed remaining quota.
- **Affected Files:** `server/services/storageService.js`, `server/index.js`, `client/src/components/RecipientManager.jsx`, `client/src/services/api.js`
- **Test Plan:** Add unit test in `server/test_quota_tracker.js` verifying 24-hour rolling window calculations across multiple timestamps.

---

### TICK-CYC2-02: AI Provider HTTP 429 Exponential Backoff Retries
- **Priority:** High
- **Problem:** During concurrent batch generation (4 workers), users on free-tier or Tier-1 API accounts (e.g., OpenAI RPM limits, Groq free tier) occasionally hit HTTP 429 "rate limit exceeded", causing that recipient's email draft to fail immediately.
- **Proposed Direction:**
  1. Wrap `callOpenAiCompatible()` and `callGemini()` in `server/services/aiService.js` with an automated retry handler for HTTP 429 status codes.
  2. Implement exponential backoff with jitter (initial delay 2s, doubling up to 8s, maximum 3 retries).
  3. Include descriptive logging when a retry is triggered.
- **Affected Files:** `server/services/aiService.js`
- **Test Plan:** Add unit test in `server/test_ai_retry.js` simulating 429 responses and asserting successful retry on subsequent attempt.

---

### TICK-CYC2-03: User-Configurable Batch Concurrency Slider in Preferences
- **Priority:** Medium
- **Problem:** Worker concurrency for batch email generation is hardcoded to 4 in `server/index.js`. Users on Tier 1 API keys need lower concurrency (1-2) to avoid rate limits, while users on high-tier enterprise keys desire faster generation (6-8).
- **Proposed Direction:**
  1. Add `batchConcurrency: 4` to default `sendingPreferences` in `server/services/storageService.js`.
  2. Update `server/index.js` `POST /api/ai/batch-generate` to read `config.sendingPreferences.batchConcurrency || 4`.
  3. Add a concurrency slider (range 1–8) with helpful guidance in `client/src/components/SettingsModal.jsx` (Preferences tab).
- **Affected Files:** `server/services/storageService.js`, `server/index.js`, `client/src/components/SettingsModal.jsx`
- **Test Plan:** Add unit test asserting `batch-generate` respects the custom `batchConcurrency` value.

---

### TICK-CYC2-04: Active Resume File Deletion Endpoint & UI Action
- **Priority:** Medium
- **Problem:** Resumes uploaded to `server/uploads/` remain on disk until a complete factory reset (`POST /api/config/reset`). If a candidate wants to remove their resume or upload an updated one, orphaned files linger.
- **Proposed Direction:**
  1. Add `DELETE /api/upload/resume` endpoint in `server/index.js` that deletes the active resume file from `server/uploads/`.
  2. Add a "Remove Resume" button in `client/src/components/ResumeUpload.jsx` allowing the user to clear their resume and state cleanly.
- **Affected Files:** `server/index.js`, `client/src/components/ResumeUpload.jsx`, `client/src/services/api.js`
- **Test Plan:** Add test asserting `DELETE /api/upload/resume` deletes the physical file from disk.

---

### TICK-CYC2-05: React Compiler Warning Elimination & Zero-Lint-Warning Cleanup
- **Priority:** Low
- **Problem:** Oxlint reports 12 warnings across `RecipientModal.jsx`, `SettingsModal.jsx`, `SendProgressModal.jsx`, `SmtpGuideModal.jsx`, and `RecipientManager.jsx` due to unused imports and calling `setState` inside `useEffect`.
- **Proposed Direction:**
  1. Refactor state synchronization in `RecipientModal.jsx` and `SettingsModal.jsx` to eliminate React Compiler cascading render warnings.
  2. Remove all unused Lucide icon imports across components.
  3. Ensure `cd client && npm run lint` outputs 0 errors and 0 warnings.
- **Affected Files:** `client/src/components/RecipientModal.jsx`, `client/src/components/SettingsModal.jsx`, `client/src/components/SendProgressModal.jsx`, `client/src/components/SmtpGuideModal.jsx`, `client/src/components/RecipientManager.jsx`, `client/src/services/api.js`
- **Test Plan:** Run `cd client && npm run lint` to verify 0 warnings and 0 errors.

---

## Cycle 1 Shipped Ticket Archive (Reference)

| Ticket ID | Title | Priority | Owning Agent | Risk Level |
|---|---|---|---|---|
| **TICK-01** | Fix Copilot AI dispatch undefined symbol `callCopilotChat` runtime crash | **Critical** | `ai-integration-engineer` | Low |
| **TICK-02** | Implement Transient vs Permanent SMTP Error Handling and Backoff Retry | **Critical** | `backend-engineer` | Medium |
| **TICK-03** | Build Comprehensive Test Suites for Subsystems (`crypto`, `storage`, `smtp`, `ai`) | **High** | `backend-engineer` | Low |
| **TICK-04** | Cryptographic Fail-Closed Enforcement & Tampering Protection in `crypto.js` | **High** | `backend-engineer` | Low |
| **TICK-05** | Complete Danger-Zone Purge (Clean `server/uploads/` & in-memory `tokenCache`) | **High** | `backend-engineer` | Low |
| **TICK-06** | Controlled Concurrency for Batch AI Generation (75% Latency Reduction) | **High** | `performance-engineer` | Medium |
| **TICK-07** | Pagination & Virtual Windowing in Recipient Spreadsheet Modal (`RecipientModal.jsx`) | **High** | `frontend-engineer` | Low |
| **TICK-08** | Anti-Spam Sending Delay Jitter and Daily Send Counter Warning | **High** | `backend-engineer` | Low |
| **TICK-09** | Cross-Session Recipient Deduplication Against Audit History (`logs.json`) | **High** | `parsing-specialist` | Medium |
| **TICK-10** | AI Hallucination Guardrail & Resume Claim Verification Step | **High** | `ai-integration-engineer` | Medium |
| **TICK-11** | SMTP TLS Strict Certificate Verification with Explicit Self-Signed Toggle | **Medium** | `backend-engineer` | Low |
| **TICK-12** | Express API Rate Limiting & Localhost CORS Hardening | **Medium** | `backend-engineer` | Low |
| **TICK-13** | Outreach Compliance Footer & Opt-Out Settings Configuration | **Medium** | `frontend-engineer` | Low |
| **TICK-14** | Masking Function Hardening for Short API Keys | **Low** | `backend-engineer` | Low |
| **TICK-15** | Glassmorphic UI Accessibility Polish (Focus States & Contrast Auditing) | **Low** | `frontend-engineer` | Low |

---

## Detailed Ticket Specifications

### TICK-01: Fix Copilot AI dispatch undefined symbol `callCopilotChat` runtime crash
- **Priority:** Critical
- **Problem:** In [`server/services/aiService.js:258`](file:///Users/manu19/Desktop/JDMail/server/services/aiService.js#L258), `case 'copilot': return await callCopilotChat(...)` throws `ReferenceError: callCopilotChat is not defined` because it was not imported from `./copilotService`. Copilot email generation crashes instantly.
- **Proposed Direction:** Update `aiService.js` to either call `copilotService.callCopilotChat` or destructure `const { callCopilotChat } = require('./copilotService')`.
- **Affected Files:** `server/services/aiService.js`
- **Owning Agent:** `ai-integration-engineer`
- **Risk Level:** Low
- **Test Plan:** Add a test verifying `generateColdEmail` invokes `callCopilotChat` properly when provider is `'copilot'`.

---

### TICK-02: Implement Transient vs Permanent SMTP Error Handling and Backoff Retry
- **Priority:** Critical
- **Problem:** [`server/index.js:510-533`](file:///Users/manu19/Desktop/JDMail/server/index.js#L510-L533) immediately fails an email if the SMTP server returns any error. Transient network resets (`ETIMEDOUT`, `ECONNRESET`) or rate limit codes (`421`, `451`, `452`) cause immediate dispatch failure with zero retries. Conversely, permanent failures (`550`, `EAUTH`) continue blasting subsequent recipients, risking IP blacklisting.
- **Proposed Direction:** Classify SMTP errors in `smtpService.js`:
  1. Transient errors (`ETIMEDOUT`, `ECONNRESET`, `421`, `452`): automatic 1-retry attempt with a 4s exponential backoff.
  2. Rate limit codes: emit `rate_limit_pause` SSE event.
  3. Authentication/Account errors (`EAUTH`): stop the sending loop immediately and notify user rather than failing every contact.
- **Affected Files:** `server/services/smtpService.js`, `server/index.js`
- **Owning Agent:** `backend-engineer`
- **Risk Level:** Medium
- **Test Plan:** Create mock transporter tests verifying transient errors are retried once, permanent errors fail immediately, and `EAUTH` halts the loop.

---

### TICK-03: Build Comprehensive Test Suites for Subsystems (`crypto`, `storage`, `smtp`, `ai`)
- **Priority:** High
- **Problem:** Currently only `sheetParser.js` has automated tests (`server/test_sheet_parser_full.js`). Section 5 of `ARCHITECTURE.md` outlines multiple core services that have 0% test coverage.
- **Proposed Direction:** Create test suites:
  - `server/test_crypto.js`: tests AES-256-GCM encryption/decryption roundtrip, IV uniqueness, tampering auth tag rejection, key masking.
  - `server/test_storage.js`: tests config persistence, masking of public config, SMTP profile CRUD.
  - `server/test_ai_service.js`: tests prompt building with/without JD, cleanJsonOutput markdown handling, key mismatch detection.
  - Wire them into `npm test` via a test runner script (`test_all.js`).
- **Affected Files:** `server/package.json`, `server/test_*.js`
- **Owning Agent:** `backend-engineer` / `qa-test-engineer`
- **Risk Level:** Low
- **Test Plan:** Ensure `cd server && npm test` runs all suites and prints clean pass summaries.

---

### TICK-04: Cryptographic Fail-Closed Enforcement & Tampering Protection in `crypto.js`
- **Priority:** High
- **Problem:** [`server/utils/crypto.js:70-73`](file:///Users/manu19/Desktop/JDMail/server/utils/crypto.js#L70-L73) returns `cipherText` unparsed if `parts.length !== 3`. This fails open and allows plaintext fallbacks or partial leakage if ciphertext is corrupted.
- **Proposed Direction:** Enforce strict fail-closed: if input does not match expected 3-part hex format, return empty string `''` unless an explicit legacy migration flag is provided.
- **Affected Files:** `server/utils/crypto.js`
- **Owning Agent:** `backend-engineer`
- **Risk Level:** Low
- **Test Plan:** Assert invalid/tampered ciphertext strings return `''` and never leak malformed inputs.

---

### TICK-05: Complete Danger-Zone Purge (Clean `server/uploads/` & in-memory `tokenCache`)
- **Priority:** High
- **Problem:** [`server/index.js:224-243`](file:///Users/manu19/Desktop/JDMail/server/index.js#L224-L243) (`/api/config/reset`) leaves uploaded resume files in `server/uploads/` and retains GitHub Copilot session tokens in `tokenCache`.
- **Proposed Direction:** Expand `/api/config/reset` to delete all files in `server/uploads/` (preserving the empty folder), call `copilotService.clearSessionCache()`, and return clean sanitized config.
- **Affected Files:** `server/index.js`, `server/services/copilotService.js`
- **Owning Agent:** `backend-engineer`
- **Risk Level:** Low
- **Test Plan:** Upload a sample resume, invoke reset endpoint, assert `server/uploads/` is empty and session token is null.

---

### TICK-06: Controlled Concurrency for Batch AI Generation (75% Latency Reduction)
- **Priority:** High
- **Problem:** [`server/index.js:374-399`](file:///Users/manu19/Desktop/JDMail/server/index.js#L374-L399) runs `for (const recipient of recipients) await generateColdEmail(...)` sequentially. 40 recipients takes ~90 seconds and risks gateway timeouts.
- **Proposed Direction:** Implement a concurrent chunk processor (concurrency limit = 3–4 workers) in `/api/ai/batch-generate`.
- **Affected Files:** `server/index.js`
- **Owning Agent:** `performance-engineer`
- **Risk Level:** Medium
- **Test Plan:** Benchmark batch generation with 10 synthetic recipients, verifying parallel execution and 100% result accuracy.

---

### TICK-07: Pagination & Virtual Windowing in Recipient Spreadsheet Modal (`RecipientModal.jsx`)
- **Priority:** High
- **Problem:** [`client/src/components/RecipientModal.jsx:535-620`](file:///Users/manu19/Desktop/JDMail/client/src/components/RecipientModal.jsx#L535-L620) renders all rows in the spreadsheet at once. Sheets with >1,000 rows create tens of thousands of DOM elements, freezing the browser.
- **Proposed Direction:** Add pagination controls (50 / 100 / 250 rows per page) with page jump, total item count, and fast filtering to `RecipientModal.jsx`, matching the pagination design in `RecipientManager.jsx`.
- **Affected Files:** `client/src/components/RecipientModal.jsx`
- **Owning Agent:** `frontend-engineer`
- **Risk Level:** Low
- **Test Plan:** Test rendering 2,000 synthetic rows; verify instant rendering (<50ms) and correct Shift-Click range selection within and across pages.

---

### TICK-08: Anti-Spam Sending Delay Jitter and Daily Send Counter Warning
- **Priority:** High
- **Problem:** Fixed send delay creates robotic timing patterns that trigger ESP anti-spam filters. Users have no warning when approaching daily limits (e.g., 500 emails/day on Gmail).
- **Proposed Direction:**
  1. Add natural timing jitter: `delay = baseDelay * (0.85 + Math.random() * 0.35)`.
  2. Calculate today's sent count from `logs.json` and display a daily progress badge (e.g. "Sent Today: 24 / 500 recommended").
- **Affected Files:** `server/index.js`, `server/services/storageService.js`, `client/src/components/SendProgressModal.jsx`, `client/src/components/RecipientManager.jsx`
- **Owning Agent:** `backend-engineer`
- **Risk Level:** Low
- **Test Plan:** Verify jitter variance in delay timing during sends, and test daily counter calculation from mock logs.

---

### TICK-09: Cross-Session Recipient Deduplication Against Audit History (`logs.json`)
- **Priority:** High
- **Problem:** Importing a new spreadsheet does not check if any contact was already emailed in a previous session or campaign, leading to accidental duplicate emails.
- **Proposed Direction:** Provide a helper/endpoint that matches imported emails against `logs.json`. If an email was sent within the last 30 days, flag with an amber "Previously Contacted on [Date]" badge and uncheck by default.
- **Affected Files:** `server/services/sheetParser.js`, `server/index.js`, `client/src/components/RecipientModal.jsx`, `client/src/components/RecipientManager.jsx`
- **Owning Agent:** `parsing-specialist` / `frontend-engineer`
- **Risk Level:** Medium
- **Test Plan:** Seed `logs.json` with `recruiter@example.com`, parse a sheet with that email, assert it is flagged as `isPreviouslyContacted: true` and deselected by default.

---

### TICK-10: AI Hallucination Guardrail & Resume Claim Verification Step
- **Priority:** High
- **Problem:** LLMs can hallucinate candidate achievements or metrics that are absent from the resume.
- **Proposed Direction:** Implement a post-generation verification function in `aiService.js` that checks numbers and capitalized tech entities in the generated body against `resumeText`. Return an `auditNotes` object with flagged claims and display a subtle "Verified Claims" / "Review Claims" indicator in `EmailPreview.jsx`.
- **Affected Files:** `server/services/aiService.js`, `client/src/components/EmailPreview.jsx`
- **Owning Agent:** `ai-integration-engineer`
- **Risk Level:** Medium
- **Test Plan:** Run test with generated body containing a fake metric not in resume; verify it is correctly flagged in `auditNotes`.

---

### TICK-11: SMTP TLS Strict Certificate Verification with Explicit Self-Signed Toggle
- **Priority:** Medium
- **Problem:** `rejectUnauthorized: false` in `smtpService.js` makes SMTP TLS vulnerable to MITM attacks.
- **Proposed Direction:** Set `rejectUnauthorized: true` by default. Add optional profile property `allowSelfSignedCerts: Boolean` with clear UI labeling.
- **Affected Files:** `server/services/smtpService.js`, `client/src/components/SettingsModal.jsx`
- **Owning Agent:** `backend-engineer`
- **Risk Level:** Low
- **Test Plan:** Verify standard SMTP connections use `rejectUnauthorized: true`.

---

### TICK-12: Express API Rate Limiting & Localhost CORS Hardening
- **Priority:** Medium
- **Problem:** Unbounded public endpoints allow local scripts to abuse AI generation or flood SMTP accounts.
- **Proposed Direction:** Add route rate limiting to `/api/ai/*` and `/api/send/*` routes and restrict CORS to configured origin.
- **Affected Files:** `server/index.js`, `server/package.json`
- **Owning Agent:** `backend-engineer`
- **Risk Level:** Low
- **Test Plan:** Test sending >30 rapid requests to `/api/ai/generate`, verify 429 status response.

---

### TICK-13: Outreach Compliance Footer & Opt-Out Settings Configuration
- **Priority:** Medium
- **Problem:** Lack of an opt-out line or physical sender location creates CAN-SPAM / privacy compliance concerns.
- **Proposed Direction:** Add optional settings for sender location and opt-out line; if enabled, append standard compliant footnote to email HTML/text.
- **Affected Files:** `server/services/storageService.js`, `server/services/smtpService.js`, `client/src/components/SettingsModal.jsx`
- **Owning Agent:** `frontend-engineer` / `backend-engineer`
- **Risk Level:** Low
- **Test Plan:** Verify outgoing email body includes opt-out text when option is enabled in settings.

---

### TICK-14: Masking Function Hardening for Short API Keys
- **Priority:** Low
- **Problem:** `maskApiKey` reveals 6-7 characters on short 9-12 char keys.
- **Proposed Direction:** If key length is <= 16, mask entirely as `••••••••••••`.
- **Affected Files:** `server/utils/crypto.js`
- **Owning Agent:** `backend-engineer`
- **Risk Level:** Low
- **Test Plan:** Test `maskApiKey` with keys of lengths 8, 12, 16, 32, 64.

---

### TICK-15: Glassmorphic UI Accessibility Polish (Focus States & Contrast Auditing)
- **Priority:** Low
- **Problem:** Buttons and inputs lack consistent `:focus-visible` styling; contrast in light mode needs verification.
- **Proposed Direction:** Add uniform `:focus-visible` ring rules and verify WCAG AA contrast for text tokens in both light and dark themes.
- **Affected Files:** `client/src/index.css`
- **Owning Agent:** `frontend-engineer`
- **Risk Level:** Low
- **Test Plan:** Run `npm run lint` and verify focus styling in both themes.
