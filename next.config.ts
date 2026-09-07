import type { NextConfig } from "next"

// Phase 0 baseline hardening (added in the 8 Sept audit) — see the main
// vardhman-vault repo's next.config.ts for the fuller rationale. Same
// conservative header set. X-Frame-Options DENY matters a little more here:
// this dashboard shows real build/business status behind a password gate,
// and should never be embeddable in an iframe on another site.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
