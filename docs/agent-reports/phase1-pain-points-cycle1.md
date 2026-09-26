# Phase 1 UX & Product Research Report — Cycle 1

**Agent:** `research-pain-points`  
**Date:** 2026-09-27  
**Scope:** Cold outreach, recruiter workflow, resume ingestion, spreadsheet parsing UX, AI draft trust, and deliverability perception.

---

## Executive Summary
This report analyzes real-world user friction points in cold-outreach and job application tools (e.g., Hunter, Lemlist, Teal, Huntr, LazyApply) and cross-references them against JDMail's current codebase (`ARCHITECTURE.md`, `README.md`, React client components, and Express routes). 

Users of automated outreach tools experience five major classes of friction:
1. **Hallucination Anxiety:** Fear that the LLM will claim skills or experience the applicant does not possess, leading to career embarrassment or disqualification.
2. **Blast / Spamming Traps:** Accidental re-contacting of the same recruiter across separate batches, or rapid sending that burns sender email domains.
3. **Black-box Failures:** Unclear error messages during SMTP connection or generation failures with no actionable remediation.
4. **Sheet Import Friction:** Large spreadsheets locking up the browser or silently dropping valid contacts due to rigid schemas.
5. **Data Lingering Anxiety:** Unclear data lifecycle regarding where uploaded resumes and API keys reside.

---

## Prioritized Findings

### Finding PP-01: No AI Hallucination Guardrail or Verifiable Resume-Fact Verification
- **Priority:** Critical
- **Why this matters to a job seeker:** An applicant will get immediately blacklisted by an engineering team or executive recruiter if an AI-drafted email invents credentials (e.g. claiming 5 years of Kubernetes or leading a team of 30) not in their resume.
- **Affected User Flow:** Step 4 (AI Email Generation Studio) & Step 5 (Review and Approval).
- **Evidence in JDMail Code:** 
  In [`aiService.js`](file:///Users/manu19/Desktop/JDMail/server/services/aiService.js#L37-L79), `buildPrompts()` passes `resumeText.slice(0, 4500)` into the prompt and relies entirely on prompt instructions (`"Draw 2-3 compelling, quantifiable achievements... from the Candidate Resume"`). There is zero post-generation verification. If the LLM invents a metric (e.g., "$15M ARR", "10 years Rust"), the system marks it as successful and queues it for dispatch without warning the user.
- **Suggested Direction:** Introduce a deterministic fact-checking or heuristic audit step in `aiService.js` that compares key entities/numbers extracted from the draft against `resumeText`. In the UI (`EmailPreview.jsx`), provide an "AI Confidence / Grounding Badge" flagging ungrounded claims for user review.

---

### Finding PP-02: Lack of Cross-Campaign / Cross-Session Duplicate Recipient Warning
- **Priority:** High
- **Why this matters to a job seeker:** Sending duplicate cold pitches to the same recruiter from different spreadsheets or separate sessions makes the applicant look disorganized and spammish.
- **Affected User Flow:** Step 2 (Recipient Ingestion & Spreadsheet Modal).
- **Evidence in JDMail Code:**
  [`sheetParser.js`](file:///Users/manu19/Desktop/JDMail/server/services/sheetParser.js#L571-L575) only tracks duplicates within the currently parsed file (`seenEmails.has(cleanEmail)`). In [`RecipientManager.jsx`](file:///Users/manu19/Desktop/JDMail/client/src/components/RecipientManager.jsx#L178), contacts are deduplicated only against the active session's `recipients` array. Recruiter emails logged in [`logs.json`](file:///Users/manu19/Desktop/JDMail/server/data/logs.json) from previous dispatches are completely ignored.
- **Suggested Direction:** When importing a sheet or adding a contact, cross-reference against `getCampaignLogs()` (or an endpoint `/api/recipients/check-history`). Flag previously contacted leads with a "Previously Contacted on [Date]" warning tag so the user can choose whether to skip or re-engage.

---

### Finding PP-03: Browser Freeze on Large Spreadsheet Imports (Unbounded Table Rendering)
- **Priority:** High
- **Why this matters to a job seeker:** Recruiter databases downloaded from LinkedIn, GitHub, or public lead sheets often contain 1,000–5,000 rows. A browser tab freezing causes immediate abandonment.
- **Affected User Flow:** Step 2 (Spreadsheet Ingestion Modal).
- **Evidence in JDMail Code:**
  [`RecipientModal.jsx`](file:///Users/manu19/Desktop/JDMail/client/src/components/RecipientModal.jsx#L535-L620) maps `filteredRows.map(...)` directly into DOM table rows. Unlike `RecipientManager.jsx` (which has pagination), `RecipientModal.jsx` renders all rows simultaneously with interactive checkboxes, inputs, and icons. A 3,000-row sheet spawns >25,000 DOM elements, freezing React 19.
- **Suggested Direction:** Add virtual scrolling (or clean pagination with configurable page size: 50 / 100 / 250 rows) to `RecipientModal.jsx`.

---

### Finding PP-04: Fixed Throttling Lacks Provider-Specific Guidance and Daily Quotas
- **Priority:** High
- **Why this matters to a job seeker:** Getting a personal Gmail or Google Workspace account banned or flagged by spam filters halts job hunting across all channels.
- **Affected User Flow:** Step 5 (Send Pipeline & Settings).
- **Evidence in JDMail Code:**
  [`server/index.js`](file:///Users/manu19/Desktop/JDMail/server/index.js#L536-L542) applies a flat `delaySeconds` (1s–10s, default 3s) without random jitter. A batch of 300 emails with 3s delay will trigger automated spam rate-limit defenses on Gmail. There is no daily counter tracking how many emails were sent today against known provider caps (Gmail personal: 500/day; Workspace: 2,000/day; Yahoo: 500/day).
- **Suggested Direction:** 
  1. Add configurable randomized jitter to delays (e.g. 3s–8s random delay instead of robotic fixed intervals).
  2. Display a "Daily Send Counter" in the UI based on `logs.json` timestamps, warning users when they exceed 100–150 emails/day on free providers.

---

### Finding PP-05: Orphaned Files and Data Retention in "Danger Zone"
- **Priority:** Medium
- **Why this matters to a job seeker:** Resumes contain phone numbers, home addresses, and private work histories. When a user clicks "Reset All Data", they expect privacy parity.
- **Affected User Flow:** Settings -> Danger Zone -> Purge Data.
- **Evidence in JDMail Code:**
  [`server/index.js`](file:///Users/manu19/Desktop/JDMail/server/index.js#L224-L243) clears keys and logs, but leaves the physical files in [`server/uploads/`](file:///Users/manu19/Desktop/JDMail/server/uploads/) intact.
- **Suggested Direction:** Expand `/api/config/reset` to purge `server/uploads/` files and in-memory caches.

---

### Finding PP-06: Missing Unsubscribe / Communication Compliance Notice
- **Priority:** Medium
- **Why this matters to a job seeker:** Cold outreach to corporate recruiters is generally B2B, but compliance with CAN-SPAM, GDPR, and CASL requires a clear physical mailing address or opt-out mechanism to avoid spam reporting.
- **Affected User Flow:** Step 3/4 (Email Template Drafting & Dispatch).
- **Evidence in JDMail Code:**
  Emails generated in [`aiService.js`](file:///Users/manu19/Desktop/JDMail/server/services/aiService.js#L56) end with a standard signature. No optional one-click opt-out line (e.g., "If you'd prefer I not follow up, please reply with 'unsubscribe'") is offered or configured.
- **Suggested Direction:** Add an optional checkbox in Settings: "Include polite opt-out footnote in cold emails".
