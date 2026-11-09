"use client"

import { LoaderCircle } from "lucide-react"
import { useId, useState } from "react"

import { Banner, Modal } from "@/components/md/ui"
import { describe } from "@/lib/api"

type Tone = "red" | "blue" | "green" | "amber" | "orange"

/**
 * "Are you sure?" before an action (mock 07 disable dialog). While the action
 * runs both buttons are disabled; if it fails the reason shows in the dialog
 * and it stays open. With `typed`, the confirm button stays off until the
 * person types that exact text: for dangerous actions (delete a list, wipe a
 * server), never for everyday ones.
 */
export function ConfirmDialog(props: {
  open: boolean
  onClose: () => void
  /** Runs the action; the dialog closes when it resolves. */
  onConfirm: () => Promise<unknown> | void
  title: string
  text?: React.ReactNode
  confirmLabel: string
  danger?: boolean
  icon?: React.ReactNode
  tone?: Tone
  /** Text to type to unlock the button, e.g. the list name. */
  typed?: string
  children?: React.ReactNode
}) {
  const inputId = useId()
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const locked = !!props.typed && value !== props.typed

  const close = () => {
    if (busy) return
    setValue("")
    setError(null)
    props.onClose()
  }

  async function run() {
    if (locked || busy) return
    setBusy(true)
    setError(null)
    try {
      await props.onConfirm()
      setValue("")
      props.onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const tone = props.tone ?? (props.danger ? "red" : "orange")
  return (
    <Modal open={props.open} onClose={close} size="narrow" tone={tone} icon={props.icon} title={props.title}
      text={props.text} locked={busy} onSubmit={run}
      footer={<>
        <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
        <button type="submit" className={`btn ${props.danger ? "danger" : "primary"}`} disabled={locked || busy}>
          {busy && <LoaderCircle className="spin" aria-hidden="true" />}{props.confirmLabel}
        </button>
      </>}>
      {(props.children || props.typed || error) ? (
        <>
          {error ? <Banner tone="red" title="That didn't work">{describe(error)}</Banner> : null}
          {props.children}
          {props.typed && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor={inputId}>
                Type <span className="confirm-phrase">{props.typed}</span> to confirm
              </label>
              <input id={inputId} className="input" value={value} autoFocus placeholder="Type it exactly" autoComplete="off" spellCheck={false}
                onChange={(e) => setValue(e.target.value)} />
            </div>
          )}
        </>
      ) : null}
    </Modal>
  )
}

/**
 * A modal with a form (mock 08 invite modal look): Enter or the submit button
 * sends it, the button spins while it runs, a failure shows the backend's
 * reason on top and keeps what was typed. Closes itself when onSubmit
 * resolves, unless it resolves to false (e.g. field errors to show).
 */
export function ModalForm(props: {
  open: boolean
  onClose: () => void
  onSubmit: () => Promise<boolean | void>
  title: string
  text?: React.ReactNode
  icon?: React.ReactNode
  tone?: Tone
  size?: "narrow" | "wide"
  submitLabel: string
  /** False keeps the submit button off (e.g. a required field is empty). */
  canSubmit?: boolean
  children: React.ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const close = () => {
    if (busy) return
    setError(null)
    props.onClose()
  }

  async function submit() {
    if (busy || props.canSubmit === false) return
    setBusy(true)
    setError(null)
    try {
      const keep = (await props.onSubmit()) === false
      if (!keep) props.onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={props.open} onClose={close} size={props.size} tone={props.tone} icon={props.icon} title={props.title}
      text={props.text} locked={busy} onSubmit={submit}
      footer={<>
        <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
        <button type="submit" className="btn primary" disabled={busy || props.canSubmit === false}>
          {busy && <LoaderCircle className="spin" aria-hidden="true" />}{props.submitLabel}
        </button>
      </>}>
      {error ? <Banner tone="red" title="That didn't work">{describe(error)}</Banner> : null}
      {props.children}
    </Modal>
  )
}
