---
title: Crypto Utils
summary: AES-256-GCM encrypt/decrypt for secret fields
updated: 2026-09-29
tags: [module]
paths: [server/utils/crypto.js]
---
## Purpose
Provides encrypt/decrypt functions using AES-256-GCM. The secret key is stored outside the repo (`server/data/.secret_key`, gitignored).

## Public surface
`encrypt()`, `decrypt()`, `getOrCreateKey()`

## Invariants / contracts
- Uses AES-256-GCM with random IV per encryption.
- Key never committed to version control.

## Gotchas
- Key loss = data loss (encrypted config unrecoverable).

## Decisions
TODO(human)
