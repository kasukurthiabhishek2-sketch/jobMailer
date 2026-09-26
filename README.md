# JDMail — AI-Powered Cold Outreach Suite for Job Applications

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Encryption](https://img.shields.io/badge/Security-AES--256--GCM-blueviolet)](#security--encryption-at-rest)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **JDMail** is a secure, high-converting cold email outreach platform for job seekers. It pairs candidate resumes with job descriptions, generates tailored cold emails across multiple AI providers (Google Gemini, OpenAI, Groq, Grok/xAI, NVIDIA NIM, GitHub Copilot, and Custom endpoints), and safely dispatches them through the user's verified SMTP accounts with real-time SSE delivery tracking and anti-spam rate limiting.

---

> 📖 **Looking for internal systems architecture, Mermaid flowcharts, data schemas, and agent onboarding?**  
> Check out the complete technical specification in [ARCHITECTURE.md](file:///Users/manu19/Desktop/JDMail/ARCHITECTURE.md).

---

## Table of Contents
1. [Key Features](#key-features)
2. [High-Level Architecture](#high-level-architecture)
3. [End-to-End 5-Step Workflow](#end-to-end-5-step-workflow)
4. [Getting Started & Installation](#getting-started--installation)
5. [Configuration & Environment](#configuration--environment)
6. [Supported AI Providers](#supported-ai-providers)
7. [SMTP Accounts & App Passwords](#smtp-accounts--app-passwords)
8. [Security & Encryption at Rest](#security--encryption-at-rest)
9. [API Reference](#api-reference)
10. [Repository Structure](#repository-structure)
11. [Testing & Quality Assurance](#testing--quality-assurance)
12. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Key Features

### 1. Resume Parsing & Heuristic Extraction
- **Supported Formats:** Upload resumes in **PDF** (`.pdf`), **Word** (`.docx`), or plain text (`.txt`) format (up to 5MB file limit).
- **Text Extraction:** Uses `pdf-parse` and `mammoth` for clean, formatting-preserving extraction.
- **Automated Heuristic Detection:** Extracts candidate Name, Email, Phone number, and Word Count from the document header.
- **Demo Mode:** One-click "Load Sample Resume" toggle for instant testing without uploading files.
- **Automatic Attachment:** Candidate's original resume file is attached to outbound emails upon dispatch.

### 2. Recipient Ingestion & Robust Spreadsheet Parsing
- **Multi-Format Ingestion:** Add recruiters manually or import batch spreadsheets (`.xlsx`, `.xls`, `.csv`).
- **Multi-Sheet Detection:** Identifies HR/recruitment sheets across complex multi-sheet workbooks.
- **Intelligent Header Scoring:** Automatically skips banner rows, logos, or empty notes on rows 0–3, scoring columns with priority weighting.
- **Priority Mapping Hierarchy:**
  - **Name:** `'hr name'` > `'recruiter name'` > `'hiring manager'` > `'contact name'` > `'full name'` > compound `first name` + `last name`.
  - **Email:** `'hr email'` > `'recruiter email'` > `'contact email'` > `'email'` > `'mail'`.
  - **Company:** `'company name'` > `'company'` > `'firm'` > `'organization'`.
  - **Role:** `'job role'` > `'role'` > `'designation'` > `'position'` > `'title'`.
- **Messy Cell Extraction:** Extracts emails from embedded text strings (e.g. `"Jessica Doe <jessica@openai.com>"` or `"HR Team - hr@domain.in"`).
- **RFC Email Validation & Typo Detection:** Validates email syntax, domain structures, and non-.com TLDs (`.in`, `.co.in`, `.ai`, `.io`, `.org`, `.edu`, etc.). Automatically flags typos like `@gamil.com`, `@yaho.com`, `@outlok.com`.
- **Interactive Recipient Modal:** Preview parsed data with column mapping dropdowns, validation badges, "Select All", and **Shift-Click range selection**.
- **Human-in-the-Loop Safety Gate:** Outbound dispatches strictly require explicit recipient approval (`isApproved: true`).

### 3. Multi-Provider AI Generation Studio
- **Native Fetch Architecture:** Zero external AI SDK overhead. Communicates directly with model providers via Node.js native `fetch()`.
- **Pluggable AI Providers:**
  - **Google Gemini** (`gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash-exp`)
  - **ChatGPT / OpenAI** (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`)
  - **Groq (LPU Inference)** (`qwen/qwen3.8-27b`, `openai/gpt-oss-20b`, `openai/gpt-oss-120b`)
  - **Grok (xAI)** (`grok-2-1212`, `grok-beta`)
  - **NVIDIA NIM** (`meta/llama-3.1-70b-instruct`, `mistralai/mixtral-8x22b-instruct-v0.1`)
  - **GitHub Copilot** (Free for subscribers via OAuth 2.0 Device Authorization Flow RFC 8628)
  - **Custom OpenAI-Compatible** (Configurable base URL & model, e.g. Ollama, vLLM, LM Studio)
- **Live Connection Testing:** "Test Connection" button per provider to validate keys before running campaigns.
- **Smart Key Mismatch Warnings:** Detects misplaced API keys (e.g. `gsk_` Groq keys entered in Grok) and guides the user to the correct provider.
- **Tailored Prompting:**
  - *With Job Description:* Extracts candidate metrics and directly aligns technical depth to JD requirements.
  - *Without Job Description:* Crafts an executive elevator pitch highlighting core strengths and domain impact.
- **Tone Profiles:** Choose between *Professional*, *Direct & Punchy*, *Conversational*, *Technical Depth*, and *Executive*.
- **Interactive Email Pager & Editor:** Cycle through recipient drafts, search, inline-edit subject lines and body text, and toggle approvals.

### 4. SMTP Configuration & In-App Setup Guides
- **Multi-Account Support:** Configure multiple sender accounts with custom From Name and From Email.
- **Encryption Modes:** Supports **SSL** (Port 465), **TLS / STARTTLS** (Port 587), and custom ports.
- **Connection Verification:** One-click verification via `nodemailer.verify()` with descriptive error diagnostics (`EAUTH`, `ESOCKET`, `ETIMEDOUT`).
- **In-App Guided Setup:** Step-by-step instructions and direct links for generating App Passwords:
  - Google Gmail / Google Workspace (2-Step Verification App Passwords)
  - Microsoft Outlook / Office 365
  - Yahoo Mail
  - Zoho Mail

### 5. Safe Sending & Real-Time Delivery Tracking
- **Server-Sent Events (SSE):** Real-time HTTP streaming progress (*"Sending 3 of 15..."*) without polling.
- **Anti-Spam Throttling:** Configurable delay (1s–10s, default 3s) between consecutive emails to protect sender domain reputation and prevent spam blacklisting.
- **Live Progress Modal:** Displays real-time sending states, countdown timers, and server response codes.
- **Persistent Audit Logging:** Every dispatch is recorded in `server/data/logs.json` with timestamps, message IDs, SMTP account used, and failure reasons. Search, export, or clear logs at any time.

### 6. Security & Encryption at Rest
- **AES-256-GCM Authenticated Encryption:** All API keys, tokens, and SMTP passwords are encrypted at rest using a 256-bit master key (`server/data/.secret_key`) or `ENCRYPTION_MASTER_KEY` environment variable.
- **Zero Client Leakage:** API endpoints only return masked strings (`sk-...1234`, `••••••••••••`). Unencrypted credentials exist in memory only during active dispatches.
- **One-Click Danger Zone:** Securely purge all stored credentials, SMTP profiles, and logs with a single click.

---

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        JDMail Web Architecture                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   CLIENT (Port 5174)                                                   │
│   React 19 + Vite 8 + Lucide Icons + Pure CSS Design System            │
│   ├── Step Progression Controller & Root State (App.jsx)               │
│   ├── Inputs: ResumeUpload, RecipientManager, JobDescriptionInput      │
│   ├── Studio: EmailPreview (Draft Pager, Inline Editor, Approval Gate) │
│   ├── Streaming: SendProgressModal (SSE Consumer & Throttling Timer)   │
│   └── Config: SettingsModal (AI, SMTP, Preferences, Logs, Reset)       │
│                                │                                       │
│                                ▼ Vite Proxy (/api/*)                   │
│                                                                        │
│   SERVER (Port 5001)                                                   │
│   Node.js 18+ Express 4 Backend                                        │
│   ├── API Routes (index.js): Auth, Ingestion, Generation, SSE Stream   │
│   ├── AI Engine (aiService.js): Native Fetch callers for 7 providers   │
│   ├── Copilot Engine (copilotService.js): RFC 8628 Device Flow OAuth   │
│   ├── Ingestion (sheetParser.js): Multi-sheet, Header Scoring, RFC     │
│   ├── Resume Engine (resumeParser.js): PDF & DOCX text extraction      │
│   ├── Dispatcher (smtpService.js): Nodemailer with TLS & Throttling    │
│   └── Storage & Security (storageService.js, crypto.js): AES-256-GCM   │
│                                │                                       │
│                ┌───────────────┴───────────────┐                       │
│                ▼                               ▼                       │
│   External AI & Mail Providers     Local Encrypted Storage             │
│   • Gemini, OpenAI, Groq, Grok     • server/data/config.json           │
│   • GitHub Copilot API             • server/data/.secret_key           │
│   • SMTP Sockets (TLS / SSL)       • server/data/logs.json             │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

> For exhaustive architectural diagrams, sequence flows, and subsystem deep dives, see [ARCHITECTURE.md](file:///Users/manu19/Desktop/JDMail/ARCHITECTURE.md).

---

## End-to-End 5-Step Workflow

```
[ Step 1: Upload Resume ]
       │  (PDF / DOCX -> Extracts text & candidate profile)
       ▼
[ Step 2: Ingest Recipients ]
       │  (Excel / CSV / Manual -> Scans headers, validates emails, approvals)
       ▼
[ Step 3: Job Description & Tone ]
       │  (Paste target JD -> Choose tone profile: Punchy, Technical, etc.)
       ▼
[ Step 4: AI Generation & Review ]
       │  (Synthesizes tailored emails -> Inline review, edit & approve)
       ▼
[ Step 5: Safe Dispatch with SSE ]
          (Streams delivery live -> Anti-spam throttle delay -> Logs audit)
```

1. **Step 1: Upload Resume**  
   Drag and drop your resume (`.pdf` or `.docx`). JDMail extracts the text and heuristically identifies your name, email, phone number, and word count. Or click "Load Sample Resume" to try it instantly.
2. **Step 2: Manage Recipients**  
   Upload an Excel (`.xlsx`, `.xls`) or `.csv` spreadsheet of HR contacts, or enter them manually. The modal previews detected columns, marks valid/invalid emails, and lets you select targets with Shift-Click.
3. **Step 3: Target Job Description (Optional)**  
   Paste the job description and select your preferred communication tone. If omitted, JDMail highlights your core career pillars for open roles.
4. **Step 4: AI Email Generation Studio**  
   Select your preferred AI provider and click "Generate Tailored Cold Emails". Cycle through recipient drafts, tweak text inline, toggle approvals, and ensure your resume is attached.
5. **Step 5: Safe Dispatch & Live Monitoring**  
   Click "Send All Approved Emails". The progress modal connects via Server-Sent Events, dispatching emails through your verified SMTP profile with anti-spam pacing (default 3s delay) to preserve domain reputation.

---

## Getting Started & Installation

### Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/JDMail.git
   cd JDMail
   ```

2. **Install all dependencies:**
   ```bash
   npm run install:all
   ```
   *(This automatically installs dependencies in both `server/` and `client/` directories.)*

3. **Start both backend and frontend:**
   ```bash
   npm run dev
   ```

4. **Open in your browser:**
   ```
   http://localhost:5174
   ```

---

### Running Frontend and Backend Independently

If you prefer separate terminal windows:

```bash
# Terminal 1: Backend API (Port 5001 with auto-reload)
cd server
npm run dev

# Terminal 2: Frontend Client (Port 5174 with Vite HMR)
cd client
npm run dev
```

---

## Configuration & Environment

JDMail is designed to work out of the box with zero required environment files. Configuration and encrypted credentials are automatically managed via the UI and saved to `server/data/config.json`.

### Optional Environment Variables

You can optionally define environment variables in `server/.env`:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | `number` | `5001` | Backend Express server port |
| `ENCRYPTION_MASTER_KEY` | `string` | *(Auto-generated)* | 64-hex-character (32-byte) key for AES-256-GCM encryption. If unset, generated automatically in `server/data/.secret_key`. |

---

## Supported AI Providers

Configure your preferred LLM provider in **Settings (Gear Icon) -> AI Providers**:

| Provider | Supported Models | Authentication | Notes |
| :--- | :--- | :--- | :--- |
| **Google Gemini** | `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash-exp` | API Key (`AIzaSy...`) | Fast and economical. Supports native JSON responses. |
| **OpenAI** | `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo` | API Key (`sk-...`) | Industry-standard quality and tone adherence. |
| **Groq (LPU)** | `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`, `openai/gpt-oss-120b` | API Key (`gsk_...`) | Ultra-fast token generation. |
| **Grok (xAI)** | `grok-2-1212`, `grok-beta` | API Key (`xai-...`) | Sharp, punchy, direct outreach style. |
| **NVIDIA NIM** | `meta/llama-3.1-70b-instruct`, `mistralai/mixtral-8x22b-instruct-v0.1` | API Key (`nvapi-...`) | Open enterprise models. |
| **GitHub Copilot** | `gpt-4o`, `gpt-4o-mini`, `claude-3.5-sonnet`, `o1-mini` | GitHub Device Flow | **Free for active Copilot subscribers.** No API key needed. |
| **Custom Endpoint** | User-defined (e.g. `llama3`, `mistral`) | Optional API Key | Works with Ollama, LM Studio, vLLM, or custom proxies. |

---

## SMTP Accounts & App Passwords

To send emails, add an SMTP profile in **Settings -> SMTP Accounts**.

### Setting Up App Passwords

Most modern email providers require an **App Password** rather than your regular login password. JDMail includes built-in guides with direct links:

- **Google Gmail / Google Workspace:**
  1. Go to [Google Account Security](https://myaccount.google.com/security).
  2. Enable **2-Step Verification**.
  3. Search for **App Passwords**, generate a password for "Mail", and copy the 16-character code.
  4. In JDMail: Host `smtp.gmail.com`, Port `465` (SSL) or `587` (TLS).
- **Microsoft Outlook / Office 365:**
  1. Go to [Microsoft Security Settings](https://account.microsoft.com/security).
  2. Enable Two-Step Verification and generate an App Password.
  3. In JDMail: Host `smtp-mail.outlook.com`, Port `587` (STARTTLS).
- **Yahoo Mail:**
  1. Go to Yahoo Account Security -> Generate App Password.
  2. In JDMail: Host `smtp.mail.yahoo.com`, Port `465` (SSL) or `587` (TLS).
- **Zoho Mail:**
  1. Go to Zoho Account Security -> App Passwords.
  2. In JDMail: Host `smtp.zoho.com`, Port `465` (SSL) or `587` (TLS).

Click **"Test SMTP Connection"** to verify credentials before running campaigns.

---

## Security & Encryption at Rest

- **AES-256-GCM Encryption:** Credentials in `server/data/config.json` are encrypted using `aes-256-gcm`. Each encrypted value includes a unique 96-bit IV, 128-bit authentication tag, and ciphertext.
- **Local Master Key:** The master key is stored in `server/data/.secret_key` with strict filesystem permissions (`0o600`), inaccessible to unauthorized local users.
- **Masked Data Flow:** The API never exposes decrypted credentials to the browser:
  - API Keys: `sk-...1234`
  - Passwords: `••••••••••••`
- **Data Isolation:** All campaign logs and settings remain strictly on your local machine.

---

## API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check endpoint |
| `/api/config` | `GET` | Retrieve public masked settings and provider statuses |
| `/api/config/ai` | `POST` | Update credentials or model for an AI provider |
| `/api/config/ai/active` | `POST` | Change active AI provider |
| `/api/config/ai/test` | `POST` | Live connection test for an AI provider |
| `/api/copilot/device-code` | `POST` | Initiate GitHub OAuth Device Flow (RFC 8628) |
| `/api/copilot/check-status` | `POST` | Poll GitHub OAuth Device Flow authorization status |
| `/api/config/smtp` | `POST` | Add or update an SMTP account profile |
| `/api/config/smtp/:id` | `DELETE` | Delete an SMTP profile |
| `/api/config/smtp/:id/default` | `POST` | Set an SMTP profile as default |
| `/api/config/smtp/test` | `POST` | Test SMTP credentials via `nodemailer.verify()` |
| `/api/config/preferences` | `POST` | Update delay seconds (1s–10s) and resume attachment setting |
| `/api/config/reset` | `POST` | Danger Zone: Purge all credentials, profiles, and logs |
| `/api/upload/resume` | `POST` | Upload and parse resume (`.pdf`, `.docx`, `.txt`) |
| `/api/upload/recipients` | `POST` | Upload and parse recipient spreadsheet (`.xlsx`, `.xls`, `.csv`) |
| `/api/ai/generate` | `POST` | Generate tailored cold email for a single recipient |
| `/api/ai/batch-generate` | `POST` | Batch generate cold emails for multiple recipients |
| `/api/send/stream` | `POST` | Stream email sending via Server-Sent Events (SSE) with throttling |
| `/api/send` | `POST` | Standard email dispatch without streaming |
| `/api/logs` | `GET` | Fetch campaign outreach audit history |
| `/api/logs` | `DELETE` | Clear outreach audit logs |

---

## Repository Structure

```
JDMail/
├── package.json                 # Monorepo scripts (dev, client, server, install:all)
├── README.md                    # Project documentation & user guide
├── ARCHITECTURE.md              # Technical specification & architecture map
│
├── client/                      # React 19 + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx             # Top bar with live status pills & theme switcher
│   │   │   ├── StepIndicator.jsx      # Interactive 5-step progression bar
│   │   │   ├── ResumeUpload.jsx       # Resume upload, parsing & sample loader
│   │   │   ├── RecipientManager.jsx   # Contact queue, manual adder & import controls
│   │   │   ├── RecipientModal.jsx     # Spreadsheet table preview with Shift-Click
│   │   │   ├── JobDescriptionInput.jsx# Optional JD input & 5 tone profile selectors
│   │   │   ├── EmailPreview.jsx       # AI email generator, pager & inline editor
│   │   │   ├── SendProgressModal.jsx  # SSE live progress & anti-spam countdown
│   │   │   ├── SettingsModal.jsx      # AI keys, SMTP accounts, preferences & logs
│   │   │   ├── SmtpGuideModal.jsx     # App password instructions for Gmail/Outlook
│   │   │   └── Toast.jsx              # Toast notification system
│   │   ├── services/
│   │   │   └── api.js                 # Unified client API & SSE streaming reader
│   │   ├── App.jsx                    # Root state coordinator
│   │   └── index.css                  # Custom design system (dark & light glassmorphic)
│   ├── package.json
│   └── vite.config.js                 # API proxy configuration
│
└── server/                      # Node.js Express Backend
    ├── services/
    │   ├── aiService.js               # Pluggable AI engine (Gemini, OpenAI, Groq, Grok, NVIDIA)
    │   ├── copilotService.js          # GitHub Copilot RFC 8628 OAuth & completion service
    │   ├── smtpService.js             # Nodemailer transport, verify & throttled send
    │   ├── resumeParser.js            # PDF & DOCX text extraction
    │   ├── sheetParser.js             # XLSX / XLS / CSV parsing, header scoring & RFC validation
    │   └── storageService.js          # AES-256-GCM encrypted persistence
    ├── utils/
    │   └── crypto.js                  # AES-256-GCM encryption & key masking
    ├── data/                          # Encrypted config (.secret_key, config.json, logs.json)
    ├── uploads/                       # Temporary storage for resume attachments
    ├── test_sheet_parser_full.js      # Automated test suite for sheetParser
    ├── index.js                       # Express API endpoints & SSE stream
    └── package.json
```

---

## Testing & Quality Assurance

JDMail includes an automated unit and integration test suite verifying spreadsheet parsing, email normalization, RFC validation, and heuristic name extraction.

Run the test suite from the `server` directory:

```bash
cd server
npm test
```

Expected output:
```
====================================================
RUNNING COMPREHENSIVE SHEET PARSER & EXTRACTION TEST
====================================================

Test 1: Header Normalization
✓ Header Normalization passed.

Test 2: Email Extraction from cells with extra text
✓ Email Extraction passed.

Test 3: Email Validation & Non-.com TLDs
✓ Email Validation & Domain Rules passed.

Test 4: Excel Row-by-Row Isolation & Priority Extraction
✓ Excel Row-by-Row Isolation & Priority Extraction passed.

Test 5: Name Priority Order Ranking
✓ Name Priority (avoiding Company Name confusion) passed.

Test 6: Compound First Name & Last Name
✓ Compound First Name + Last Name passed.

====================================================
ALL TESTS PASSED! FULL EXTRACTION & VALIDATION VERIFIED.
====================================================
```

To run frontend linting:
```bash
cd client
npm run lint
```

---

## Troubleshooting & FAQ

#### 1. Why do I get an `EAUTH` error when testing my SMTP account?
Most email providers (Gmail, Outlook, Yahoo) require an **App Password** when sending mail via third-party software. Make sure 2-Step Verification is active on your Google/Microsoft account, generate an App Password, and paste it into JDMail without spaces. See **Settings -> SMTP Accounts -> Setup Guide**.

#### 2. Why does my Groq key fail in Grok?
Groq (`console.groq.com`, keys starting with `gsk_`) is a fast LPU inference engine. Grok (`x.ai`, keys starting with `xai-`) is xAI's model. JDMail features intelligent key prefix detection and will guide you to select the matching provider.

#### 3. How does GitHub Copilot authentication work?
Click "Login with GitHub" in Settings -> AI Providers -> GitHub Copilot. JDMail displays an 8-character user code and opens GitHub's device authorization page. Once approved, JDMail securely exchanges and caches your Copilot session token locally.

#### 4. Can I customize the delay between outgoing emails?
Yes. Go to **Settings -> Preferences** and set **Anti-Spam Delay** between 1 and 10 seconds (default 3s). This spaces out SMTP socket requests and preserves your domain reputation.

---

## Contributing & License

Contributions, issues, and feature requests are welcome!  
Feel free to open an issue or pull request.

Distributed under the **MIT License**.
