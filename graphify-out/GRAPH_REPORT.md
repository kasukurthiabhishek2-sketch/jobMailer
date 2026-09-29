# Graph Report - JDMail  (2026-09-29)

## Corpus Check
- 127 files · ~114,952 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .rules 2, .css 1)

## Summary
- 823 nodes · 1553 edges · 66 communities (45 shown, 21 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 74 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `439b372a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- api.js
- test_graphify_integration.js
- App.jsx
- test_sheet_parser_full.js
- devDependencies
- auditDraftClaims
- index.js
- storageService.js
- test_security_guardrails.js
- test_firebase_migration.js
- smtpService.js
- resumeParser.js
- server/package.json
- dependencies
- test_design_tokens.js
- scripts
- test_batch_concurrency.js
- JDMail — AI-Powered Cold Outreach Suite for Job Applications
- test_runner_all.js
- .oxlintrc.json
- ref_path
- test_danger_zone.js
- ref_fs
- test_storage.js
- ref_assert
- copilotService.js
- av
- scripts
- aiService.js
- dependencies
- scripts
- callOpenAiCompatible
- firebaseAdmin.js
- 3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)
- JDMail — Comprehensive Architecture Map & Technical Specification
- What You Must Do When Invoked
- AGENTS.md
- Hybrid Deployment Guide (Vercel + Render)
- Codebase Debloat & Anti-Slop Rules
- graphify reference: extra exports and benchmark
- React + Vite
- graphify reference: query, path, explain
- sanitizeDraft.test.js
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- rules/graphify.md
- extraction-spec.md
- workflows/graphify.md

## God Nodes (most connected - your core abstractions)
1. `react` - 35 edges
2. `authFetch()` - 26 edges
3. `cleanJsonOutput()` - 21 edges
4. `vitest` - 20 edges
5. `App()` - 19 edges
6. `parseRecipientSheet()` - 19 edges
7. `lucide-react` - 19 edges
8. `AiProvidersTab()` - 18 edges
9. `@testing-library/react` - 17 edges
10. `classifySmtpError()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `4-Worker Concurrent Batch Generation Pipeline` --references--> `batchGenerateColdEmails()`  [INFERRED]
  ARCHITECTURE.md → client/src/services/api.js
- `3.5 SMTP Delivery & Anti-Spam Throttler (`smtpService.js`, SSE Stream)` --references--> `classifySmtpError()`  [INFERRED]
  ARCHITECTURE.md → server/services/smtpService.js
- `Parsing & Markdown Sanitization (`cleanJsonOutput`)` --references--> `cleanJsonOutput()`  [INFERRED]
  ARCHITECTURE.md → server/services/aiService.js
- `How to Add New Sheet Parsing Heuristics` --references--> `analyzeHeaders()`  [INFERRED]
  ARCHITECTURE.md → server/services/sheetParser.js
- `How to Add a New AI Provider` --references--> `callOpenAiCompatible()`  [INFERRED]
  ARCHITECTURE.md → server/services/aiService.js

## Import Cycles
- 2-file cycle: `server/services/aiService.js -> server/services/copilotService.js -> server/services/aiService.js`

## Communities (66 total, 21 thin omitted)

### Community 0 - "api.js"
Cohesion: 0.10
Nodes (49): EmailPreview(), SPAM_TRIGGER_WORDS, TONE_OPTIONS, AiProvidersTab(), formatTimeAgo(), FRIENDLY_MODEL_NAMES, friendlyModelName(), getProviderSavedKeys() (+41 more)

### Community 1 - "test_graphify_integration.js"
Cohesion: 0.10
Nodes (20): agentsMd, assert, claudeMd, { execSync, spawnSync }, expectedSymbolsOrFiles, fs, geminiMd, graphHtmlPath (+12 more)

### Community 2 - "App.jsx"
Cohesion: 0.05
Nodes (63): name, private, type, version, App(), AuthGate(), ErrorBoundary, Header() (+55 more)

### Community 3 - "test_sheet_parser_full.js"
Cohesion: 0.06
Nodes (50): 3.2 Smart Recipient & Spreadsheet Engine (`sheetParser.js`), xlsx, analyzeHeaders(), cleanPersonName(), detectHeaderRowIndex(), extractEmail(), extractNameFromEmailCell(), findBestSheetName() (+42 more)

### Community 4 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, jsdom, oxlint, @testing-library/jest-dom, @testing-library/react, vite, @vitejs/plugin-react, vitest

### Community 5 - "auditDraftClaims"
Cohesion: 0.23
Nodes (11): worker(), auditDraftClaims(), buildPrompts(), generateColdEmail(), assert, {
  auditDraftClaims,
  buildPrompts,
  cleanJsonOutput,
  generateColdEmail
}, runTests(), assert (+3 more)

### Community 6 - "index.js"
Cohesion: 0.08
Nodes (21): aiLimiter, app, copilotService, cors, express, fs, { generateColdEmail, testAiConnection, listProviderModels, cleanJsonOutput }, helmet (+13 more)

### Community 7 - "storageService.js"
Cohesion: 0.06
Nodes (59): 3.4 Security & Cryptographic Storage (`crypto.js`, `storageService.js`), ref_crypto, addCampaignLogs(), clearCampaignLogs(), CONFIG_FILE, DATA_DIR, DEFAULT_CONFIG, deleteSmtpProfile() (+51 more)

### Community 8 - "test_security_guardrails.js"
Cohesion: 0.20
Nodes (10): isOriginAllowed(), validateCustomBaseUrl(), assert, copilotService, { isOriginAllowed }, RFC-1918, path, { requireAuth } (+2 more)

### Community 9 - "test_firebase_migration.js"
Cohesion: 0.11
Nodes (17): assert, checkNoLocalStorageCredentials(), clientSrcDir, decrypted, firestoreDoc, fs, path, payloadWithUndefined (+9 more)

### Community 10 - "smtpService.js"
Cohesion: 0.17
Nodes (21): nodemailer, classifySmtpError(), createTransporter(), dispatchCampaign(), worker(), extractSmtpCode(), fs, RFC-5321 (+13 more)

### Community 11 - "resumeParser.js"
Cohesion: 0.16
Nodes (15): mammoth, pdf-parse, extractEmail(), extractName(), extractPhone(), fs, mammoth, parseResumeFile() (+7 more)

### Community 12 - "server/package.json"
Cohesion: 0.17
Nodes (11): cors, dotenv, exceljs, express, express-rate-limit, helmet, multer, description (+3 more)

### Community 13 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, cors, dotenv, exceljs, express, express-rate-limit, firebase-admin, helmet (+5 more)

### Community 14 - "test_design_tokens.js"
Cohesion: 0.17
Nodes (11): assert, clientDir, cssContent, cssPath, fs, lightThemeMatch, path, requiredLightOverrides (+3 more)

### Community 15 - "scripts"
Cohesion: 0.15
Nodes (12): description, name, scripts, client, dev, graphify, graphify:query, graphify:report (+4 more)

### Community 16 - "test_batch_concurrency.js"
Cohesion: 0.36
Nodes (7): adaptGenericEmailForRecipient(), { adaptGenericEmailForRecipient }, assert, runConcurrentBatch(), runPartitionedBatch(), worker(), runTests()

### Community 17 - "JDMail — AI-Powered Cold Outreach Suite for Job Applications"
Cohesion: 0.06
Nodes (35): 1. Resume Parsing & Heuristic Extraction, 1. Server Subsystem Suites (Node.js), 1. Why do I get an `EAUTH` error when testing my SMTP account?, 2. Frontend Component & Hook Suites (Vitest + React Testing Library), 2. Recipient Ingestion & Robust Spreadsheet Parsing, 2. Why does my Groq key fail in Grok?, 3. Code Quality & Linter, 3. How does GitHub Copilot authentication work? (+27 more)

### Community 18 - "test_runner_all.js"
Cohesion: 0.29
Nodes (6): ref_child_process, fs, path, results, { spawnSync }, testSuites

### Community 19 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 20 - "ref_path"
Cohesion: 0.20
Nodes (6): SCREENSHOT_DIR, ref_path, ref_puppeteer_core, assert, fs, path

### Community 21 - "test_danger_zone.js"
Cohesion: 0.33
Nodes (4): assert, copilotService, fs, path

### Community 22 - "ref_fs"
Cohesion: 0.33
Nodes (6): ref_fs, assert, fs, path, results, runTests()

### Community 23 - "test_storage.js"
Cohesion: 0.33
Nodes (4): assert, fs, path, storage

### Community 24 - "ref_assert"
Cohesion: 0.16
Nodes (15): ref_assert, listProviderModels(), testAiConnection(), assert, runTests(), { testAiConnection, listProviderModels }, assert, copilotService (+7 more)

### Community 25 - "copilotService.js"
Cohesion: 0.22
Nodes (10): callCopilotChat(), checkDeviceStatus(), clearPendingDeviceFlow(), clearSessionCache(), defaultCache, getCopilotSessionToken(), getSessionCache(), RFC-8628 (+2 more)

### Community 26 - "av"
Cohesion: 0.17
Nodes (27): argparse, datetime, glob, os, re, cmd_beat(), cmd_board(), cmd_claim() (+19 more)

### Community 27 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 28 - "aiService.js"
Cohesion: 0.25
Nodes (12): RFC-8259, cleanJsonOutput(), copilotService, extractFieldsViaRegex(), extractPlainTextFallback(), RFC-1918, normalizeControlCharacters(), sanitizeParsedEmail() (+4 more)

### Community 29 - "dependencies"
Cohesion: 0.40
Nodes (5): dependencies, firebase, lucide-react, react, react-dom

### Community 30 - "scripts"
Cohesion: 0.50
Nodes (4): scripts, dev, start, test

### Community 32 - "callOpenAiCompatible"
Cohesion: 0.43
Nodes (6): HTTP 429 Exponential Backoff & Retry Handling, callGemini(), callOpenAiCompatible(), assert, { callGemini, callOpenAiCompatible }, runTests()

### Community 35 - "firebaseAdmin.js"
Cohesion: 0.25
Nodes (7): firebase-admin, admin, fs, path, requireAuth(), SERVICE_ACCOUNT_PATH, verifyIdToken()

### Community 39 - "3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)"
Cohesion: 0.25
Nodes (8): 3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`), 4-Worker Concurrent Batch Generation Pipeline, Enforced JSON Contract, Intelligent Key Prefix Mismatch Detection, Parsing & Markdown Sanitization (`cleanJsonOutput`), Provider Implementations, Uniform Interface, Verifiable Fact-Grounding Guardrail (`auditDraftClaims`)

### Community 42 - "JDMail — Comprehensive Architecture Map & Technical Specification"
Cohesion: 0.06
Nodes (31): 10.1 Graph Artifacts (`graphify-out/`), 10.2 Agent Protocols & Invariants, 10. Graphify Knowledge Graph & Multi-Agent Architecture, 1. System Overview & Architectural Principles, 2.1 High-Level Component Topology, 2.2 End-to-End Outreach Pipeline, 2.3 Spreadsheet Ingestion & Heuristic Extraction Pipeline, 2.4 GitHub Copilot Device Flow Authentication (RFC 8628) (+23 more)

### Community 43 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 46 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): 0.5 Non-negotiable guardrails, 0. Prime directives, 1. Orient (cold start <= 4k tokens; stop as soon as you know enough), 2. Before / after every change (scaled by tier), 3. Coding rules, 4. Token discipline, 5. Handoff-ready at all times, 6. Multi-agent protocol (+4 more)

### Community 47 - "Hybrid Deployment Guide (Vercel + Render)"
Cohesion: 0.18
Nodes (10): 1. Architecture Topology, 2. CORS & Origin Normalization Pitfalls, 3. Environment Variable Invariants, 4. MCP Servers Configuration, 5. Verification Commands, Failure Symptom:, Hybrid Deployment Guide (Vercel + Render), Managing in Antigravity IDE: (+2 more)

### Community 51 - "Codebase Debloat & Anti-Slop Rules"
Cohesion: 0.40
Nodes (4): AI-Slop Checklist (Review Before Committing), Codebase Debloat & Anti-Slop Rules, Core Rules, Non-Negotiable Guardrails

### Community 52 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 55 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

### Community 75 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 77 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 78 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 79 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

## Knowledge Gaps
- **400 isolated node(s):** `Project facts`, `0. Prime directives`, `0.5 Non-negotiable guardrails`, `1. Orient (cold start <= 4k tokens; stop as soon as you know enough)`, `2. Before / after every change (scaled by tier)` (+395 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 465 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `api.js`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `3. Subsystem Deep Dives` connect `JDMail — Comprehensive Architecture Map & Technical Specification` to `test_sheet_parser_full.js`, `storageService.js`, `3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `Project facts`, `0. Prime directives`, `0.5 Non-negotiable guardrails` to the rest of the system?**
  _400 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09935710111046171 - nodes in this community are weakly interconnected._
- **Should `test_graphify_integration.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05431140892258861 - nodes in this community are weakly interconnected._
- **Should `test_sheet_parser_full.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0573025856044724 - nodes in this community are weakly interconnected._