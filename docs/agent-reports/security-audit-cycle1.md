# Application Security Audit Report — Cycle 1

**Agent:** `security-auditor`  
**Date:** 2026-09-27  
**Scope:** Cryptography, credential storage, secret leakage vectors, Express API hardening, input validation, and dependency supply-chain risks.

---

## Executive Summary
A comprehensive security review of the backend services ([`crypto.js`](file:///Users/manu19/Desktop/JDMail/server/utils/crypto.js), [`storageService.js`](file:///Users/manu19/Desktop/JDMail/server/services/storageService.js), [`smtpService.js`](file:///Users/manu19/Desktop/JDMail/server/services/smtpService.js), [`copilotService.js`](file:///Users/manu19/Desktop/JDMail/server/services/copilotService.js), and [`index.js`](file:///Users/manu19/Desktop/JDMail/server/index.js)) and external dependencies was conducted.

The overall architectural intent—AES-256-GCM encryption with local hardware-bound keys and masked API responses—is well-founded. However, several critical and high severity vulnerabilities were identified that could lead to credential leakage, server memory corruption, unauthorized file accumulation, and SMTP MITM vulnerabilities.

---

## Detailed Audit Findings

### SEC-01: Runtime Bug & Undefined Symbol in Copilot AI Dispatch
- **Severity:** Critical
- **File & Line:** [`server/services/aiService.js:258`](file:///Users/manu19/Desktop/JDMail/server/services/aiService.js#L258)
- **Concrete Scenario:**
  In `aiService.js`, line 258 invokes:
  ```javascript
  case 'copilot':
    return await callCopilotChat({ ... });
  ```
  However, `callCopilotChat` is **not imported** or defined in `aiService.js` (line 5 only imports `const copilotService = require('./copilotService')`). When any user attempts to generate an email using GitHub Copilot, Node throws an unhandled `ReferenceError: callCopilotChat is not defined`, crashing or 500-erroring the generation request.
- **Recommended Fix:** Change call to `copilotService.callCopilotChat(...)` or import `{ callCopilotChat }` from `./copilotService`.

---

### SEC-02: Cryptographic Bypass & Plaintext Fallback in `decrypt()`
- **Severity:** High
- **File & Line:** [`server/utils/crypto.js:70-73`](file:///Users/manu19/Desktop/JDMail/server/utils/crypto.js#L70-L73)
- **Concrete Scenario:**
  ```javascript
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    // If not encrypted format, return as-is for backward compatibility or empty
    return cipherText;
  }
  ```
  If an unencrypted secret or a malformed string is written to `config.json`, `decrypt()` returns the raw value unchanged. More critically, if an attacker tampers with the ciphertext structure, the function fails open instead of failing closed, and could return raw stored data or partial chunks.
- **Recommended Fix:** Require explicit encryption. If `parts.length !== 3`, reject or return empty string unless an explicit migration mode flag is passed. Ensure fail-closed behavior.

---

### SEC-03: Incomplete Danger-Zone Data Purge Leaves PII Resumes on Disk & Stale Token Cache
- **Severity:** High
- **File & Line:** [`server/index.js:224-243`](file:///Users/manu19/Desktop/JDMail/server/index.js#L224-L243), [`server/services/copilotService.js:7-10`](file:///Users/manu19/Desktop/JDMail/server/services/copilotService.js#L7-L10)
- **Concrete Scenario:**
  The Danger Zone endpoint `/api/config/reset` clears provider keys in `config.json` and clears `logs.json`. However:
  1. It leaves all uploaded candidate resumes in [`server/uploads/`](file:///Users/manu19/Desktop/JDMail/server/uploads/) untouched. A user believing they purged their personal information will leave their resume containing personal phone, address, and email on the filesystem.
  2. The in-memory `tokenCache` in `copilotService.js` retains the active GitHub Copilot bearer session token until process exit.
- **Recommended Fix:**
  In `/api/config/reset`, synchronously purge all files in `server/uploads/`, call `copilotService.clearSessionCache()`, and ensure all in-memory credentials are wiped.

---

### SEC-04: SMTP TLS Certificate Verification Disabled (`rejectUnauthorized: false`)
- **Severity:** High
- **File & Line:** [`server/services/smtpService.js:27-30`](file:///Users/manu19/Desktop/JDMail/server/services/smtpService.js#L27-L30)
- **Concrete Scenario:**
  ```javascript
  if (profile.encryption === 'STARTTLS' || profile.encryption === 'TLS') {
    transportOptions.requireTLS = true;
    transportOptions.tls = {
      rejectUnauthorized: false // Helps avoid local certificate issues
    };
  }
  ```
  Setting `rejectUnauthorized: false` globally disables TLS certificate validation for all STARTTLS connections. On an untrusted network (e.g. coffee shop Wi-Fi or public co-working space), a local adversary can perform a machine-in-the-middle (MITM) attack, intercepting the SMTP STARTTLS negotiation and capturing plaintext email credentials and outbound candidate email contents.
- **Recommended Fix:**
  Default `rejectUnauthorized` to `true`. Add an explicit advanced setting `allowSelfSignedCerts: false` in the SMTP profile schema, so users only bypass validation if explicitly chosen with a security warning.

---

### SEC-05: Missing Rate Limiting on Public Express Routes
- **Severity:** Medium
- **File & Line:** [`server/index.js:38-41`](file:///Users/manu19/Desktop/JDMail/server/index.js#L38-L41)
- **Concrete Scenario:**
  Express has `app.use(cors())` with wildcard origin and no IP rate limiting (`express-rate-limit`). Any script running in the browser or on the local network can hammer `/api/ai/generate`, `/api/ai/batch-generate`, or `/api/send/stream`, exhausting the user's paid API keys (OpenAI, Gemini, Groq) or flooding their SMTP account.
- **Recommended Fix:**
  Apply `express-rate-limit` on `/api/ai/*` and `/api/send/*` routes (e.g., 20 requests per minute limit) and restrict CORS to `localhost:5174` (or Vite's active development port).

---

### SEC-06: High Severity Vulnerabilities in Direct Dependencies (`xlsx` & `nodemailer`)
- **Severity:** Medium
- **Evidence:** `npm audit` on `server` reported 2 high severity vulnerability advisories:
  1. `xlsx`: Prototype Pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9).
  2. `nodemailer <=9.1.0`: Command injection via `envelope.size` (GHSA-c7w3-x93f-qmm8) and addressparser DoS (GHSA-rcmh-qjqh-p98v).
- **Concrete Scenario:**
  A maliciously crafted `.xlsx` spreadsheet uploaded to `/api/upload/recipients` could trigger prototype pollution in Node's global object runtime.
- **Recommended Fix:**
  Update `nodemailer` to the latest secure version (v6.10+ or v10) and ensure `xlsx` parsing uses safe options or sanitize parsed sheet structures.

---

### SEC-07: Key Masking Discloses 66% of Short Keys
- **Severity:** Low
- **File & Line:** [`server/utils/crypto.js:98-100`](file:///Users/manu19/Desktop/JDMail/server/utils/crypto.js#L98-L100)
- **Concrete Scenario:**
  `maskApiKey(key)` extracts `prefix = key.slice(0, Math.min(6, Math.floor(len / 4)))` and `suffix = key.slice(-4)`. For a 9-to-12 character key or token, 6 to 7 characters are shown in plaintext.
- **Recommended Fix:**
  Enforce a minimum length threshold before showing suffixes: for keys under 16 chars, return `••••••••••••`.
