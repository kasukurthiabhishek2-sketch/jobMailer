---
title: Merge and Release
summary: How to merge a completed task branch back to main
updated: 2026-09-29
tags: [playbook]
---
# Merge and Release

1. Task is in `review` with tests green.
2. Rebase `agent/<id>` onto main.
3. Conflicts:
   - Code: resolve minimally.
   - `vault/index.md`: run `av index` (it's generated).
   - `vault/log.md`: union-merged via `.gitattributes`; check for duplicate lines.
   - Task files: keep the owner's version.
4. `graphify update .`, then full test and lint:
   - `cd server && npm test`
   - `cd client && npm run lint`
5. Fast-forward merge (or PR). Remove the branch and worktree (`git worktree remove`).
6. `av done <id> --status done`, `av log "T-xxxx merged: <what>"`.
7. T2 tasks: confirm the reviewer checked the ADR and overview updates.
