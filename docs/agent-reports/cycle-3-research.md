# Research Report: Feature & Efficiency Proposals (Cycle 3)

- **Date:** 2026-09-28
- **Ticket:** `TICK-CYC3-21`
- **Role:** AI & Integration Engineer / Deliverability Specialist / Product Designer
- **Status:** Complete — Awaiting Human Review & Sign-Off (Track 2: No code modified)

---

## Executive Summary

This research evaluation analyzes high-leverage features, algorithmic efficiencies, and deliverability safeguards for JDMail Cycle 3 and beyond. Every proposal has been vetted against the non-negotiable invariants defined in Section 3 (zero SDK bloat, AES-256-GCM encryption at rest, two-stage human send gate, zero file retention, and RFC validation).

---

## Ranked Proposal Inventory

| Rank | Feature Proposal | Effort | Impact | Risk to Invariants | Recommended Next Step |
|---|---|---|---|---|---|
| **1** | **Draft Diffing & Selective Regeneration Caching** | Low (3 hrs) | High (75% faster iterative edits) | None (In-memory state only) | Approve for Cycle 3 Track 1 extension |
| **2** | **"Send Test Copy to Myself" Verification Step** | Low (2 hrs) | High (Critical deliverability trust) | None (Uses active SMTP profile, 1 recipient) | Approve for Cycle 3 Track 1 extension |
| **3** | **Spam-Scanner & Quality-Meter Keystroke Debounce** | Very Low (1 hr) | Medium (CPU/Render optimization) | None (Pure UI performance) | Approve for Phase 4 UI polish |
| **4** | **Keyboard Navigation in Review Pager** | Low (2 hrs) | High (Reviewer throughput +300%) | None (Accessible hotkeys) | Approve for Phase 4 UI polish |
| **5** | **Draft In-Progress Autosave & Tab Crash Recovery** | Medium (3 hrs) | High (Prevents data loss) | None (Session/IndexedDB with zero secrets) | Approve for post-Cycle 3 |
| **6** | **CSV / JSON Export for Audit Logs (`logs.json`)** | Low (1.5 hrs) | Medium (Portability & compliance) | None (Read-only download) | Approve for Phase 4 UI polish |
| **7** | **Virtual Windowing for Large Recipient Tables** | Medium (4 hrs) | High (Handles 1,000+ contacts) | None (Pure DOM virtualization) | Evaluate if lists exceed 500 rows |

---

## Detailed Architectural Evaluations

### 1. Draft Diffing & Selective Regeneration Caching
- **The Problem:** Currently, clicking "Regenerate All" wipes all generated drafts across all recipients, even those the user already reviewed, manually edited, or approved. If a user has 40 recipients and only changes the job description slightly, 40 AI API requests are re-issued, incurring unnecessary API costs and obliterating manual user edits.
- **Proposed Architecture:**
  - Compute a deterministic hash (`hash(resumeText + jobDescription + recipient.id + tone)`) for each draft.
  - If a recipient's draft was already generated and the user triggers batch generation, only generate for recipients whose hash changed or who do not have an existing draft.
  - If the user manually edited a draft, preserve an `isManuallyEdited: true` flag that protects it from batch overwrite unless explicitly forced.
- **Effort:** ~3 hours.
- **Impact:** Reduces redundant LLM API consumption by up to 80% during iterative prompt/JD refinement.
- **Invariants Check:** Zero retention impact; hashes and drafts reside only in client memory.

### 2. "Send Test Copy to Myself" Verification Gate
- **The Problem:** Cold emailers risk formatting errors, broken template variables (e.g. `{{company}}`), and spam filter landing if they cannot preview how their message renders in an actual desktop and mobile email client (Gmail, Outlook, Apple Mail).
- **Proposed Architecture:**
  - In Step 5 (`SendStep.jsx`), add a prominent "Send Test Copy to Me" button.
  - Generates a single dispatch containing the first approved recipient's personalized draft, but overrides the destination address to `activeSmtp.fromEmail` with a subject prefix `[TEST] `.
  - Dispatches via existing `/api/send/stream` or a dedicated test route without marking the actual recruiter recipient as "Sent" in `logs.json`.
