# Graph Report - JDMail  (2026-09-30)

## Corpus Check
- 137 files · ~130,663 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .rules 2, .css 1)

## Summary
- 938 nodes · 1760 edges · 82 communities (43 shown, 39 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 98 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c7e1c9a2`
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
- ref_assert
- JDMail — AI-Powered Cold Outreach Suite for Job Applications
- test_runner_all.js
- .oxlintrc.json
- ref_path
- test_danger_zone.js
- urlScraper.js
- test_storage.js
- test_sample_resume_and_ai_keys.js
- aiService.js
- av
- jdSchemaValidator.js
- 3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)
- errorTaxonomy.js
- users_manu19_desktop_jdmail_server_services_aiservice_cleanjsonoutput
- users_manu19_desktop_jdmail_server_services_aiservice_generatecoldemail
- users_manu19_desktop_jdmail_server_services_aiservice_listprovidermodels
- users_manu19_desktop_jdmail_server_services_aiservice_parsejobdescription
- users_manu19_desktop_jdmail_server_services_aiservice_testaiconnection
- copilotService.js
- users_manu19_desktop_jdmail_server_services_firebaseadmin_requireauth
- users_manu19_desktop_jdmail_server_services_resumeparser_parseresumefile
- users_manu19_desktop_jdmail_server_services_sheetparser_parserecipientsheet
- callOpenAiCompatible
- test_custom_prompts.js
- JDMail — Comprehensive Architecture Map & Technical Specification
- What You Must Do When Invoked
- users_manu19_desktop_jdmail_server_services_smtpservice_classifysmtperror
- sanitizeDraft.test.js
- AGENTS.md
- Hybrid Deployment Guide (Vercel + Render)
- CLAUDE.md
- GEMINI.md
- users_manu19_desktop_jdmail_server_services_smtpservice_dispatchcampaign
- users_manu19_desktop_jdmail_server_services_smtpservice_sendemailmessage
- graphify reference: extra exports and benchmark
- users_manu19_desktop_jdmail_server_services_smtpservice_sendemailmessagewithretry
- users_manu19_desktop_jdmail_server_services_smtpservice_testsmtpconnection
- React + Vite
- users_manu19_desktop_jdmail_server_services_urlscraper_fetchurlastext
- users_manu19_desktop_jdmail_server_utils_crypto_decrypt
- users_manu19_desktop_jdmail_server_utils_crypto_encrypt
- users_manu19_desktop_jdmail_server_utils_crypto_maskapikey
- users_manu19_desktop_jdmail_server_utils_crypto_maskpassword
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
1. `react` - 40 edges
2. `authFetch()` - 37 edges
3. `vitest` - 22 edges
4. `lucide-react` - 21 edges
5. `cleanJsonOutput()` - 21 edges
6. `@testing-library/react` - 19 edges
7. `AiProvidersTab()` - 19 edges
8. `parseRecipientSheet()` - 19 edges
9. `App()` - 18 edges
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
- `How to Add New Sheet Parsing Heuristics` --references--> `analyzeHeaders()`  [INFERRED]
  ARCHITECTURE.md → server/services/sheetParser.js

## Import Cycles
- 2-file cycle: `server/services/aiService.js -> server/services/copilotService.js -> server/services/aiService.js`

## Communities (82 total, 39 thin omitted)

### Community 0 - "api.js"
Cohesion: 0.09
Nodes (53): EmailPreview(), SPAM_TRIGGER_WORDS, TONE_OPTIONS, AiProvidersTab(), formatTimeAgo(), FRIENDLY_MODEL_NAMES, friendlyModelName(), getProviderSavedKeys() (+45 more)

### Community 1 - "test_graphify_integration.js"
Cohesion: 0.10
Nodes (20): agentsMd, assert, claudeMd, { execSync, spawnSync }, expectedSymbolsOrFiles, fs, geminiMd, graphHtmlPath (+12 more)

### Community 2 - "react"
Cohesion: 0.06
Nodes (56): 3.3 Resume Extraction Engine (`resumeParser.js`), 3.5 SMTP Delivery & Anti-Spam Throttler (`smtpService.js`, SSE Stream), 3.6 Frontend Reactive Architecture (`App.jsx`, `api.js`, CSS Tokens), 3. Subsystem Deep Dives, App(), AiJdParserPanel(), AuthGate(), ErrorBoundary (+48 more)

### Community 3 - "test_sheet_parser_full.js"
Cohesion: 0.06
Nodes (50): 3.2 Smart Recipient & Spreadsheet Engine (`sheetParser.js`), xlsx, analyzeHeaders(), cleanPersonName(), detectHeaderRowIndex(), extractEmail(), extractNameFromEmailCell(), findBestSheetName() (+42 more)

### Community 4 - "client/package.json"
Cohesion: 0.07
Nodes (28): dependencies, firebase, lucide-react, react, react-dom, devDependencies, jsdom, oxlint (+20 more)

### Community 5 - "test_jd_parser.js"
Cohesion: 0.15
Nodes (13): dispatchToProvider(), parseJobDescription(), assert, { ERROR_CODES, ParsingError, generateRequestId }, { extractJsonObject }, { isPrivateOrRestrictedIp, extractJsonLdJobPosting, detectContentBarriers }, { parseJobDescription }, { validateAndNormalizeJd, isValidEmail } (+5 more)

### Community 6 - "index.js"
Cohesion: 0.07
Nodes (24): aiLimiter, app, copilotService, cors, { ERROR_CODES, STAGES, ParsingError, generateRequestId }, express, { fetchUrlAsText }, fs (+16 more)

### Community 7 - "storageService.js"
Cohesion: 0.06
Nodes (67): 3.4 Security & Cryptographic Storage (`crypto.js`, `storageService.js`), auditDraftClaims(), buildPrompts(), generateColdEmail(), addCampaignLogs(), clearCampaignLogs(), CONFIG_FILE, DATA_DIR (+59 more)

### Community 8 - "test_security_guardrails.js"
Cohesion: 0.12
Nodes (17): firebase-admin, isOriginAllowed(), validateCustomBaseUrl(), admin, fs, path, requireAuth(), SERVICE_ACCOUNT_PATH (+9 more)

### Community 9 - "test_firebase_migration.js"
Cohesion: 0.11
Nodes (17): assert, checkNoLocalStorageCredentials(), clientSrcDir, decrypted, firestoreDoc, fs, path, payloadWithUndefined (+9 more)

### Community 10 - "smtpService.js"
Cohesion: 0.17
Nodes (21): nodemailer, classifySmtpError(), createTransporter(), dispatchCampaign(), worker(), extractSmtpCode(), fs, RFC-5321 (+13 more)

### Community 11 - "resumeParser.js"
Cohesion: 0.17
Nodes (14): pdf-parse, extractEmail(), extractName(), extractPhone(), fs, mammoth, parseResumeFile(), path (+6 more)

### Community 12 - "server/package.json"
Cohesion: 0.12
Nodes (16): cors, dotenv, exceljs, express, express-rate-limit, helmet, mammoth, multer (+8 more)

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
Cohesion: 0.14
Nodes (12): SCREENSHOT_DIR, ref_fs, ref_path, ref_puppeteer_core, assert, fs, path, results (+4 more)

### Community 21 - "test_danger_zone.js"
Cohesion: 0.33
Nodes (4): assert, copilotService, fs, path

### Community 22 - "urlScraper.js"
Cohesion: 0.23
Nodes (14): ref_dns, ref_net, ALLOWED_PORTS, assertPublicDnsResolution(), detectContentBarriers(), { ERROR_CODES, STAGES, ParsingError }, extractJsonLdJobPosting(), extractTextFromHtml() (+6 more)

### Community 23 - "test_storage.js"
Cohesion: 0.33
Nodes (4): assert, fs, path, storage

### Community 24 - "test_sample_resume_and_ai_keys.js"
Cohesion: 0.06
Nodes (36): listProviderModels(), testAiConnection(), assert, runTests(), { testAiConnection, listProviderModels }, assert, copilotService, fs (+28 more)

### Community 25 - "aiService.js"
Cohesion: 0.19
Nodes (15): RFC-8259, cleanJsonOutput(), copilotService, { ERROR_CODES, STAGES, ParsingError }, extractFieldsViaRegex(), { extractJsonObject }, extractPlainTextFallback(), RFC-1918 (+7 more)

### Community 26 - "av"
Cohesion: 0.13
Nodes (31): AI-Slop Checklist (Review Before Committing), Codebase Debloat & Anti-Slop Rules, Core Rules, Non-Negotiable Guardrails, argparse, datetime, glob, os (+23 more)

### Community 27 - "jdSchemaValidator.js"
Cohesion: 0.32
Nodes (7): extractHeuristicJd(), isPlaceholder(), isValidEmail(), PLACEHOLDER_STRINGS, PLATFORM_DOMAINS, SYSTEM_EMAIL_PREFIXES, validateAndNormalizeJd()

### Community 28 - "3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)"
Cohesion: 0.25
Nodes (8): 3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`), 4-Worker Concurrent Batch Generation Pipeline, Enforced JSON Contract, Intelligent Key Prefix Mismatch Detection, Parsing & Markdown Sanitization (`cleanJsonOutput`), Provider Implementations, Uniform Interface, Verifiable Fact-Grounding Guardrail (`auditDraftClaims`)

