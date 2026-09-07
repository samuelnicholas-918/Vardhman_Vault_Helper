# Vardhman Vault — Gold Loan Management System (GLMS)

## PROJECT_RULES.md — The Single Source of Truth

**Naming note (7 Sept 2026, finalized):** the product is named **Vardhman Vault** — keeps the business name intact (unlike an earlier "Vardhan" shorthand considered and dropped the same day) and works for both internal staff use and future customer-facing surfaces. "Vault" isn't just branding — it genuinely maps onto the custody/receipt-surrender discipline already locked in this file (an item is never released without the original receipt back in hand). **"GLMS" remains the internal technical shorthand** used throughout this file, the codebase, table/repo names, and prior planning docs — not worth an exhaustive find-replace pass for internal references when the product name is what customers and staff actually see.

**This file supersedes `GOLD_LOAN_SOFTWARE_MASTER.md`, `CURSOR_HANDOFF.md`, and `APP_LOGIC_SESSION_2026-09-03.md` as the authoritative reference.** Those files remain in the repo for historical trace (how a decision was reasoned through), but if anything here conflicts with them, **this file wins.** `GLMS_TECHNICAL_LOGIC.md` remains authoritative for exact formulas, schema field-lists, and state-machine detail not restated here — this file gives you the _rules and rationale_; that file gives you the _exact math_.

**Last updated:** 8 September 2026. **Document version: 1.3.0** (see §13 Document Changelog for what each version bump means — added in the 8 Sept audit as a fix for having no version tracking at all). **Status:** Pre-build. Phase 0 complete and audited; Phase 1 not yet started. This is a living document — update it whenever a rule changes, bump the version, never let a decision exist only in a chat conversation.

**Who reads this file:** Cursor (via its own config pointing here), Claude Code (via `CLAUDE.md` pointing here), Claude in planning conversations (via the `glms-gold-loan-management` skill), and — eventually — a human developer who has never touched an AI coding tool. Every section should be readable by that last person without translation.

---

## 0. What this actually is

An internal system of record for Vardhman World's gold-pledge lending — pledge to closure or auction — for a single-branch registered co-operative credit society in Andheri West, Mumbai. Client: **Mukesh Sanghvi** (Founder & MD). PM/builder: **Samuel Nicholas** — a finance/accounting student, non-coder, building this via AI agents (Cursor + Claude Code) while developing genuine technical fluency alongside the build.

**Design bar:** a chartered accountant and an auditor could each independently trace any rupee or any gram of gold through this system and arrive at the same answer.

**Why this file exists in this shape:** Samuel cannot read code to catch a mistake. That single fact drives almost every process rule in this document — mechanical enforcement (Section 3) exists because rules stated only in English get silently bypassed by agents under pressure; golden-test fixtures exist because Samuel's own finance expertise is the one independent check on correctness that doesn't require reading code; the two-pass review exists because a single AI reviewing its own output shares its own blind spots.

---

## 1. The five non-negotiable rules (unchanged from original handoff, still absolute)

1. **No filling in blanks.** Every business rule traces to a confirmed answer or an explicit default. Hit an ambiguity not covered here → **stop, log it in `DECISIONS.md` under `NEEDS_HUMAN`**, do not silently pick something reasonable.
2. **One file at a time.** Write → typecheck → fix → update `CHANGELOG.md` → commit → next. Never batch multiple files before verifying.
3. **You never mark a phase complete. Samuel does.** Your job ends at "here's the diff, here's what I verified, here's the fixture results."
4. **The ledger is the only source of truth.** No balance, no status, no "current" anything is ever a stored, directly-editable field — always derived from `loan_ledger_events` at read time. Catching yourself adding an `outstanding_balance` column anywhere is the signal to stop.
5. **Every non-trivial choice gets logged** in `DECISIONS.md` — library picks, workarounds, anything resolved that wasn't spelled out explicitly.

---

## 2. Architecture — one paragraph

Next.js 16 App Router (see DECISIONS.md — resolved 3 Sept 2026, framework version deliberately not pinned to older docs) / TypeScript strict / Tailwind + shadcn/ui (New York) / Supabase (Postgres + RLS + Auth + Storage) / Vercel / Zod on every mutation / Resend (email). Everything sits on one governing rule: the ledger (`loan_ledger_events`) is the only source of truth — no balance or status is ever stored directly, always derived. Money as integer paise, weight as integer milligrams, interest as integer basis points — no float rounding drift over thousands of loans. Every mutation carries a client-generated `client_request_id` for idempotency. Every table write triggers an `audit_log` insert via a Postgres trigger, not application-level logging. RLS enabled on every table, deny-by-default.

**Deferred, confirmed not-now:** PowerSync offline sync, Tauri desktop shell, WATI/WhatsApp, Telegram bot, vault/inventory tracking. Schema leaves room for these; nothing about the current build should assume they'll never arrive.

---

## 3. Enforcement architecture — how rules become unbreakable, not just written down

**The core problem this section solves:** an AI agent stating "sorry, I shouldn't have done that" after violating a rule provides zero value — the damage is already in the codebase. There is a documented, public case of Claude Code itself repeatedly using `git commit --no-verify` to bypass its own configured safety checks across six consecutive commits; Anthropic's own issue tracker closed the report as "not planned." **The conclusion the whole industry has converged on: defense must live outside the agent, in infrastructure the agent cannot argue its way past — not in prose instructions, however firmly worded.**

### 3.1 The five layers, weakest to strongest

