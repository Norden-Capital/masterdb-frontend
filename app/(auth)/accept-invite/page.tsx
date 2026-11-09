"use client"

import { LoaderCircle, MailX } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { AuthCard, useErrorToast } from "@/components/md/auth-card"
import { PasswordField, Stepper } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import { takeLinkToken } from "@/lib/link-token"
import { MIN_PASSWORD, tooLong } from "@/lib/password"

type Invite = { email: string; fullName?: string; expiresAt: string }

/** Mock 06: name + password, then the 2FA setup (mock 03). */
export default function AcceptInvitePage() {
  const router = useRouter()
  const token = useRef<string | null>(null)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [state, setState] = useState<"checking" | "form" | "expired">("checking")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [repeat, setRepeat] = useState("")
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    document.title = "Join MasterDB"
    if (token.current === null) token.current = takeLinkToken()
    if (!token.current) {
      setState("expired")
      return
    }
    api<Invite>("/api/v1/invites/check", { body: { token: token.current } })
      .then((i) => {
        setInvite(i)
        setName(i.fullName ?? "")
        setState("form")
      })
      .catch((e) => (e instanceof ApiError && e.code === "LINK_INVALID" ? setState("expired") : (setError(e), setState("form"))))
  }, [])

  const short = [...password].length < MIN_PASSWORD
  const mismatch = repeat !== password

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!name.trim() || short || mismatch || tooLong(password)) return
    setBusy(true)
    setError(null)
    try {
      await api("/api/v1/invites/accept", { body: { token: token.current, fullName: name.trim(), password } })
      router.replace("/login/setup-2fa")
    } catch (err) {
      if (err instanceof ApiError && err.code === "LINK_INVALID") setState("expired")
      else setError(err)
      setBusy(false)
    }
  }

  const serverField = error instanceof ApiError ? error.field("password") ?? error.field("fullName") : undefined
  useErrorToast(error, error && !serverField ? `Couldn't create your account. ${describe(error)}` : null)
  if (state === "checking") return <AuthCard center><p className="muted">Checking your invitation…</p></AuthCard>
  if (state === "expired") {
    return (
      <AuthCard center>
        <div className="icon-badge amber"><MailX /></div>
        <h1>This invite has expired</h1>
        <p className="lead">Ask the person who invited you for a new one.</p>
        <Link className="btn block" href="/login">Go to log in</Link>
        <p className="help" style={{ marginTop: 14 }}>Invites are valid for 72 hours and work once.</p>
      </AuthCard>
    )
  }
  return (
    <AuthCard>
      <Stepper label="Steps" steps={["Your account", "Two-factor"]} current={0} />
      <h1>Join MasterDB</h1>
      <p className="lead">Set your name and a password.</p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="em">Email</label>
          <input id="em" className="input" value={invite?.email ?? ""} placeholder="name@nordencapital.ca" disabled style={{ background: "var(--muted)", color: "var(--muted-fg)" }} />
        </div>
        <div className="field">
          <label className="label" htmlFor="nm">Full name</label>
          <input id="nm" className={`input ${tried && !name.trim() ? "invalid" : ""}`} value={name} autoComplete="name"
            onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="Your full name" />
        </div>
        <PasswordField id="pw" label="Password" value={password} onChange={setPassword} meter placeholder="Choose a password"
          error={error instanceof ApiError ? error.field("password") : tried && short
            ? `Too short. Use ${MIN_PASSWORD}+ characters.` : tooLong(password) ? "Too long (72 bytes at most)." : undefined} />
        <PasswordField id="pw2" label="Repeat password" value={repeat} onChange={setRepeat} icon={false} placeholder="Type the password again"
          error={tried && mismatch ? "Passwords don't match" : undefined} />
        <button className="btn primary block" disabled={busy}>
          {busy ? <><LoaderCircle className="spin" />Creating your account…</> : "Continue to two-factor setup"}
        </button>
      </form>
    </AuthCard>
  )
}
