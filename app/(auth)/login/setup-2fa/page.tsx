"use client"

import { Check, Copy, Download, LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import { useEffect, useRef, useState } from "react"

import { AuthCard } from "@/components/md/auth-card"
import { takeReturn } from "@/components/md/session"
import { useToast } from "@/components/md/toast"
import { Banner, OtpInput, downloadText } from "@/components/md/ui"
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
  if (err === "LOGIN_CHALLENGE_INVALID") {
    return (
      <AuthCard center>
        <h1>Your setup step expired</h1>
        <p className="lead">Setting up two-factor must be done within 10 minutes of logging in. Log in again to restart it.</p>
        <Link className="btn primary block" href="/login">Log in again</Link>
      </AuthCard>
    )
  }

  const text = codes.join("\n")
  return (
    <AuthCard wide>
      <div className="steps">
        <span className={step === "scan" ? "cur" : "done"}>{step === "scan" ? "1 · Scan" : <><Check size={14} />Scan</>}</span>
        <span className={step === "confirm" ? "cur" : step === "codes" ? "done" : ""}>
          {step === "codes" ? <><Check size={14} />Confirm</> : "2 · Confirm"}
        </span>
        <span className={step === "codes" ? "cur" : ""}>3 · Save codes</span>
      </div>
      {err && !["INVALID_TWO_FACTOR_CODE"].includes(err) && <Banner tone="red" title="Something went wrong">{describe(error)}</Banner>}

      {step === "scan" && (
        <div>
          <h1>Protect your account</h1>
          <p className="lead">Two-factor is required for everyone. Scan this code with Google Authenticator, 1Password, Authy or similar.</p>
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
        </div>
      )}

      {step === "confirm" && (
        <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) confirm(code) }}>
          <h1>Confirm with a code</h1>
          <p className="lead">Type the 6-digit code your app shows now, to prove the setup works.</p>
          <OtpInput value={code} onChange={setCode} onComplete={confirm} invalid={err === "INVALID_TWO_FACTOR_CODE"} disabled={busy} />
          {err === "INVALID_TWO_FACTOR_CODE" && (
            <p className="err" style={{ justifyContent: "center", marginTop: 10 }} role="alert">
              That code didn&apos;t match. Check your phone&apos;s clock and try the next code.
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
          <p className="lead">If you lose your phone, each code lets you in once. Store them somewhere safe, like a password manager. You won&apos;t see them again.</p>
          <div className="codes">{codes.map((c) => <span key={c}>{c}</span>)}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => navigator.clipboard.writeText(text).then(() => toast(`${codes.length} codes copied`))}>
              <Copy />Copy
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => downloadText("masterdb-recovery-codes.txt", `MasterDB recovery codes\n\n${text}\n`)}>
              <Download />Download .txt
            </button>
          </div>
          <label className="check" style={{ margin: "20px 0" }}>
            <input type="checkbox" className="cb" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I&apos;ve saved my recovery codes
          </label>
          <button className="btn primary block" disabled={!saved} onClick={() => router.replace(takeReturn())}>
            Finish and open MasterDB
          </button>
        </div>
      )}
    </AuthCard>
  )
}
