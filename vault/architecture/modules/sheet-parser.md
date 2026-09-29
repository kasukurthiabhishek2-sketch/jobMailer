---
title: Sheet Parser
summary: Excel/CSV recipient extraction with heuristic column detection
updated: 2026-09-29
tags: [module]
paths: [server/services/sheetParser.js]
---
## Purpose
Parses uploaded Excel (.xlsx) and CSV files to extract recipient data (name, email, company, role). Uses heuristic column matching to handle varied spreadsheet formats.

## Public surface
`parseRecipientSheet()`

## Invariants / contracts
- Returns array of recipient objects with at minimum `email` field.
- God node (19 edges) — heavily depended upon.

## Gotchas
- Heuristic matching can misidentify columns in unusual formats.

## Decisions
TODO(human)
