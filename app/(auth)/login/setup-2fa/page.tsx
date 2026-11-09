"use client"

import { Copy, Download, Info, KeyRound, LoaderCircle, TimerOff } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import { useEffect, useRef, useState } from "react"

import { AuthCard, useErrorToast } from "@/components/md/auth-card"
import { takeReturn } from "@/components/md/session"
import { useToast } from "@/components/md/toast"
import { OtpInput, Stepper, downloadText } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import type { LoginResponse } from "@/lib/types"

type Setup = { secret: string; otpauthUri: string; issuer: string; account: string }

/** Mock 03: scan → confirm → save recovery codes. Reached from the first login or an accepted invite. */
export default function TwoFactorSetupPage() {
  const router = useRouter()
  const toast = useToast()
  const [step, setStep] = useState<"scan" | "confirm" | "codes">("scan")
  const [setup, setSetup] = useState<Setup | null>(null)
  const [qr, setQr] = useState("")
  const [code, setCode] = useState("")
  const [codes, setCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | Error | null>(null)
  // Each call makes a new secret: ask once, even when React runs effects twice in development.
  const asked = useRef(false)

  useEffect(() => {
    document.title = "Set up two-factor · MasterDB"
    if (asked.current) return
    asked.current = true
    api<Setup>("/api/v1/auth/2fa/setup", { method: "POST" })
      .then(async (s) => {
        setSetup(s)
        setQr(await QRCode.toString(s.otpauthUri, { type: "svg", margin: 0, errorCorrectionLevel: "M",
          color: { dark: "#262A2E", light: "#FFFFFF" } }))
      })
      .catch((e) => setError(e))
  }, [])

  async function confirm(value: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api<LoginResponse>("/api/v1/auth/2fa/setup/confirm", { body: { code: value } })
      setCodes(res.recoveryCodes ?? [])
      setStep("codes")
    } catch (e) {
      setError(e as Error)
      setCode("")
    } finally {
      setBusy(false)
    }
  }

  const err = error instanceof ApiError ? error.code : error ? "OTHER" : null
  useErrorToast(error, err && !["INVALID_TWO_FACTOR_CODE", "LOGIN_CHALLENGE_INVALID"].includes(err) ? `Something went wrong. ${describe(error)}` : null)
  if (err === "LOGIN_CHALLENGE_INVALID") {
    return (
      <AuthCard center>
        <div className="icon-badge orange"><TimerOff /></div>
        <h1>Your setup step expired</h1>
        <p className="lead">Log in again to restart it.</p>
        <Link className="btn primary block" href="/login">Log in again</Link>
        <p className="help" style={{ marginTop: 14 }}>Two-factor must be set up within 10 minutes of logging in.</p>
      </AuthCard>
    )
  }

  const text = codes.join("\n")
  return (
    <AuthCard wide>
      <Stepper label="Setup steps" steps={["Scan", "Confirm", "Save codes"]} current={step === "scan" ? 0 : step === "confirm" ? 1 : 2} />

      {step === "scan" && (
        <div>
          <h1>Protect your account</h1>
          <p className="lead">Scan this code with your authenticator app.</p>
          <div className="qr" aria-label="QR code for your authenticator app" role="img"
            dangerouslySetInnerHTML={{ __html: qr }} />
          {setup && (
            <div className="secret">
              Can&apos;t scan? Key: <b style={{ color: "var(--fg)" }}>{setup.secret.match(/.{1,4}/g)?.join(" ")}</b>
              <button className="round" style={{ width: 30, height: 30 }} title="Copy key" aria-label="Copy key"
                onClick={() => navigator.clipboard.writeText(setup.secret).then(() => toast("Key copied"))}>
                <Copy size={14} />
              </button>
            </div>
          )}
          <button className="btn primary block" style={{ marginTop: 24 }} disabled={!setup} onClick={() => setStep("confirm")}>
            I&apos;ve scanned it
          </button>
          <p className="help" style={{ marginTop: 14 }}>Two-factor is required for everyone. Google Authenticator, 1Password or Authy all work.</p>
        </div>
      )}

      {step === "confirm" && (
        <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) confirm(code) }}>
          <h1>Confirm with a code</h1>
          <p className="lead">Type the code your app shows now.</p>
          <OtpInput value={code} onChange={setCode} onComplete={confirm} invalid={err === "INVALID_TWO_FACTOR_CODE"} disabled={busy} />
          {err === "INVALID_TWO_FACTOR_CODE" && (
            <p className="err" style={{ justifyContent: "center", marginTop: 10 }} role="alert">
              Wrong code. Check your phone&apos;s clock.
            </p>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button type="button" className="btn" onClick={() => setStep("scan")}>Back</button>
            <button className="btn primary" style={{ flex: 1 }} disabled={busy || code.length !== 6}>
              {busy ? <><LoaderCircle className="spin" />Checking…</> : "Confirm"}
            </button>
          </div>
        </form>
      )}

      {step === "codes" && (
        <div>
          <h1>Save your recovery codes</h1>
          <p className="lead">Keep them safe. You won&apos;t see them again.</p>
          <div className="codes-card">
            <div className="codes-head">
              <span><KeyRound />{codes.length} recovery codes</span>
              <span className="codes-actions">
                <button className="icon-btn" title="Copy all codes" aria-label="Copy all codes"
                  onClick={() => navigator.clipboard.writeText(text).then(() => toast(`${codes.length} codes copied`))}><Copy /></button>
                <button className="icon-btn" title="Download as .txt" aria-label="Download as .txt"
                  onClick={() => downloadText("masterdb-recovery-codes.txt", `MasterDB recovery codes

${text}
`)}><Download /></button>
              </span>
            </div>
            <ol className="codes-list">
              {codes.map((c, i) => <li key={c}><span className="n">{String(i + 1).padStart(2, "0")}</span><code>{c}</code></li>)}
            </ol>
          </div>
          <p className="help codes-note"><Info />Each code lets you in once if you lose your phone.</p>
          <label className="confirm-row">
            <input type="checkbox" className="cb" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I&apos;ve saved these codes somewhere safe
          </label>
          <button className="btn primary block" disabled={!saved} onClick={() => router.replace(takeReturn())}>
            Finish and open MasterDB
          </button>
        </div>
      )}
    </AuthCard>
  )
}
