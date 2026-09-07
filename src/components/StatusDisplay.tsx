"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { BuildStatus } from "@/lib/types"

const SOURCE_LABEL: Record<BuildStatus["source"], string> = {
  cursor_local: "Cursor (local)",
  cloud_agent: "Cloud Agent",
  claude_code: "Claude Code",
}

function StatusPill({ status }: { status: BuildStatus["pass1_status"] }) {
  const color =
    status === "passed"
      ? "text-ambient-glow"
      : status === "failed"
        ? "text-ambient-alert"
        : "text-ambient-text-dim"
  return <span className={color}>{status}</span>
}

/**
 * PROJECT_RULES.md §3.5 — no polling loop here. Supabase Realtime pushes an
 * update to every connected device the instant a row changes in
 * `build_status`. This component only ever reacts to that push.
 */
export function StatusDisplay() {
  const [status, setStatus] = useState<BuildStatus | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    // Initial fetch — the one time this app actually queries instead of
    // waiting for a push, since there's nothing to react to yet on load.
    // Explicit catch: an unhandled rejection here (network down, RLS
    // misconfig) would otherwise surface as a console error with no UI
    // feedback. `cancelled` guards against a state update after unmount.
    void supabase
      .from("build_status")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error("Initial build_status fetch failed:", error.message)
          return
        }
        if (data) setStatus(data as BuildStatus)
      })

    const channel = supabase
      .channel("build_status_live")
      .on(
        "postgres_changes",
        // INSERT and UPDATE only — NOT "*". A DELETE event carries an empty
        // `payload.new` ({}), which would blank the display and then throw
        // on the next `.slice()`/property access. build_status rows are only
        // ever inserted/updated in normal operation anyway.
        { event: "INSERT", schema: "public", table: "build_status" },
        (payload) => {
          if (!cancelled) setStatus(payload.new as BuildStatus)
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "build_status" },
        (payload) => {
          if (!cancelled) setStatus(payload.new as BuildStatus)
        }
      )
      .subscribe((subStatus) => {
        if (!cancelled) setConnected(subStatus === "SUBSCRIBED")
      })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [])

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-ambient-text-dim">Waiting for first status update…</p>
      </div>
    )
  }

  return (
    <main className="bg-ambient-bg tablet:px-8 laptop:px-16 laptop:py-12 min-h-screen px-4 py-6">
      {/* Live connection indicator — same on every device */}
      <div className="text-ambient-text-dim mb-6 flex items-center gap-2 text-xs">
        <span
          className={`live-dot h-2 w-2 rounded-full ${connected ? "bg-ambient-glow" : "bg-ambient-alert"}`}
        />
        {connected ? "Live" : "Reconnecting…"}
      </div>

      {/*
        Phone (default, no prefix — Galaxy S25 Ultra ~384-480px):
          plain-language summary leads, stacked cards below.
        Tablet (Xiaomi Pad 7, 768px+):
          two-column — ambient numbers left, narration right.
        Laptop (MacBook M1 Air 13", 1280px+):
          full cinematic layout, larger type, more breathing room.
      */}
      <div className="tablet:grid-cols-[1fr_1.2fr] laptop:gap-12 grid grid-cols-1 gap-6">
        {/* Plain-language narration — leads on phone, sits right on tablet+ */}
        <div className="tablet:order-2 order-1">
          <p className="glow-text tablet:text-xl laptop:text-2xl text-lg leading-relaxed">
            {status.plain_language_summary ??
              `${SOURCE_LABEL[status.source]} is working on ${status.current_phase}.`}
          </p>
          <p className="text-ambient-text-dim mt-3 text-sm">
            {SOURCE_LABEL[status.source]} · branch {status.branch}
            {status.pr_number ? ` · PR #${status.pr_number}` : ""}
          </p>
        </div>

        {/* Ambient numbers */}
        <div className="tablet:order-1 tablet:grid-cols-2 laptop:gap-6 order-2 grid grid-cols-2 gap-4">
          <div className="glow-border bg-ambient-panel laptop:p-8 rounded-lg p-4">
            <p className="text-ambient-text-dim text-xs">Phase</p>
            <p className="glow-text laptop:text-4xl mt-1 text-2xl font-semibold">
              {status.current_phase}
            </p>
            <p className="text-ambient-text-dim mt-1 text-sm">
              {status.phase_percent_complete}% complete
            </p>
          </div>

          <div className="glow-border bg-ambient-panel laptop:p-8 rounded-lg p-4">
            <p className="text-ambient-text-dim text-xs">Pass 1 / Pass 2</p>
            <p className="laptop:text-4xl mt-1 text-2xl font-semibold">
              <StatusPill status={status.pass1_status} /> /{" "}
              <StatusPill status={status.pass2_status} />
            </p>
          </div>

          <div className="glow-border bg-ambient-panel laptop:p-8 rounded-lg p-4">
            <p className="text-ambient-text-dim text-xs">Open decisions</p>
            <p className="laptop:text-4xl mt-1 text-2xl font-semibold">
              {status.open_decisions_count}
            </p>
          </div>

          <div className="glow-border bg-ambient-panel laptop:p-8 rounded-lg p-4">
            <p className="text-ambient-text-dim text-xs">CA-blocked items</p>
            <p
              className={`laptop:text-4xl mt-1 text-2xl font-semibold ${status.ca_blocked_items_count > 0 ? "text-ambient-alert" : ""}`}
            >
              {status.ca_blocked_items_count}
            </p>
          </div>
        </div>
      </div>

      {/* Recent build log excerpt — full width, all devices */}
      <div className="glow-border bg-ambient-panel laptop:mt-12 laptop:p-8 order-3 mt-6 rounded-lg p-4">
        <p className="text-ambient-text-dim mb-2 text-xs">Recent activity</p>
        <pre className="text-ambient-text-dim text-sm whitespace-pre-wrap">
          {status.recent_build_log_excerpt}
        </pre>
        <p className="text-ambient-text-dim mt-3 text-xs">
          {status.last_commit_sha.slice(0, 7)} — {status.last_commit_message}
        </p>
      </div>
    </main>
  )
}
