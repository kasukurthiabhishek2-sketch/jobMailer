# Graph Report - JDMail  (2026-09-29)

## Corpus Check
- 145 files · ~128,253 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .rules 2, .css 1)

## Summary
- 989 nodes · 1716 edges · 85 communities (67 shown, 18 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 136 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `30671c43`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- api.js
- test_graphify_integration.js
- App.jsx
- test_sheet_parser_full.js
- client/package.json
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
- ref_assert
- JDMail — AI-Powered Cold Outreach Suite for Job Applications
- test_runner_all.js
- .oxlintrc.json
- ref_path
- test_danger_zone.js
- ref_fs
- test_storage.js
- test_copilot_device_flow.js
- copilotService.js
- Screen-by-Screen Findings Grouped by Wizard Step
- Detailed Cycle 3 Shipped Ticket Specifications
- aiService.js
- runServerE2eSuite
- 2. Detailed Ticket-by-Ticket Diff Review
- Detailed Architectural Evaluations
- callOpenAiCompatible
- test_e2e_suite.js
- Full End-of-Cycle QA Report: Cycle 1
- firebaseAdmin.js
- Dimension Scorecard
- test_e2e_pipeline.js
- crypto.js
- 3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)
- Prioritized Deliverability Findings
- 1. Audit of Remaining Gaps & Opportunities
- JDMail — Comprehensive Architecture Map & Technical Specification
- What You Must Do When Invoked
- Frontend Test Harness Proposal: Vitest + React Testing Library (Cycle 3)
- Prioritized Performance Findings
- Codebase Debloat & Anti-Slop Rules
- Hybrid Deployment Guide (Vercel + Render)
- Codebase Debloat & Anti-Slop Rules
- Codebase Debloat & Anti-Slop Rules
- Prioritized Findings
- Codebase Debloat & Anti-Slop Rules
- graphify reference: extra exports and benchmark
- Cycle 3 Ground-Truth Protocol & Baseline Report
- Cycle 3 Ticket Inventory & Execution Status
- React + Vite
- Implementation Report: TICK-06 (Batch AI Generation Concurrency)
- Implementation Report: TICK-09 (Cross-Session Deduplication)
- Implementation Report: TICK-07 (Recipient Modal Pagination)
- Implementation Report: TICK-02 / TICK-08 / TICK-11 (SMTP Resilience, Strict TLS & Delay Jitter)
- Detailed Audit Findings
- getPublicConfig
- decrypt
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
3. `Detailed Cycle 3 Shipped Ticket Specifications` - 25 edges
4. `cleanJsonOutput()` - 22 edges
5. `App()` - 20 edges
6. `parseRecipientSheet()` - 19 edges
7. `lucide-react` - 19 edges
8. `vitest` - 19 edges
9. `AiProvidersTab()` - 18 edges
10. `classifySmtpError()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Parsing & Markdown Sanitization (`cleanJsonOutput`)` --references--> `cleanJsonOutput()`  [INFERRED]
  ARCHITECTURE.md → server/services/aiService.js
- `Verifiable Fact-Grounding Guardrail (`auditDraftClaims`)` --references--> `auditDraftClaims()`  [INFERRED]
  ARCHITECTURE.md → server/services/aiService.js
- `4-Worker Concurrent Batch Generation Pipeline` --references--> `batchGenerateColdEmails()`  [INFERRED]
  ARCHITECTURE.md → client/src/services/api.js
- `3.5 SMTP Delivery & Anti-Spam Throttler (`smtpService.js`, SSE Stream)` --references--> `classifySmtpError()`  [INFERRED]
  ARCHITECTURE.md → server/services/smtpService.js
- `How to Add a New AI Provider` --references--> `callOpenAiCompatible()`  [INFERRED]
  ARCHITECTURE.md → server/services/aiService.js

## Import Cycles
- 2-file cycle: `server/services/aiService.js -> server/services/copilotService.js -> server/services/aiService.js`

## Communities (85 total, 18 thin omitted)

