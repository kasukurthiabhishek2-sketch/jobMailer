---
title: JDMail Product Brief
summary: AI-powered cold email outreach platform for job seekers
updated: 2026-09-29
tags: [product]
---
# JDMail — Product Brief

## Goal
AI-powered cold email outreach platform for job seekers. Pairs resumes with job descriptions, generates tailored cold emails via multiple AI providers, and dispatches them through verified SMTP accounts with real-time tracking.

## Stack
- **Server:** Node.js 18+, Express 4, native `fetch()` for AI providers
- **Client:** React 19, Vite 8, OxLint
- **AI Providers:** Google Gemini, OpenAI, Groq, Grok/xAI, NVIDIA NIM, GitHub Copilot, Custom endpoints
- **Security:** AES-256-GCM encryption at rest for secrets
- **Storage:** JSON flat files (`config.json`, `logs.json`), Firebase optional
- **Deployment:** Hybrid (Vercel frontend + Render backend) or local

## Commands
| Action     | Command                          |
|------------|----------------------------------|
| fast-test  | `cd server && npm test`          |
| full-test  | `cd server && npm test`          |
| lint       | `cd client && npm run lint`      |
| run        | `npm run dev`                    |
| build      | `cd client && npm run build`     |

## Agent tools
Claude Code, Codex, Gemini CLI, Cursor, Copilot

## Constraints
- MIT license
- Native `fetch()` only — no OpenAI/Google SDKs
- Secrets AES-256-GCM encrypted at rest, never returned unmasked
- Two-stage human-in-the-loop send gate never bypassed
- CORS origin normalization (trailing slashes)
- `config.json` / `logs.json` schemas backward-compatible

## Key Modules
- `server/services/aiService.js` — Multi-provider AI email generation
- `server/services/smtpService.js` — SMTP dispatch with SSE streaming
- `server/services/storageService.js` — Encrypted config/log persistence
- `server/utils/crypto.js` — AES-256-GCM encryption
- `server/services/sheetParser.js` — Spreadsheet recipient extraction
- `server/services/copilotService.js` — GitHub Copilot device flow auth
- `client/src/App.jsx` — Main React SPA entry
- `client/src/services/api.js` — Frontend API client with `authFetch()`