### Community 29 - "errorTaxonomy.js"
Cohesion: 0.33
Nodes (4): ref_crypto, crypto, ERROR_CODES, STAGES

### Community 36 - "copilotService.js"
Cohesion: 0.14
Nodes (15): callCopilotChat(), callCopilotChatRaw(), checkDeviceStatus(), clearPendingDeviceFlow(), clearSessionCache(), defaultCache, getCopilotSessionToken(), getSessionCache() (+7 more)

### Community 40 - "callOpenAiCompatible"
Cohesion: 0.43
Nodes (6): HTTP 429 Exponential Backoff & Retry Handling, callGemini(), callOpenAiCompatible(), assert, { callGemini, callOpenAiCompatible }, runTests()

### Community 41 - "test_custom_prompts.js"
Cohesion: 0.29
Nodes (6): assert, { buildPrompts }, fs, path, runTests(), storage

### Community 42 - "JDMail — Comprehensive Architecture Map & Technical Specification"
Cohesion: 0.07
Nodes (27): 10.1 Graph Artifacts (`graphify-out/`), 10.2 Agent Protocols & Invariants, 10. Graphify Knowledge Graph & Multi-Agent Architecture, 1. System Overview & Architectural Principles, 2.1 High-Level Component Topology, 2.2 End-to-End Outreach Pipeline, 2.3 Spreadsheet Ingestion & Heuristic Extraction Pipeline, 2.4 GitHub Copilot Device Flow Authentication (RFC 8628) (+19 more)

### Community 43 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

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
- **449 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+444 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 539 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `api.js`, `client/package.json`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `3. Subsystem Deep Dives` connect `react` to `JDMail — Comprehensive Architecture Map & Technical Specification`, `test_sheet_parser_full.js`, `3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)`, `storageService.js`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `JDMail — Comprehensive Architecture Map & Technical Specification` connect `JDMail — Comprehensive Architecture Map & Technical Specification` to `react`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _449 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08990384615384615 - nodes in this community are weakly interconnected._
- **Should `test_graphify_integration.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.06121212121212121 - nodes in this community are weakly interconnected._