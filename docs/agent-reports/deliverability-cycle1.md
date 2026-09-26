# Cold-Email Deliverability & Outreach Compliance Report — Cycle 1

**Agent:** `deliverability-specialist`  
**Date:** 2026-09-27  
**Scope:** SMTP transmission mechanics, rate-limiting jitter, ESP spam filter triggers, retry/backoff dynamics, deduplication across sessions, and regulatory compliance considerations.

---

## Executive Summary
Cold email deliverability is governed by mailbox provider reputation algorithms (Google, Microsoft 365, Yahoo). Sending patterns that exhibit robotic periodicity, unhandled burst rates, high bounce rates, or un-throttled retries quickly trigger sender reputation degradation, routing emails to spam or causing mailbox suspensions.

An audit of [`smtpService.js`](file:///Users/manu19/Desktop/JDMail/server/services/smtpService.js) and the SSE streaming loop in [`server/index.js`](file:///Users/manu19/Desktop/JDMail/server/index.js#L411-L556) reveals several deliverability vulnerabilities.

---

## Prioritized Deliverability Findings

### DEL-01: Zero Retry / Backoff for Transient SMTP Failures vs Permanent Bounces
- **Priority:** Critical
- **Why this matters:** Mail servers frequently return temporary error codes (`421 4.7.0 Try again later`, `452 4.5.3 Rate limit exceeded`, or transient network resets `ETIMEDOUT`, `ECONNRESET`). Immediately failing the email wastes recruiter leads and leaves campaigns half-sent. Conversely, retrying permanent bounces (`550 User unknown`) harms IP reputation.
- **Evidence in JDMail Code:**
  In [`server/index.js:510-533`](file:///Users/manu19/Desktop/JDMail/server/index.js#L510-L533):
  ```javascript
  } catch (err) {
    console.error(`Failed sending to ${item.email}:`, err);
    logItem.status = 'failed';
    logItem.error = err.message || 'SMTP delivery failure';
    campaignLogs.push(logItem);
  }
  ```
  There is zero distinction between transient network/server hiccups (which should be retried 1–2 times after a brief backoff) and fatal authentication/recipient errors (`550`, `551`, `EAUTH`).
- **Suggested Direction:**
  Implement error classification in `smtpService.js`:
  - **Transient Errors (`ETIMEDOUT`, `ECONNRESET`, `421`, `451`, `452`):** Automatic single retry with exponential backoff (e.g. 5s then retry). If persistent, pause campaign to preserve quota.
  - **Permanent Errors (`550`, `553`, `554`, `EAUTH`):** Fail immediately; if `EAUTH` or provider rate limit hit, abort remaining queue to prevent account lockout.

---

### DEL-02: Predictable Robotic Delay Lacks Jitter & Provider Quota Awareness
- **Priority:** High
- **Why this matters:** Modern ESP spam detection algorithms (Spamhaus, Google Postmaster) analyze timing patterns. Sending emails with exact identical intervals (e.g. exactly 3.000 seconds apart) is a known bot fingerprint that triggers spam filtering. Furthermore, sending 200 emails in 10 minutes from a personal Gmail account will hit Google's rolling burst filter.
- **Evidence in JDMail Code:**
  [`server/index.js:536-542`](file:///Users/manu19/Desktop/JDMail/server/index.js#L536-L542):
  ```javascript
  if (i < recipients.length - 1 && delaySeconds > 0) {
    sendEvent('throttling', { waitingSeconds: delaySeconds, nextIndex: currentIndex + 1 });
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
  }
  ```
  The wait is perfectly static (`delaySeconds * 1000`).
- **Suggested Direction:**
  Introduce randomized jitter to the delay: `actualDelay = delaySeconds + (Math.random() * 2 - 1) * jitterFactor` (e.g., 3s base becomes a natural 2.8s – 5.2s variation).
  Add safety warnings when the total approved queue exceeds safe single-session volumes (e.g., >50 for personal Gmail).

---

### DEL-03: No Cross-Session Recipient Deduplication (Audit Log Blindness)
- **Priority:** High
- **Why this matters:** Re-contacting a recruiter who was already emailed 3 days ago from another spreadsheet is the #1 reason recipients hit "Report Spam", causing immediate domain reputation damage.
- **Evidence in JDMail Code:**
  Deduplication is strictly scoped to the single active spreadsheet upload ([`sheetParser.js:571`](file:///Users/manu19/Desktop/JDMail/server/services/sheetParser.js#L571)). The server already records all successful and failed sends in [`logs.json`](file:///Users/manu19/Desktop/JDMail/server/data/logs.json), but neither the parser nor the UI checks against `logs.json`.
- **Suggested Direction:**
  Add a helper `storage.hasRecentlyContacted(email, days = 30)`. When loading sheets or viewing recipients, display a "Recently Contacted" badge and automatically uncheck them from default selection.

---

### DEL-04: Outreach Compliance & Opt-Out Notice Flag
- **Priority:** Medium
- **Why this matters:** Sending unsolicited emails to corporate contacts touches privacy frameworks (CAN-SPAM in the US, GDPR in the EU/UK, CASL in Canada). Under CAN-SPAM, B2B cold emails are generally permissible provided the sender is truthful, provides a valid physical address, and honors opt-out requests.
- **Legal Disclaimer:** *This analysis is a technical flag for informational purposes. Users must consult with qualified legal counsel regarding their specific outreach jurisdiction.*
- **Evidence in JDMail Code:**
  Currently, emails have no footer or opt-out mechanism ([`aiService.js:56`](file:///Users/manu19/Desktop/JDMail/server/services/aiService.js#L56)).
- **Suggested Direction:**
  Add an optional "Outreach Compliance Footer" setting in Settings:
  - Checkbox: "Include polite opt-out footnote (e.g., 'If you prefer not to receive future notes, please reply with unsubscribe.')"
  - Field: "Physical Mailing Address or Location (required for CAN-SPAM compliance)".
