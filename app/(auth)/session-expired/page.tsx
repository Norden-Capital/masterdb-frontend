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
      <p className="lead">You were logged out after a while away.</p>
      <Link className="btn primary block" href="/login">Log in again</Link>
      <p className="help" style={{ marginTop: 14 }}>Or you signed out elsewhere. Running jobs keep going, and you&apos;ll come back to the page you were on.</p>
    </AuthCard>
  )
}
