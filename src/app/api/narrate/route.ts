import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import type { BuildStatus } from "@/lib/types"

// The Anthropic SDK needs the Node.js runtime (not Edge), and this route
// must never be statically cached — it acts on live webhook payloads.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * PROJECT_RULES.md §3.5 — the piece flagged as "not built yet" in
 * DECISIONS.md (7 Sept 2026). Closes that gap.
 *
 * Trigger: a Supabase Database Webhook on `build_status` INSERT/UPDATE
 * (configure in Supabase dashboard: Database → Webhooks → new webhook →
 * table: build_status, events: INSERT, type: HTTP Request, URL: this
 * route's deployed URL, method: POST). Supabase sends the new row as
 * `{ record: {...} }` in the payload — see the webhook docs for the exact
 * shape if this ever needs adjusting.
 *
 * This is a narration layer ONLY — same generator/narrator split as the
 * main Analytics Dashboard (PROJECT_RULES.md §5). It never invents a
 * number; it only phrases numbers that are already in `record`. If you
 * find yourself asking Claude to *compute* phase_percent_complete or any
 * other figure here, stop — that violates the split this whole design is
 * built around.
 */

const SOURCE_LABEL: Record<BuildStatus["source"], string> = {
  cursor_local: "Cursor, working locally",
  cloud_agent: "A Cloud Agent, running remotely",
  claude_code: "Claude Code",
}

export async function POST(request: Request) {
  // Basic shared-secret check — Supabase webhooks support a custom header.
  // Not full auth, but keeps this endpoint from being trivially spammed.
  const secret = request.headers.get("x-webhook-secret")
  if (secret !== process.env.NARRATE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON" }, { status: 400 })
  }

  const record = (payload as { record?: BuildStatus }).record

  if (!record || typeof record.id !== "string") {
    return NextResponse.json({ error: "No valid record in payload" }, { status: 400 })
  }

  // Loop guard. This route WRITES plain_language_summary back onto the row.
  // If the Supabase webhook is configured to fire on UPDATE as well as
  // INSERT, that write would re-trigger this route forever. Two defenses:
  //   1. Configure the webhook for INSERT only (documented in route header
  //      and .env.example).
  //   2. Belt-and-braces: if this event already carries a summary, there's
  //      nothing to do — bail out. This makes an accidental UPDATE-trigger
  //      config a no-op rather than an infinite (and billable) loop.
  if (record.plain_language_summary) {
    return NextResponse.json({ ok: true, skipped: "summary already present" })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Deliberately small, cheap model call — this is a one-sentence status
  // narration, not a task that needs deep reasoning. Keep the prompt
  // narrow: it only ever sees the structured fields already computed
  // upstream, never asked to infer or calculate anything itself.
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `You are writing ONE short, plain-English status sentence for a live build dashboard. Do not invent any fact not given below. Do not calculate anything. Just phrase these facts naturally, the way a calm colleague would report status in passing.

Source: ${SOURCE_LABEL[record.source] ?? record.source}
Phase: ${record.current_phase} (${record.phase_percent_complete}% complete)
Branch: ${record.branch}${record.pr_number ? `, PR #${record.pr_number}` : ""}
Pass 1 status: ${record.pass1_status}
Pass 2 status: ${record.pass2_status}
Open decisions needing a human: ${record.open_decisions_count}
CA-blocked items: ${record.ca_blocked_items_count}
Latest commit: "${record.last_commit_message}"

One sentence only. No preamble, no markdown, no quotes around your answer.`,
      },
    ],
  })

  const textBlock = message.content.find((block) => block.type === "text")
  const summary = textBlock && "text" in textBlock ? textBlock.text.trim() : null

  if (!summary) {
    return NextResponse.json({ error: "No text in Claude response" }, { status: 502 })
  }

  // Write the narration back onto the SAME row — service-role key required,
  // since build_status's RLS policy has no anon/authenticated write access
  // by design (see supabase/migrations/0001_build_status.sql in the main
  // repo). This is the one place this app writes rather than only reads.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from("build_status")
    .update({ plain_language_summary: summary })
    .eq("id", record.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, summary })
}
