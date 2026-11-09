"use client"

import { LoaderCircle, Mail, MailCheck } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { AuthCard, BackToLogin, useErrorToast } from "@/components/md/auth-card"
import { useToast } from "@/components/md/toast"
import { api, describe } from "@/lib/api"

/** Mock 04. The answer is the same whether the email has an account (the backend never says). */
export default function ForgotPasswordPage() {
  const toast = useToast()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    document.title = "Reset password · MasterDB"
  }, [])

  async function send(again = false) {
    setBusy(true)
    setError(null)
    try {
      await api("/api/v1/auth/password/forgot", { body: { email } })
      setSent(true)
      if (again) toast("Link sent again")
    } catch (e) {
      if (again) toast(describe(e), "bad")
      else setError(e)
    } finally {
      setBusy(false)
    }
  }

  useErrorToast(error, error ? `Couldn't send the email. ${describe(error)}` : null)

  if (sent) {
    return (
      <AuthCard center>
        <div className="icon-badge green"><MailCheck /></div>
        <h1>Check your email</h1>
        <p className="lead">We sent a link to <b style={{ color: "var(--fg)" }}>{email}</b></p>
        <Link className="btn block" href="/login">Go back</Link>
        <p className="help" style={{ marginTop: 16 }}>
          Only if that email has an account. The link expires in 30 minutes. Nothing after 5 minutes? Check spam, or{" "}
          <button className="link-btn" onClick={() => send(true)} disabled={busy}>send it again</button>.
        </p>
      </AuthCard>
    )
  }
  return (
    <AuthCard foot={<BackToLogin />}>
      <h1>Reset your password</h1>
      <p className="lead">We&apos;ll email you a link to set a new one.</p>
      <form onSubmit={(e) => { e.preventDefault(); send() }}>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <div className="input-wrap"><Mail />
            <input id="email" className="input" type="email" placeholder="name@nordencapital.ca" autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
        </div>
        <button className="btn primary block" disabled={busy || !email.includes("@")}>
          {busy ? <><LoaderCircle className="spin" />Sending…</> : "Send reset link"}
        </button>
      </form>
    </AuthCard>
  )
}
