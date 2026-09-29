---
title: Takeover Playbook
summary: How to resume a stale or abandoned task from another agent
updated: 2026-09-29
tags: [playbook]
---
# Takeover Playbook

1. `av board` — find the STALE or named task.
2. `av handoff <id>` — read the resume packet (frontmatter, goal, acceptance, plan, checkpoint, recent git).
3. Run the **Verify** commands from the Checkpoint. Check `git status -s`. Confirm the baseline matches the checkpoint's claims.
4. Checkpoint empty or unclear: `git diff --stat main...agent/<id>`, reconstruct state, write a Checkpoint before coding.
5. `av takeover <id> <you>` — claims the task with a fresh lease.
6. Continue from the "Now" line in the Checkpoint.
7. Too big for your remaining budget: split with `av new`, hand the remainder back with `av release`.
