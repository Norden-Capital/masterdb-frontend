"use client"

import { Check, CircleAlert, CircleSlash, Eye, EyeOff, Lock, LockKeyhole, Mail, X } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

import { strength } from "@/lib/password"
import type { UserItem } from "@/lib/types"
import { avatarTone, initials } from "@/lib/format"

/** Modal over a dimmed page (mock .backdrop/.modal). Esc and the backdrop close it unless `locked`. */
export function Modal(props: {
  open: boolean
  onClose: () => void
  size?: "narrow" | "wide"
  icon?: React.ReactNode
  tone?: "red" | "blue" | "green" | "amber" | "orange"
  title: string
  text?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  locked?: boolean
  /** Makes body + footer one <form>: Enter submits, the footer's submit button sends it. */
  onSubmit?: () => void
}) {
  const titleId = useId()
  const { open, onClose, locked } = props
  useEffect(() => {
    if (!open || locked) return
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [open, onClose, locked])
  if (!props.open) return null
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div className={`modal ${props.size ?? ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          {props.icon && <span className={`icon-badge ${props.tone ?? "orange"}`}>{props.icon}</span>}
          <div>
            <h2 id={titleId}>{props.title}</h2>
            {props.text && <p>{props.text}</p>}
          </div>
          {!locked && (
            <button className="round x" onClick={onClose} aria-label="Close">
              <X />
            </button>
          )}
        </div>
        {props.onSubmit ? (
          <form noValidate onSubmit={(e) => { e.preventDefault(); props.onSubmit?.() }}>
            {props.children && <div className="modal-body">{props.children}</div>}
            {props.footer && <div className="modal-foot">{props.footer}</div>}
          </form>
        ) : (
          <>
            {props.children && <div className="modal-body">{props.children}</div>}
            {props.footer && <div className="modal-foot">{props.footer}</div>}
          </>
        )}
      </div>
    </div>
  )
}

/** Six boxes for a TOTP code; typing moves on, paste fills all, Enter submits. */
export function OtpInput(props: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  invalid?: boolean
  disabled?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = props.value.padEnd(6, " ").slice(0, 6).split("")
  useEffect(() => {
    refs.current[0]?.focus()
  }, [])
  const set = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6)
    props.onChange(clean)
    if (clean.length === 6) props.onComplete?.(clean)
    return clean
  }
  return (
    <div className={`otp ${props.invalid ? "invalid" : ""}`} role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={6}
          value={d.trim()}
          disabled={props.disabled}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "")
            if (typed.length > 1) {
              set(typed)
              refs.current[Math.min(typed.length, 5)]?.focus()
              return
            }
            const arr = props.value.padEnd(6, " ").split("")
            arr[i] = typed || " "
            set(arr.join("").replace(/ /g, ""))
            if (typed && i < 5) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d.trim() && i > 0) refs.current[i - 1]?.focus()
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus()
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus()
          }}
          onPaste={(e) => {
            e.preventDefault()
            const v = set(e.clipboardData.getData("text"))
            refs.current[Math.min(v.length, 5)]?.focus()
          }}
        />
      ))}
    </div>
  )
}

/** Password input with a show/hide eye, optional strength bar (mock .strength). */
export function PasswordField(props: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  meter?: boolean
  autoComplete?: string
  icon?: boolean
}) {
  const [shown, setShown] = useState(false)
  const s = strength(props.value)
  return (
    <div className="field">
      <label className="label" htmlFor={props.id}>{props.label}</label>
      <div className={props.icon === false ? "" : "input-wrap"} style={{ position: "relative" }}>
        {props.icon !== false && <Lock />}
        <input
          id={props.id}
          className={`input ${props.error ? "invalid" : ""}`}
          type={shown ? "text" : "password"}
          value={props.value}
          autoComplete={props.autoComplete ?? "new-password"}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={!!props.error}
        />
        <button type="button" className="suffix" style={props.icon === false ? { position: "absolute", right: 6, top: 5 } : undefined}
          onClick={() => setShown(!shown)} aria-label={shown ? "Hide password" : "Show password"}>
          {shown ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {props.meter && props.value && (
        <>
          <div className={`strength s${s.level}`}><span /><span /><span /><span /></div>
          {!props.error && <span className="help">{s.hint}</span>}
        </>
      )}
      {props.error && <FieldError text={props.error} />}
    </div>
  )
}

export function FieldError({ text }: { text: string }) {
  return (
    <span className="err" role="alert">
      <CircleAlert />
      {text}
    </span>
  )
}

export function Banner(props: { tone: "red" | "amber" | "blue" | "green"; icon?: React.ReactNode; title: string;
  children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={`banner ${props.tone}`} role={props.tone === "red" ? "alert" : "status"} style={props.style}>
      {props.icon ?? <CircleAlert />}
      <div>
        <b>{props.title}</b>
        {props.children}
      </div>
    </div>
  )
}

export function Avatar({ name, id, size }: { name: string; id: string; size?: "sm" | "lg" }) {
  return <span className={`avatar ${size ?? ""} ${avatarTone(id)}`} aria-hidden="true">{initials(name)}</span>
}

/** Status pill of a user (mock 07). */
export function StatusPill({ user }: { user: Pick<UserItem, "status" | "locked"> }) {
  if (user.status === "DISABLED") return <span className="pill grey"><CircleSlash />Disabled</span>
  if (user.status === "INVITED") return <span className="pill blue"><Mail />Invited</span>
  if (user.locked) return <span className="pill amber"><LockKeyhole />Locked</span>
  return <span className="pill green"><Check />Active</span>
}

/** Download a text file the browser builds itself (recovery codes). */
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
