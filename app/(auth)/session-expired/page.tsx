import { TimerOff } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/md/auth-card"

export const metadata: Metadata = { title: "Session expired" }

/** Mock 13. The page you were on is remembered (sessionStorage) and opened after logging in again. */
export default function SessionExpiredPage() {
  return (
    <AuthCard center>
      <div className="icon-badge orange"><TimerOff /></div>
      <h1>Your session expired</h1>
      <p className="lead">You were inactive for a while, or signed out elsewhere, so we logged you out to keep the data safe. Running jobs keep going.</p>
      <Link className="btn primary block" href="/login">Log in again</Link>
      <p className="help" style={{ marginTop: 14 }}>You&apos;ll come back to the page you were on.</p>
    </AuthCard>
  )
}
