# JDMail — AI-Powered Cold Outreach Suite for Job Applications

JDMail is a personalized, high-converting cold email outreach platform for job seekers. It pairs candidate resumes with job descriptions, generates tailored cold emails across multiple AI providers (Google Gemini, OpenAI, Grok, NVIDIA NIM, and Custom OpenAI-compatible endpoints), and safely dispatches them through the user's verified SMTP accounts with real-time delivery tracking and anti-spam rate limiting.

---

## Key Features

### 1. Resume Parsing & Matching
- Upload resumes in **PDF** (`.pdf`) or **Word** (`.docx`) format.
- Automatic text extraction via `pdf-parse` and `mammoth`.
- Heuristic detection of candidate Name, Email, Phone, and word count.
- Candidate resume is automatically attached to each outgoing outreach email.

### 2. Recipient Management & Spreadsheet Import
- Add individual HR / recruiter contacts manually, or import from **Excel** (`.xlsx`, `.xls`) or **CSV** files.
- Modal preview with header detection, auto-mapping (`Name`, `Email`, `Company`, `Role`).
- **RFC-compliant email validation**: invalid email rows are visually highlighted in red and automatically unchecked.
- **Multi-row selection** with **Shift-Click** range selection and "Select All" toggle.
- Real-time count of selected recipients.

### 3. Multi-Provider AI Generation Studio
- Pluggable AI engine supporting:
  - **Google Gemini** (`gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash-exp`)
  - **ChatGPT / OpenAI** (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`)
  - **Grok (xAI)** (`grok-2-1212`, `grok-beta`)
  - **NVIDIA NIM** (`meta/llama-3.1-70b-instruct`, `mistralai/mixtral-8x22b-instruct-v0.1`)
  - **GitHub Copilot / Custom OpenAI-Compatible** (configurable base URL & model)
- **Live Connection Testing**: "Test Connection" button per provider to validate API keys without sending emails.
- **Job Description Tailoring**:
  - *With JD*: aligns candidate accomplishments and technical depth to the exact JD requirements.
  - *Without JD*: crafts a high-impact intro highlighting core accomplishments and value proposition.
- **Interactive Review & Editor**: cycle through recipient drafts, edit subject lines and body text before dispatching.

### 4. SMTP Configuration & App Password Guides
- Add multiple SMTP accounts with customizable From Name and From Address.
- Supports **SSL** (Port 465), **TLS / STARTTLS** (Port 587), and custom ports.
- **"Test SMTP Connection"** button for immediate verification via `nodemailer.verify()`.
- **In-App Guided Setup** with direct links and instructions for generating App Passwords:
  - Google Gmail / Google Workspace
  - Microsoft Outlook / Office 365
  - Yahoo Mail
  - Zoho Mail

### 5. Safe Sending & Real-Time Delivery Logs
- **Server-Sent Events (SSE)** streaming live progress (*"Sending 3 of 15..."*).
- **Anti-Spam Throttling**: configurable delay (1s–10s, default 3s) between consecutive emails to protect sender domain reputation and prevent spam filter triggers.
- Live progress modal showing send success, failures with detailed server response codes, and persistent audit logs.

### 6. Security & Encryption at Rest
- All API keys and SMTP passwords are encrypted at rest using **AES-256-GCM** with a persistent local master key.
- Sensitive credentials are **never exposed** in client-side responses or logs; only masked formats (e.g. `sk-...1234`, `••••••••••••`) are sent to the frontend.

---

## Getting Started

### Prerequisites
- Node.js v18+ and npm installed

### Quick Start

1. **Install dependencies**:
   ```bash
   # From root directory:
   npm run install:all
   ```

2. **Start Backend & Frontend together**:
   ```bash
   npm run dev
   ```

   Or run them independently:
   ```bash
   # Backend (Port 5001):
   cd server && npm run dev

   # Frontend (Port 5173 / 5174):
   cd client && npm run dev
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:5174
   ```

---

## Application Structure

```
JDMail/
├── client/                      # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx             # Top bar with live status pills & settings
│   │   │   ├── StepIndicator.jsx      # Workflow step progression bar
│   │   │   ├── ResumeUpload.jsx       # Resume upload, parsing & sample loader
│   │   │   ├── RecipientManager.jsx   # Contact queue & spreadsheet triggers
│   │   │   ├── RecipientModal.jsx     # Spreadsheet table preview with Shift-click
│   │   │   ├── JobDescriptionInput.jsx# Optional JD input & tailoring controls
│   │   │   ├── EmailPreview.jsx       # AI email generator, pager & inline editor
│   │   │   ├── SendProgressModal.jsx  # SSE live progress & anti-spam countdown
│   │   │   ├── SettingsModal.jsx      # AI keys, SMTP accounts, preferences & logs
│   │   │   ├── SmtpGuideModal.jsx     # App password instructions for Gmail/Outlook
│   │   │   └── Toast.jsx              # Toast notification alerts
│   │   ├── services/
│   │   │   └── api.js                 # Unified client API & SSE streaming
│   │   ├── App.jsx                    # Root state coordinator
│   │   └── index.css                  # Custom design system (glassmorphic dark theme)
│   ├── package.json
│   └── vite.config.js                 # API proxy configuration
├── server/                      # Node.js Express backend
│   ├── services/
│   │   ├── aiService.js               # Pluggable AI engine (Gemini, OpenAI, Grok, NVIDIA)
│   │   ├── smtpService.js             # Nodemailer transport, verify & throttled send
│   │   ├── resumeParser.js            # PDF & DOCX text extraction
│   │   ├── sheetParser.js             # XLSX / XLS / CSV parsing & email validation
│   │   └── storageService.js          # AES-256-GCM encrypted persistence
│   ├── utils/
│   │   └── crypto.js                  # AES-256-GCM encryption & key masking
│   ├── uploads/                       # Temporary storage for resume attachments
│   ├── data/                          # Encrypted config and delivery logs
│   ├── index.js                       # Express API endpoints
│   └── package.json
├── package.json                 # Monorepo root run scripts
└── README.md
```
