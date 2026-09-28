# Codebase Debloat & Anti-Slop Rules

Every agent modifying code in this codebase MUST adhere strictly to the following standards:

### Non-Negotiable Guardrails

- **Never break existing functionality.** `cd server && npm test` and `cd client && npm run lint` must pass before *and* after every change. A change that breaks either is reverted, not "fixed later."
- **Preserve the architecture's stated invariants** unless a task explicitly targets changing one:
  - Native `fetch()` only for AI providers — no OpenAI/Google SDKs added.
  - Secrets (`apiKey`, SMTP `password`) are AES-256-GCM encrypted at rest and **never** returned unmasked from any `/api/*` endpoint.
  - The two-stage human-in-the-loop send gate (`isApproved` per recipient, explicit "Send Approved Emails" action) is never bypassed by an automated path.
  - `config.json` / `logs.json` schemas stay backward-compatible, or the change ships a migration + version bump.
- **Every code change ships with a test.** No exceptions for "small" fixes — the small ones are exactly what regress silently.
- **One backlog item per branch**, named `agent/<cycle>-<short-slug>`. No agent commits directly to `main`.
- **Read `ARCHITECTURE.md` and `README.md` before touching code.** Any subagent whose plan contradicts those docs must flag the contradiction in its report instead of silently resolving it.
- **No agent invents scope.** If a subagent thinks a problem is bigger than its ticket, it writes that in its report for the orchestrator to re-plan — it does not unilaterally expand the diff.

### Core Rules

1. **Think before touching anything.**
   State what you think a piece of code is actually for before changing it. If you're not sure, say so and ask instead of guessing. If a file or function could reasonably be read two ways, don't silently pick one — flag it. If you spot a simpler way to do something than what's there, say so instead of quietly doing the complicated thing anyway.

2. **Simplicity first.**
   Default to the least code that does the job. No abstraction for something used once. No config knob nobody sets. No error handling for a case that can't happen. If a file is 300 lines and could be 80, that's the job — rewrite it, don't tidy it. Test for every change: would a senior engineer reading this call it overcomplicated? If yes, cut it.

3. **Surgical changes only.**
   Don't "improve" code that isn't part of this pass — no drive-by reformatting, no unrelated refactors, no rewriting comments you just happen to dislike. Match the existing style even where you'd personally do it differently. If you notice slop outside the current area, log it instead of fixing it on the spot, unless your own edit is what created it (e.g. an import you just orphaned).

4. **Goal-driven, verifiable execution.**
   Before a non-trivial change, restate the goal as something checkable — "remove X, tests still pass, behavior of Y is unchanged" — not "clean this up." After each change, verify it still builds/runs/passes tests (`cd server && npm test` and `cd client && npm run lint`). If nothing covers what you just touched, say so; don't assume it's fine.

5. **Chesterton's Fence.**
   Don't remove something just because you don't see the point of it yet. Find out why it's there first. If you genuinely can't tell after looking, flag it for the user rather than deleting it.

6. **Rule of Three.**
   Don't abstract something until it's needed in three real places. Two similar blocks of code can just stay two blocks. Collapse premature abstractions that were built for a "someday" that never came.

### AI-Slop Checklist (Review Before Committing)

Hunt for these specifically in every touched file:
- **Unused dead code:** Unused imports, variables, functions, exports, and files nothing references anymore.
- **Restating comments:** Comments that just restate the line under them ("// increment counter") — cut; keep only comments that explain *why*.
- **Empty / swallow catch blocks:** `try/catch` (or equivalent) around code that can't actually throw, or that swallows errors silently instead of handling or logging them.
- **Single-implementation interfaces/factories:** Interfaces, abstract base classes, or factories with exactly one real implementation.
- **Pass-through wrappers:** Wrapper functions that just forward to another function with the same arguments and add nothing.
- **Unused config flags:** Config flags, options, or parameters that are never set to anything but their default anywhere in the codebase.
- **Premature deduplication vs duplication:** Logic duplicated across 3+ files that should be one helper — or the opposite: over-extracted one-line "helpers" that just hide a single call.
- **Redundant type/null checks:** Null/type checks defending against states the type system, caller, or validation layer already rules out.
- **Leftover scaffolding:** Stray TODOs, tutorial boilerplate, commented-out old versions of functions.
- **Catch-all junk drawers:** Catch-all files (`utils.py`, `helpers.js`, `misc/`) hiding logic that actually belongs somewhere specific.
- **Noisy logging:** Logging that adds noise rather than operational signal.
- **Tautological tests:** Tests that only exercise the language/framework rather than your logic (don't cut a test just because it's inconvenient — only if it's not testing anything real).
