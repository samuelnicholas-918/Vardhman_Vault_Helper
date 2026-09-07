import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Vardhman Vault — Build Status",
  description: "Live progress dashboard for the Vardhman Vault (GLMS) build.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-mono">{children}</body>
    </html>
  )
}
