---
title: Architecture Overview
summary: Top-level system architecture and data flow for JDMail
updated: 2026-09-29
tags: [architecture]
---
# Architecture Overview

## What it is
A two-tier web application: React SPA (Vite) ↔ Express REST API. The server orchestrates AI email generation, SMTP dispatch, and encrypted storage. No database — JSON flat files on disk, with optional Firebase for cloud persistence.

## Top-level modules
| Module | Path | Purpose |
|--------|------|---------|
| API server | `server/index.js` | Express app, routes, CORS, SSE streaming |
| AI service | `server/services/aiService.js` | Multi-provider prompt dispatch via native `fetch()` |
| Copilot service | `server/services/copilotService.js` | GitHub Copilot OAuth device flow (RFC 8628) |
| SMTP service | `server/services/smtpService.js` | Nodemailer dispatch with anti-spam throttling |
| Storage service | `server/services/storageService.js` | Encrypted JSON persistence (`config.json`, `logs.json`) |
| Crypto utils | `server/utils/crypto.js` | AES-256-GCM encrypt/decrypt for secrets |
| Sheet parser | `server/services/sheetParser.js` | Excel/CSV recipient extraction with heuristics |
| Resume parser | `server/services/resumeParser.js` | PDF/DOCX resume text extraction |
| React SPA | `client/src/App.jsx` | Single-page app, component tree |
| API client | `client/src/services/api.js` | `authFetch()` wrapper for all backend calls |

## Main data flow
1. User uploads resume + recipient spreadsheet → server parses both
2. User selects AI provider, pastes JD → server generates personalized emails
3. User reviews/approves per-recipient → two-stage send gate
4. Server dispatches via SMTP with SSE progress stream to client
5. All config (providers, SMTP accounts) encrypted at rest via AES-256-GCM

## God nodes (from graphify, by connectivity)
`react`, `authFetch()`, `cleanJsonOutput()`, `App()`, `parseRecipientSheet()`, `AiProvidersTab()`, `classifySmtpError()`