### Community 0 - "api.js"
Cohesion: 0.09
Nodes (50): AiProvidersTab(), formatTimeAgo(), FRIENDLY_MODEL_NAMES, friendlyModelName(), getProviderSavedKeys(), ModelSelect(), PROVIDER_CONFIG, PROVIDER_DEFAULT_MODELS (+42 more)

### Community 1 - "test_graphify_integration.js"
Cohesion: 0.10
Nodes (20): agentsMd, assert, claudeMd, { execSync, spawnSync }, expectedSymbolsOrFiles, fs, geminiMd, graphHtmlPath (+12 more)

### Community 2 - "App.jsx"
Cohesion: 0.06
Nodes (58): App(), AuthGate(), EmailPreview(), SPAM_TRIGGER_WORDS, TONE_OPTIONS, ErrorBoundary, Header(), JobDescriptionInput() (+50 more)

### Community 3 - "test_sheet_parser_full.js"
Cohesion: 0.06
Nodes (50): 3.2 Smart Recipient & Spreadsheet Engine (`sheetParser.js`), xlsx, analyzeHeaders(), cleanPersonName(), detectHeaderRowIndex(), extractEmail(), extractNameFromEmailCell(), findBestSheetName() (+42 more)

### Community 4 - "client/package.json"
Cohesion: 0.07
Nodes (28): dependencies, firebase, lucide-react, react, react-dom, devDependencies, jsdom, oxlint (+20 more)

### Community 5 - "auditDraftClaims"
Cohesion: 0.17
Nodes (14): 1. Summary of Changes, 2. Test Execution, Implementation Report: TICK-10 (AI Hallucination Guardrail), worker(), auditDraftClaims(), buildPrompts(), generateColdEmail(), assert (+6 more)

### Community 6 - "index.js"
Cohesion: 0.08
Nodes (21): aiLimiter, app, copilotService, cors, express, fs, { generateColdEmail, testAiConnection, listProviderModels, cleanJsonOutput }, helmet (+13 more)

### Community 7 - "storageService.js"
Cohesion: 0.20
Nodes (13): addCampaignLogs(), clearCampaignLogs(), CONFIG_FILE, DATA_DIR, DEFAULT_CONFIG, { encrypt, decrypt, maskApiKey, maskPassword }, fs, getCampaignLogs() (+5 more)

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
Cohesion: 0.12
Nodes (15): cors, dotenv, exceljs, express, express-rate-limit, helmet, multer, description (+7 more)

### Community 13 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, cors, dotenv, exceljs, express, express-rate-limit, firebase-admin, helmet (+5 more)

### Community 14 - "test_design_tokens.js"
Cohesion: 0.17
Nodes (11): assert, clientDir, cssContent, cssPath, fs, lightThemeMatch, path, requiredLightOverrides (+3 more)

### Community 15 - "scripts"
Cohesion: 0.15
Nodes (12): description, name, scripts, client, dev, graphify, graphify:query, graphify:report (+4 more)

### Community 16 - "ref_assert"
Cohesion: 0.31
Nodes (8): ref_assert, adaptGenericEmailForRecipient(), { adaptGenericEmailForRecipient }, assert, runConcurrentBatch(), runPartitionedBatch(), worker(), runTests()

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

### Community 24 - "test_copilot_device_flow.js"
Cohesion: 0.16
Nodes (14): listProviderModels(), testAiConnection(), assert, runTests(), { testAiConnection, listProviderModels }, assert, copilotService, fs (+6 more)

### Community 25 - "copilotService.js"
Cohesion: 0.12
Nodes (17): 1. Summary of Changes, 2. Test Execution, Implementation Report: TICK-01 (Copilot AI Dispatch Bug), 1. Summary of Changes, 2. Test Execution, Implementation Report: TICK-05 (Complete Danger-Zone Purge), SEC-03: Incomplete Danger-Zone Data Purge Leaves PII Resumes on Disk & Stale Token Cache, callCopilotChat() (+9 more)

