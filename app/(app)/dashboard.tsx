"use client"

import { Activity, CalendarDays, ChevronRight, MonitorSmartphone, RefreshCw, ScrollText, Users } from "lucide-react"
import Link from "next/link"
import { useCallback } from "react"

import { LiveStatus } from "@/components/md/progress"
import { useSession } from "@/components/md/session"
import { ErrorState, LoadingState } from "@/components/md/states"
import { usePoll } from "@/components/md/use-poll"
import { api } from "@/lib/api"
import { count } from "@/lib/table"
import type { DashboardSummary } from "@/lib/types"
import { Welcome } from "./welcome"

/**
 * Start page: only numbers the backend counts today, refreshed every minute
 * while the tab is visible. A strip of big numbers, then the team and the
 * activity log. Nothing for modules that don't exist yet.
 */
export function Dashboard() {
  const { can } = useSession()
  const allowed = can("DASHBOARD:VIEW")
  const fetcher = useCallback((signal: AbortSignal) => api<DashboardSummary>("/api/v1/dashboard/summary", { signal }), [])
  const p = usePoll(fetcher, { interval: 60_000, enabled: allowed })

  if (!allowed) return <Welcome />
  const s = p.data
  const head = (
    <div className="page-head">
      <h1>Dashboard</h1>
      <span className="meta"><LiveStatus status={p.status} updatedAt={p.updatedAt} failures={p.failures} /></span>
      <div className="actions"><button className="btn" onClick={p.refresh}><RefreshCw />Refresh</button></div>
    </div>
  )
  if (p.error && !s) return <>{head}<ErrorState title="Couldn't load the numbers" error={p.error} onRetry={p.refresh} /></>
  if (!s) return <>{head}<div className="card"><LoadingState label="Loading dashboard numbers" /></div></>
  const u = s.users
  const share = (n: number) => `${u.total > 0 ? (n / u.total) * 100 : 0}%`
  return (
    <>
      {head}
      <div className="kpis">
        <Kpi icon={<Users />} label="Accounts" value={u.total} meta="Owner included" />
        <Kpi icon={<MonitorSmartphone />} label="Signed in now" value={s.openSessions} meta="Open sessions" />
        <Kpi icon={<Activity />} label="Last 24 hours" value={s.activity.last24Hours} meta="Sign-ins, account changes, exports" />
        <Kpi icon={<CalendarDays />} label="Last 7 days" value={s.activity.last7Days} meta="Activity across all users" />
      </div>
      <div className="grid-2">
        <section className="card" aria-labelledby="dash-users">
          <div className="card-head">
            <Users /><h2 id="dash-users">Team</h2>
            {can("USERS:VIEW") && <Link className="link" href="/users">Users &amp; permissions<ChevronRight /></Link>}
          </div>
          <div className="card-pad">
            <div className="sharebar" role="img" aria-label={`${u.active} active, ${u.invited} invited, ${u.disabled} disabled`}>
              <span style={{ width: share(u.active), background: "var(--success)" }} />
              <span style={{ width: share(u.invited), background: "var(--info)" }} />
              <span style={{ width: share(u.disabled), background: "var(--grey-bd)" }} />
            </div>
            <div className="legend">
              <LegendItem label="Active" value={u.active} color="var(--success)" />
              <LegendItem label="Invited" value={u.invited} color="var(--info)" />
              <LegendItem label="Disabled" value={u.disabled} color="var(--grey-bd)" />
            </div>
          </div>
        </section>
        <section className="card" aria-labelledby="dash-activity">
          <div className="card-head">
            <ScrollText /><h2 id="dash-activity">Activity log</h2>
            {can("ACTIVITY_LOG:VIEW") && <Link className="link" href="/activity">Open log<ChevronRight /></Link>}
          </div>
          <div className="card-pad" style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            <div><div className="muted small">Last 24 hours</div><div className="kpi-v num">{count(s.activity.last24Hours)}</div></div>
            <div><div className="muted small">Last 7 days</div><div className="kpi-v num">{count(s.activity.last7Days)}</div></div>
          </div>
        </section>
      </div>
    </>
  )
}

/** One number of the strip at the top: icon + label, big number, small grey line. No box (design direction 4.13). */
function Kpi(props: { icon: React.ReactNode; label: string; value: number; meta: string }) {
  return (
    <div className="kpi" role="group" aria-label={props.label}>
      <span className="kpi-l">{props.icon}{props.label}</span>
      <span className="kpi-v num">{count(props.value)}</span>
      <span className="kpi-m">{props.meta}</span>
    </div>
  )
}

function LegendItem(props: { label: string; value: number; color: string }) {
  return (
    <span role="group" aria-label={props.label}>
      <i style={{ background: props.color }} />{props.label} <b className="num">{count(props.value)}</b>
    </span>
  )
}
