import { NextResponse } from "next/server"
import { createHash } from "crypto"

export const runtime = "nodejs"

// PROJECT_RULES.md §3.5 — this dashboard shows real build/business status,
// so it's password-gated even though "temporary" in spirit. Deliberately
// simple (one shared password) — not a full auth system, just a lock on the
// door. Two hardening choices worth noting:
//   1. The cookie stores a SHA-256 hash of the password, not the password
//      itself — so a leaked cookie doesn't hand over the plaintext password.
//      The proxy compares against the same hash. (Weak against a determined
//      attacker who has the cookie, but that's out of scope for an internal
//      build dashboard; the point is not to echo the secret back in a cookie.)
//   2. Malformed JSON is caught rather than throwing an unhandled 500.
export async function POST(request: Request) {
  let password: unknown
  try {
    const body = await request.json()
    password = body?.password
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) {
    // Fail closed: if the server has no password configured, never grant access.
    return NextResponse.json({ error: "Server not configured" }, { status: 500 })
  }

  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
  }

  const token = createHash("sha256").update(expected).digest("hex")
  const response = NextResponse.json({ ok: true })
  response.cookies.set("dashboard_auth", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  })
  return response
}
