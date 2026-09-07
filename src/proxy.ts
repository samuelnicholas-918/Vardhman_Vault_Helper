import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createHash } from "crypto"

// NOTE: no `export const runtime` here — this Next.js version rejects route
// segment config in a proxy file, and proxy always runs on the Node.js
// runtime anyway (which is why `crypto` below is available). Confirmed via a
// build error during the 8 Sept audit; see BUILD_LOG.md.
//
// /api/narrate is deliberately excluded below — it's called by a Supabase
// Database Webhook (server-to-server), which has no browser cookie to send.
// It has its own shared-secret check instead (see its route.ts). Every
// other route stays behind the cookie gate.
//
// The cookie holds a SHA-256 hash of DASHBOARD_PASSWORD (set by the login
// route), not the password itself — so this compares against the same hash.
// Must stay in lockstep with api/auth/login/route.ts: if one changes how the
// token is derived, the other must change identically or login breaks.
export function proxy(request: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) {
    // Fail closed — no configured password means no access, ever.
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const expectedToken = createHash("sha256").update(expected).digest("hex")
  const authCookie = request.cookies.get("dashboard_auth")

  if (authCookie?.value !== expectedToken) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!login|api/auth/login|api/narrate|_next/static|_next/image|favicon.ico).*)"],
}
