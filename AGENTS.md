# AGENTS.md
<!-- Loaded every session: every line costs tokens. Keep <= 150 lines. Depth lives in vault/playbooks/ (read on demand). -->

## Project facts
- Goal: AI-powered cold email outreach platform for job seekers — resume+JD pairing, multi-provider email generation, SMTP dispatch with SSE tracking.
- Stack: Node.js 18+ / Express 4 (server), React 19 / Vite 8 (client), AES-256-GCM encryption, JSON flat-file storage
- Commands: fast-test `cd server && npm test` | full-test `cd server && npm test` | lint `cd client && npm run lint` | run `npm run dev`
- av (task/vault helper): `python3 scripts/av` (below, `av <cmd>` means this)
- Search: `grep -rn --exclude-dir=graphify-out --exclude-dir=node_modules --exclude-dir=vault/_graph -m 20 "<pat>" <dir>`. Read files by line range, never whole.
- Vault: `vault/` (Obsidian, plain Markdown). Graph: `graphify-out/` (local, gitignored, code only).

## 0. Prime directives
1. Tokens are the scarcest resource: retrieve the minimum, edit the minimum, write the minimum.
2. You can die at any moment (context or quota). State lives in files and git, never only in your head.
3. Graph = what the code IS (derived, free). Vault = what we DECIDED and what is IN PROGRESS (curated). Never copy one into the other.
4. Section 3 overrides your habits. If a rule blocks a good result, say so in one line and ask.
5. Secrets never go in code, vault, logs or checkpoints.

## 0.5 Non-negotiable guardrails
- **Never break existing functionality.** `cd server && npm test` and `cd client && npm run lint` must pass before and after every change.
- Native `fetch()` only for AI providers — no OpenAI/Google SDKs.
- Secrets (`apiKey`, SMTP `password`) AES-256-GCM encrypted at rest, **never** returned unmasked from `/api/*`.
- Two-stage human-in-the-loop send gate (`isApproved` + explicit "Send Approved Emails") never bypassed.
- CORS origin matching normalizes trailing slashes (W3C Origin spec).
- `config.json` / `logs.json` schemas backward-compatible, or ship migration + version bump.
- Every code change ships with a test. One backlog item per branch (`agent/<id>`). Read `ARCHITECTURE.md` and `README.md` before touching code.

## 1. Orient (cold start <= 4k tokens; stop as soon as you know enough)
1. `av board` (<= 30 lines). Resuming? `av handoff T-xxxx` prints the resume packet: trust it, don't re-explore.
2. `git status -s` and `git log --oneline -8`.
3. `graphify hook status || graphify hook install`. If `graphify-out/graph.json` is missing: `graphify extract . --code-only`.
4. Read only what your task needs (section 2). Never read: whole GRAPH_REPORT.md, graph.json, vault/_graph/, lockfiles, generated or minified files, whole directory trees. Read log.md with `tail -20` only.

## 2. Before / after every change (scaled by tier)
- T0 trivial (typo, comment, <= 3 lines, no signature change): no pre-check. After: commit + `av log "T-x fix: ..."`.
- T1 normal (inside one module, contracts unchanged):
  - BEFORE: `graphify affected "<symbol>"` + `grep -rn "<symbol>"`. Skim `vault/architecture/modules/<m>.md`.
  - AFTER: run tests (quiet), `graphify update .`, update module note if purpose/invariants/gotchas changed, `av log`, checkpoint, commit.
- T2 structural (new module/dependency; public API, contract or schema change; cross-module):
  - BEFORE: `graphify query "<area>" --budget 1200`, `affected`, module notes, ADRs. Write PLAN in task file.
  - AFTER: as T1, plus ADR required; update overview if module map changed; re-run `affected` on changed public symbols.
- After edits: `graphify update .` (AST only, free). Deleted/renamed files: `graphify update . --force`.
- Always finish with `av index && av lint`.

## 3. Coding rules
1. Think before coding. State assumptions. Ambiguous? List readings (<= 3 lines) and ask, or choose simplest.
2. Simplicity first. Least code that solves the stated problem. No speculative features or one-use abstractions.
3. Surgical changes. Every changed line traces to the task. Match local style. Don't refactor neighbours.
4. Goal-driven execution. Verifiable checks before coding. Loop until they pass. Report evidence.
5. Anti-slop: hunt for unused imports/vars/functions, restating comments, empty catches, pass-through wrappers, redundant null checks, leftover TODOs.

## 4. Token discipline
- Search first, read ranges. Edit with targeted replacements. Quiet commands: `| tail -40`.
- Graph tools: `affected "X"`, `path "A" "B"`, `explain "X"`, `query "..." --budget 1200`. At most 2 graph calls in a row.
- Never run LLM graph extraction. Two failed attempts at same fix: stop, write dead end, ask or hand off.
- Budgets: orient <= 4k | checkpoint <= 200 tokens | module note <= 60 lines | ADR <= 30 | task file <= 100 | index <= 150.
- Context: checkpoint every 10 tool calls and before anything long or risky.

## 5. Handoff-ready at all times
- After every completed step: overwrite `## Checkpoint` (<= 25 lines), `av beat T-xxxx`, `git commit -am "wip(T-xxxx): <step>"`.
- Test: an agent reading only this file + the task file can continue without asking.

## 6. Multi-agent protocol
- One file per task in `vault/tasks/`. Status: todo → in_progress → review → done (or blocked).
- Identity: `<tool>-<model>-<4hex>`. `av claim T-xxxx <id>` is atomic (mkdir-based lease, 45 min default).
- Workspace: one branch per task `agent/T-xxxx`. Parallel: `git worktree add`, then `graphify hook install`.
- Scope: edit only files under the task's `scope`. Need outside? `av new` a task.
- Takeover: only after lease expired. `av handoff`, then `av takeover`.
- Size: <= 40% of one context (<=5 files, <=150 changed lines). Bigger: split first.
- Merge: rebase, tests green, `graphify update .`, `av index && av lint`, fast-forward. See `vault/playbooks/merge-and-release.md`.

## 7. Vault contract
- Layout: `index.md` (generated) | `log.md` (append-only) | `lessons.md` | `product/brief.md` | `architecture/{overview,modules/*}` | `decisions/ADR-*` | `tasks/` | `playbooks/` | `_templates/`.
- Every note: frontmatter `title`, `summary` (<= 120 chars), `updated`, `tags`; `[[wikilinks]]`; <= 80 lines.
- Notes hold only what the graph can't: purpose, invariants, gotchas, decisions, why.

## 8. Code layout (NEW code only)
- Files <= ~300 lines, functions <= ~50; one responsibility per module; explicit public surface.
- Unique, greppable names; one-line docstring + type hints on public functions.
- Tests mirror source paths. Generated/build output gitignored and in `.graphifyignore`.

## 9. Done means
Acceptance checks pass (quote command + result) | diff only within scope | `graphify update .` | vault deltas + log + checkpoint | `av index && av lint` clean | committed as `T-xxxx: <what/why>` | `av done T-xxxx --status review` | one-line report.