- **Effort:** ~2 hours.
- **Impact:** Substantially eliminates sending embarrassing template errors to real recruiters.
- **Invariants Check:** Complies with SMTP pacing and does not bypass the two-stage approval gate for real recipients.

### 3. Real-Time Spam-Scanner & Quality-Meter Keystroke Debounce
- **The Problem:** In `EmailPreview.jsx`, the spam trigger word matching and quality score calculation run synchronously on every keystroke in both the subject and body `textarea`. For large bodies (400+ words), this creates minor input lag on low-power laptops.
- **Proposed Architecture:**
  - Wrap `calculateSpamScore` and `detectTriggerWords` in a 250ms `useDebounce` hook or `useDeferredValue`.
  - Input remains completely instantaneous (60fps) while metrics update smoothly in the background.
- **Effort:** ~1 hour.
- **Impact:** Eliminates typing latency and unnecessary re-renders in the draft editor.
- **Invariants Check:** Zero invariant impact.

### 4. Keyboard Shortcuts in the Review Pager
- **The Problem:** Reviewing 50 to 100 drafts requires clicking "Next", "Approve", "Regenerate" hundreds of times with a mouse, leading to significant user fatigue.
- **Proposed Architecture:**
  - Scope keyboard listeners when the editor is not actively focused in a textarea:
    - `J` or `ArrowRight`: Next recipient draft
    - `K` or `ArrowLeft`: Previous recipient draft
    - `A` or `Space`: Toggle approval on current recipient
    - `R`: Regenerate current draft
    - `E`: Focus editor textarea
    - `Esc`: Unfocus editor / Close modal
- **Effort:** ~2 hours.
- **Impact:** Increases review velocity by 3x–4x for recruiters and candidates.
- **Invariants Check:** Zero risk; keyboard interactions map 1:1 to existing button handlers.

### 5. In-Progress Draft Autosave & Recovery
- **The Problem:** If a browser tab crashes or is accidentally refreshed while editing drafts in Step 4, all uncommitted changes and generated drafts are lost, requiring re-running AI generation.
- **Proposed Architecture:**
  - Autosave drafts to `sessionStorage` (keyed by session/job hash).
  - Store strictly ephemeral draft text and recipient IDs — **never** store API keys, SMTP passwords, or unparsed resume binaries.
  - On page load, if a matching session draft cache is detected, offer a "Restore in-progress draft edits?" prompt.
- **Effort:** ~3 hours.
- **Impact:** Prevents catastrophic data loss during long review sessions.
- **Invariants Check:** No credentials stored; only public draft text and recipient metadata in sessionStorage.

### 6. CSV / JSON Export for Outreach Logs (`logs.json`)
- **The Problem:** Users who send outreach campaigns want to track outcomes in Google Sheets, Airtable, or their CRM, but currently have no way to export their dispatch history other than inspecting the raw UI table.
- **Proposed Architecture:**
  - Add an "Export CSV" action in `AuditLogsTab.jsx`.
  - Formats timestamp, recipient email, recipient name, company, subject, delivery status, and error message into a downloadable CSV blob directly in the client.
- **Effort:** ~1.5 hours.
- **Impact:** High utility for tracking outreach responses and follow-ups.
- **Invariants Check:** Export contains only log data; zero secrets or tokens.

### 7. Virtual Windowing for Large Recipient Lists
- **The Problem:** The current recipient table uses pagination (50, 100, 250 rows). While windowed pagination solved the initial DOM freeze, users with 1,000+ contacts cannot do continuous scrolling.
- **Proposed Architecture:**
  - Implement a lightweight virtual list (`@tanstack/react-virtual` or zero-dependency CSS-containment row windowing) rendering only visible rows (+/- 5 row buffer).
- **Effort:** ~4 hours.
- **Impact:** Seamless 60fps scrolling for spreadsheets with 2,000+ rows.
- **Invariants Check:** Requires adding a dependency or implementing custom virtualization. Recommend keeping windowed pagination for Cycle 3 unless 1,000+ row use cases become common.
