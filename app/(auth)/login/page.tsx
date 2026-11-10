"use client"

import { LoaderCircle, Mail } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { AuthCard, useErrorToast } from "@/components/md/auth-card"
import { rememberReturn } from "@/components/md/session"
import { FieldError, PasswordField } from "@/components/md/ui"
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
  const [lockEnds, setLockEnds] = useState<number | undefined>(undefined)

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
      if (err instanceof ApiError && err.code === "ACCOUNT_LOCKED") {
        const sec = err.retryAfter ?? 900
        setLockedFor(sec)
        setLockEnds(Date.now() + sec * 1000)
      }
      setPassword("")
      setBusy(false)
    }
  }

  const code = error instanceof ApiError ? error.code : null
  const mmss = `${Math.floor(lockedFor / 60)}:${String(lockedFor % 60).padStart(2, "0")}`

  useErrorToast(error,
    code === "ACCOUNT_LOCKED" ? "Account locked. Try again in {time} or reset your password."
      : code === "RATE_LIMITED" ? `Too many attempts. Wait ${wait((error as ApiError).retryAfter)}, then try again.`
        : error && !["INVALID_CREDENTIALS", "VALIDATION_FAILED"].includes(code ?? "") ? `Couldn't log in. ${describe(error)}`
          : null,
    code === "ACCOUNT_LOCKED" ? lockEnds : undefined)

  return (
    <AuthCard foot={<>Two-factor sign-in is required for every account.<br />Need access? Ask an Owner for an invite.</>}>
      <h1>Welcome to MasterDB</h1>
      <p className="lead">Log in with your Norden Capital account.</p>
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
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        <PasswordField id="password" label="Password" value={password} onChange={setPassword}
          autoComplete="current-password" placeholder="Enter your password" />
        {code === "INVALID_CREDENTIALS" && <div style={{ marginTop: -10, marginBottom: 12 }}><FieldError text="Email or password is incorrect" /></div>}
        <button className="btn primary block" type="submit" disabled={busy || lockedFor > 0 || !email || !password}>
          {busy ? <><LoaderCircle className="spin" />Logging in…</> : lockedFor > 0 ? <>Locked · <span className="num">{mmss}</span></> : "Log in"}
        </button>
      </form>
    </AuthCard>
  )
}
