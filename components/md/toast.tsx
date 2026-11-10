"use client"

import { CircleAlert, CircleCheck, X } from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"

/**
 * `until`: a live countdown. The text's "{time}" shows the time left (m:ss),
 * ticking every second, and the toast closes when it reaches zero.
 */
export type ToastOptions = { until?: number }
type Toast = { id: number; text: string; bad: boolean; until?: number }
type Show = (text: string, kind?: "ok" | "bad", options?: ToastOptions) => void

const ToastContext = createContext<Show>(() => {})

/** How long a toast stays: a success 5 s, an error 8 s (long enough to read). */
const LIFETIME = { ok: 5000, bad: 8000 }

export function useToast(): Show {
  return useContext(ToastContext)
}

/** m:ss from milliseconds, rounded up so "0:00" never shows while time is left. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/**
 * Dark toasts (reference 11/12): bottom-right in the app, bottom-centre on
 * the sign-in pages (md.css). Every toast closes by itself (a thin bar shows
 * the time left); a countdown toast closes when its time is up. The same
 * text is never shown twice at once.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const close = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const show = useCallback<Show>((text, kind = "ok", options) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.filter((x) => x.text !== text), { id, text, bad: kind === "bad", until: options?.until }])
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} close={close} />)}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast: t, close }: { toast: Toast; close: (id: number) => void }) {
  const onClose = useCallback(() => close(t.id), [close, t.id])
  const [now, setNow] = useState(() => Date.now())
  const life = LIFETIME[t.bad ? "bad" : "ok"]

  useEffect(() => {
    if (t.until) {
      const tick = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(tick)
    }
    const timer = setTimeout(onClose, life)
    return () => clearTimeout(timer)
  }, [t.until, life, onClose])

  const left = t.until ? t.until - now : 0
  useEffect(() => {
    if (t.until && left <= 0) onClose()
  }, [t.until, left, onClose])

  const text = t.until ? t.text.replace("{time}", clock(left)) : t.text
  return (
    <div className="toast" role={t.bad ? "alert" : undefined}>
      {t.bad ? <CircleAlert className="bad" /> : <CircleCheck className="ok" />}
      <span>{text}</span>
      <button className="x" aria-label="Close" onClick={onClose}>
        <X />
      </button>
      {!t.until && <i className="toast-timer" style={{ animationDuration: `${life}ms` }} aria-hidden="true" />}
    </div>
  )
}
