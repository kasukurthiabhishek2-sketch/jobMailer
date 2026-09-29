---
title: Vault Maintenance
summary: Periodic cleanup of tasks, logs, lessons, and notes
updated: 2026-09-29
tags: [playbook]
---
# Vault Maintenance

Run every ~10 finished tasks:

1. Move `done` tasks to `vault/tasks/_archive/`.
2. Keep the last ~200 lines of `log.md`; move older lines to `log-archive-YYYY-MM.md`.
3. Prune `lessons.md` to 100 lines or fewer:
   - Merge duplicates.
   - Promote mature lessons into module notes or AGENTS.md (only if they're rules for everyone).
4. Split any note over 80 lines.
5. `av lint` — fix all errors.
6. `av index` — regenerate the index.
