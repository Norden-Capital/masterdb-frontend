"use client"

import { LoaderCircle, LockKeyhole, Mail } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { AuthCard } from "@/components/md/auth-card"
import { rememberReturn } from "@/components/md/session"
import { Banner, FieldError, PasswordField } from "@/components/md/ui"
import { api, ApiError, describe, wait } from "@/lib/api"
import type { LoginResponse } from "@/lib/types"

/** Mock 01: email + password, then the 2FA step. */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [lockedFor, setLockedFor] = useState(0)

  useEffect(() => {
    document.title = "Log in · MasterDB"
    const next = new URLSearchParams(window.location.search).get("next")
    if (next) rememberReturn(next)
  }, [])

  // Live countdown while the account is locked.
  useEffect(() => {
    if (lockedFor <= 0) return
    const t = setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [lockedFor])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api<LoginResponse>("/api/v1/auth/login", { body: { email, password } })
      router.push(res.state === "TWO_FACTOR_SETUP_REQUIRED" ? "/login/setup-2fa" : "/login/2fa")
    } catch (err) {
      setError(err as Error)
      if (err instanceof ApiError && err.code === "ACCOUNT_LOCKED") setLockedFor(err.retryAfter ?? 900)
      setPassword("")
      setBusy(false)
    }
  }

  const code = error instanceof ApiError ? error.code : null
  const mmss = `${Math.floor(lockedFor / 60)}:${String(lockedFor % 60).padStart(2, "0")}`

  return (
    <AuthCard foot="Access is by invitation only. Ask an Owner for an invite.">
      <h1>Log in</h1>
      <p className="lead">Welcome back. Use your Norden Capital account.</p>
      {code === "INVALID_CREDENTIALS" && (
        <Banner tone="red" title="Email or password is incorrect">
          Check both and try again. After 5 wrong attempts the account is locked for 15 minutes.
        </Banner>
      )}
      {code === "ACCOUNT_LOCKED" && lockedFor > 0 && (
        <Banner tone="amber" icon={<LockKeyhole />} title="Account temporarily locked">
          Too many failed attempts. Try again in <span className="num">{mmss}</span>, or{" "}
          <Link href="/forgot-password">reset your password</Link>.
        </Banner>
      )}
      {code === "RATE_LIMITED" && (
        <Banner tone="amber" title="Too many attempts">Wait {wait((error as ApiError).retryAfter)} and try again.</Banner>
      )}
      {error && !["INVALID_CREDENTIALS", "ACCOUNT_LOCKED", "RATE_LIMITED", "VALIDATION_FAILED"].includes(code ?? "") && (
        <Banner tone="red" title="Couldn't log in">{describe(error)}</Banner>
      )}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <div className="input-wrap">
            <Mail />
            <input id="email" className="input" type="email" placeholder="name@nordencapital.ca" autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
        </div>
        <div className="label-row" style={{ marginBottom: -22, position: "relative", zIndex: 1 }}>
          <span />
          <Link href="/forgot-password" className="small">Forgot password?</Link>
        </div>
        <PasswordField id="password" label="Password" value={password} onChange={setPassword}
          autoComplete="current-password" />
        {code === "INVALID_CREDENTIALS" && <div style={{ marginTop: -10, marginBottom: 12 }}><FieldError text="Email or password is incorrect" /></div>}
        <button className="btn primary block" type="submit" disabled={busy || lockedFor > 0 || !email || !password}>
          {busy ? <><LoaderCircle className="spin" />Logging in…</> : "Log in"}
        </button>
      </form>
    </AuthCard>
  )
}
