"use client"

import { ChevronLeft, ChevronRight, LoaderCircle, Send } from "lucide-react"
import { useState } from "react"

import { PermissionGrid, allPermissions } from "@/components/md/permission-grid"
import { useSession } from "@/components/md/session"
import { useToast } from "@/components/md/toast"
import { Banner, FieldError, Sheet, Stepper } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import type { Catalogue } from "@/lib/types"

/** "No access": a fourth choice next to the server's templates. */
const NONE = "NONE"

/**
 * Invite as a two-step side sheet over the users list:
 * 1. first name, last name, email and a template (one radio row each);
 * 2. the permissions, starting from that template.
 * The backend keeps one full name, so first and last are joined when sent.
 */
export function InviteModal(props: { open: boolean; onClose: () => void; onSent: () => void; catalogue: Catalogue | null }) {
  const { can } = useSession()
  const toast = useToast()
  const [step, setStep] = useState<0 | 1>(0)
  const [first, setFirst] = useState("")
  const [last, setLast] = useState("")
  const [email, setEmail] = useState("")
  const [emailCheck, setEmailCheck] = useState<string | null>(null)
  const [template, setTemplate] = useState("VIEWER")
  const [perms, setPerms] = useState<Set<string> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const catalogue = props.catalogue
  const tpl = catalogue?.templates.find((t) => t.key === template)
  const value = perms ?? new Set(template === NONE ? [] : tpl?.permissions ?? [])
  const total = catalogue ? allPermissions(catalogue).length : 0
  const notMine = [...value].filter((p) => !can(p))
  const fullName = [first.trim(), last.trim()].filter(Boolean).join(" ")

  function close() {
    if (busy) return
    setStep(0)
    setFirst("")
    setLast("")
    setEmail("")
    setEmailCheck(null)
    setPerms(null)
    setTemplate("VIEWER")
    setError(null)
    props.onClose()
  }

  function pick(key: string) {
    setTemplate(key)
    setPerms(null)
  }

  function next(e?: React.FormEvent) {
    e?.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailCheck("Enter an email like name@nordencapital.ca.")
      return
    }
    setError(null)
    setStep(1)
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await api("/api/v1/users/invites", { body: { email: email.trim(), fullName: fullName || null, permissions: [...value] } })
      toast(`Invite sent to ${email.trim()}`)
      props.onSent()
      setBusy(false)
      close()
    } catch (e) {
      setError(e)
      setBusy(false)
      // Email problems are fixed on the first step.
      if (e instanceof ApiError && (e.code === "CONFLICT" || e.field("email"))) setStep(0)
    }
  }

  const conflict = error instanceof ApiError && error.code === "CONFLICT"
  const emailError = error instanceof ApiError ? error.field("email") : undefined
  const choices = [
    ...(catalogue?.templates ?? []).map((t) => ({ key: t.key, label: t.label, description: t.description })),
    { key: NONE, label: "No access", description: "Signs in, sees nothing yet" },
  ]

  return (
    <Sheet open={props.open} onClose={close} title="Invite user"
      footer={step === 0 ? <>
        <button className="btn" type="button" onClick={close}>Cancel</button>
        <button className="btn primary" type="submit" form="invite-1">Next<ChevronRight /></button>
      </> : <>
        <button className="btn" type="button" onClick={() => setStep(0)} disabled={busy}><ChevronLeft />Back</button>
        <button className="btn primary" type="button" onClick={send} disabled={busy || notMine.length > 0}>
          {busy ? <><LoaderCircle className="spin" />Sending…</> : <><Send />Send invite</>}
        </button>
      </>}>
      <Stepper label="Invite steps" steps={["Details", "Permissions"]} current={step} />

      {step === 0 ? (
        <form id="invite-1" onSubmit={next} noValidate>
          <p className="muted" style={{ margin: "0 0 18px" }}>They get an email to set a password and two-factor. The invite expires in 72 hours.</p>
          {conflict && <Banner tone="red" title="This email can't be invited">{(error as ApiError).detail}</Banner>}
          <div className="grid-2">
            <div className="field">
              <label className="label" htmlFor="inv-first">First name</label>
              <input id="inv-first" className="input" placeholder="e.g. Sam" value={first} autoFocus
                onChange={(e) => setFirst(e.target.value)} maxLength={100} autoComplete="off" />
            </div>
            <div className="field">
              <label className="label" htmlFor="inv-last">Last name</label>
              <input id="inv-last" className="input" placeholder="e.g. Taylor" value={last}
                onChange={(e) => setLast(e.target.value)} maxLength={100} autoComplete="off" />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="inv-email">Email</label>
            <input id="inv-email" className={`input ${conflict || emailError || emailCheck ? "invalid" : ""}`} type="email"
              placeholder="name@nordencapital.ca" value={email} autoComplete="off"
              onChange={(e) => { setEmail(e.target.value); setEmailCheck(null) }} />
            {conflict && <FieldError text="Already in use" />}
            {emailError && <FieldError text={emailError} />}
            {emailCheck && <FieldError text={emailCheck} />}
          </div>
          <fieldset className="tpl-list">
            <legend className="label">Start from a template</legend>
            {choices.map((c) => (
              <label key={c.key} className={template === c.key ? "on" : ""}>
                <input type="radio" name="tpl" value={c.key} checked={template === c.key} onChange={() => pick(c.key)} />
                <div>
                  <b>{c.label}</b>
                  <span title={c.description}>{c.description}</span>
                </div>
              </label>
            ))}
          </fieldset>
        </form>
      ) : (
        <>
          <p className="muted" style={{ margin: "0 0 18px" }}>
            {fullName || email.trim()} starts with {choices.find((c) => c.key === template)?.label ?? "the template"}.
            Tick or untick anything. <b className="num" style={{ color: "var(--fg)" }}>{value.size}</b> of {total} selected.
          </p>
          {error && !conflict && !emailError ? <Banner tone="red" title="Couldn't send the invite">{describe(error)}</Banner> : null}
          {notMine.length > 0 && (
            <Banner tone="amber" title="You can only grant permissions you have yourself">
              Untick: {notMine.join(", ")}.
            </Banner>
          )}
          {catalogue && <PermissionGrid catalogue={catalogue} value={value} onChange={setPerms} grantable={can} />}
        </>
      )}
    </Sheet>
  )
}
