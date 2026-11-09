"use client"

import { Check, Download, SearchX, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { type Column, DataTable } from "@/components/md/data-table"
import { useSession } from "@/components/md/session"
import { EmptyState, Forbidden } from "@/components/md/states"
import { Avatar } from "@/components/md/ui"
import { type Filters, useTableQuery } from "@/components/md/use-table-query"
import { ACTIONS, actionMeta, detailLine } from "@/lib/activity"
import { api } from "@/lib/api"
import { dayLabel, timeWithSeconds } from "@/lib/format"
import { count } from "@/lib/table"
import type { ActivityEntry, Page, UserItem } from "@/lib/types"

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "1", label: "Last 24 hours", days: 1 },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "all", label: "All time (365 days)", days: null },
]

/** Filter values → query parameters: the date range becomes `from`, counted from the moment of the call. */
function toParams(f: Filters): Filters {
  const days = RANGES.find((r) => r.key === f.range)?.days
  return {
    user: f.user ?? "",
    action: f.action ?? "",
    from: days ? new Date(Date.now() - days * 86_400_000).toISOString() : "",
  }
}

/** Mock 12: everything sensitive that happened, filterable, exportable. Kept 365 days. */
export default function ActivityPage() {
  const { can } = useSession()
  const [initialUser] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("user") ?? "")
  const t = useTableQuery<ActivityEntry>({
    path: "/api/v1/activity", enabled: can("ACTIVITY_LOG:VIEW"), size: 50,
    filters: { user: initialUser, action: "", range: "all" }, toParams,
  })
  const [people, setPeople] = useState<UserItem[]>([])

  useEffect(() => {
    document.title = "Activity log · MasterDB"
    if (can("USERS:VIEW")) api<Page<UserItem>>("/api/v1/users?size=100&sort=fullName").then((p) => setPeople(p.items), () => {})
  }, [can])

  if (!can("ACTIVITY_LOG:VIEW")) return <Forbidden module="the activity log" />

  const { user = "", action = "", range = "all" } = t.filters
  const person = people.find((p) => p.publicId === user)
  const filtered = !!(user || action || t.query || range !== "all")
  const clear = () => {
    t.clearFilters()
    t.setFilter("user", "")
  }
  const exportParams = new URLSearchParams(Object.entries({ ...toParams(t.filters), q: t.query }).filter(([, v]) => v))

  const columns: Column<ActivityEntry>[] = [
    { key: "time", header: "Time", className: "cell2", render: (e) => <><b>{dayLabel(e.occurredAt)}</b><span>{timeWithSeconds(e.occurredAt)}</span></> },
    {
      key: "user", header: "User",
      render: (e) => e.actorLabel
        ? <div className="who"><Avatar name={e.actorLabel} id={e.actorPublicId ?? e.actorLabel} size="sm" />{e.actorLabel}</div>
        : <span className="muted">—</span>,
    },
    {
      key: "action", header: "Action",
      render: (e) => {
        const m = actionMeta(e.action)
        const Icon = m.icon
        return <span className="act"><Icon />{m.label}</span>
      },
    },
    {
      key: "target", header: "Target", className: "cell2",
      render: (e) => {
        const line = detailLine(e)
        return (
          <>
            <b>{e.targetPublicId && can("USERS:VIEW") && e.targetPublicId !== e.actorPublicId
              ? <Link href={`/users/${e.targetPublicId}`} style={{ color: "inherit" }}>{e.targetLabel}</Link>
              : e.targetLabel ?? "—"}</b>
            {line && <span>{line}</span>}
          </>
        )
      },
    },
    { key: "ip", header: "IP address", className: "mono", render: (e) => e.ip ?? "—" },
    {
      key: "result", header: "Result",
      render: (e) => actionMeta(e.action).failed
        ? <span className="pill red"><X />Failed</span>
        : <span className="pill green"><Check />Success</span>,
    },
  ]

  return (
    <>
      <div className="page">
        <div className="page-head">
          <h1>{t.data ? `${count(t.data.totalItems)} Event${t.data.totalItems === 1 ? "" : "s"}` : "Events"}</h1>
          <span className="meta">Kept for 365 days · can&apos;t be edited</span>
          <div className="actions">
            {can("ACTIVITY_LOG:EXPORT") && (
              <a className="btn" href={`/api/v1/activity/export?${exportParams}`} download><Download />Export CSV</a>
            )}
          </div>
        </div>
        <div className="toolbar">
          {people.length > 0 && (
            <select className={`filter ${user ? "on" : ""}`} aria-label="User" value={user} onChange={(e) => t.setFilter("user", e.target.value)}>
              <option value="">User: All</option>
              {people.map((p) => <option key={p.publicId} value={p.publicId}>User: {p.fullName}</option>)}
            </select>
          )}
          <select className={`filter ${action ? "on" : ""}`} aria-label="Action" value={action} onChange={(e) => t.setFilter("action", e.target.value)}>
            <option value="">Action: All</option>
            {Object.entries(ACTIONS).map(([k, m]) => <option key={k} value={k}>Action: {m.label}</option>)}
          </select>
          <select className={`filter ${range !== "all" ? "on" : ""}`} aria-label="Date range" value={range} onChange={(e) => t.setFilter("range", e.target.value)}>
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        {filtered && (
          <div className="fchips">
            {user && <span className="chip">User: {person?.fullName ?? "selected"} <button aria-label="Remove user filter" onClick={() => t.setFilter("user", "")}><X size={13} /></button></span>}
            {action && <span className="chip">{actionMeta(action).label} <button aria-label="Remove action filter" onClick={() => t.setFilter("action", "")}><X size={13} /></button></span>}
            {range !== "all" && <span className="chip">{RANGES.find((r) => r.key === range)?.label} <button aria-label="Remove date filter" onClick={() => t.setFilter("range", "all")}><X size={13} /></button></span>}
            {t.query && <span className="chip">“{t.query}” <button aria-label="Remove search" onClick={() => t.setQ("")}><X size={13} /></button></span>}
            <button className="link-btn small" onClick={clear}>Clear all</button>
          </div>
        )}
        <DataTable
          table={t}
          label="Activity log"
          columns={columns}
          rowKey={(e) => String(e.id)}
          search={{ placeholder: "Search by email", label: "Search activity" }}
          sizes={[25, 50, 100]}
          errorTitle="Couldn't load the activity log"
          empty={(d) => d.totalItems > 0 ? null : (
            <EmptyState icon={<SearchX />}
              title={filtered ? "No events match these filters" : "Nothing recorded yet"}
              text={filtered ? "Try a longer date range or another user." : "Sign-ins and changes to accounts will show up here."}
              action={filtered && <button className="btn" onClick={clear}>Clear filters</button>} />
          )}
        />
        <p className="help" style={{ marginTop: 12 }}>Sensitive events (sign-ins, account changes, permission changes, exports) are always recorded. Emails of people without an account are masked.</p>
      </div>
    </>
  )
}
