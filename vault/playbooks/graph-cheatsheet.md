---
title: Graph Cheatsheet
summary: Quick reference for graphify CLI commands and their behaviour
updated: 2026-09-29
tags: [playbook]
---
# Graph Cheatsheet

## Verified commands
| Command | When |
|---------|------|
| `graphify extract . --code-only` | First build (AST only, free) |
| `graphify update .` | After edits (incremental, AST only) |
| `graphify update . --force` | After deletes/renames (removes stale nodes) |
| `graphify query "..." --budget N [--dfs]` | Area overview (add `--dfs` to follow chains) |
| `graphify affected "X" [--depth N]` | What breaks if I change X |
| `graphify path "A" "B"` | How A and B connect |
| `graphify explain "X"` | What is X |
| `graphify god-nodes --top N` | Onboarding only: most-connected symbols |
| `graphify hook status\|install` | Check or install git hooks |

## Output shape
NODE and EDGE lines with `file:line`. `EXTRACTED` = fact (static analysis). `INFERRED` = hint.

## When it lies
Static analysis misses: reflection, DI, string-keyed dispatch, config wiring. Empty result ≠ safe — corroborate with `grep -rn`.

## Budget behaviour
Output cut at `--budget`; refine the question once, then fall back to `grep -rn`.

## Never run
`extract` without `--code-only`, `label`, `--mode deep`, `/graphify`.
