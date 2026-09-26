# Phase 1 Research & Audit Report: Cycle 2

- **Cycle:** 2
- **Lead Auditors:** brutal-critic, deliverability-lead, backend-dev, frontend-dev
- **Date:** 2026-09-27
- **Target:** Elevate JDMail from 9.10/10 to a flawless 10.0/10 rating

---

## 1. Audit of Remaining Gaps & Opportunities

Following Cycle 1's integration and rating of 9.10/10, an adversarial audit across all 8 rubric dimensions identified the following specific opportunities for perfection:

### 1.1 Deliverability & Provider Quota Protection (Currently 8.8 / 10)
- **Problem:** Email service providers impose strict rolling 24-hour limits on standard SMTP accounts (e.g. Gmail: 500 emails/day; Outlook: 300 emails/day). Exceeding these limits leads to immediate account suspension or 24-hour mailbox lockouts.
- **Current State:** JDMail tracks individual emails in `logs.json`, but does not calculate rolling 24h totals or warn the user before they initiate a batch campaign that exceeds remaining capacity.
- **Opportunity:** Add `getDailySendingStats(smtpAccountId)` in `storageService.js` that counts successful dispatches in the last 24 hours. Display a live daily quota progress pill in the UI with a warning when staging more emails than quota allows.

### 1.2 AI Provider Rate-Limit Resilience (Currently 9.0 / 10)
- **Problem:** During concurrent batch generation (4 workers), users on free-tier or Tier-1 API accounts (e.g., OpenAI TPM/RPM limits, Groq free tier) occasionally hit HTTP 429 "rate limit exceeded".
- **Current State:** When an HTTP 429 occurs, `aiService.js` currently throws an error immediately, marking that single recipient as failed in the batch.
- **Opportunity:** Implement automatic exponential backoff retry with jitter on HTTP 429 / rate-limit responses in `callOpenAiCompatible()`, `callGemini()`, etc. (retry up to 3 times with delays of 2s, 4s, 8s).

### 1.3 Configurable Batch Concurrency (Currently 9.2 / 10)
- **Problem:** Concurrency in `server/index.js` is hardcoded to `const CONCURRENCY = 4;`. Users on ultra-fast enterprise tiers want higher concurrency (e.g. 6-8), while users on strict rate-limited keys need lower concurrency (e.g. 1-2).
- **Current State:** No configuration option in UI or settings.
- **Opportunity:** Add `batchConcurrency: 1..8` (default 4) to `sendingPreferences`. Expose a slider in the Settings Modal Preferences tab.

### 1.4 Active Resume Attachment Deletion & Storage Lifecycle (Currently 9.2 / 10)
- **Problem:** When a user uploads a resume, it is stored in `server/uploads/` indefinitely until a complete factory reset (`/api/config/reset`). If a candidate wants to remove their resume or upload an updated version, the old file lingers on disk.
- **Current State:** No dedicated endpoint to delete or replace the active resume file.
- **Opportunity:** Add `DELETE /api/upload/resume` endpoint to purge the active resume file and clear `resumeData` from disk, and add a "Remove Resume" action button in `ResumeUpload.jsx`.

### 1.5 Client Code Cleanliness & React Optimization (Currently 9.4 / 10)
- **Problem:** Oxlint reports 12 warnings across `RecipientModal.jsx`, `SettingsModal.jsx`, `SendProgressModal.jsx`, and `SmtpGuideModal.jsx` due to unused imports and React Compiler warnings (`calling setState synchronously within an effect`).
- **Opportunity:** Refactor state synchronization in `RecipientModal.jsx` and `SettingsModal.jsx` to eliminate cascading renders, and remove all unused Lucide icon imports, achieving a clean 0-warning, 0-error lint report.

---

## 2. Cycle 2 Ticket Backlog Proposals

1. **`TICK-CYC2-01`**: Daily Provider Quota Budget Tracker & Warning System
2. **`TICK-CYC2-02`**: AI Provider HTTP 429 Exponential Backoff Retries
3. **`TICK-CYC2-03`**: User-Configurable Batch Concurrency Slider
4. **`TICK-CYC2-04`**: Resume File Deletion Endpoint & UI Action
5. **`TICK-CYC2-05`**: React Compiler Warning Elimination & Zero-Lint-Warning Cleanup
