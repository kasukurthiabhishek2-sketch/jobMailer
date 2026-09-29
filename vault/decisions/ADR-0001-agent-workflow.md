---
title: ADR-0001 Agent Workflow
summary: Bootstrap decision — graph is code map, vault holds intent and state, CLI-only graphify
status: accepted
updated: 2026-09-29
tags: [adr]
---
## Context
Multiple coding agents (Claude Code, Codex, Gemini CLI, Cursor, Copilot) need to work on JDMail in parallel or relay. Cold-start context must be minimal. State must survive agent death.

## Decision
- The graphify knowledge graph (code-only, CLI-only, AST extraction) is the code map. No LLM extraction.
- The vault (`vault/`) holds intent, decisions, and task state as plain Markdown.
- Platform-specific hooks (`.claude/`, `.cursor/`) are NOT installed to avoid token cost; pointer files redirect to AGENTS.md.
- Checkpoints are written ahead (before potential death), not after.
- Tasks use directory-based leases (`vault/tasks/.locks/`) with heartbeat expiry.

## Alternatives rejected
- Full LLM graph extraction: ongoing API cost, non-deterministic, unnecessary for a ~250 file codebase.
- Platform-native task systems: not portable across agent tools.
- Database-backed coordination: overkill; filesystem atomicity (mkdir) suffices.

## Consequences
- Every fresh clone or worktree must run `graphify hook install` and `graphify extract . --code-only` once.
- Agents must checkpoint at least every 20 minutes and before risky operations.
- `graphify-out/` is gitignored: derived, deterministic, free to rebuild.
