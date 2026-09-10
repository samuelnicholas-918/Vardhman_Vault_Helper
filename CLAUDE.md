@AGENTS.md

# Helper Tool (repo: vardhman-vault-dashboard) — read PROJECT_RULES.md before doing anything else

This is the progress dashboard for **Vault** (the main Vardhman Vault / GLMS app, repo: `vardhman-vault`) — referred to as **"Helper Tool"** in chat with Samuel. It is a separate repo with its own git history, but it is governed by the **same rules as Vault**, not a separate standard.

Before writing any code, read `PROJECT_RULES.md` (copied into this repo's root — the authoritative copy lives in the `vardhman-vault` repo; if the two ever visibly disagree, flag it to Samuel rather than picking one silently) in full — it is the single source of truth for both apps: the five non-negotiable rules, the enforcement architecture, the Progress Dashboard's own spec (§3.5), the git workflow conventions (§3.6), and everything else.

If you hit an ambiguity not covered there: **stop and log it clearly in a commit message or flag it to Samuel.** Helper Tool does not currently have its own `DECISIONS.md`/`BUILD_LOG.md` — non-trivial decisions made here should still be logged in Vault's `DECISIONS.md`, since that's the project's single decision log, not duplicated per-repo.

Git workflow (PROJECT_RULES.md §3.6) applies here identically: Conventional Commits, never straight to `main`, one reviewable PR at a time, squash-merge.

You never mark work complete. Samuel does, via PR approval.

**Cursor Cloud:** follow the "Cursor Cloud specific instructions" section in `AGENTS.md`. Secrets come from the Cloud Agents dashboard, not `.env.local`. Use Vault staging Supabase only.