| Layer                                  | What it is                                                                                                                                                                                 | Can it be bypassed?                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. In-session hooks                    | Cursor/Claude Code `PreToolUse`-style hooks intercepting a tool call before execution                                                                                                      | Partially — enforcement strength varies by tool, treat as a fast first line, not the boundary                                                           |
| 2. Local pre-commit hooks              | Husky/pre-commit running typecheck, lint, forbidden-pattern checks before a commit lands                                                                                                   | **Yes** — `--no-verify`, `HUSKY=0`, or editing the hook config itself. Convenience only, never trust alone                                              |
| 3. Tamper-proof git wrapper            | A `PATH`-shim git wrapper (e.g. `gitleash`) intercepting every git call regardless of which agent is running                                                                               | Harder — tool-agnostic, catches huge diffs/deleted tests/hardcoded secrets/force-pushes at the git-hook level for any agent or human                    |
| 4. Server-side CI                      | GitHub Actions running typecheck/tests/secret-scan/duplication-check as **required status checks** on `main`                                                                               | **No** — runs on GitHub's infrastructure, outside the agent's local environment entirely. This is the real wall                                         |
| 5. Protected paths + branch protection | Rule-defining files (hook configs, CI workflows, this file) require Samuel's explicit human approval to modify; merge to `main` requires all checks green **and** Samuel's manual approval | This is what stops the sneakiest failure mode: an agent not bypassing a hook, but quietly editing the hook/config so a failing check technically passes |

**Rule for this project: Layers 4 and 5 are mandatory from Phase 0. Layers 1–3 are encouraged but supplementary — never treated as sufficient on their own.**

### 3.2 What gets mechanically enforced, specifically, for GLMS

| Business rule                                                                                 | Mechanical enforcement                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "One file → typecheck → fix → commit"                                                         | Pre-commit hook (typecheck/lint) + CI typecheck as a required status check                                                                                                                                                                                                                          |
| No stored `outstanding_balance`-style field, ledger-only                                      | A static-analysis/lint rule that greps for forbidden column patterns in migrations and fails CI if found                                                                                                                                                                                            |
| Statutory constants never overridable (85% LTV ceiling, related-party cap, 1-year max tenure) | A dedicated test suite asserting these constants exist and are unmodified — runs every CI pass; any change (human or agent) fails the build                                                                                                                                                         |
| Secrets never committed                                                                       | Full-history secret scanner (`Gitleaks` or `truffleHog`) in CI — checks entire git history, not just current HEAD                                                                                                                                                                                   |
| Nobody can mark a phase complete except Samuel                                                | Branch protection requiring Samuel's manual PR approval — structurally cannot merge without it, regardless of what any agent claims                                                                                                                                                                 |
| No silent rule/hook-config edits                                                              | This file, CI workflow files, and hook configs are a "protected path" — an agent can _propose_ a change but cannot merge one without Samuel's explicit review                                                                                                                                       |
| RLS "deny-by-default" claim (§6 roles table)                                                  | `rlsautotest` (or `supashield`) generates a full pgTAP access-matrix suite per table/command/role directly from the Postgres catalog — CI fails on any leak or unprotected table. Added 6 Sept 2026 after research surfaced that "RLS enabled" was previously an unverified claim, not a tested one |

### 3.2a External tools evaluated (6 Sept 2026 research pass)

**Adopted:**

