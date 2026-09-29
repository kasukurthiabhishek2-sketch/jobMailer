---
title: Copilot Service
summary: GitHub Copilot OAuth device flow authentication (RFC 8628)
updated: 2026-09-29
tags: [module]
paths: [server/services/copilotService.js]
---
## Purpose
Implements the GitHub Copilot device authorization flow per RFC 8628. Manages token acquisition, refresh, and model listing for the Copilot AI provider.

## Public surface
`startDeviceFlow()`, `pollForToken()`, `listModels()`, `generateWithCopilot()`

## Invariants / contracts
- Tokens stored encrypted via storageService.
- Device flow requires user interaction (browser-based authorization).

## Gotchas
- Polling interval and expiry are server-dictated; must respect `interval` from the device code response.

## Decisions
TODO(human)
