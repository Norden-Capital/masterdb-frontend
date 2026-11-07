"use client"

import { Activity, Contact, RefreshCw, ShieldCheck, Users } from "lucide-react"
import Link from "next/link"
import { useCallback } from "react"

import { Counter, LiveStatus } from "@/components/md/progress"
import { useSession } from "@/components/md/session"
import { ErrorState, LoadingState } from "@/components/md/states"
import { usePoll } from "@/components/md/use-poll"
import { api } from "@/lib/api"
import type { DashboardSummary } from "@/lib/types"
import { Welcome } from "./welcome"

/**
 * Start page (M2.4): only numbers the backend counts today, refreshed every
 * minute while the tab is visible. Modules that don't exist yet are shown as
 * "coming soon" tiles without any number.
 */
export function Dashboard() {
  const { can } = useSession()
  const allowed = can("DASHBOARD:VIEW")
  const fetcher = useCallback((signal: AbortSignal) => api<DashboardSummary>("/api/v1/dashboard/summary", { signal }), [])
  const p = usePoll(fetcher, { interval: 60_000, enabled: allowed })

  if (!allowed) return <Welcome />
  const s = p.data
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <LiveStatus status={p.status} updatedAt={p.updatedAt} failures={p.failures} />
        <button className="btn sm" style={{ marginLeft: "auto" }} onClick={p.refresh}><RefreshCw />Refresh</button>
      </div>
      {p.error && !s ? <ErrorState title="Couldn't load the numbers" error={p.error} onRetry={p.refresh} /> : null}
      {!s && !p.error && <div className="card"><LoadingState label="Loading dashboard numbers" /></div>}
      {s && (
        <>
          <section className="card" aria-labelledby="dash-users">
            <div className="card-head">
              <Users style={{ color: "var(--muted-fg)" }} />
              <h2 id="dash-users">Team</h2>
              {can("USERS:VIEW") && <div className="right"><Link className="btn sm" href="/users">Users &amp; permissions</Link></div>}
            </div>
            <div className="card-pad counters">
              <Counter label="Accounts" value={s.users.total} hint="Owner included" />
              <Counter label="Active" value={s.users.active} tone="green" />
              <Counter label="Invited" value={s.users.invited} tone="blue" hint="Not accepted yet" />
              <Counter label="Disabled" value={s.users.disabled} tone="grey" />
              <Counter label="Signed in now" value={s.openSessions} tone="primary" hint="Open sessions" />
            </div>
          </section>
          <section className="card" aria-labelledby="dash-activity">
            <div className="card-head">
              <Activity style={{ color: "var(--muted-fg)" }} />
              <h2 id="dash-activity">Activity log</h2>
              {can("ACTIVITY_LOG:VIEW") && <div className="right"><Link className="btn sm" href="/activity">Open log</Link></div>}
            </div>
            <div className="card-pad counters">
              <Counter label="Last 24 hours" value={s.activity.last24Hours} hint="Sign-ins, account changes, exports" />
              <Counter label="Last 7 days" value={s.activity.last7Days} />
            </div>
          </section>
        </>
      )}
      <div className="grid-2">
        <SoonTile icon={<Contact />} title="Contacts & lists" text="Imported contacts, lists and duplicates will be counted here." />
        <SoonTile icon={<ShieldCheck />} title="Validation" text="Running jobs and results by category will show here." />
      </div>
    </div>
  )
}

function SoonTile(props: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <section className="card soon-tile" aria-label={`${props.title}: coming soon`}>
      <div className="card-head">
        <span style={{ color: "var(--muted-fg)", display: "grid" }}>{props.icon}</span>
        <h2>{props.title}</h2>
        <span className="soon-tag" style={{ marginLeft: "auto", display: "inline-block" }}>Coming soon</span>
      </div>
      <div className="card-pad"><p className="muted">{props.text}</p></div>
    </section>
  )
}