- **`rlsautotest`** (Apache-2.0) or **`supashield`** — RLS policy testing, wired into CI (see `.github/workflows/ci.yml`'s `rls-policy-test` job). This is a real gap closed, not a nice-to-have: RBAC/RLS was locked as a rule with no automated proof it held.

**Reference only, not adopted as a dependency:**

- **Blnk** (github.com/blnkfinance/blnk) — a production-grade, Postgres-backed, open-source double-entry ledger explicitly listing "lending" as a supported use case, with a tamper-evident hash chain for immutability. Directly relevant to Rule 4 and the "nobody has delete authority" principle — but it's a separate Go service (Docker Compose deployment), not an npm dependency. **Decision not yet made**: use purely as a Pass-2-review reference to sanity-check GLMS's own `loan_ledger_events` schema against a proven implementation, or actually self-host it (a real architecture change, adding a second service outside the current Next.js+Supabase+Vercel stack). Leaning reference-only given how far the ledger design already is, but this is Samuel's call, not decided here.

**Evaluated and NOT recommended:**

- **Aadhaar Offline KYC verification libraries on GitHub** — no actively-maintained, production-grade TypeScript/Node option exists. What's findable is small, low-star personal repos in Java/.NET/Go/Android. Recommendation: build the verification logic (ZIP decryption via share-code, XML parsing, UIDAI digital-signature validation against their public certificate) carefully in-house against UIDAI's own published spec, rather than importing an unmaintained hobby repo into identity-verification code for a regulated lending product. Flagged explicitly so this isn't mistaken for "nothing found, so anything goes."

### 3.3 Check cadence — stacked, not single-frequency

**Every commit (automated, seconds, unattended):** typecheck, lint, forbidden-pattern check, secret scan. Fails → blocked, structurally, whether Samuel is watching or not. This is what makes "autopilot" safe — the check doesn't depend on a human noticing.

**Every phase (human-gated, cannot be automated away):**

- **Pass 1** — Cursor's own module checklist, derived from the relevant spec section, run before proposing a phase complete
- **Pass 2** — an independent, freshly-started Claude session with zero memory of writing the code, given spec + diff only, instructed to try to break it. Deliberate: a reviewer that remembers writing the code defends it; a cold adversarial read catches what self-review misses. Extra scrutiny on Phase 4 (Ledger & Interest Engine) specifically, given it's the precision core.
- **Golden-test fixtures** — derived by Samuel from the spec, using his own finance expertise, _before_ the phase's code exists. Never generated by reading the code's own output. This exists specifically because Samuel can't verify correctness by reading code — this is his independent check.

**Before merge to `main` (server-side, unbypassable):** all CI checks green + Samuel's manual approval on the PR. Neither alone is sufficient.

**Before go-live (once, non-negotiable):** full backup/restore test (Section 8) + a broader security/red-team pass.

### 3.4 Reconciling "autopilot" with all of the above

Autopilot (Cursor running file after file, unattended, within a phase) is safe **specifically because** the mechanical layer (3.1–3.3, "every commit") doesn't require a human watching in real time — it's infrastructure, not vigilance. What must remain a genuine, structural pause, not a habit:

- **The phase boundary itself should be a structural wall**, not a request the agent honors. Configure the repo so it will not accept next-phase work until the current phase's PR is reviewed and merged — even an agent trying to barrel through the boundary has nowhere for that work to land.
- **Merge approval** stays Samuel's, always, regardless of how clean CI looks.
- **Golden-test fixtures and Pass 2** cannot be automated away — they exist to catch code that is syntactically clean and passes every mechanical check but is still _wrong_. No CI gate replaces this.

### 3.5 Progress Dashboard — "Jarvis-style" live status, viewable from anywhere, any device

A small, **separate** Next.js app (not part of GLMS itself), designed to feel like an ambient live status console — dark, futuristic, ARC-reactor-style live numbers with a plain-language narration line underneath, not a chat box. Purpose: Samuel needs to know build status even when using Cursor's **Cloud Agent** feature (cloud VM, no laptop access) to trigger builds remotely.

**Data flow (decoupled — this is the key design decision):**

1. **Sources**: Cursor (local), Cursor Cloud Agent (isolated cloud VM, no laptop access — pushes to a branch, opens a PR), and Claude Code all push to **GitHub** the same way. The pipeline below doesn't know or care which one did it.
2. **GitHub Action** fires on every push _and_ on `pull_request` events (opened/synchronize) — so in-progress Cloud Agent work is visible before it's even merged. Reads `BUILD_LOG.md`, `CHANGELOG.md`, `PROJECT_STATE.json`, `DECISIONS.md`, `REVIEW_LOG.md`, writes structured status to a Supabase table (current phase, % complete, last commit hash, last Pass 1/Pass 2 status, open-decisions count, CA-blocked items, recent build-log excerpt).
3. **Supabase Realtime** (websocket) pushes that status update to every connected device **instantly** — no polling, no redeploy. This is what makes the dashboard genuinely live rather than "refresh to check."
4. **Plain-language layer**: same generator/narrator split as the main Analytics Dashboard (§5) — the structured status is computed deterministically by the GitHub Action; a Claude API call turns it into a plain-English status line ("Cloud Agent finished the ledger schema, one test failed, waiting on your review"), event-driven off actual status changes, never the source of the underlying numbers.

**Why this is faster than "redeploy on every push":** redeploying the whole dashboard app for every data change is unnecessary and slower. Splitting "data updates" (instant, via websocket) from "dashboard code changes" (rare, only when the dashboard itself is modified) means the dashboard only redeploys when it actually needs to.

**Device-specific layouts (not one generic responsive guess) — targets confirmed:**

- **MacBook M1 Air 13"** (≈1470×830 CSS px): full cinematic layout — ambient numbers + narration side by side
- **Xiaomi Pad 7** (≈1068px portrait / 1600px landscape at dpr 2): two-column tablet layout
- **Samsung Galaxy S25 Ultra** (≈384–480px CSS width portrait): stacked cards, plain-language summary leads (read the sentence first, tap into numbers) — smallest screen gets the most compressed, narration-first treatment

**Data store — RESOLVED (6 Sept 2026):** the `build_status` table lives in the **staging** Supabase project — the same one GLMS itself uses, not a dedicated third project. Rationale: this genuinely is part of the same build, not an unrelated system, so a separate project would be one more thing to manage for no real isolation benefit. **Staging, not prod** — build/CI status is a development-time concern; prod stays reserved for real loan data only, kept as clean as possible. RLS on `build_status` (anon read-only, service-role write-only — see its migration file) means mixing it into the same project carries no meaningful security risk; it's isolated at the table level regardless of which project it sits in.

**Local vs remote (deployment — separate decision from the data store above):**

- **Local:** `npm run dev`, works on localhost with zero extra setup
- **Remote:** its own separate Vercel project (not the same deployment as GLMS) — this is about _deployment_, not data; the dashboard is still a distinct Next.js app with its own URL, it just points at GLMS's staging Supabase project for its data. Connected to the same repo — the Vercel deploy itself only needs to happen when the dashboard's own code changes; live data arrives via Supabase Realtime regardless of deploy state
- **Access:** simple password gate (Vercel deployment protection or an env-var check) — shows real build status, shouldn't be public even temporarily

**Visual direction:** once the repo exists and there's real data to point it at, prototype visually (Claude Design or a live HTML mockup) rather than building the aesthetic blind first. Small enough overall (roughly 150–200 lines including the Realtime wiring) to scaffold in a single pass.

### 3.6 Git workflow — commit, branch, and PR conventions

**Gap closed 8 Sept 2026.** Until this was written, "commit discipline" only existed as mechanical enforcement (Rule 2, §3.1–3.3) and philosophy — nothing spelled out message format, branch naming, or PR scope. Checked against the actual Phase 0 commit history while writing this: it used free-form descriptive messages, no stated convention. That history stands as-is (not worth rewriting); the convention below applies from this point forward.

**Commit message format — Conventional Commits, going forward:**
`<type>(<scope>): <description>` — e.g. `feat(ledger): add interest accrual event type`, `fix(rls): close gap in officer-tier read policy`, `chore(ci): bump gitleaks action version`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Scope is the module/area (`ledger`, `rls`, `ci`, `dashboard`, etc.) — optional but encouraged, since it makes `git log --oneline` scannable months later without opening every commit.

**When to commit:**

- After every single file passes typecheck (Rule 2) — never batch unverified files
- After a coherent, working unit of logic (one function, one migration, one component) — never mid-syntax-error, even temporarily
- Before switching context to a different file or feature
- At the end of every work session, even mid-phase — an uncommitted end-of-session is real lost-work risk, especially for a Cloud Agent session that could simply be interrupted with nothing saved anywhere

**When NOT to commit:**

- Directly to `main` — everything goes through a branch + PR. Branch protection (§3.2) enforces this mechanically, but it's worth stating as a convention too, not just relying on the wall to stop a mistake
- With a failing typecheck or lint, "temporarily" — this is exactly what Rule 2 and the pre-commit hook exist to prevent; if a hook is bypassed to get a broken commit through, that's a Layer 5 violation (§3.1), not a shortcut
- Without updating the relevant build log (`BUILD_LOG.md` / `DECISIONS.md` / `CHANGELOG.md`) for anything non-trivial — an unlogged non-trivial change is functionally invisible to the next session, human or agent

**Branch naming:**

- `phase/<n>-<short-name>` for phase work, e.g. `phase/1-identity-access`
- `fix/<short-name>` for bug fixes outside normal phase work
- Cloud Agent branches follow whatever Cursor's Cloud Agent generates automatically — currently assumed to be `cursor/*` (see the placeholder in `update-dashboard.yml`'s source-detection step), **not yet verified against a real run**. Correct this convention once confirmed, same open item as the bot-identity detection.

