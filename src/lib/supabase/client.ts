import { createBrowserClient } from "@supabase/ssr"

// PROJECT_RULES.md §3.5 — this is the ONLY client the dashboard needs.
// Realtime subscriptions run over this connection; there is no polling loop
// anywhere in this app. If you're adding a setInterval to refetch status,
// stop — that defeats the entire point of the Realtime architecture.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
