"use client"

import {
  ChevronLeft, ChevronRight, CircleSlash, Crown, Ellipsis, KeyRound, LogOut, RotateCcw, Search, Send,
  SlidersHorizontal, Trash2, UserPlus, UserRound, Users,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { allPermissions } from "@/components/md/permission-grid"
import { useSession } from "@/components/md/session"
import { Forbidden, SkeletonRows } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Avatar, Banner, Modal, StatusPill } from "@/components/md/ui"
import { api, describe } from "@/lib/api"
import { relative, when } from "@/lib/format"
import type { Catalogue, Page, UserItem, UserStatus } from "@/lib/types"
import { InviteModal } from "./invite-modal"

type Sort = { field: "fullName" | "status" | "lastLoginAt" | "createdAt"; dir: "asc" | "desc" }

/** Mock 07: the team, with search, status filter, paging, row and bulk actions. */
export default function UsersPage() {
  const { me, can } = useSession()
  const toast = useToast()
  const [q, setQ] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<UserStatus | "">("")
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(25)
  const [sort, setSort] = useState<Sort>({ field: "createdAt", dir: "asc" })
  const [data, setData] = useState<Page<UserItem> | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<UserItem[] | null>(null)
  const [inviting, setInviting] = useState(false)
  const [reload, setReload] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = "Users · MasterDB"
    api<Catalogue>("/api/v1/permissions/catalogue").then(setCatalogue, () => {})
  }, [])

  // Search waits for a pause in typing.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!can("USERS:VIEW")) return
    const params = new URLSearchParams({ page: String(page), size: String(size), sort: `${sort.field},${sort.dir}` })
    if (query) params.set("q", query)
    if (status) params.set("status", status)
    const ctl = new AbortController()
    api<Page<UserItem>>(`/api/v1/users?${params}`, { signal: ctl.signal })
      .then((d) => { setData(d); setError(null); setSelected(new Set()) }, (e) => e?.name !== "AbortError" && setError(e))
      .finally(() => setLoading(false))
    return () => ctl.abort()
  }, [can, page, size, sort, query, status, reload])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(null)
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menu])

  const refresh = useCallback(() => { setLoading(true); setReload((r) => r + 1) }, [])
  const total = catalogue ? allPermissions(catalogue).length : null
  const items = useMemo(() => data?.items ?? [], [data])
  const selectable = (u: UserItem) => !u.isOwner && u.publicId !== me.publicId && can("USERS:EDIT")
  const chosen = items.filter((u) => selected.has(u.publicId))

  if (!can("USERS:VIEW")) return <Forbidden module="Users & permissions" />

  async function act(label: string, run: () => Promise<unknown>) {
    setMenu(null)
    try {
      await run()
      toast(label)
      refresh()
    } catch (e) {
      toast(describe(e), "bad")
    }
  }

  const resend = (u: UserItem) => act(`Invite sent again to ${u.email}`, () => api(`/api/v1/users/${u.publicId}/invite/resend`, { method: "POST" }))
  const cancel = (u: UserItem) => act(`Invite for ${u.email} cancelled`, () => api(`/api/v1/users/${u.publicId}/invite`, { method: "DELETE" }))
  const reset2fa = (u: UserItem) => act(`Two-factor reset. ${u.fullName} sets it up at next login.`, () => api(`/api/v1/users/${u.publicId}/2fa/reset`, { method: "POST" }))
  const logoutAll = (u: UserItem) => act(`${u.fullName} was logged out everywhere`, () => api(`/api/v1/users/${u.publicId}/sessions`, { method: "DELETE" }))
  const enable = (u: UserItem) => act(`${u.fullName} can log in again`, () => api(`/api/v1/users/${u.publicId}/enable`, { method: "POST" }))

  async function disable(users: UserItem[]) {
    setConfirm(null)
    let ok = 0
    for (const u of users) {
      try {
        await api(`/api/v1/users/${u.publicId}/disable`, { method: "POST" })
        ok++
      } catch (e) {
        toast(`${u.fullName}: ${describe(e)}`, "bad")
      }
    }
    if (ok) toast(`${ok} user${ok === 1 ? "" : "s"} disabled`)
    refresh()
  }

  async function bulkResend() {
    const invited = chosen.filter((u) => u.status === "INVITED")
    for (const u of invited) {
      try {
        await api(`/api/v1/users/${u.publicId}/invite/resend`, { method: "POST" })
      } catch (e) {
        toast(`${u.fullName}: ${describe(e)}`, "bad")
      }
    }
    toast(`${invited.length} invite${invited.length === 1 ? "" : "s"} sent again`)
    refresh()
  }

  const sortBy = (field: Sort["field"]) => {
    setSort((s) => ({ field, dir: s.field === field && s.dir === "asc" ? "desc" : "asc" }))
    setPage(0)
  }
  const arrow = (field: Sort["field"]) => (sort.field === field ? (sort.dir === "asc" ? "↑" : "↓") : "⇅")
  const counts = data && !query && !status ? data.totalItems : null
  const allChosen = items.filter(selectable).length > 0 && items.filter(selectable).every((u) => selected.has(u.publicId))

  return (
    <>
      <div className="subtabs">
        <Link className="active" href="/users">Users</Link>
        {can("ACTIVITY_LOG:VIEW") && <Link href="/activity">Activity log</Link>}
      </div>
      <div className="page">
        <div className="page-head">
          <h1>{data ? `${data.totalItems} User${data.totalItems === 1 ? "" : "s"}` : "Users"}</h1>
          {counts !== null && <span className="meta">{query || status ? "matching" : "in MasterDB"}</span>}
          <div className="actions">
            {can("USERS:CREATE") && (
              <button className="btn primary" onClick={() => setInviting(true)}><UserPlus />Invite user</button>
            )}
          </div>
        </div>
        <div className="toolbar">
          <select className="filter" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value as UserStatus | ""); setPage(0) }}>
            <option value="">Status: All</option>
            <option value="ACTIVE">Status: Active</option>
            <option value="INVITED">Status: Invited</option>
            <option value="DISABLED">Status: Disabled</option>
          </select>
        </div>
        <div className="table-card">
          <div className="table-top">
            <div className="input-wrap"><Search />
              <input className="input" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
            </div>
            {data && data.totalItems > 0 && (
              <div className="right">Showing
                <select className="filter" style={{ height: 32 }} aria-label="Rows per page" value={size}
                  onChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}>
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                of <b className="num" style={{ color: "var(--fg)" }}>{data.totalItems}</b>
              </div>
            )}
          </div>
          {error ? (
            <Banner tone="red" title="Couldn't load users" style={{ margin: 16 }}>
              {describe(error)} <button className="link-btn" onClick={refresh}>Try again</button>
            </Banner>
          ) : null}
          {!error && data && data.totalItems === 0 && (query || status) && (
            <div className="empty"><div className="ic"><Search /></div><h3>No users match</h3>
              <p>Try another name or clear the filters.</p>
              <button className="btn" onClick={() => { setQ(""); setStatus("") }}>Clear filters</button></div>
          )}
          {!error && data && data.totalItems <= 1 && !query && !status && (
            <div className="empty"><div className="ic"><Users /></div><h3>Invite your team</h3>
              <p>You&apos;re the only person here. Invite people and choose exactly what each one can see and do.</p>
              {can("USERS:CREATE") && <button className="btn primary" onClick={() => setInviting(true)}><UserPlus />Invite user</button>}
            </div>
          )}
          {!error && (loading && !data || (data && items.length > 0 && !(data.totalItems <= 1 && !query && !status))) && (
            <div className="tbl-scroll">
              <table className="t">
                <thead>
                  <tr>
                    <th className="w-cb">
                      {can("USERS:EDIT") && (
                        <input type="checkbox" className="cb" aria-label="Select all" checked={allChosen}
                          onChange={(e) => setSelected(e.target.checked ? new Set(items.filter(selectable).map((u) => u.publicId)) : new Set())} />
                      )}
                    </th>
                    <th><button className="sorter" onClick={() => sortBy("fullName")}>User <span className="sort">{arrow("fullName")}</span></button></th>
                    <th>Permissions</th>
                    <th><button className="sorter" onClick={() => sortBy("status")}>Status <span className="sort">{arrow("status")}</span></button></th>
                    <th><button className="sorter" onClick={() => sortBy("lastLoginAt")}>Last login <span className="sort">{arrow("lastLoginAt")}</span></button></th>
                    <th style={{ width: 56 }}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !data ? <SkeletonRows cols={6} /> : items.map((u) => (
                    <tr key={u.publicId} className={selected.has(u.publicId) ? "sel" : ""}>
                      <td>
                        {selectable(u) && (
                          <input type="checkbox" className="cb" aria-label={`Select ${u.fullName}`} checked={selected.has(u.publicId)}
                            onChange={(e) => {
                              const next = new Set(selected)
                              if (e.target.checked) next.add(u.publicId)
                              else next.delete(u.publicId)
                              setSelected(next)
                            }} />
                        )}
                      </td>
                      <td>
                        <Link className="who" href={`/users/${u.publicId}`} style={{ color: "inherit" }}>
                          <Avatar name={u.fullName} id={u.publicId} />
                          <span className="cell2"><b>{u.fullName}{u.publicId === me.publicId && <span className="muted small"> (you)</span>}</b><span>{u.email}</span></span>
                        </Link>
                      </td>
                      <td>
                        {u.isOwner ? (
                          <span className="chip" style={{ background: "var(--primary-soft)", color: "var(--primary-text)" }}><Crown size={13} />Owner · everything</span>
                        ) : (
                          <span className="cell2"><b>{u.permissionCount === 0 ? "No access" : "Custom"}</b>
                            <span>{u.permissionCount}{total ? ` of ${total}` : ""} permissions</span></span>
                        )}
                      </td>
                      <td><StatusPill user={u} /></td>
                      <td className="cell2">
                        <b>{u.status === "INVITED" ? "Never" : when(u.lastLoginAt)}</b>
                        <span style={u.status === "INVITED" && !u.inviteExpiresAt ? { color: "var(--amber-fg)" } : undefined}>
                          {u.status === "INVITED" ? (u.inviteExpiresAt ? `Invite expires ${relative(u.inviteExpiresAt)}` : "Invite expired")
                            : u.locked ? "Locked after failed attempts" : u.twoFactorEnabled ? "Two-factor on" : "Two-factor not set up"}
                        </span>
                      </td>
                      <td className="actions-cell">
                        {!u.isOwner && u.publicId !== me.publicId && (
                          <div ref={menu === u.publicId ? menuRef : undefined}>
                            <button className="round" style={{ width: 32, height: 32 }} aria-label={`Actions for ${u.fullName}`}
                              aria-haspopup="menu" aria-expanded={menu === u.publicId} onClick={() => setMenu(menu === u.publicId ? null : u.publicId)}>
                              <Ellipsis />
                            </button>
                            {menu === u.publicId && (
                              <div className="menu row-menu" role="menu">
                                <Link href={`/users/${u.publicId}`}><UserRound />View profile</Link>
                                {can("USERS:EDIT") && <Link href={`/users/${u.publicId}/permissions`}><SlidersHorizontal />Edit permissions</Link>}
                                {u.status === "INVITED" && can("USERS:CREATE") && <button onClick={() => resend(u)}><Send />Resend invite</button>}
                                {u.status === "ACTIVE" && can("USERS:EDIT") && <button onClick={() => reset2fa(u)}><KeyRound />Reset two-factor</button>}
                                {u.status === "ACTIVE" && can("USERS:EDIT") && <button onClick={() => logoutAll(u)}><LogOut />Log out all sessions</button>}
                                {u.status === "DISABLED" && can("USERS:EDIT") && <button onClick={() => enable(u)}><RotateCcw />Enable user</button>}
                                {(u.status === "ACTIVE" && can("USERS:EDIT")) || (u.status === "INVITED" && can("USERS:DELETE")) ? <hr /> : null}
                                {u.status === "INVITED" && can("USERS:DELETE") && <button className="danger" onClick={() => cancel(u)}><Trash2 />Cancel invite</button>}
                                {u.status === "ACTIVE" && can("USERS:EDIT") && <button className="danger" onClick={() => { setMenu(null); setConfirm([u]) }}><CircleSlash />Disable user</button>}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && data.totalPages > 1 && (
            <div className="pager">
              {data.page * data.size + 1}–{data.page * data.size + items.length} of {data.totalItems}
              <button className="round" style={{ width: 32, height: 32 }} aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></button>
              <button className="round" style={{ width: 32, height: 32 }} aria-label="Next page" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}><ChevronRight /></button>
            </div>
          )}
        </div>
        <p className="help" style={{ marginTop: 12 }}>The Owner and your own row can&apos;t be selected: they can&apos;t be disabled or edited here.</p>
      </div>

      {chosen.length > 0 && (
        <div className="bulkbar" role="toolbar" aria-label="Bulk actions">
          <b>{chosen.length} selected</b>
          <button className="link-btn" onClick={() => setSelected(new Set())}>Unselect all</button>
          <span className="vr" />
          {can("USERS:CREATE") && chosen.some((u) => u.status === "INVITED") && <button className="btn" onClick={bulkResend}><Send />Resend invite</button>}
          {chosen.some((u) => u.status === "ACTIVE") && (
            <>
              <span className="vr" />
              <button className="btn text-danger" onClick={() => setConfirm(chosen.filter((u) => u.status === "ACTIVE"))}><CircleSlash />Disable</button>
            </>
          )}
        </div>
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} size="narrow" tone="red" icon={<CircleSlash />}
        title={confirm?.length === 1 ? `Disable ${confirm[0].fullName}?` : `Disable ${confirm?.length} users?`}
        text="They're logged out right away and can't log in until you enable them again. Their history stays."
        footer={<>
          <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
          <button className="btn danger" onClick={() => confirm && disable(confirm)}>
            {confirm?.length === 1 ? `Disable ${confirm[0].fullName}` : `Disable ${confirm?.length} users`}
          </button>
        </>} />
      <InviteModal open={inviting} onClose={() => setInviting(false)} onSent={refresh} catalogue={catalogue} />
    </>
  )
}
