# JDMail Product & Engineering Backlog

**Current Cycle:** Cycle 1  
**Status:** Awaiting Human Checkpoint Approval (Phase 2 -> Phase 3 Gate)  
**Synthesized from:**
- `docs/agent-reports/phase1-pain-points-cycle1.md`
- `docs/agent-reports/security-audit-cycle1.md`
- `docs/agent-reports/deliverability-cycle1.md`
- `docs/agent-reports/perf-audit-cycle1.md`

---

## Prioritized Ticket Inventory

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