### Community 26 - "Screen-by-Screen Findings Grouped by Wizard Step"
Cohesion: 0.09
Nodes (22): Pain-Point Audit: 14-Screen End-to-End Walkthrough (Cycle 3), Screen 10: Dispatch Progress & SSE Live Stream (`SendProgressModal.jsx`), Screen 11: Active Send Step View (`SendStep.jsx`), Screen 12: SMTP Accounts Management (`SettingsModal.jsx` / `SmtpAccountsTab.jsx`), Screen 13: Delivery & Audit Logs (`SettingsModal.jsx` / `AuditLogsTab.jsx`), Screen 14: Danger Zone (`SettingsModal.jsx` / `DangerZoneTab.jsx`), Screen 1: Resume Upload & Parsing View (`ResumeUpload.jsx`), Screen 2: AI Provider Configuration & Testing (`SettingsModal.jsx` / `AiProvidersTab.jsx`) (+14 more)

### Community 27 - "Detailed Cycle 3 Shipped Ticket Specifications"
Cohesion: 0.09
Nodes (22): Detailed Cycle 3 Shipped Ticket Specifications, TICK-CYC3-01: Hardware-Bound Local Storage Architecture (Option 1), TICK-CYC3-03: Surface Hallucination Guardrail in `EmailPreview.jsx`, TICK-CYC3-04: Step Numbering Alignment (5-Step Canonical Wizard), TICK-CYC3-07: Centralize Canonical `WIZARD_STEPS` Source of Truth, TICK-CYC3-08: Decompose `App.jsx` (`useWizardState`, `useCampaignStream`), TICK-CYC3-09: Modular Decomposition of `SettingsModal.jsx` (5 Tabs), TICK-CYC3-10: Accessible Step Progression Bar & ARIA Navigation (+14 more)

### Community 28 - "aiService.js"
Cohesion: 0.25
Nodes (12): RFC-8259, cleanJsonOutput(), copilotService, extractFieldsViaRegex(), extractPlainTextFallback(), RFC-1918, normalizeControlCharacters(), sanitizeParsedEmail() (+4 more)

### Community 29 - "runServerE2eSuite"
Cohesion: 0.31
Nodes (9): 1. Guardrails & Architecture Invariants Checklist, assert, { encrypt, decrypt, maskApiKey, maskPassword }, runTests(), runE2ePipelineTests(), runServerE2eSuite(), encrypt(), maskApiKey() (+1 more)

### Community 30 - "2. Detailed Ticket-by-Ticket Diff Review"
Cohesion: 0.15
Nodes (12): 2. Detailed Ticket-by-Ticket Diff Review, 3. Findings & Recommendations (Non-blocking Nits), Code Review Report: Cycle 1 Integration, TICK-01: Copilot Symbol Fix & Resilient Dispatch, TICK-02 / TICK-08 / TICK-11: SMTP Resilience, Jitter & Strict TLS, TICK-03: Subsystem Automated Test Suites, TICK-04 / TICK-14: Cryptographic Fail-Closed & Short-Key Masking, TICK-05: Danger-Zone Resume & Cache Purge (+4 more)

### Community 31 - "Detailed Architectural Evaluations"
Cohesion: 0.17
Nodes (11): 1. Draft Diffing & Selective Regeneration Caching, 2. "Send Test Copy to Myself" Verification Gate, 3. Real-Time Spam-Scanner & Quality-Meter Keystroke Debounce, 4. Keyboard Shortcuts in the Review Pager, 5. In-Progress Draft Autosave & Recovery, 6. CSV / JSON Export for Outreach Logs (`logs.json`), 7. Virtual Windowing for Large Recipient Lists, Detailed Architectural Evaluations (+3 more)

### Community 32 - "callOpenAiCompatible"
Cohesion: 0.36
Nodes (8): HTTP 429 Exponential Backoff & Retry Handling, 1.2 AI Provider Rate-Limit Resilience (Currently 9.0 / 10), TICK-CYC3-05: AI Provider HTTP 429 Exponential Backoff Retries, callGemini(), callOpenAiCompatible(), assert, { callGemini, callOpenAiCompatible }, runTests()

