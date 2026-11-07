"use client"

import {
  CircleSlash, Crown, Ellipsis, KeyRound, LogOut, RotateCcw, Search, Send, SlidersHorizontal, Trash2, UserPlus,
  UserRound, Users,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { type Column, DataTable } from "@/components/md/data-table"
import { ConfirmDialog } from "@/components/md/dialogs"
import { allPermissions } from "@/components/md/permission-grid"
import { useSession } from "@/components/md/session"
import { EmptyState, Forbidden } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Avatar, StatusPill } from "@/components/md/ui"
import { useTableQuery } from "@/components/md/use-table-query"
import { api, describe } from "@/lib/api"
import { relative, when } from "@/lib/format"
import { count } from "@/lib/table"
import type { Catalogue, UserItem } from "@/lib/types"
import { InviteModal } from "./invite-modal"

/** Mock 07: the team, with search, status filter, paging, row and bulk actions. */
export default function UsersPage() {
  const { me, can } = useSession()
  const toast = useToast()
  const t = useTableQuery<UserItem>({
    path: "/api/v1/users", enabled: can("USERS:VIEW"), sort: { field: "createdAt", dir: "asc" },
    filters: { status: "" },
  })
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<UserItem[] | null>(null)
  const [inviting, setInviting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = "Users · MasterDB"
    api<Catalogue>("/api/v1/permissions/catalogue").then(setCatalogue, () => {})
  }, [])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(null)
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menu])

  const refresh = t.reload
  const total = catalogue ? allPermissions(catalogue).length : null
  const selectable = (u: UserItem) => !u.isOwner && u.publicId !== me.publicId && can("USERS:EDIT")

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

  async function bulkResend(chosen: UserItem[]) {
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

  const columns: Column<UserItem>[] = [
    {
      key: "user", header: "User", sortField: "fullName",
      render: (u) => (
        <Link className="who" href={`/users/${u.publicId}`} style={{ color: "inherit" }}>
          <Avatar name={u.fullName} id={u.publicId} />
          <span className="cell2"><b>{u.fullName}{u.publicId === me.publicId && <span className="muted small"> (you)</span>}</b><span>{u.email}</span></span>
        </Link>
      ),
    },
    {
      key: "permissions", header: "Permissions",
      render: (u) => u.isOwner ? (
        <span className="chip" style={{ background: "var(--primary-soft)", color: "var(--primary-text)" }}><Crown size={13} />Owner · everything</span>
      ) : (
        <span className="cell2"><b>{u.permissionCount === 0 ? "No access" : "Custom"}</b>
          <span>{u.permissionCount}{total ? ` of ${total}` : ""} permissions</span></span>
      ),
    },
    { key: "status", header: "Status", sortField: "status", render: (u) => <StatusPill user={u} /> },
    {
      key: "lastLogin", header: "Last login", sortField: "lastLoginAt", className: "cell2",
      render: (u) => (
        <>
          <b>{u.status === "INVITED" ? "Never" : when(u.lastLoginAt)}</b>
          <span style={u.status === "INVITED" && !u.inviteExpiresAt ? { color: "var(--amber-fg)" } : undefined}>
            {u.status === "INVITED" ? (u.inviteExpiresAt ? `Invite expires ${relative(u.inviteExpiresAt)}` : "Invite expired")
              : u.locked ? "Locked after failed attempts" : u.twoFactorEnabled ? "Two-factor on" : "Two-factor not set up"}
          </span>
        </>
      ),
    },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, width: 56, className: "actions-cell",
      render: (u) => !u.isOwner && u.publicId !== me.publicId && (
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
      ),
    },
  ]

  const data = t.data
  const status = t.filters.status ?? ""
  return (
    <>
      <div className="subtabs">
        <Link className="active" href="/users">Users</Link>
        {can("ACTIVITY_LOG:VIEW") && <Link href="/activity">Activity log</Link>}
      </div>
      <div className="page">
        <div className="page-head">
          <h1>{data ? `${count(data.totalItems)} User${data.totalItems === 1 ? "" : "s"}` : "Users"}</h1>
          {data && <span className="meta">{t.filtered ? "matching" : "in MasterDB"}</span>}
          <div className="actions">
            {can("USERS:CREATE") && (
              <button className="btn primary" onClick={() => setInviting(true)}><UserPlus />Invite user</button>
            )}
          </div>
        </div>
        <div className="toolbar">
          <select className={`filter ${status ? "on" : ""}`} aria-label="Status" value={status}
            onChange={(e) => t.setFilter("status", e.target.value)}>
            <option value="">Status: All</option>
            <option value="ACTIVE">Status: Active</option>
            <option value="INVITED">Status: Invited</option>
            <option value="DISABLED">Status: Disabled</option>
          </select>
        </div>
        <DataTable
          table={t}
          label="Users"
          columns={columns}
          rowKey={(u) => u.publicId}
          rowLabel={(u) => u.fullName}
          selectable={selectable}
          search={{ placeholder: "Search by name or email", label: "Search users" }}
          errorTitle="Couldn't load users"
          empty={(d) => {
            if (d.totalItems === 0 && t.filtered) {
              return <EmptyState icon={<Search />} title="No users match" text="Try another name or clear the filters."
                action={<button className="btn" onClick={t.clearFilters}>Clear filters</button>} />
            }
            if (d.totalItems <= 1 && !t.filtered) {
              return <EmptyState icon={<Users />} title="Invite your team"
                text="You're the only person here. Invite people and choose exactly what each one can see and do."
                action={can("USERS:CREATE") && <button className="btn primary" onClick={() => setInviting(true)}><UserPlus />Invite user</button>} />
            }
            return null
          }}
          bulkActions={(chosen) => (
            <>
              {can("USERS:CREATE") && chosen.some((u) => u.status === "INVITED") && (
                <button className="btn" onClick={() => bulkResend(chosen)}><Send />Resend invite</button>
              )}
              {chosen.some((u) => u.status === "ACTIVE") && (
                <>
                  <span className="vr" />
                  <button className="btn text-danger" onClick={() => setConfirm(chosen.filter((u) => u.status === "ACTIVE"))}><CircleSlash />Disable</button>
                </>
              )}
            </>
          )}
        />
        <p className="help" style={{ marginTop: 12 }}>The Owner and your own row can&apos;t be selected: they can&apos;t be disabled or edited here.</p>
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} danger icon={<CircleSlash />}
        title={confirm?.length === 1 ? `Disable ${confirm[0].fullName}?` : `Disable ${confirm?.length ?? 0} users?`}
        text="They're logged out right away and can't log in until you enable them again. Their history stays."
        confirmLabel={confirm?.length === 1 ? `Disable ${confirm[0].fullName}` : `Disable ${confirm?.length ?? 0} users`}
        onConfirm={() => confirm ? disable(confirm) : undefined} />
      <InviteModal open={inviting} onClose={() => setInviting(false)} onSent={refresh} catalogue={catalogue} />
    </>
  )
}
