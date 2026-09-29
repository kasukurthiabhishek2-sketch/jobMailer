# test_sheet_parser_full.js

> 54 nodes · cohesion 0.06

## Key Concepts

- **test_sheet_parser_full.js** (32 connections) — `server/test_sheet_parser_full.js`
- **sheetParser.js** (20 connections) — `server/services/sheetParser.js`
- **parseRecipientSheet()** (19 connections) — `server/services/sheetParser.js`
- **test_cross_session_dedup.js** (14 connections) — `server/test_cross_session_dedup.js`
- **test_ephemeral_uploads.js** (12 connections) — `server/test_ephemeral_uploads.js`
- **3.2 Smart Recipient & Spreadsheet Engine (`sheetParser.js`)** (6 connections) — `ARCHITECTURE.md`
- **extractEmail()** (6 connections) — `server/services/sheetParser.js`
- **analyzeHeaders()** (5 connections) — `server/services/sheetParser.js`
- **detectHeaderRowIndex()** (5 connections) — `server/services/sheetParser.js`
- **extractNameFromEmailCell()** (5 connections) — `server/services/sheetParser.js`
- **xlsx** (4 connections) — `server/package.json`
- **cleanPersonName()** (4 connections) — `server/services/sheetParser.js`
- **findBestSheetName()** (4 connections) — `server/services/sheetParser.js`
- **looksLikePersonName()** (4 connections) — `server/services/sheetParser.js`
- **normalizeHeader()** (4 connections) — `server/services/sheetParser.js`
- **validateEmail()** (4 connections) — `server/services/sheetParser.js`
- **runTests()** (2 connections) — `server/test_cross_session_dedup.js`
- **runTests()** (2 connections) — `server/test_ephemeral_uploads.js`
- **path** (1 connections) — `server/services/sheetParser.js`
- **xlsx** (1 connections) — `server/services/sheetParser.js`
- **assert** (1 connections) — `server/test_cross_session_dedup.js`
- **fs** (1 connections) — `server/test_cross_session_dedup.js`
- **{ parseRecipientSheet }** (1 connections) — `server/test_cross_session_dedup.js`
- **path** (1 connections) — `server/test_cross_session_dedup.js`
- **storage** (1 connections) — `server/test_cross_session_dedup.js`
- *... and 29 more nodes in this community*

## Relationships

- [ref_path](ref_path.md) (4 shared connections)
- [ref_assert](ref_assert.md) (3 shared connections)
- [ref_fs](ref_fs.md) (3 shared connections)
- [index.js](index.js.md) (2 shared connections)
- [test_e2e_pipeline.js](test_e2e_pipeline.js.md) (2 shared connections)
- [test_e2e_suite.js](test_e2e_suite.js.md) (2 shared connections)
- [decrypt](decrypt.md) (2 shared connections)
- [storageService.js](storageService.js.md) (2 shared connections)
- [3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)](3.1_Multi-Provider_AI_Studio_`aiService.js`,_`copilotService.js`.md) (1 shared connections)
- [callCopilotChat](callCopilotChat.md) (1 shared connections)
- [server/package.json](server-package.json.md) (1 shared connections)
- [7. Agent Onboarding & Modification Cheatsheet](7._Agent_Onboarding_&_Modification_Cheatsheet.md) (1 shared connections)

## Source Files

- `ARCHITECTURE.md`
- `server/package.json`
- `server/services/sheetParser.js`
- `server/test_cross_session_dedup.js`
- `server/test_ephemeral_uploads.js`
- `server/test_sheet_parser_full.js`

## Audit Trail

- EXTRACTED: 95 (90%)
- INFERRED: 11 (10%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*