### Community 33 - "test_e2e_suite.js"
Cohesion: 0.18
Nodes (10): assert, { classifySmtpError }, { cleanJsonOutput, buildPrompts, auditDraftClaims }, { encrypt, decrypt, maskApiKey, maskPassword }, fs, RFC-5321, RFC-8628, { parseRecipientSheet } (+2 more)

### Community 34 - "Full End-of-Cycle QA Report: Cycle 1"
Cohesion: 0.20
Nodes (9): 1. Automated Regression & Unit Test Suite, 2. Client Linter Verification, 3. Subsystem Interaction Verification, 4. Manual Smoke-Test Checklist for 5-Step UI Workflow, Command Executed:, Command Executed:, Full End-of-Cycle QA Report: Cycle 1, Raw Output: (+1 more)

### Community 35 - "firebaseAdmin.js"
Cohesion: 0.22
Nodes (8): TICK-CYC3-06: Backend API Authentication Middleware (`requireAuth`), firebase-admin, admin, fs, path, requireAuth(), SERVICE_ACCOUNT_PATH, verifyIdToken()

### Community 36 - "Dimension Scorecard"
Cohesion: 0.33
Nodes (6): Cycle 0 baseline, Cycle 1 — Overall: 9.10/10, Dimension Scorecard, Docs-Sync Changelog, JDMail Rating & Cycle History, getRecentlyContactedMap()

### Community 37 - "test_e2e_pipeline.js"
Cohesion: 0.22
Nodes (8): assert, { classifySmtpError }, { cleanJsonOutput, buildPrompts, auditDraftClaims }, { encrypt, decrypt, maskApiKey, maskPassword }, fs, RFC-5321, { parseRecipientSheet }, path

### Community 38 - "crypto.js"
Cohesion: 0.22
Nodes (7): ref_crypto, crypto, DATA_DIR, fs, KEY_FILE, MASTER_KEY, path

