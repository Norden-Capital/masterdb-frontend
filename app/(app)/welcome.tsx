"use client"

import { LayoutDashboard } from "lucide-react"
import Link from "next/link"

import { useSession } from "@/components/md/session"

export function Welcome() {
  const { me, can } = useSession()
  return (
    <div className="card">
      <div className="empty">
        <div className="ic"><LayoutDashboard /></div>
        <h3>Welcome, {me.fullName.split(" ")[0]}</h3>
        <p>The dashboard and the contact modules come next. For now you can manage your account
          {can("USERS:VIEW") ? ", the team" : ""}{can("ACTIVITY_LOG:VIEW") ? " and the activity log" : ""}.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
          <Link className="btn" href="/account/security">My security</Link>
          {can("USERS:VIEW") && <Link className="btn primary" href="/users">Users & permissions</Link>}
        </div>
      </div>
    </div>
  )
}
