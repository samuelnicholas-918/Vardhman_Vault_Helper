<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This is **Helper Tool** (`github.com/samuelnicholas-918/Vardhman_Vault_Helper`), the progress dashboard for Vault. Same rules as Vault — not a separate standard. Vault is `github.com/samuelnicholas-918/Vardhman_Vault`.

Read `PROJECT_RULES.md` (especially §3.5) before writing code. Non-trivial decisions go in Vault's `DECISIONS.md`, not a second log here.

### Machine

- Dependencies are installed during the Cloud Build (`HUSKY=0 npm ci`). Do not reinstall unless `package.json` changed mid-run.
- A Next.js dev server is already running on **port 3000** in the `dev` terminal. Do not start a second one.
- Verify with `npm run typecheck` then `npm run lint`.

### Secrets

Do not create, commit, or snapshot `.env` / `.env.local`. Secrets come from the Cursor Cloud Agents dashboard and arrive as environment variables.

Point at Vault's **staging** Supabase project (PROJECT_RULES.md §3.5), never prod, never a third project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHBOARD_PASSWORD`
- `ANTHROPIC_API_KEY` (only for `/api/narrate`)
- `NARRATE_WEBHOOK_SECRET`

If a required secret is missing, stop and tell Samuel. `/api/narrate` is the only write path this app should have unless you re-check §3.5 first.

### Git

Never commit to `main`. One reviewable PR at a time, Conventional Commits, squash-merge by Samuel. You never mark work complete.
