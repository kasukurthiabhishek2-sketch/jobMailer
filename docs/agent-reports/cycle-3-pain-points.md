# Pain-Point Audit: 14-Screen End-to-End Walkthrough (Cycle 3)

- **Date:** 2026-09-28
- **Ticket:** `TICK-CYC3-22`
- **Role:** Product Designer / UX Researcher & Principal Frontend Architect
- **Evaluated Personas:**
  1. **Persona A: First-Time User** (Seeking quick setup, easily confused by technical jargon or silent failures)
  2. **Persona B: Power Recruiter / Candidate** (Bulk dispatching 100+ contacts, demanding batch throughput, keyboard agility, and clear feedback)

---

## Screen-by-Screen Findings Grouped by Wizard Step

### Step 1: Candidate Profile & AI Studio

#### Screen 1: Resume Upload & Parsing View (`ResumeUpload.jsx`)
- **First-Time User Persona:**
  - *Finding:* Dropping a file shows extraction tags (Detected Name, Email, Skills), but no indication that the resume file on disk is ephemeral. Users worry their resume will be permanently uploaded to third-party cloud servers.
  - *Recommendation:* Add a small security pill: `🔒 Zero file retention — processed in memory and purged automatically`.
- **Power User Persona (100+ sends):**
  - *Finding:* No way to replace or delete an uploaded resume without a Danger Zone purge (TICK-CYC3-13). If a user has different resume versions for different roles, they have to reload or wipe everything.

#### Screen 2: AI Provider Configuration & Testing (`SettingsModal.jsx` / `AiProvidersTab.jsx`)
- **First-Time User Persona:**
  - *Finding:* The test connection button returns raw JSON errors if an invalid API key is entered (e.g. `Incorrect API key provided: sk-proj...`). It should display an actionable error: "Invalid API key — please check your key in the provider console".
- **Power User Persona:**
  - *Finding:* Switching between AI models (e.g. `gemini-1.5-flash` vs `gemini-1.5-pro`) doesn't show expected speed/cost tradeoffs. Adding a "Fastest" vs "High Quality" badge helps choose the right model for batch vs single drafts.

---

### Step 2: Target Role & Strategy

#### Screen 3: Job Description & Value Pitch Editor (`JobDescriptionInput.jsx`)
- **First-Time User Persona:**
  - *Finding:* Clicking "Direct Value Pitch" hides the textarea without warning that any previously entered JD text is still preserved or about to be lost (TICK-CYC3-15).
  - *Recommendation:* Prompt a confirmation banner: "Switching to Direct Value Pitch will generate intro emails without JD-specific tailoring. Keep or clear existing JD?"
- **Power User Persona:**
  - *Finding:* No character counter or token estimation. A recruiter pasting a 10-page job description might exceed token limits or increase generation latency unnecessarily.

---

### Step 3: Recipient Management

#### Screen 4: Recipient Spreadsheet Ingestion Modal (`RecipientModal.jsx`)
- **First-Time User Persona:**
  - *Finding:* The footer approval checkbox ("I have reviewed these contacts and authorize outreach") is below the fold on smaller laptop screens (1366x768), making the "Import Recipients" button appear broken/disabled without explanation (TICK-CYC3-17).
  - *Recommendation:* When the user hovers over or clicks the disabled "Import" button, highlight the approval checkbox with an amber pulse animation and tooltip: "Please check the authorization box to proceed".
- **Power User Persona:**
  - *Finding:* When uploading a sheet with 200 rows, duplicate entries and previously contacted emails (>0 days in `logs.json`) are automatically unchecked, but the banner only gives raw counts. Adding a filter toggle "Show Only Excluded / Duplicates" allows immediate review before importing.

#### Screen 5: Recipient Management Table (`RecipientManager.jsx`)
- **First-Time User Persona:**
  - *Finding:* Adding a manual contact opens a modal, but manual entries skip the 30-day cross-session deduplication against `logs.json` that spreadsheet uploads get (TICK-CYC3-16).
- **Power User Persona:**
  - *Finding:* No bulk actions other than "Select All". Users cannot "Select All Approved" or "Approve Filtered Search Results" after searching for a specific company (e.g. "Google").

---

### Step 4: AI Drafts & Personalization Studio

#### Screen 6: Tone & Batch Generation Toolbar (`EmailPreview.jsx`)
- **First-Time User Persona:**
  - *Finding:* Step-numbering toast references Step 2 instead of Step 3 (TICK-CYC3-04).
  - *Finding:* Clicking "Generate All" runs in sequence rather than parallel batch (TICK-CYC3-02), making 20 recipients feel sluggish.
