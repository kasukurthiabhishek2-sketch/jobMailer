---
title: React SPA (App)
summary: Main React single-page application entry and component tree
updated: 2026-09-29
tags: [module]
paths: [client/src/**]
---
## Purpose
Single-page React 19 application built with Vite. Orchestrates the 5-step outreach workflow UI: configure providers → upload resume/recipients → generate emails → review/approve → send with SSE tracking.

## Public surface
`App()`, `authFetch()`, component tree in `client/src/components/`

## Invariants / contracts
- `authFetch()` is the sole HTTP client for backend calls (god node, 26 edges).
- All state is local React state (no Redux/Zustand).

## Gotchas
- `App()` is a god node (20 edges) — large component, potential split target.
- `AiProvidersTab()` is also a god node (18 edges).

## Decisions
TODO(human)
