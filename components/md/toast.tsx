"use client"

import { CircleAlert, CircleCheck, X } from "lucide-react"
import { createContext, useCallback, useContext, useState } from "react"

type Toast = { id: number; text: string; bad: boolean }
type Show = (text: string, kind?: "ok" | "bad") => void

const ToastContext = createContext<Show>(() => {})

export function useToast(): Show {
  return useContext(ToastContext)
}

/**
 * Dark toasts (reference 11/12): bottom-right in the app, bottom-centre on
 * the sign-in pages (md.css). A success goes after 5 s; an error stays until
 * closed (design direction 4.11). The same text is never shown twice at once.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const close = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const show = useCallback<Show>(
    (text, kind = "ok") => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t.filter((x) => x.text !== text), { id, text, bad: kind === "bad" }])
      if (kind !== "bad") setTimeout(() => close(id), 5000)
    },
    [close],
  )
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id} role={t.bad ? "alert" : undefined}>
            {t.bad ? <CircleAlert className="bad" /> : <CircleCheck className="ok" />}
            <span>{t.text}</span>
            <button className="x" aria-label="Close" onClick={() => close(t.id)}>
              <X />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