### Community 39 - "3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)"
Cohesion: 0.25
Nodes (8): 3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`), 4-Worker Concurrent Batch Generation Pipeline, Enforced JSON Contract, Intelligent Key Prefix Mismatch Detection, Parsing & Markdown Sanitization (`cleanJsonOutput`), Provider Implementations, Uniform Interface, Verifiable Fact-Grounding Guardrail (`auditDraftClaims`)

### Community 40 - "Prioritized Deliverability Findings"
Cohesion: 0.25
Nodes (7): Cold-Email Deliverability & Outreach Compliance Report — Cycle 1, DEL-01: Zero Retry / Backoff for Transient SMTP Failures vs Permanent Bounces, DEL-02: Predictable Robotic Delay Lacks Jitter & Provider Quota Awareness, DEL-03: No Cross-Session Recipient Deduplication (Audit Log Blindness), DEL-04: Outreach Compliance & Opt-Out Notice Flag, Executive Summary, Prioritized Deliverability Findings

### Community 41 - "1. Audit of Remaining Gaps & Opportunities"
Cohesion: 0.25
Nodes (7): 1.1 Deliverability & Provider Quota Protection (Currently 8.8 / 10), 1.3 Configurable Batch Concurrency (Currently 9.2 / 10), 1.4 Active Resume Attachment Deletion & Storage Lifecycle (Currently 9.2 / 10), 1.5 Client Code Cleanliness & React Optimization (Currently 9.4 / 10), 1. Audit of Remaining Gaps & Opportunities, 2. Cycle 2 Ticket Backlog Proposals, Phase 1 Research & Audit Report: Cycle 2

### Community 42 - "JDMail — Comprehensive Architecture Map & Technical Specification"
Cohesion: 0.06
Nodes (31): 10.1 Graph Artifacts (`graphify-out/`), 10.2 Agent Protocols & Invariants, 10. Graphify Knowledge Graph & Multi-Agent Architecture, 1. System Overview & Architectural Principles, 2.1 High-Level Component Topology, 2.2 End-to-End Outreach Pipeline, 2.3 Spreadsheet Ingestion & Heuristic Extraction Pipeline, 2.4 GitHub Copilot Device Flow Authentication (RFC 8628) (+23 more)

### Community 43 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 44 - "Frontend Test Harness Proposal: Vitest + React Testing Library (Cycle 3)"
Cohesion: 0.25
Nodes (7): 1. Justification, 2. Proposed Minimal Test Stack, 3. Targeted Test Coverage (Minimal, High-Value Scope), 4. Execution Script Integration, 5. Decision Request for User / Human Lead, Frontend Test Harness Proposal: Vitest + React Testing Library (Cycle 3), Required Dev Dependencies (Client Workspace Only)

### Community 45 - "Prioritized Performance Findings"
Cohesion: 0.29
Nodes (6): Executive Summary, PERF-01: Unbounded DOM Generation in Recipient Spreadsheet Modal (`RecipientModal.jsx`), PERF-02: Strictly Serialized Batch AI Generation Bottleneck, PERF-03: Redundant Resume Text Slicing & Reprocessing, Prioritized Performance Findings, System Performance & Efficiency Audit Report — Cycle 1

### Community 46 - "Codebase Debloat & Anti-Slop Rules"
Cohesion: 0.33
Nodes (5): AI-Slop Checklist (Review Before Committing), Codebase Debloat & Anti-Slop Rules, Core Rules, graphify, Non-Negotiable Guardrails

### Community 47 - "Hybrid Deployment Guide (Vercel + Render)"
Cohesion: 0.18
Nodes (10): 1. Architecture Topology, 2. CORS & Origin Normalization Pitfalls, 3. Environment Variable Invariants, 4. MCP Servers Configuration, 5. Verification Commands, Failure Symptom:, Hybrid Deployment Guide (Vercel + Render), Managing in Antigravity IDE: (+2 more)

### Community 48 - "Codebase Debloat & Anti-Slop Rules"
Cohesion: 0.33
Nodes (5): AI-Slop Checklist (Review Before Committing), Codebase Debloat & Anti-Slop Rules, Core Rules, graphify, Non-Negotiable Guardrails

### Community 49 - "Codebase Debloat & Anti-Slop Rules"
Cohesion: 0.33
Nodes (5): AI-Slop Checklist (Review Before Committing), Codebase Debloat & Anti-Slop Rules, Core Rules, graphify, Non-Negotiable Guardrails

### Community 50 - "Prioritized Findings"
Cohesion: 0.20
Nodes (9): Executive Summary, Finding PP-01: No AI Hallucination Guardrail or Verifiable Resume-Fact Verification, Finding PP-02: Lack of Cross-Campaign / Cross-Session Duplicate Recipient Warning, Finding PP-03: Browser Freeze on Large Spreadsheet Imports (Unbounded Table Rendering), Finding PP-04: Fixed Throttling Lacks Provider-Specific Guidance and Daily Quotas, Finding PP-05: Orphaned Files and Data Retention in "Danger Zone", Finding PP-06: Missing Unsubscribe / Communication Compliance Notice, Phase 1 UX & Product Research Report — Cycle 1 (+1 more)

### Community 51 - "Codebase Debloat & Anti-Slop Rules"
Cohesion: 0.40
Nodes (4): AI-Slop Checklist (Review Before Committing), Codebase Debloat & Anti-Slop Rules, Core Rules, Non-Negotiable Guardrails

### Community 52 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 53 - "Cycle 3 Ground-Truth Protocol & Baseline Report"
Cohesion: 0.40
Nodes (4): 1. Baseline Test Failure Breakdown (Ground-Truth Deltas), 2. Verification of Audit Findings in Code, 3. Recommended Actions Prior to Phase 1 Execution, Cycle 3 Ground-Truth Protocol & Baseline Report

### Community 54 - "Cycle 3 Ticket Inventory & Execution Status"
Cohesion: 0.40
Nodes (4): Cycle 1 Shipped Tickets (Archive), Cycle 3 Ticket Inventory & Execution Status, JDMail Product & Engineering Backlog, Shipped Ticket Archive (Cycles 1 & 2)

### Community 55 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

### Community 56 - "Implementation Report: TICK-06 (Batch AI Generation Concurrency)"
Cohesion: 0.50
Nodes (3): 1. Summary of Changes, 2. Test Execution, Implementation Report: TICK-06 (Batch AI Generation Concurrency)

### Community 57 - "Implementation Report: TICK-09 (Cross-Session Deduplication)"
Cohesion: 0.50
Nodes (3): 1. Summary of Changes, 2. Test Execution, Implementation Report: TICK-09 (Cross-Session Deduplication)

### Community 58 - "Implementation Report: TICK-07 (Recipient Modal Pagination)"
Cohesion: 0.50
Nodes (3): 1. Summary of Changes, 2. Test Execution, Implementation Report: TICK-07 (Recipient Modal Pagination)

### Community 59 - "Implementation Report: TICK-02 / TICK-08 / TICK-11 (SMTP Resilience, Strict TLS & Delay Jitter)"
Cohesion: 0.50
Nodes (3): 1. Summary of Changes, 2. Test Execution, Implementation Report: TICK-02 / TICK-08 / TICK-11 (SMTP Resilience, Strict TLS & Delay Jitter)

### Community 60 - "Detailed Audit Findings"
Cohesion: 0.20
Nodes (9): Application Security Audit Report — Cycle 1, Detailed Audit Findings, Executive Summary, SEC-01: Runtime Bug & Undefined Symbol in Copilot AI Dispatch, SEC-02: Cryptographic Bypass & Plaintext Fallback in `decrypt()`, SEC-04: SMTP TLS Certificate Verification Disabled (`rejectUnauthorized: false`), SEC-05: Missing Rate Limiting on Public Express Routes, SEC-06: High Severity Vulnerabilities in Direct Dependencies (`xlsx` & `nodemailer`) (+1 more)

### Community 73 - "getPublicConfig"
Cohesion: 0.27
Nodes (13): 1. Objective & Scope, 2. Implementation Details, 3. Verification & Guardrail Adherence, Implementation Report: TICK-03 Comprehensive Subsystem Tests, deleteSmtpProfile(), getPublicConfig(), readConfigFile(), saveConfigFile() (+5 more)

### Community 74 - "decrypt"
Cohesion: 0.33
Nodes (6): 3.4 Security & Cryptographic Storage (`crypto.js`, `storageService.js`), 1. Summary of Changes, 2. Test Execution, Implementation Report: TICK-04 (Crypto Fail-Closed & Hardening), getDecryptedConfig(), decrypt()

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
- **495 isolated node(s):** `graphify`, `Usage`, `What graphify is for`, `Step 0 - GitHub repos and multi-path merge (only if a URL or several paths)`, `Step 1 - Ensure graphify is installed` (+490 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 571 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `api.js`, `client/package.json`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `3. Subsystem Deep Dives` connect `JDMail — Comprehensive Architecture Map & Technical Specification` to `decrypt`, `test_sheet_parser_full.js`, `3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `auditDraftClaims()` connect `auditDraftClaims` to `test_e2e_suite.js`, `App.jsx`, `Full End-of-Cycle QA Report: Cycle 1`, `Dimension Scorecard`, `test_e2e_pipeline.js`, `3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)`, `aiService.js`, `runServerE2eSuite`, `2. Detailed Ticket-by-Ticket Diff Review`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `graphify`, `Usage`, `What graphify is for` to the rest of the system?**
  _495 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08711433756805807 - nodes in this community are weakly interconnected._
- **Should `test_graphify_integration.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06464646464646465 - nodes in this community are weakly interconnected._