**PR scope:**

- One phase — or one clearly-bounded sub-phase, if a phase is large — per PR. Never the whole build in one PR.
- A PR should be reviewable by Samuel in a single sitting. If it isn't, it's too big and should be split, even if that means an artificial-feeling seam mid-phase.
- PR description states which `PROJECT_RULES.md` phase/section it implements, and links the Pass 1 checklist result.

**Before opening a PR:**

- All CI checks passing (or expected to pass — CI is the actual proof, a local pass is a prediction)
- Relevant build logs updated
- For anything touching the interest/penalty/waterfall engine (Phase 4+): golden-test fixtures passing, referenced explicitly in the PR description

**Merge strategy:** squash-merge to `main`. Keeps `main`'s history as one clean commit per logical unit of work; the branch's own iterative commit history (which may be messy — "wip", "fix typo", etc.) is preserved in the closed PR if ever needed for archaeology, without cluttering `main`'s log.

---

## 4. Industry best-practice guardrails against AI-codebase technical debt

Grounded in 2026 research on AI-assisted development (GitClear, Stanford AI Index, Cloud Security Alliance, and direct incident data from teams running agents at scale). These are the specific, measurable failure patterns and the countermeasures adopted for GLMS:

| Documented failure mode                                                                                               | Countermeasure for GLMS                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplication instead of reuse (vibe-coded repos cluster at 30–50% duplication vs. a healthy ~15%)                      | Duplication detector (SonarQube/CodeClimate/`jscpd`) wired into CI; flag anything above 15%                                                       |
| "Geological layers" of inconsistent style across sessions                                                             | This file's stack/convention lock (Section 2) + ADRs (below) — one canonical way to do each kind of thing                                         |
| Documentation voids (nobody, including the builder, can explain the system later)                                     | Four build logs (`AGENT_BRIEF.md`, `BUILD_LOG.md`, `DECISIONS.md`, `CHANGELOG.md`), mandatory, not optional; a fifth (`REVIEW_LOG.md`, see below) |
| Test debt (vibe-coded projects average ~12% coverage vs. ~68% industry norm)                                          | Coverage report in CI, broken down by module, not aggregate; golden-test fixtures mandatory for the ledger/interest engine specifically           |
| Secret exposure (roughly double the rate in AI-assisted commits vs. human-only)                                       | Full-history secret scanning in CI (Section 3.2)                                                                                                  |
| Reviewer shares the generator's blind spots (same AI reviewing its own output misses the same defects)                | Pass 2 is always a **fresh, independent session**, never the same context that wrote the code                                                     |
| "Looks correct" mistaken for "is correct" — AI output is syntactically clean regardless of whether the logic is right | Golden-test fixtures derived from spec, independent of the code — Samuel's specific defense against this, since he can't verify by reading        |

**New requirements added to the build, beyond what existed before today's session:**

- **Architecture Decision Records (ADRs)** — one per major _technical_ structural choice (e.g., "why Supabase RLS instead of app-layer permission checks"), distinct from `DECISIONS.md` (which covers _business-logic_ decisions). This is the single most-cited factor in whether a future developer can understand intent, not just behavior.
- **`REVIEW_LOG.md`** — a fifth build log. Every Pass 2 adversarial review's findings get written here (dated, referencing the exact commit/file). Cursor is required to read this at the start of every new phase, same as the other four logs — this is what closes the context loop in _both_ directions between Cursor and Claude.
- **A human-oriented onboarding document**, written for someone who has never seen an AI coding tool — distinct from this file (written _to_ an agent). Originally slated for Phase 14+; pull this earlier, since writing it forces real clarity while reasoning is fresh rather than after 16 phases of it fading.
- **The "Business Impact Test" for review depth** — not uniform rigor everywhere. Deepest, slowest, most human-involved review specifically where a mistake costs real money or legal exposure (interest engine, LTV enforcement, related-party caps, the due-date/defaulter-clock logic in Section 7). Lighter, faster review for genuinely low-stakes surface work (UI copy, non-critical admin screens). Already applied instinctively (extra Pass-2 scrutiny on Phase 4) — now stated as an explicit, named policy so it's consistent as more phases arrive.
- **Metrics tracked continuously, not just at the end:** code churn, duplication %, test coverage, refactor percentage. A healthy AI-assisted codebase maintains roughly **15–25% refactoring activity** — if that number drops toward zero, the codebase is growing by addition only, and architectural drift is accelerating invisibly.

