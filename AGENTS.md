# Non-Negotiable Guardrails

- **Never break existing functionality.** `cd server && npm test` and `cd client && npm run lint` must pass before *and* after every change. A change that breaks either is reverted, not "fixed later."
- **Preserve the architecture's stated invariants** unless a task explicitly targets changing one, and if it does, it needs its own review + migration note:
  - Native `fetch()` only for AI providers — no OpenAI/Google SDKs added.
  - Secrets (`apiKey`, SMTP `password`) are AES-256-GCM encrypted at rest and **never** returned unmasked from any `/api/*` endpoint.
  - The two-stage human-in-the-loop send gate (`isApproved` per recipient, explicit "Send Approved Emails" action) is never bypassed by an automated path.
  - `config.json` / `logs.json` schemas stay backward-compatible, or the change ships a migration + version bump.
- **Every code change ships with a test.** No exceptions for "small" fixes — the small ones are exactly what regress silently.
- **One backlog item per branch**, named `agent/<cycle>-<short-slug>`. No agent commits directly to `main`.
- **Read `ARCHITECTURE.md` and `README.md` before touching code.** Any subagent whose plan contradicts those docs must flag the contradiction in its report instead of silently resolving it.
- **No agent invents scope.** If a subagent thinks a problem is bigger than its ticket, it writes that in its report for the orchestrator to re-plan — it does not unilaterally expand the diff.