- **Power User Persona:**
  - *Finding:* No concurrency control or quota indicator. If generating 100 drafts on a rate-limited key, HTTP 429 errors fail without backoff retry (TICK-CYC3-05).

#### Screen 7: Split-Pane Draft Review & Editor (`EmailPreview.jsx`)
- **First-Time User Persona:**
  - *Finding:* The spam trigger words highlighter flags common words like "free" or "instant" in red, which can induce panic. An explanatory tooltip ("Spam filter tip: Avoid urgent sales phrasing to maintain inbox deliverability") provides constructive guidance.
- **Power User Persona:**
  - *Finding:* Reviewing 50+ drafts requires endless mouse clicks. Lack of keyboard shortcuts (`J`/`K` navigation, `A` approve, `R` regenerate) slows down power users (TICK-CYC3-21).

#### Screen 8: Claim Grounding & Anti-Hallucination Guardrail (`EmailPreview.jsx`)
- **First-Time User Persona:**
  - *Finding:* Currently, `groundingAudit` is computed by the backend but completely invisible in the frontend (TICK-CYC3-03). Users have no visual confirmation that their resume facts are verified.
  - *Recommendation:* Display a prominent green `100% Fact-Checked` pill or amber `Ungrounded Claims Detected (2)` badge linking to specific unmatched phrases.
- **Power User Persona:**
  - *Finding:* If a claim is ungrounded because of a minor wording difference (e.g., "PostgreSQL" in draft vs "Postgres" in resume), the user needs a quick "Verify & Dismiss" button so it doesn't block campaign approval.

#### Screen 9: Pre-Send Human Gate & Final Review Modal (`EmailPreview.jsx`)
- **First-Time User Persona:**
  - *Finding:* Clear and reassuring. Confirms recipient count, SMTP sender address, and requires explicit confirmation.
- **Power User Persona:**
  - *Finding:* Does not display the estimated time to complete (e.g., "50 recipients at 3s delay = approx. 2.5 minutes"). Adding an estimated duration calculation sets clear expectations before launching.

---

### Step 5: Safe Dispatch Pipeline

#### Screen 10: Dispatch Progress & SSE Live Stream (`SendProgressModal.jsx`)
- **First-Time User Persona:**
  - *Finding:* The modal blocks the entire viewport and cannot be minimized or moved to the background (TICK-CYC3-19). Users are trapped watching the countdown timer for 5 minutes if sending 50 emails.
- **Power User Persona:**
  - *Finding:* If an authentication error occurs (e.g. `EAUTH` / invalid SMTP password), the dispatcher immediately aborts (correct!), but the progress modal doesn't immediately link to Settings -> SMTP to fix the password.

#### Screen 11: Active Send Step View (`SendStep.jsx`)
- **First-Time User Persona:**
  - *Finding:* Shows sender profile and recipient count clearly.
- **Power User Persona:**
  - *Finding:* If the user edits their SMTP profile in Settings while on Step 5, the screen does not update reactively until navigating away and back (TICK-CYC3-18).

---

### Settings & Administration Modals

#### Screen 12: SMTP Accounts Management (`SettingsModal.jsx` / `SmtpAccountsTab.jsx`)
- **First-Time User Persona:**
  - *Finding:* Setting up Gmail app passwords is confusing for users unfamiliar with Google 2-Step Verification.
  - *Remedy:* The existing `SmtpGuideModal.jsx` is helpful, but needs a direct link in the Gmail account setup form.
- **Power User Persona:**
  - *Finding:* No test email sending action inside the SMTP settings tab (only socket verification `testConnection`). A real message delivery test is desired (TICK-CYC3-21).

#### Screen 13: Delivery & Audit Logs (`SettingsModal.jsx` / `AuditLogsTab.jsx`)
- **First-Time User Persona:**
  - *Finding:* Logs show delivery events, but no easy way to clear individual campaign runs.
- **Power User Persona:**
  - *Finding:* Lacks export capabilities (CSV/JSON) for CRM import, and no search bar to filter by recipient email.

#### Screen 14: Danger Zone (`SettingsModal.jsx` / `DangerZoneTab.jsx`)
- **First-Time User Persona:**
  - *Finding:* High-friction confirmation modal prevents accidental data loss. Good.
- **Power User Persona:**
  - *Finding:* Lacks granular reset options — resetting wipes all AI keys, SMTP profiles, and logs simultaneously. A user who just wants to purge their cached resume has to wipe everything (TICK-CYC3-13).
