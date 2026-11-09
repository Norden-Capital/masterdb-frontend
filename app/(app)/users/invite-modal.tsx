"use client"

import { ChevronDown, LoaderCircle, Send, SlidersHorizontal } from "lucide-react"
import { useState } from "react"

import { PermissionGrid, allPermissions } from "@/components/md/permission-grid"
import { useSession } from "@/components/md/session"
import { useToast } from "@/components/md/toast"
import { Banner, FieldError, Sheet } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import type { Catalogue } from "@/lib/types"

/** Invite by email, start from a template, adjust the grid. Opens as a side sheet over the users list. */
export function InviteModal(props: { open: boolean; onClose: () => void; onSent: () => void; catalogue: Catalogue | null }) {
  const { can } = useSession()
  const toast = useToast()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [template, setTemplate] = useState("VIEWER")
  const [perms, setPerms] = useState<Set<string> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const catalogue = props.catalogue
  const tpl = catalogue?.templates.find((t) => t.key === template)
  const value = perms ?? new Set(tpl?.permissions ?? [])
  const total = catalogue ? allPermissions(catalogue).length : 0
  const notMine = [...value].filter((p) => !can(p))

  function close() {
    setEmail("")
    setName("")
    setPerms(null)
    setTemplate("VIEWER")
    setError(null)
    props.onClose()
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await api("/api/v1/users/invites", { body: { email: email.trim(), fullName: name.trim() || null, permissions: [...value] } })
      toast(`Invite sent to ${email.trim()}`)
      props.onSent()
      close()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const conflict = error instanceof ApiError && error.code === "CONFLICT"
  const emailError = error instanceof ApiError ? error.field("email") : undefined
  return (
    <Sheet open={props.open} onClose={close} title="Invite user"
      footer={<>
        <button className="btn" onClick={close}>Cancel</button>
        <button className="btn primary" onClick={send} disabled={busy || !email.includes("@") || notMine.length > 0}>
          {busy ? <><LoaderCircle className="spin" />Sending…</> : <><Send />Send invite</>}
        </button>
      </>}>
      <p className="muted" style={{ marginBottom: 18 }}>They get an email to set a password and two-factor. The invite expires in 72 hours.</p>
      {conflict && <Banner tone="red" title="This email can't be invited">{(error as ApiError).detail}</Banner>}
      {error && !conflict && !emailError ? <Banner tone="red" title="Couldn't send the invite">{describe(error)}</Banner> : null}
      {notMine.length > 0 && (
        <Banner tone="amber" title="You can only grant permissions you have yourself">
          Untick: {notMine.join(", ")}.
        </Banner>
      )}
      <div className="grid-2" style={{ gap: 16 }}>
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="inv-email">Email</label>
          <input id="inv-email" className={`input ${conflict || emailError ? "invalid" : ""}`} type="email"
            placeholder="name@nordencapital.ca" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          {conflict && <FieldError text="Already in use" />}
          {emailError && <FieldError text={emailError} />}
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="inv-name">Full name</label>
          <input id="inv-name" className="input" placeholder="First and last name (optional)" value={name}
            onChange={(e) => setName(e.target.value)} maxLength={200} />
        </div>
      </div>
      <p className="label" style={{ margin: "20px 0 8px" }}>Start from a template</p>
      <div className="tpl" role="radiogroup">
        {catalogue?.templates.map((t) => (
          <label key={t.key}>
            <input type="radio" name="tpl" value={t.key} checked={template === t.key && perms === null}
              onChange={() => { setTemplate(t.key); setPerms(null) }} />
            <b>{t.label}</b><span>{t.description}</span>
          </label>
        ))}
        <label>
          <input type="radio" name="tpl" checked={perms !== null && perms.size === 0}
            onChange={() => setPerms(new Set())} />
          <b>No access</b><span>Signs in, sees nothing yet</span>
        </label>
      </div>
      {catalogue && (
        <details className="adjust">
          <summary><SlidersHorizontal size={18} />Adjust permissions
            <span className="muted small" style={{ marginLeft: "auto" }}>{value.size} of {total} selected</span><ChevronDown size={18} /></summary>
          <PermissionGrid catalogue={catalogue} value={value} onChange={setPerms} grantable={can} />
        </details>
      )}
    </Sheet>
  )
}
