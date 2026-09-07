// Shape of a row in the `build_status` Supabase table, written by
// .github/workflows/ci.yml's status-update job (see PROJECT_RULES.md §3.5).
// This file is the contract between the CI pipeline and this dashboard —
// if you change one, change both.
export interface BuildStatus {
  id: string
  source: "cursor_local" | "cloud_agent" | "claude_code"
  branch: string
  pr_number: number | null
  current_phase: string
  phase_percent_complete: number
  last_commit_sha: string
  last_commit_message: string
  pass1_status: "pending" | "passed" | "failed" | "n/a"
  pass2_status: "pending" | "passed" | "failed" | "n/a"
  open_decisions_count: number
  ca_blocked_items_count: number
  recent_build_log_excerpt: string
  plain_language_summary: string | null
  updated_at: string
}
