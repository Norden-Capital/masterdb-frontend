"use client"

import { CircleCheck, ClockAlert, LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { AuthCard, useErrorToast } from "@/components/md/auth-card"
import { PasswordField } from "@/components/md/ui"
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

  const serverField = error instanceof ApiError ? error.field("password") : undefined
  useErrorToast(error, error && !serverField ? `Couldn't save the password. ${describe(error)}` : null)
  if (state === "checking") return <AuthCard center><p className="muted">Checking your link…</p></AuthCard>
  if (state === "expired") {
    return (
      <AuthCard center>
        <div className="icon-badge amber"><ClockAlert /></div>
        <h1>This link has expired</h1>
        <p className="lead">Reset links work once, for 30 minutes.</p>
        <Link className="btn primary block" href="/forgot-password">Send a new link</Link>
      </AuthCard>
    )
  }
  if (state === "done") {
    return (
      <AuthCard center>
        <div className="icon-badge green"><CircleCheck /></div>
        <h1>Password updated</h1>
        <p className="lead">Log in with your new password.</p>
        <Link className="btn primary block" href="/login">Log in</Link>
        <p className="help" style={{ marginTop: 14 }}>You&apos;ve been logged out everywhere. You&apos;ll also need your authenticator code.</p>
      </AuthCard>
    )
  }
  return (
    <AuthCard>
      <h1>Choose a new password</h1>
      <p className="lead">{MIN_PASSWORD}+ characters. A few unrelated words work well.</p>
      <form onSubmit={save} noValidate>
        <PasswordField id="pw" label="New password" value={password} onChange={setPassword} meter placeholder="Enter a new password"
          error={serverField ?? (tried && short ? `Too short. Use ${MIN_PASSWORD}+ characters.`
            : tooLong(password) ? "Too long (72 bytes at most)." : undefined)} />
        <PasswordField id="pw2" label="Repeat new password" value={repeat} onChange={setRepeat} placeholder="Type the new password again"
          error={tried && mismatch ? "Passwords don't match" : undefined} />
        <button className="btn primary block" disabled={busy}>
          {busy ? <><LoaderCircle className="spin" />Saving…</> : "Save password"}
        </button>
        <p className="help" style={{ marginTop: 14 }}>Saving logs you out of all devices.</p>
      </form>
    </AuthCard>
  )
}