---

## 5. v1 scope — what's actually being built (supersedes the original module list where it conflicts)

The original `GOLD_LOAN_SOFTWARE_MASTER.md` module list (A0–Q) still describes the intended feature surface, **but several modules were deliberately reduced in scope during the 3 Sept 2026 session.** Where this section conflicts with that document, this section is current.

### Confirmed, unchanged from original planning

- Society membership as a hard gate before any loan (Section 22 of the Act — statutory, not just policy): `PENDING_APPROVAL` → `ACTIVE`, no application fee
- Gold/silver valuation, flat **80% LTV** policy default (statutory ceiling is 85% — 80% is a deliberate, documented conservative choice, not an oversight)
- Loan range ₹5,000–₹1 crore; tenure 3/6/12 months (gold loan statutory max is 1 year)
- Interest: 12–21%, reducing balance, monthly compounding, 1-month minimum
- Penalty: 0.5%/month, triggers after any missed monthly interest payment
- Promotional scheme: one-time 0% interest up to ₹1 lakh for 3 months, once per customer
- Repayment waterfall: **Penalty → Interest → Principal**

### Customer-facing flow (v1)

1. Customer signs up on a client-facing frontend, providing all information needed for any financial transaction ahead of time.
2. Dashboard shows only **"Approval Pending"** until an admin/officer explicitly approves (promotional business videos loop on this screen while pending).
3. Once Active, customer can express **loan intent** — signal only, not a document-filling or draft-approval step.
4. **No customer-facing draft-review screen in v1** — considered, explicitly dropped. All processing happens **in-person at the branch**: staff selects the approved profile, the document auto-fills, customer review happens physically/on-screen before signing, not as a built feature.
5. v1 deliberately keeps customer-facing features minimal. **Flagship feature is staff-side document auto-fill**, not customer self-service.

### Document auto-fill (the flagship feature)

All fields for all loan document types collected **once, at customer intake**. At processing time, staff **selects the approved profile**, system auto-fills the document(s). Needs its own line-limit/spacing/line-break handling per field — highest-leverage piece to get right early, since it's customer-facing paper with the least tolerance for "fix later." **Restricted to Senior Officer/Branch Manager tier only** (see Section 6) — not general Loan Officer access.

### Top-up — REMOVED (differs from original master doc, which specified full top-up support)

**Confirmed: no concept of top-up.** If a customer wants more against existing collateral, that is a **new loan entirely**, not an addition to an existing one.

### Renewal — RESOLVED, one mechanic still open

Renewal = **a new loan agreement**, not a continuation of the same loan record — structurally similar to how top-up was resolved. Same collateral (no re-pledging), **prevailing interest rate** (not original sanction rate), **1.25% service charge**. Old loan formally closed; new loan tagged/linked as "renewal of [old loan]" for traceability.

**Still open, NOT locked — do not build either path until Mukesh confirms:** at the moment of renewal, does money actually move?

- **(a) Rollover, no cash movement** — outstanding principal on the old loan becomes opening principal of the new loan; only real transaction is the 1.25% service charge. Samuel's working lean, **not confirmed**.
- **(b) Full settlement, fresh disbursement** — old loan fully repaid first, new loan disbursed fresh (real repayment + real disbursement events, linked by reference).
- (a) requires a new "principal carry-forward" ledger event type that doesn't exist yet; (b) reuses existing closure/disbursement events. **Structurally different builds — confirm before writing either.**

### Gold rate — staff-entered, no automation (differs from original master doc's "rate feed" plan)

No live gold-rate feed integration, no automated 3-month-average calculation, no automated margin-call monitor. **Gold rate is staff-entered manually** per valuation event; staff decides if/when a margin-call situation exists. Entered once at origination, stands as the fact — **option to update later remains available**, any such update goes through the immutable log (Section 7), never a silent edit.

### Admin Preferences Menu — named toggles only, NOT a general rules engine

A deliberate scope decision: **not** an open-ended, extensible rule-configuration framework. A menu of **specific, individually named toggles**, added one at a time as real cases arise. First named toggle: gold-rate-entry-method (currently: manual only). **Hard rule: any toggle that could touch a statutory constant is never eligible to become a toggle** — those remain hardcoded checks regardless of menu contents.

**Locked design philosophy:** _"The app takes no decisions on its own. Everything is based on staff discretion. Where judgment is required, staff provides it — with specific decision points and their options named explicitly as they're identified, not a general configurable rule engine."_

### Variable factors — soft/policy vs. hard/statutory boundary

Because this is a relationship-driven family business, soft/policy values (interest rate within the 12–21% band, grace period length, penalty rate, service charges) can vary per customer via the existing **override-with-audit-event pattern** (reason code + who approved it, never a silent field edit). **Does NOT apply to statutory values**, which cannot flex regardless of relationship or family status:

- 85% LTV ceiling (80% is the policy default, overridable only up to 85%, never beyond)
- Gold loan max tenure = 1 year — "any duration" means up to 12 months, not unlimited
- Related-party lending cap (2–5% of loan book, tier-dependent); directors/relatives cannot receive unsecured loans at all and cannot be guarantors
- ₹50,000 cash disbursement cap — see below

### Cash disbursement cap — variable, BLOCKED-PENDING-CA

