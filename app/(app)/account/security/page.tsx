"use client"

import { Check, Copy, Download, KeyRound, LoaderCircle, LogOut, RefreshCw, Smartphone } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { useSession } from "@/components/md/session"
import { useToast } from "@/components/md/toast"
import { Banner, Modal, OtpInput, PasswordField, downloadText } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import { date, device, when } from "@/lib/format"
import { MIN_PASSWORD, tooLong } from "@/lib/password"
import type { SessionView } from "@/lib/types"
import { DeviceIcon } from "../../users/[id]/user-detail"

type TwoFactor = { enabled: boolean; enabledAt?: string; recoveryCodesRemaining: number }

/** Mock 11: password, two-factor + recovery codes, active sessions. */
export default function SecurityPage() {
  const { me } = useSession()
  const router = useRouter()
  const toast = useToast()
  const [twoFactor, setTwoFactor] = useState<TwoFactor | null>(null)
  const [sessions, setSessions] = useState<SessionView[] | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)

  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [repeat, setRepeat] = useState("")
  const [tried, setTried] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<unknown>(null)

  const [codesOpen, setCodesOpen] = useState(false)
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState<unknown>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [codesBusy, setCodesBusy] = useState(false)
  const [confirmOthers, setConfirmOthers] = useState(false)

  useEffect(() => {
    document.title = "Security · MasterDB"
    api<TwoFactor>("/api/v1/account/2fa").then(setTwoFactor, setLoadError)
    api<SessionView[]>("/api/v1/account/sessions").then(setSessions, setLoadError)
  }, [reload])
  const refresh = useCallback(() => setReload((r) => r + 1), [])

  const short = [...next].length < MIN_PASSWORD
  const mismatch = next !== repeat

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!current || short || mismatch || tooLong(next)) return
    setPwBusy(true)
    setPwError(null)
    try {
      await api("/api/v1/account/password", { body: { currentPassword: current, newPassword: next } })
      setCurrent("")
      setNext("")
      setRepeat("")
      setTried(false)
      toast("Password updated. Other devices were logged out.")
      refresh()
    } catch (err) {
      setPwError(err)
    } finally {
      setPwBusy(false)
    }
  }

  async function newCodes(value: string) {
    if (codesBusy) return
    setCodesBusy(true)
    setCodeError(null)
    try {
      const res = await api<{ recoveryCodes: string[] }>("/api/v1/account/2fa/recovery-codes", { body: { code: value } })
      setCodes(res.recoveryCodes)
      refresh()
    } catch (e) {
      setCodeError(e)
      setCode("")
    } finally {
      setCodesBusy(false)
    }
  }

  async function endSession(s: SessionView) {
    try {
      await api(`/api/v1/account/sessions/${s.publicId}`, { method: "DELETE" })
      if (s.current) {
        router.replace("/login")
        return
      }
      toast("Session ended")
      refresh()
    } catch (e) {
      toast(describe(e), "bad")
    }
  }

  async function endOthers() {
    setConfirmOthers(false)
    try {
      const res = await api<{ sessionsEnded: number }>("/api/v1/account/sessions/revoke-others", { method: "POST" })
      toast(`Logged out of ${res.sessionsEnded} other session${res.sessionsEnded === 1 ? "" : "s"}`)
      refresh()
    } catch (e) {
      toast(describe(e), "bad")
    }
  }

  async function everywhere() {
    try {
      await api("/api/v1/account/logout-everywhere", { method: "POST" })
    } finally {
      router.replace("/login")
    }
  }

  const pwCode = pwError instanceof ApiError ? pwError.code : null
  const others = (sessions ?? []).filter((s) => !s.current).length
  const closeCodes = () => { setCodesOpen(false); setCodes(null); setCode(""); setCodeError(null) }

  return (
    <>
      <div className="subtabs">
        <Link href="/account">Profile</Link>
        <Link className="active" href="/account/security">Security</Link>
      </div>
      <div className="page">
        <div className="page-head"><h1>Security</h1><span className="meta">{me.fullName} · {me.email}</span></div>
        {loadError ? <Banner tone="red" title="Couldn't load your security settings">{describe(loadError)} <button className="link-btn" onClick={refresh}>Try again</button></Banner> : null}
        <div className="grid-2" style={{ alignItems: "start" }}>
          <form className="card" onSubmit={changePassword} noValidate>
            <div className="card-head"><h2>Password</h2></div>
            <div className="card-pad">
              {pwError && pwCode !== "CURRENT_PASSWORD_INCORRECT" && !(pwError instanceof ApiError && pwError.field("newPassword"))
                ? <Banner tone="red" title="Couldn't change the password">{describe(pwError)}</Banner> : null}
              <PasswordField id="cur" label="Current password" value={current} onChange={setCurrent} icon={false}
                autoComplete="current-password"
                error={pwCode === "CURRENT_PASSWORD_INCORRECT" ? "Current password is incorrect" : tried && !current ? "Enter your current password" : undefined} />
              <PasswordField id="new" label="New password" value={next} onChange={setNext} meter
                error={(pwError instanceof ApiError ? pwError.field("newPassword") : undefined)
                  ?? (tried && short ? `Too short. Use at least ${MIN_PASSWORD} characters.` : tooLong(next) ? "Too long (72 bytes at most)." : undefined)} />
              <PasswordField id="rep" label="Repeat new password" value={repeat} onChange={setRepeat} icon={false}
                error={tried && mismatch ? "Passwords don't match" : undefined} />
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn primary" disabled={pwBusy}>{pwBusy ? <><LoaderCircle className="spin" />Saving…</> : "Update password"}</button>
                <span className="help">Other devices are logged out.</span>
              </div>
            </div>
          </form>
          <div className="card">
            <div className="card-head"><h2>Two-factor authentication</h2>
              <span className="right">{twoFactor?.enabled && <span className="pill green"><Check />On</span>}</span></div>
            <div className="card-pad">
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
                <span className="icon-badge blue"><Smartphone /></span>
                <div><b style={{ fontWeight: 500 }}>Authenticator app</b>
                  <p className="muted small">{twoFactor?.enabledAt ? `Added ${date(twoFactor.enabledAt)} · ` : ""}required for every user</p></div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 22 }}>
                <span className="icon-badge amber"><KeyRound /></span>
                <div><b style={{ fontWeight: 500 }}>Recovery codes</b>
                  <p className="muted small"><span className="num">{twoFactor ? `${twoFactor.recoveryCodesRemaining} of 10` : "…"}</span> left</p></div>
              </div>
              <button className="btn" onClick={() => setCodesOpen(true)} disabled={!twoFactor?.enabled}><RefreshCw />New recovery codes</button>
              <p className="help" style={{ marginTop: 12 }}>New codes replace the old ones. New phone? Ask an Owner to reset your two-factor, then set it up again at your next login.</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-head"><h2>Active sessions</h2><span className="count">{sessions?.length ?? "…"}</span>
            <div className="right">
              {others > 0 && <button className="btn text-danger" onClick={() => setConfirmOthers(true)}><LogOut />Log out everywhere else</button>}
              <button className="btn" onClick={everywhere}><LogOut />Log out everywhere</button>
            </div>
          </div>
          <div className="tbl-scroll">
            <table className="t">
              <thead><tr><th>Device</th><th>IP address</th><th>Last active</th><th style={{ width: 120 }}><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {(sessions ?? []).map((s) => (
                  <tr key={s.publicId}>
                    <td><div className="who">
                      <span className="icon-badge blue" style={{ width: 34, height: 34, ...(s.current ? {} : { background: "var(--muted)", color: "var(--muted-fg)" }) }}><DeviceIcon ua={s.userAgent} /></span>
                      <span className="cell2"><b>{device(s.userAgent).label}</b><span>Logged in {when(s.createdAt)}</span></span>
                    </div></td>
                    <td className="mono">{s.ip ?? "—"}</td>
                    <td>{s.current ? <span className="pill green"><Check />This device</span> : when(s.lastSeenAt)}</td>
                    <td>{!s.current && <button className="btn sm" onClick={() => endSession(s)}>Log out</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={codesOpen} onClose={closeCodes} locked={!!codes} tone="amber" icon={<KeyRound />} title="New recovery codes"
        text={codes ? "Your old codes no longer work. Save these now: you won't see them again." : "Type the current code from your authenticator app to confirm it's you."}
        footer={codes ? <button className="btn primary" onClick={closeCodes}>I&apos;ve saved them</button> : <>
          <button className="btn" onClick={closeCodes}>Cancel</button>
          <button className="btn primary" disabled={codesBusy || code.length !== 6} onClick={() => newCodes(code)}>
            {codesBusy ? <><LoaderCircle className="spin" />Checking…</> : "Make new codes"}
          </button>
        </>}>
        {codes ? (
          <>
            <div className="codes">{codes.map((c) => <span key={c}>{c}</span>)}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => toast(`${codes.length} codes copied`))}><Copy />Copy</button>
              <button className="btn" style={{ flex: 1 }} onClick={() => downloadText("masterdb-recovery-codes.txt", `MasterDB recovery codes\n\n${codes.join("\n")}\n`)}><Download />Download .txt</button>
            </div>
          </>
        ) : (
          <>
            <OtpInput value={code} onChange={setCode} onComplete={newCodes} disabled={codesBusy}
              invalid={codeError instanceof ApiError && codeError.code === "INVALID_TWO_FACTOR_CODE"} />
            {codeError ? <p className="err" style={{ justifyContent: "center", marginTop: 10 }} role="alert">{describe(codeError)}</p> : null}
          </>
        )}
      </Modal>
      <Modal open={confirmOthers} onClose={() => setConfirmOthers(false)} size="narrow" tone="red" icon={<LogOut />}
        title="Log out everywhere else?"
        text={`${others} other session${others === 1 ? "" : "s"} end right away. You stay logged in on this device.`}
        footer={<>
          <button className="btn" onClick={() => setConfirmOthers(false)}>Cancel</button>
          <button className="btn danger" onClick={endOthers}>Log out {others} session{others === 1 ? "" : "s"}</button>
        </>} />
    </>
  )
}
