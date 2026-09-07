"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push("/")
      router.refresh()
    } else {
      setError(true)
    }
  }

  return (
    <main className="bg-ambient-bg flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="glow-border bg-ambient-panel w-full max-w-sm rounded-lg p-8"
      >
        <p className="glow-text mb-4 text-center text-lg">Vardhman Vault</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="border-ambient-glow-dim bg-ambient-bg text-ambient-text w-full rounded border px-3 py-2 outline-none"
          autoFocus
        />
        {error && <p className="text-ambient-alert mt-2 text-sm">Incorrect password</p>}
        <button
          type="submit"
          className="bg-ambient-glow-dim text-ambient-text mt-4 w-full rounded py-2 hover:opacity-90"
        >
          Enter
        </button>
      </form>
    </main>
  )
}