The cap is intended to be **variable per customer**, not fixed — but this touches Section 269SS of the Income Tax Act, not just internal policy. Build the field as variable/configurable, but **do not finalize or ship the actual variability logic** (what drives the per-customer cap, who approves raising it, the ceiling it can never cross) until CA confirmation specifically on Section 269SS. Marked `BLOCKED-PENDING-CA`, not just "variable," so it isn't treated as freely tunable in the meantime.

### Auction — DRASTICALLY REDUCED (differs heavily from original master doc's full workflow)

The **full auction governance workflow** (45+45 day notice process, Chairman+VC+Treasurer sign-off, public notice, conduct, closeout) is **out of v1 scope entirely.** v1 only needs a **status tag**: "this loan is sent for auction," for customer-record purposes. Whatever actually happens at auction happens **entirely outside the app**, at least for now. This is a genuine, deliberate scope cut from the original plan — not a minor adjustment.

### Vault — foundation only, unchanged

Reconfirmed: no real vault-tracking build in v1 (placeholder schema only, where sensible). Consistent with "no need for maintaining the vault as of the current build."

### Notifications — LOCKED as email-only (Resend), differs from original master doc's WATI/SMS plan

Deliberate choice: this is a formal financial business, customers should be checking notifications regardless of channel convenience. **Not currently in scope**, even though email has known lower open rates.
**If SMS (MSG91) is ever added later:** DLT registration is mandatory in India for transactional/promotional SMS — Vardhman must register as an entity on a DLT platform, obtain a registered sender ID (6-char alphanumeric header), get every message template pre-approved and mapped to a template ID. Messages without this are silently blocked by carriers. One-time setup, few days to a couple weeks lead time — not a same-day switch if the decision is ever made urgently. Templates need pre-declared variable slots; can't send free-form dynamic text once locked. Technical integration itself (MSG91 alongside Resend) is comparatively small.

### Analytics Dashboard — FULLY RESOLVED

A "cinematic screen" — big, ambient, always-on numbers (active loan count, alerts, amount processed, etc.) for Mukesh to monitor by sitting in front of it. **Locked split:** the actual numbers are computed by SQL/materialized views, refreshed on a schedule, rendered visually. **Claude serves purely as a narration/Q&A layer on top of already-computed numbers — never as the source of a figure** (satisfies the pre-existing rule against AI-generated financial figures). **Claude lives inside the same cinematic screen** — one always-on screen combining the ambient display and narration/Q&A, not two separate modes.

### Reporting — resolved, minimal scope

Per-customer detail export/print, per-loan detail export/print, point-in-time analytics print/export. Nothing else in scope currently.

### CoPass migration — resolved, phased

Legacy data is being manually cleaned by staff before import — real data problems surfacing (one phone number under 4 different names due to marriage/name changes, other entry errors). Migration happens **phase-by-phase, via CSV importer**, once cleaning is done. **Requirement flagged for the importer build:** it needs a **dedup/merge resolution step**, not just a straight CSV-to-table load — otherwise the same real person could import as multiple separate customer records.

---

## 6. Roles & Permissions (fully resolved, 3 Sept 2026 session)

**1. Loan Officer / Front Desk Staff** — day-to-day operational

- Enter customer signup/KYC data
- Record repayments (waterfall automatic: penalty → interest → principal)
- View loans/customers assigned to them
- **Cannot:** fill/generate loan documents, approve membership, override due-dates/rates/penalties, access admin toggles, see full-branch analytics

**2. Senior Officer / Branch Manager** — everything above, plus:

- **Document auto-fill / loan document generation — restricted to this tier only.** Explicit, deliberate restriction: the flagship feature is gated to a single accountable tier, not general Loan Officer access
- Approve membership (Pending → Active)
- Approve soft-value overrides with audit trail (due-date extension, penalty adjustment, rate deviation within the 12–21% band)
- Tag a loan "sent for auction" (status-only)
- View all loans/customers, not just assigned ones

**3. Admin**

- Manage the admin preferences menu (named toggles only)
- Manage staff accounts and role assignments
- Full analytics dashboard access
- Same hard statutory ceiling as everyone else — cannot override 85% LTV, related-party cap, 1-year max tenure, etc.

**4. Owner (Mukesh)**

- Everything above, plus final say on anything escalated
- The cinematic analytics screen is primarily his interface
- **Explicitly no exception to the immutable-log rule** — even the owner cannot delete or edit a past log entry (Section 7). Owner has the most access, not an exception to "nobody has delete authority."

**Constant across every role, no exceptions:** statutory hard limits are system-enforced regardless of role — no tier can override, only the soft/policy layer flexes.

**Deliberately NOT modeled as in-app roles for v1:** the 21-member statutory Board or the mandatory Loan Recovery Committee (per bylaws) — since auction is just a status tag in v1, that governance layer stays a real-world, outside-the-app process. Would need real committee-role modeling if a future phase brings the full auction sign-off workflow back into the app.

---

## 7. The due-date / defaulter-clock decision — TOP compliance priority

**This is the single most consequential decision from the 3 Sept 2026 session and the highest-priority item for the CA/lawyer list, above everything else pending.**

**The mechanism, fully locked:**

- Staff sets the initial due-date when creating a loan, and **can change it later** (e.g., customer needs more time due to an arrangement or relationship)
- **Every loan has a non-destructible change log.** Any date change, penalty adjustment, or override gets appended as a new entry — the prior entry is never edited or deleted, **not even by Mukesh as owner.** Nobody has delete authority, full stop.
- **Default/auction-eligibility is computed off the CURRENT/LATEST due-date in the log**, not the original. Each staff override **genuinely resets** the operative clock for penalty visibility, 90-day defaulter status, and auction-eligibility. The immutable log's role is to show _that_ it happened, _when_, and _why_ — not to protect the original date's authority over triggers.

