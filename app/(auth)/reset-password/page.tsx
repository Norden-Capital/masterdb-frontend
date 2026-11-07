"use client"

import { CircleCheck, ClockAlert, LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { AuthCard } from "@/components/md/auth-card"
import { Banner, PasswordField } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import { takeLinkToken } from "@/lib/link-token"
import { MIN_PASSWORD, tooLong } from "@/lib/password"

/** Mock 05. Token from the link's #fragment. */
export default function ResetPasswordPage() {
  const token = useRef<string | null>(null)
  const [state, setState] = useState<"checking" | "form" | "expired" | "done">("checking")
  const [password, setPassword] = useState("")
  const [repeat, setRepeat] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    document.title = "Choose a new password · MasterDB"
    if (token.current === null) token.current = takeLinkToken()
    if (!token.current) {
      setState("expired")
      return
    }
    api("/api/v1/auth/password/reset/check", { body: { token: token.current } })
      .then(() => setState("form"))
      .catch((e) => (e instanceof ApiError && e.code === "LINK_INVALID" ? setState("expired") : (setError(e), setState("form"))))
  }, [])

  const short = [...password].length < MIN_PASSWORD
  const mismatch = repeat !== password

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (short || mismatch || tooLong(password)) return
    setBusy(true)
    setError(null)
    try {
      await api("/api/v1/auth/password/reset", { body: { token: token.current, password } })
      setState("done")
    } catch (err) {
      if (err instanceof ApiError && err.code === "LINK_INVALID") setState("expired")
      else setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (state === "checking") return <AuthCard center><p className="muted">Checking your link…</p></AuthCard>
  if (state === "expired") {
    return (
      <AuthCard center>
        <div className="icon-badge amber"><ClockAlert /></div>
        <h1>This link has expired</h1>
        <p className="lead">Reset links work for 30 minutes and only once. Ask for a new one.</p>
        <Link className="btn primary block" href="/forgot-password">Send a new link</Link>
      </AuthCard>
    )
  }
  if (state === "done") {
    return (
      <AuthCard center>
        <div className="icon-badge green"><CircleCheck /></div>
        <h1>Password updated</h1>
        <p className="lead">You&apos;ve been logged out everywhere. Log in with your new password and your authenticator code.</p>
        <Link className="btn primary block" href="/login">Log in</Link>
      </AuthCard>
    )
  }
  const serverField = error instanceof ApiError ? error.field("password") : undefined
  return (
    <AuthCard>
      <h1>Choose a new password</h1>
      <p className="lead">At least {MIN_PASSWORD} characters. A few unrelated words make a strong one.</p>
      {error && !serverField ? <Banner tone="red" title="Couldn't save the password">{describe(error)}</Banner> : null}
      <form onSubmit={save} noValidate>
        <PasswordField id="pw" label="New password" value={password} onChange={setPassword} meter
          error={serverField ?? (tried && short ? `Too short. Use at least ${MIN_PASSWORD} characters.`
            : tooLong(password) ? "Too long (72 bytes at most)." : undefined)} />
        <PasswordField id="pw2" label="Repeat new password" value={repeat} onChange={setRepeat}
          error={tried && mismatch ? "Passwords don't match" : undefined} />
        <button className="btn primary block" disabled={busy}>
          {busy ? <><LoaderCircle className="spin" />Saving…</> : "Save password"}
        </button>
        <p className="help" style={{ marginTop: 14 }}>Saving logs you out of all devices.</p>
      </form>
    </AuthCard>
  )
}
