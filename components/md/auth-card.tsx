"use client"

import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

import { useToast } from "@/components/md/toast"

/**
 * The sign-in pages: near-black page, no card, everything centred, orange
 * buttons (the log-in reference). The logo shows on form pages only; status
 * screens (`center`) and pages with a stepper hide it (md.css).
 */
export function AuthCard(props: { wide?: boolean; center?: boolean; foot?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="am" data-look="dark">
      <div className="auth">
        <div>
          <div className={`auth-card ${props.wide ? "wide" : ""} ${props.center ? "auth-center" : ""}`}>
            <div className="auth-logo"><span className="logo-mark">M</span>MasterDB</div>
            {props.children}
          </div>
          {props.foot && <p className="auth-foot">{props.foot}</p>}
        </div>
      </div>
    </div>
  )
}

export function BackToLogin() {
  return <Link className="go-back" href="/login"><ChevronLeft />Go back</Link>
}

/**
 * Sign-in errors show as a toast at the bottom centre, not as a card above
 * the form. `error` is the error object, so the same message after a new
 * failed try shows again; `text` is what the toast says (null = no toast).
 */
export function useErrorToast(error: unknown, text: string | null) {
  const toast = useToast()
  useEffect(() => {
    if (error && text) toast(text, "bad")
  }, [error, text, toast])
}
