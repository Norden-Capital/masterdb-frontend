"use client"

import { LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { AuthCard, BackToLogin } from "@/components/md/auth-card"
import { takeReturn } from "@/components/md/session"
import { Banner, FieldError } from "@/components/md/ui"
import { OtpInput } from "@/components/md/ui"
import { api, ApiError, describe, wait } from "@/lib/api"

/** Mock 02: the authenticator code, or a recovery code. */
export default function TwoFactorPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"code" | "recovery">("code")
  const [code, setCode] = useState("")
  const [recovery, setRecovery] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | Error | null>(null)

  useEffect(() => {
    document.title = "Two-factor · MasterDB"
  }, [])

  async function verify(value: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api("/api/v1/auth/login/2fa", { body: { code: value } })
      router.replace(takeReturn())
    } catch (e) {
      setError(e as Error)
      setBusy(false)
      if (mode === "code") setCode("")
    }
  }

  const err = error instanceof ApiError ? error.code : error ? "OTHER" : null

  if (err === "LOGIN_CHALLENGE_INVALID") {
    return (
      <AuthCard center>
        <h1>Your sign-in expired</h1>
        <p className="lead">The code step lasts 10 minutes. Log in again with your password.</p>
        <Link className="btn primary block" href="/login">Log in again</Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard foot={<BackToLogin />}>
      {err === "ACCOUNT_LOCKED" && (
        <Banner tone="amber" title="Account temporarily locked">
          Too many wrong codes. Try again in {wait((error as ApiError).retryAfter)}.
        </Banner>
      )}
      {err === "RATE_LIMITED" && <Banner tone="amber" title="Too many attempts">{describe(error)}</Banner>}
      {err && !["ACCOUNT_LOCKED", "RATE_LIMITED", "INVALID_TWO_FACTOR_CODE"].includes(err) && (
        <Banner tone="red" title="Couldn't check the code">{describe(error)}</Banner>
      )}
      {mode === "code" ? (
        <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) verify(code) }}>
          <h1>Enter your code</h1>
          <p className="lead">Open your authenticator app and type the 6-digit code for MasterDB.</p>
          <OtpInput value={code} onChange={setCode} onComplete={verify} invalid={err === "INVALID_TWO_FACTOR_CODE"} disabled={busy} />
          {err === "INVALID_TWO_FACTOR_CODE" && (
            <p className="err" style={{ justifyContent: "center", marginTop: 10 }} role="alert">
              That code didn&apos;t work. Codes change every 30 seconds.
            </p>
          )}
          <div style={{ marginTop: 24 }}>
            <button className="btn primary block" type="submit" disabled={busy || code.length !== 6}>
              {busy ? <><LoaderCircle className="spin" />Checking…</> : "Verify"}
            </button>
          </div>
          <p style={{ marginTop: 20, textAlign: "center" }}>
            <button type="button" className="link-btn" onClick={() => { setMode("recovery"); setError(null) }}>
              Use a recovery code instead
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verify(recovery) }}>
          <h1>Use a recovery code</h1>
          <p className="lead">Type one of the recovery codes you saved when you set up two-factor. Each code works once.</p>
          <div className="field">
            <label className="label" htmlFor="rc">Recovery code</label>
            <input id="rc" className={`input mono ${err === "INVALID_TWO_FACTOR_CODE" ? "invalid" : ""}`} placeholder="xxxxx-xxxxx"
              autoComplete="off" value={recovery} onChange={(e) => setRecovery(e.target.value)} autoFocus />
            {err === "INVALID_TWO_FACTOR_CODE" && <FieldError text="That code is not valid or was already used." />}
          </div>
          <button className="btn primary block" type="submit" disabled={busy || recovery.trim().length < 10}>
            {busy ? <><LoaderCircle className="spin" />Checking…</> : "Verify"}
          </button>
          <p style={{ marginTop: 20, textAlign: "center" }}>
            <button type="button" className="link-btn" onClick={() => { setMode("code"); setError(null) }}>
              Back to authenticator code
            </button>
          </p>
          <p className="help" style={{ textAlign: "center", marginTop: 12 }}>Lost both? Ask an Owner to reset your two-factor.</p>
        </form>
      )}
    </AuthCard>
  )
}
