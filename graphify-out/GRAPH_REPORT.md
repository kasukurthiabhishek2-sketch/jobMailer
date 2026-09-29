# Graph Report - JDMail  (2026-09-30)

## Corpus Check
- 134 files · ~124,163 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .rules 2, .css 1)

## Summary
- 903 nodes · 1667 edges · 73 communities (47 shown, 26 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 85 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d6387a53`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- api.js
- test_graphify_integration.js
- react
- test_sheet_parser_full.js
- client/package.json
- test_jd_parser.js
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
- test_sample_resume_and_ai_keys.js
- aiService.js
- av
- Q: do a deep analysis of the project and find the improvements and additional features and create a detailed plan
- crypto.js
- users_manu19_desktop_jdmail_server_services_aiservice_cleanjsonoutput
- users_manu19_desktop_jdmail_server_services_aiservice_generatecoldemail
- users_manu19_desktop_jdmail_server_services_aiservice_listprovidermodels
- users_manu19_desktop_jdmail_server_services_aiservice_parsejobdescription
- users_manu19_desktop_jdmail_server_services_aiservice_testaiconnection
- tier2_boundary_adversarial.test.jsx
- copilotService.js
- test_e2e_suite.js
- firebaseAdmin.js
- test_e2e_pipeline.js
- ref_assert
- test_custom_prompts.js
- JDMail — Comprehensive Architecture Map & Technical Specification
- What You Must Do When Invoked
- scripts
- sanitizeDraft.test.js
- AGENTS.md
- Hybrid Deployment Guide (Vercel + Render)
- CLAUDE.md
- GEMINI.md
- graphify reference: extra exports and benchmark
- React + Vite
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- rules/graphify.md
- extraction-spec.md
- workflows/graphify.md

## God Nodes (most connected - your core abstractions)
1. `react` - 39 edges
2. `authFetch()` - 37 edges
3. `cleanJsonOutput()` - 21 edges
4. `lucide-react` - 21 edges
5. `vitest` - 21 edges
6. `AiProvidersTab()` - 19 edges
7. `App()` - 18 edges
8. `parseRecipientSheet()` - 18 edges
9. `@testing-library/react` - 18 edges
10. `parseJsonResponse()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `4-Worker Concurrent Batch Generation Pipeline` --references--> `batchGenerateColdEmails()`  [INFERRED]
  ARCHITECTURE.md → client/src/services/api.js
- `Parsing & Markdown Sanitization (`cleanJsonOutput`)` --references--> `cleanJsonOutput()`  [INFERRED]
  ARCHITECTURE.md → server/services/aiService.js
- `How to Add a New AI Provider` --references--> `callOpenAiCompatible()`  [INFERRED]
  ARCHITECTURE.md → server/services/aiService.js
- `Verifiable Fact-Grounding Guardrail (`auditDraftClaims`)` --references--> `auditDraftClaims()`  [INFERRED]
  ARCHITECTURE.md → server/services/aiService.js
- `3.5 SMTP Delivery & Anti-Spam Throttler (`smtpService.js`, SSE Stream)` --references--> `classifySmtpError()`  [INFERRED]
  ARCHITECTURE.md → server/services/smtpService.js

## Import Cycles
- 2-file cycle: `server/services/aiService.js -> server/services/copilotService.js -> server/services/aiService.js`

## Communities (73 total, 26 thin omitted)

### Community 0 - "api.js"
Cohesion: 0.09
Nodes (55): EmailPreview(), SPAM_TRIGGER_WORDS, TONE_OPTIONS, AiProvidersTab(), formatTimeAgo(), FRIENDLY_MODEL_NAMES, friendlyModelName(), getProviderSavedKeys() (+47 more)

### Community 1 - "test_graphify_integration.js"
Cohesion: 0.10
Nodes (20): agentsMd, assert, claudeMd, { execSync, spawnSync }, expectedSymbolsOrFiles, fs, geminiMd, graphHtmlPath (+12 more)

### Community 2 - "react"
Cohesion: 0.07
Nodes (49): App(), AiJdParserPanel(), AuthGate(), ErrorBoundary, Header(), JobDescriptionInput(), SAMPLE_JDS, RecipientManager() (+41 more)

### Community 3 - "test_sheet_parser_full.js"
Cohesion: 0.06
Nodes (51): 3.2 Smart Recipient & Spreadsheet Engine (`sheetParser.js`), xlsx, analyzeHeaders(), cleanPersonName(), detectHeaderRowIndex(), extractEmail(), extractNameFromEmailCell(), findBestSheetName() (+43 more)

### Community 4 - "client/package.json"
Cohesion: 0.07
Nodes (28): dependencies, firebase, lucide-react, react, react-dom, devDependencies, jsdom, oxlint (+20 more)

### Community 5 - "test_jd_parser.js"
Cohesion: 0.33
Nodes (7): extractTextFromHtml(), extractTitle(), fetchUrlAsText(), validateUrl(), assert, { parseJobDescription }, { validateUrl, extractTextFromHtml, extractTitle }

### Community 6 - "index.js"
Cohesion: 0.05
Nodes (31): aiLimiter, app, copilotService, cors, express, { fetchUrlAsText }, fs, { generateColdEmail, parseJobDescription, testAiConnection, listProviderModels, cleanJsonOutput } (+23 more)

### Community 7 - "storageService.js"
Cohesion: 0.13
Nodes (33): 3.4 Security & Cryptographic Storage (`crypto.js`, `storageService.js`), addCampaignLogs(), clearCampaignLogs(), CONFIG_FILE, DATA_DIR, DEFAULT_CONFIG, deleteSmtpProfile(), { encrypt, decrypt, maskApiKey, maskPassword } (+25 more)

### Community 8 - "test_security_guardrails.js"
Cohesion: 0.20
Nodes (9): isOriginAllowed(), assert, copilotService, { isOriginAllowed }, RFC-1918, path, { requireAuth }, runTests() (+1 more)

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

### Community 24 - "test_sample_resume_and_ai_keys.js"
Cohesion: 0.06
Nodes (36): listProviderModels(), testAiConnection(), assert, runTests(), { testAiConnection, listProviderModels }, assert, copilotService, fs (+28 more)

### Community 25 - "aiService.js"
Cohesion: 0.20
Nodes (16): RFC-1918, RFC-8259, cleanJsonOutput(), copilotService, dispatchToProvider(), extractFieldsViaRegex(), extractPlainTextFallback(), normalizeControlCharacters() (+8 more)

### Community 26 - "av"
Cohesion: 0.13
Nodes (31): AI-Slop Checklist (Review Before Committing), Codebase Debloat & Anti-Slop Rules, Core Rules, Non-Negotiable Guardrails, argparse, datetime, glob, os (+23 more)

### Community 27 - "Q: do a deep analysis of the project and find the improvements and additional features and create a detailed plan"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: do a deep analysis of the project and find the improvements and additional features and create a detailed plan, Source Nodes

### Community 28 - "crypto.js"
Cohesion: 0.16
Nodes (15): ref_crypto, assert, { encrypt, decrypt, maskApiKey, maskPassword }, runTests(), runE2ePipelineTests(), runServerE2eSuite(), crypto, DATA_DIR (+7 more)

### Community 35 - "tier2_boundary_adversarial.test.jsx"
Cohesion: 0.22
Nodes (11): RFC-5321, auditDraftClaims(), buildPrompts(), generateColdEmail(), assert, {
  auditDraftClaims,
  buildPrompts,
  cleanJsonOutput,
  generateColdEmail
}, runTests(), assert (+3 more)

### Community 36 - "copilotService.js"
Cohesion: 0.23
Nodes (9): checkDeviceStatus(), clearPendingDeviceFlow(), clearSessionCache(), defaultCache, getCopilotSessionToken(), getSessionCache(), RFC-8628, testCopilotConnection() (+1 more)

### Community 37 - "test_e2e_suite.js"
Cohesion: 0.18
Nodes (10): assert, { classifySmtpError }, { cleanJsonOutput, buildPrompts, auditDraftClaims }, { encrypt, decrypt, maskApiKey, maskPassword }, fs, RFC-5321, RFC-8628, { parseRecipientSheet } (+2 more)

### Community 38 - "firebaseAdmin.js"
Cohesion: 0.25
Nodes (7): firebase-admin, admin, fs, path, requireAuth(), SERVICE_ACCOUNT_PATH, verifyIdToken()

### Community 39 - "test_e2e_pipeline.js"
Cohesion: 0.22
Nodes (8): assert, { classifySmtpError }, { cleanJsonOutput, buildPrompts, auditDraftClaims }, { encrypt, decrypt, maskApiKey, maskPassword }, fs, RFC-5321, { parseRecipientSheet }, path

### Community 40 - "ref_assert"
Cohesion: 0.36
Nodes (7): HTTP 429 Exponential Backoff & Retry Handling, ref_assert, callGemini(), callOpenAiCompatible(), assert, { callGemini, callOpenAiCompatible }, runTests()

### Community 41 - "test_custom_prompts.js"
Cohesion: 0.29
Nodes (6): assert, { buildPrompts }, fs, path, runTests(), storage

### Community 42 - "JDMail — Comprehensive Architecture Map & Technical Specification"
Cohesion: 0.05
Nodes (39): 10.1 Graph Artifacts (`graphify-out/`), 10.2 Agent Protocols & Invariants, 10. Graphify Knowledge Graph & Multi-Agent Architecture, 1. System Overview & Architectural Principles, 2.1 High-Level Component Topology, 2.2 End-to-End Outreach Pipeline, 2.3 Spreadsheet Ingestion & Heuristic Extraction Pipeline, 2.4 GitHub Copilot Device Flow Authentication (RFC 8628) (+31 more)

### Community 43 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 44 - "scripts"
Cohesion: 0.50
Nodes (4): scripts, dev, start, test

### Community 46 - "AGENTS.md"
Cohesion: 0.13
Nodes (13): 0.5 Non-negotiable guardrails, 0. Prime directives, 1. Orient (cold start <= 4k tokens; stop as soon as you know enough), 2. Before / after every change (scaled by tier), 3. Coding rules, 4. Token discipline, 5. Handoff-ready at all times, 6. Multi-agent protocol (+5 more)

### Community 47 - "Hybrid Deployment Guide (Vercel + Render)"
Cohesion: 0.18
Nodes (10): 1. Architecture Topology, 2. CORS & Origin Normalization Pitfalls, 3. Environment Variable Invariants, 4. MCP Servers Configuration, 5. Verification Commands, Failure Symptom:, Hybrid Deployment Guide (Vercel + Render), Managing in Antigravity IDE: (+2 more)

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
- **437 isolated node(s):** `TONE_OPTIONS`, `SPAM_TRIGGER_WORDS`, `SETTINGS_TABS`, `PROVIDER_DEFAULT_MODELS`, `PROVIDER_CONFIG` (+432 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 524 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `api.js`, `tier2_boundary_adversarial.test.jsx`, `client/package.json`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `3. Subsystem Deep Dives` connect `JDMail — Comprehensive Architecture Map & Technical Specification` to `test_sheet_parser_full.js`, `storageService.js`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `TONE_OPTIONS`, `SPAM_TRIGGER_WORDS`, `SETTINGS_TABS` to the rest of the system?**
  _437 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08683853459972862 - nodes in this community are weakly interconnected._
- **Should `test_graphify_integration.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.06642246642246642 - nodes in this community are weakly interconnected._
- **Should `test_sheet_parser_full.js` be split into smaller, more focused modules?**
  _Cohesion score 0.055218855218855216 - nodes in this community are weakly interconnected._