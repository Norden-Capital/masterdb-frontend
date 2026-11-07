"use client"

import { Check, ChevronLeft, ChevronRight, Download, Search, SearchX, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { useSession } from "@/components/md/session"
import { Forbidden, SkeletonRows } from "@/components/md/states"
import { Avatar, Banner } from "@/components/md/ui"
import { ACTIONS, actionMeta, detailLine } from "@/lib/activity"
import { api, describe } from "@/lib/api"
import { dayLabel, timeWithSeconds } from "@/lib/format"
import type { ActivityEntry, Page, UserItem } from "@/lib/types"

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "1", label: "Last 24 hours", days: 1 },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "all", label: "All time (365 days)", days: null },
]

/** Mock 12: everything sensitive that happened, filterable, exportable. Kept 365 days. */
export default function ActivityPage() {
  const { can } = useSession()
  const [user, setUser] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("user") ?? "")
  const [action, setAction] = useState("")
  const [range, setRange] = useState("all")
  const [q, setQ] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(50)
  const [data, setData] = useState<Page<ActivityEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [people, setPeople] = useState<UserItem[]>([])
  const [reload, setReload] = useState(0)

  useEffect(() => {
    document.title = "Activity log · MasterDB"
    if (can("USERS:VIEW")) api<Page<UserItem>>("/api/v1/users?size=100&sort=fullName").then((p) => setPeople(p.items), () => {})
  }, [can])

  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const params = useCallback(() => {
    const p = new URLSearchParams()
    if (user) p.set("user", user)
    if (action) p.set("action", action)
    if (query) p.set("q", query)
    const days = RANGES.find((r) => r.key === range)?.days
    if (days) p.set("from", new Date(Date.now() - days * 86_400_000).toISOString())
    return p
  }, [user, action, query, range])

  useEffect(() => {
    if (!can("ACTIVITY_LOG:VIEW")) return
    const p = params()
    p.set("page", String(page))
    p.set("size", String(size))
    const ctl = new AbortController()
    api<Page<ActivityEntry>>(`/api/v1/activity?${p}`, { signal: ctl.signal })
      .then((d) => { setData(d); setError(null) }, (e) => e?.name !== "AbortError" && setError(e))
      .finally(() => setLoading(false))
    return () => ctl.abort()
  }, [can, params, page, size, reload])

  if (!can("ACTIVITY_LOG:VIEW")) return <Forbidden module="the activity log" />

  const person = people.find((p) => p.publicId === user)
  const filtered = !!(user || action || query || range !== "all")
  const clear = () => { setUser(""); setAction(""); setQ(""); setRange("all"); setPage(0) }
  const items = data?.items ?? []

  return (
    <>
      <div className="subtabs">
        {can("USERS:VIEW") && <Link href="/users">Users</Link>}
        <Link className="active" href="/activity">Activity log</Link>
      </div>
      <div className="page">
        <div className="page-head">
          <h1>{data ? `${data.totalItems.toLocaleString("en-CA")} Event${data.totalItems === 1 ? "" : "s"}` : "Events"}</h1>
          <span className="meta">Kept for 365 days · can&apos;t be edited</span>
          <div className="actions">
            {can("ACTIVITY_LOG:EXPORT") && (
              <a className="btn" href={`/api/v1/activity/export?${params()}`} download><Download />Export CSV</a>
            )}
          </div>
        </div>
        <div className="toolbar">
          {people.length > 0 && (
            <select className={`filter ${user ? "on" : ""}`} aria-label="User" value={user} onChange={(e) => { setUser(e.target.value); setPage(0) }}>
              <option value="">User: All</option>
              {people.map((p) => <option key={p.publicId} value={p.publicId}>User: {p.fullName}</option>)}
            </select>
          )}
          <select className={`filter ${action ? "on" : ""}`} aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(0) }}>
            <option value="">Action: All</option>
            {Object.entries(ACTIONS).map(([k, m]) => <option key={k} value={k}>Action: {m.label}</option>)}
          </select>
          <select className={`filter ${range !== "all" ? "on" : ""}`} aria-label="Date range" value={range} onChange={(e) => { setRange(e.target.value); setPage(0) }}>
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        {filtered && (
          <div className="fchips">
            {user && <span className="chip">User: {person?.fullName ?? "selected"} <button aria-label="Remove user filter" onClick={() => setUser("")}><X size={13} /></button></span>}
            {action && <span className="chip">{actionMeta(action).label} <button aria-label="Remove action filter" onClick={() => setAction("")}><X size={13} /></button></span>}
            {range !== "all" && <span className="chip">{RANGES.find((r) => r.key === range)?.label} <button aria-label="Remove date filter" onClick={() => setRange("all")}><X size={13} /></button></span>}
            {query && <span className="chip">“{query}” <button aria-label="Remove search" onClick={() => setQ("")}><X size={13} /></button></span>}
            <button className="link-btn small" onClick={clear}>Clear all</button>
          </div>
        )}
        <div className="table-card">
          <div className="table-top">
            <div className="input-wrap"><Search />
              <input className="input" placeholder="Search by email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search activity" />
            </div>
            {data && data.totalItems > 0 && (
              <div className="right">Showing
                <select className="filter" style={{ height: 32 }} aria-label="Rows per page" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}>
                  {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                of <b className="num" style={{ color: "var(--fg)" }}>{data.totalItems.toLocaleString("en-CA")}</b>
              </div>
            )}
          </div>
          {error ? (
            <Banner tone="red" title="Couldn't load the activity log" style={{ margin: 16 }}>
              {describe(error)} <button className="link-btn" onClick={() => { setLoading(true); setReload((r) => r + 1) }}>Try again</button>
            </Banner>
          ) : null}
          {!error && data && data.totalItems === 0 && (
            <div className="empty"><div className="ic"><SearchX /></div>
              <h3>{filtered ? "No events match these filters" : "Nothing recorded yet"}</h3>
              <p>{filtered ? "Try a longer date range or another user." : "Sign-ins and changes to accounts will show up here."}</p>
              {filtered && <button className="btn" onClick={clear}>Clear filters</button>}
            </div>
          )}
          {!error && (loading && !data || items.length > 0) && (
            <div className="tbl-scroll">
              <table className="t">
                <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>IP address</th><th>Result</th></tr></thead>
                <tbody>
                  {loading && !data ? <SkeletonRows cols={6} /> : items.map((e) => {
                    const m = actionMeta(e.action)
                    const Icon = m.icon
                    const line = detailLine(e)
                    return (
                      <tr key={e.id}>
                        <td className="cell2"><b>{dayLabel(e.occurredAt)}</b><span>{timeWithSeconds(e.occurredAt)}</span></td>
                        <td>{e.actorLabel
                          ? <div className="who"><Avatar name={e.actorLabel} id={e.actorPublicId ?? e.actorLabel} size="sm" />{e.actorLabel}</div>
                          : <span className="muted">—</span>}</td>
                        <td><span className="act"><Icon />{m.label}</span></td>
                        <td className="cell2"><b>{e.targetPublicId && can("USERS:VIEW") && e.targetPublicId !== e.actorPublicId
                          ? <Link href={`/users/${e.targetPublicId}`} style={{ color: "inherit" }}>{e.targetLabel}</Link>
                          : e.targetLabel ?? "—"}</b>{line && <span>{line}</span>}</td>
                        <td className="mono">{e.ip ?? "—"}</td>
                        <td>{m.failed ? <span className="pill red"><X />Failed</span> : <span className="pill green"><Check />Success</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data && data.totalPages > 1 && (
            <div className="pager">
              {(data.page * data.size + 1).toLocaleString("en-CA")}–{(data.page * data.size + items.length).toLocaleString("en-CA")} of {data.totalItems.toLocaleString("en-CA")}
              <button className="round" style={{ width: 32, height: 32 }} aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></button>
              <button className="round" style={{ width: 32, height: 32 }} aria-label="Next page" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}><ChevronRight /></button>
            </div>
          )}
        </div>
        <p className="help" style={{ marginTop: 12 }}>Sensitive events (sign-ins, account changes, permission changes, exports) are always recorded. Emails of people without an account are masked.</p>
      </div>
    </>
  )
}