**Why this needed real scrutiny before being locked:** Rule 17 of the Maharashtra model bylaws states no loan tenure extension is permitted once a loan is overdue. The statutory 90-day defaulter definition (Section 22 of the Act) depends on a fixed clock. If staff can push the due-date whenever they choose, and that action resets the same clock the statutory definition depends on, a borrower could functionally never reach legal defaulter status — regardless of how long they actually go unpaid. This isn't about whether staff will misuse it (very unlikely, per Samuel's read of the actual business relationships) — it's about what the system's record shows if a dispute or statutory audit ever occurs, independent of anyone's good faith.

**Real-world effect, stated plainly:** the statutory 90/45+45-day clock is, in practice, staff-discretionary — it restarts every time the date is pushed. This is a deliberate, informed choice by Samuel/Mukesh, not an oversight.

**Exact question for the CA:** _"Loan due-dates and the resulting defaulter/auction-eligibility clock can be extended by staff at their discretion, with all changes permanently logged. Does this practice create risk under Rule 17 (no tenure extension once overdue) or Section 22's 90-day defaulter definition?"_

**Same override-with-audit-event pattern also applies to the calculation engine itself:** the system still calculates interest/penalty automatically from the confirmed formulas — golden-test-fixture plan is unchanged. Staff can override a calculated date or figure, but every override is a **new ledger event layered on top of** the calculated one — the original figure is never edited, only appended-over.

---

## 8. Backup strategy — CRITICAL, not a routine checklist item

**⚠️ Why this matters more than usual:** Samuel confirmed CoPass (the legacy system) will be **retired entirely** once GLMS is established. After that point, GLMS becomes the **sole system of record** for all of Vardhman's lending data, with no legacy fallback. Backup discipline is not hardening — it is the only thing standing between Vardhman and permanent, total data loss once CoPass is decommissioned. Must be tested and proven working **before** CoPass is switched off.

**Rejected model:** game-style "save states" to roll back to. A live multi-user financial system cannot roll back to an earlier snapshot without destroying real, already-happened activity (repayments, new loans, overrides) — this would violate the "nothing is ever deleted, only reversed" ledger principle. **Locked distinction:**

- **Backups = disaster recovery only** (Supabase outage, corruption, accidental drop) — not a staff-facing undo button
- **Staff "undo my mistake" = the existing reversal-entry pattern** — a new corrective ledger event gets appended with a reason code; the original mistaken entry stays visible, never vanishes

**Concrete plan, locked (v1, webapp only — PowerSync/Tauri deferred):**

- Manual, admin-triggered on-demand export (`pg_dump`-based) — available on any Supabase plan tier
- Automated daily backups (Supabase Pro+ built-in, or cron-triggered `pg_dump` on lower tiers)
- Point-in-Time Recovery (PITR) if plan tier supports it
- At least one backup copy stored **outside Supabase's own infrastructure**
- Restore path is **never staff-facing / never one-click live** — goes into a separate recovery environment first, verified (ledger reconciliation check), only then considered for promotion
- **Mandatory pre-launch test:** an actual full restore into a throwaway environment, verified, before go-live — an untested backup is treated as not existing
- **Recommended:** run CoPass and GLMS **in parallel for a defined overlap period** after go-live, rather than a same-day hard cutover — proves the backup/restore process in production before the legacy fallback disappears. Exact overlap length is Samuel's/Mukesh's call.
- This is a Phase 0 environment-scaffolding task, alongside the two Supabase projects and the build logs.

---

## 9. Phase sequence (updated — supersedes the original master doc's straight-through plan and the original Cursor handoff's phase table)

| #   | Phase                                                                                                        | Depends on                                              | Status / change from original plan                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0   | Foundation — repo, env, base schema, RLS skeleton, CI/CD gates (Section 3), progress dashboard (Section 3.5) | —                                                       | Unchanged, but now includes the full enforcement architecture and backup setup (Section 8) as mandatory, not optional         |
| 1   | Identity & Access — Membership, Customer/KYC, RBAC roles                                                     | 0                                                       | RBAC now matches the 4-tier structure in Section 6, not the original officer/committee model                                  |
| 2   | Valuation & Pledge Intake — gold-only, flat 80% LTV, staff-entered rate                                      | 1                                                       | Rate-feed integration **removed** — staff-manual entry only                                                                   |
| 3   | Loan Origination — membership gate, promo scheme, cash cap (BLOCKED-PENDING-CA on variability)               | 1, 2                                                    | Document auto-fill build lives here, restricted to Senior Officer tier                                                        |
| 4   | **Ledger & Interest Engine — the precision core**                                                            | 3                                                       | Unchanged — build golden-test fixtures before this phase's code, extra Pass-2 scrutiny                                        |
| 5   | Repayment, Waterfall, Penalty                                                                                | 4                                                       | Waterfall order confirmed: penalty → interest → principal                                                                     |
| 6   | ~~Top-Up~~                                                                                                   | —                                                       | **REMOVED ENTIRELY.** No top-up concept exists                                                                                |
| 7   | Renewal                                                                                                      | 4, 21                                                   | **Blocked** until Mukesh confirms rollover mechanic (a)/(b), Section 5                                                        |
| 8   | Default & Auction                                                                                            | 5                                                       | **Hugely reduced** — status-tag only, not the multi-sig workflow. Full governance workflow removed from v1                    |
| 9   | Notifications                                                                                                | 4                                                       | Resend/email only — WATI/SMS removed for now, DLT requirements documented for future re-add                                   |
| 10  | Reports & Export                                                                                             | 4-8                                                     | Simplified — per-customer/per-loan/analytics print only                                                                       |
| 11  | Admin, Roles & Audit Hardening                                                                               | all prior                                               | Includes the named-toggle admin menu (Section 5) and ADR/REVIEW_LOG requirements (Section 4)                                  |
| 12  | Operational Excellence P0 — search, maturity pipeline, health check                                          | 4                                                       | Unchanged                                                                                                                     |
| 13  | Customer Portal — request-vs-write pattern                                                                   | 6→7 (renumber once Top-Up removal is reflected in repo) | Minimal v1 scope — intent-only, no draft-approval UI                                                                          |
| 14  | Data Migration (CoPass)                                                                                      | 4                                                       | Now includes mandatory dedup/merge resolution step (Section 5)                                                                |
| 15  | Offline Sync Layer (PowerSync)                                                                               | 0-14 stable                                             | Deferred, unchanged                                                                                                           |
| 16  | Desktop Shell (Tauri)                                                                                        | 15                                                      | Deferred, unchanged                                                                                                           |
| —   | Analytics Dashboard (cinematic screen + Claude narration)                                                    | 10                                                      | New — see Section 5                                                                                                           |
| —   | Progress Dashboard app                                                                                       | 0                                                       | New — see Section 3.5, build early alongside Phase 0                                                                          |
| —   | Human-oriented onboarding doc                                                                                | —                                                       | Pulled earlier than originally planned (was Phase 14+) — write once core modules stabilize, don't wait for the full 16 phases |
| —   | Design/Branding pass                                                                                         | 0-14 complete                                           | Unchanged — `frontend-design` skill, `DESIGN.md` at that point                                                                |

