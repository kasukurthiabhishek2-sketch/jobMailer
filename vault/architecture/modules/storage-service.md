---
title: Storage Service
summary: Encrypted JSON persistence for config and logs
updated: 2026-09-29
tags: [module]
paths: [server/services/storageService.js]
---
## Purpose
Reads and writes `config.json` and `logs.json`. Encrypts secrets (API keys, SMTP passwords) via AES-256-GCM before writing; decrypts on read. Handles Firebase sync when configured.

## Public surface
`loadConfig()`, `saveConfig()`, `loadLogs()`, `saveLogs()`

## Invariants / contracts
- Secrets are AES-256-GCM encrypted at rest.
- API endpoints never return unmasked secrets.
- Schemas are backward-compatible; changes require migration + version bump.

## Gotchas
- Firebase integration is optional and adds async complexity.

## Decisions
TODO(human)
