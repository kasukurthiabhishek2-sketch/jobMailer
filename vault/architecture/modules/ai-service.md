---
title: AI Service
summary: Multi-provider AI email generation via native fetch()
updated: 2026-09-29
tags: [module]
paths: [server/services/aiService.js]
---
## Purpose
Dispatches email generation prompts to multiple AI providers (Gemini, OpenAI, Groq, Grok/xAI, NVIDIA NIM, Custom) using native `fetch()`. Handles retry logic, JSON recovery from malformed responses, and provider-specific API formats.

## Public surface
`generateEmail()`, `cleanJsonOutput()`, `buildPrompt()`

## Invariants / contracts
- Native `fetch()` only — no SDK imports.
- Returns structured JSON (subject, body) or throws.
- Provider API keys are never logged or returned in responses.

## Gotchas
- `cleanJsonOutput()` is a god node (22 edges) — changes ripple widely.
- JSON recovery handles markdown-wrapped responses from some providers.

## Decisions
TODO(human)