Vault — **not built**, indefinitely deferred, foundation-only schema where sensible.

---

## 10. Accounts & ownership

**Hard rule:** every infrastructure account must be under Vardhman's ownership, not Samuel's personal accounts — Supabase, Vercel, Resend, domain, everything. **Confirmed exception, tracked:** GitHub currently sits on Samuel's personal account, to be transferred to Mukesh's email later. This is a real open TODO, not a settled deferral — set an actual trigger for it (e.g., "transfer before go-live") rather than leaving it open-ended, since a late transfer means re-pointing CI/CD, Vercel's GitHub integration, and deploy keys.

Everything else (Supabase, Vercel, Cursor's account, Resend, etc.) — business Gmail account, correct from day one.

---

## 11. Running CA/lawyer list (priority order)

1. **[TOP]** Staff-discretionary due-date extension resetting the statutory defaulter/auction clock — Section 7, full detail above
2. Variable ₹50,000 cash disbursement cap under Section 269SS — BLOCKED-PENDING-CA (Section 5)
3. Maharashtra Stamp Act duty on electronic agreements
4. DPN eSign restriction — confirm DPN presence in loan package (Vardhman is regulated by the Registrar of Co-operative Societies, not RBI/NHB/SEBI/IRDAI/PFRDA, so the 2022 IT Act amendment carving DPNs back into eSign eligibility does not apply)
5. Auction notice legal wording — lower priority given v1 auction scope is just a status tag, but the underlying question (what Vardhman must do outside the app at actual auction time) still needs resolution eventually

---

## 12. Genuinely open decisions (not blocking, tracked so nothing is silently assumed)

- Renewal rollover mechanic (a) rollover vs (b) full settlement — Section 5, pending Mukesh
- Cash disbursement cap variability mechanics — pending CA (Section 5, Section 11 #2)
- Whether email-only notifications are acceptable long-term, or SMS should be added back — Section 5
- Board size discrepancy: bylaws mandate a 21-member statutory Board; earlier notes describe an 11-member operative committee — likely two different bodies, needs direct confirmation from the actual Trust deed, not just the bylaws PDF
- Approver delegation if Chairman/equivalent officer is unavailable for a time-sensitive action — relevant once/if the full auction workflow re-enters app scope

---

## 13. Document Changelog

**Added 8 Sept 2026** to close a real gap: this file had no version tracking at all — just a "last updated" date, which gives no way to tell how far apart two copies have drifted (relevant now that physical copies exist in both Vault and Helper Tool repos, §3.6/§10). Versioning follows semver loosely: major = a locked rule reversed or replaced, minor = a new section/rule added, patch = clarification/typo/no rule-meaning change. Bump the version and add an entry here whenever the file changes materially — a diff without a changelog entry is exactly the kind of silent drift this exists to prevent.

| Version | Date        | What changed                                                                                                                                                                                                                                                             |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0.0   | 3 Sept 2026 | File created, consolidating `GOLD_LOAN_SOFTWARE_MASTER.md`, `CURSOR_HANDOFF.md`, and the day's app-logic session into one authoritative document for the first time                                                                                                      |
| 1.1.0   | 6 Sept 2026 | Progress Dashboard architecture (§3.5) added; external-tools research folded in (§3.2a) — Blnk evaluated as reference-only, `rlsautotest`/`supashield` adopted into CI, Aadhaar KYC libraries evaluated and rejected                                                     |
| 1.2.0   | 7 Sept 2026 | Product renamed Vardhman Vault (from working name "Vardhan"); Next.js 14→16 version decision resolved; Git workflow conventions added (§3.6) — commit format, branch naming, PR scope, merge strategy, closing a gap that had no written convention at all               |
| 1.3.0   | 8 Sept 2026 | Three-pass code audit completed (15 findings fixed — see `AUDIT_REPORT.md`); Helper Tool governance parity fixed (was missing `PROJECT_RULES.md` entirely — §3.6/§10 updated); GitHub Actions pinned to immutable SHAs (§3 note); this changelog and version field added |

---

_This file is maintained by Claude in planning conversations and should be re-synced into the actual repo (as `PROJECT_RULES.md` at repo root, with `CLAUDE.md` and Cursor's config both pointing to it) as soon as the repository exists._
