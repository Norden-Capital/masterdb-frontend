"use client"

import { LoaderCircle, TimerOff } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { AuthCard, BackToLogin, useErrorToast } from "@/components/md/auth-card"
import { takeReturn } from "@/components/md/session"
import { FieldError, OtpInput, RecoveryCodeInput } from "@/components/md/ui"
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
  useErrorToast(error,
    err === "ACCOUNT_LOCKED" ? `Account locked. Try again in ${wait((error as ApiError).retryAfter)}.`
      : err === "RATE_LIMITED" ? `Too many attempts. ${describe(error)}`
        : err && !["INVALID_TWO_FACTOR_CODE", "LOGIN_CHALLENGE_INVALID"].includes(err) ? `Couldn't check the code. ${describe(error)}`
          : null)

  if (err === "LOGIN_CHALLENGE_INVALID") {
    return (
      <AuthCard center>
        <div className="icon-badge orange"><TimerOff /></div>
        <h1>Your sign-in expired</h1>
        <p className="lead">The code step lasts 10 minutes.</p>
        <Link className="btn primary block" href="/login">Log in again</Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard foot={<BackToLogin />}>
      {mode === "code" ? (
        <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) verify(code) }}>
          <h1>Enter your code</h1>
          <p className="lead">Enter the 6-digit code from your app.</p>
          <OtpInput value={code} onChange={setCode} onComplete={verify} invalid={err === "INVALID_TWO_FACTOR_CODE"} disabled={busy} />
          {err === "INVALID_TWO_FACTOR_CODE" && (
            <p className="err" style={{ justifyContent: "center", marginTop: 10 }} role="alert">
              Wrong code. Try the next one.
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
          <p className="lead">Each saved recovery code works once.</p>
          <div className="field">
            <span className="label" style={{ textAlign: "center" }}>Recovery code</span>
            <div><RecoveryCodeInput value={recovery} onChange={setRecovery} invalid={err === "INVALID_TWO_FACTOR_CODE"} disabled={busy} /></div>
            {err === "INVALID_TWO_FACTOR_CODE" && <div style={{ display: "flex", justifyContent: "center" }}><FieldError text="Not valid, or already used." /></div>}
          </div>
          <button className="btn primary block" type="submit" disabled={busy || recovery.replace("-", "").length < 10}>
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
