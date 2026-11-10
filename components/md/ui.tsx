"use client"

import { ArrowRightToLine, Check, CircleAlert, CircleSlash, Eye, EyeOff, Lock, LockKeyhole, Mail, TriangleAlert, X } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { strength } from "@/lib/password"
import type { UserItem } from "@/lib/types"
import { avatarTone, initials } from "@/lib/format"

/** Side sheet from the right (reference 07): close button and title on top, body scrolls, footer stays. Esc and the dimmed page close it. */
export function Sheet(props: { open: boolean; onClose: () => void; title: string; children?: React.ReactNode; footer?: React.ReactNode }) {
  const titleId = useId()
  const { open, onClose } = props
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="backdrop sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="sheet-head">
          <button className="sheet-close" onClick={onClose} aria-label="Close"><ArrowRightToLine /></button>
          <h2 id={titleId}>{props.title}</h2>
        </header>
        <div className="sheet-body">{props.children}</div>
        {props.footer && <footer className="sheet-foot">{props.footer}</footer>}
      </aside>
    </div>
  )
}

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

/**
 * A recovery code as 5 + 5 boxes ("xxxxx-xxxxx", the backend's format):
 * typing moves on, Backspace goes back, paste fills all. `value` keeps the dash.
 */
export function RecoveryCodeInput(props: { value: string; onChange: (v: string) => void; invalid?: boolean; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const chars = props.value.replace(/[^0-9a-z]/gi, "").toLowerCase().padEnd(10, " ").slice(0, 10).split("")
  useEffect(() => {
    refs.current[0]?.focus()
  }, [])
  const emit = (arr: string[]) => {
    const clean = arr.join("").replace(/ /g, "").slice(0, 10)
    props.onChange(clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean)
    return clean
  }
  const box = (i: number) => (
    <input
      key={i}
      ref={(el) => {
        refs.current[i] = el
      }}
      aria-label={`Character ${i + 1}`}
      autoComplete="off"
      spellCheck={false}
      placeholder="x"
      maxLength={11}
      value={chars[i].trim()}
      disabled={props.disabled}
      onChange={(e) => {
        const typed = e.target.value.replace(/[^0-9a-z]/gi, "").toLowerCase()
        if (typed.length > 1) {
          const arr = [...chars]
          typed.split("").forEach((c, k) => { if (i + k < 10) arr[i + k] = c })
          const v = emit(arr)
          refs.current[Math.min(v.length, 9)]?.focus()
          return
        }
        const arr = [...chars]
        arr[i] = typed || " "
        emit(arr)
        if (typed && i < 9) refs.current[i + 1]?.focus()
      }}
      onKeyDown={(e) => {
        if (e.key === "Backspace" && !chars[i].trim() && i > 0) refs.current[i - 1]?.focus()
        if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus()
        if (e.key === "ArrowRight" && i < 9) refs.current[i + 1]?.focus()
      }}
      onPaste={(e) => {
        e.preventDefault()
        const all = e.clipboardData.getData("text").replace(/[^0-9a-z]/gi, "").toLowerCase().slice(0, 10)
        const v = emit(all.padEnd(10, " ").split(""))
        refs.current[Math.min(v.length, 9)]?.focus()
      }}
    />
  )
  return (
    <div className={`otp rc ${props.invalid ? "invalid" : ""}`} role="group" aria-label="Recovery code">
      {[0, 1, 2, 3, 4].map(box)}
      <span className="rc-dash" aria-hidden="true">-</span>
      {[5, 6, 7, 8, 9].map(box)}
    </div>
  )
}

/** Arrow steps (design direction 4.6): done and current steps orange (done with a tick), the rest grey. */
export function Stepper({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol className="stepper" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s} className={`${i === 0 ? "first" : i === steps.length - 1 ? "last" : "mid"} ${i <= current ? "on" : ""}`}
          aria-current={i === current ? "step" : undefined}>
          {i < current && <Check />}{s}
        </li>
      ))}
    </ol>
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
  placeholder?: string
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
          placeholder={props.placeholder}
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

/**
 * A page's warning, placed anywhere inside `.page-head`. Open, it shows
 * full width at the end of the page (after the table, which it pushes up);
 * closed, a bare amber warning icon at the right end of the title row
 * brings it back.
 */
export function PageWarning(props: { title: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  const anchor = useRef<HTMLSpanElement>(null)
  const [hosts, setHosts] = useState<{ page: Element; head: Element } | null>(null)
  useEffect(() => {
    const head = anchor.current?.closest(".page-head")
    const page = anchor.current?.closest(".page")
    if (head && page) setHosts({ page, head })
  }, [])
  return (
    <>
      <span ref={anchor} hidden />
      {hosts && (open ? createPortal(
        <div className="banner amber page-warning" role="status">
          <TriangleAlert />
          <div><b>{props.title}</b>{props.children}</div>
          <button type="button" className="x" aria-label="Hide this warning" onClick={() => setOpen(false)}><X /></button>
        </div>, hosts.page,
      ) : createPortal(
        <button type="button" className="warn-mark" title={props.title} aria-label={`Warning: ${props.title}. Show it`}
          onClick={() => setOpen(true)}>
          <TriangleAlert />
        </button>, hosts.head,
      ))}
    </>
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
