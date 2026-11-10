"use client"

import { ArrowLeft, CircleDot, Copy, Crown, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { PermissionGrid, allPermissions } from "@/components/md/permission-grid"
import { useSession } from "@/components/md/session"
import { Forbidden } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Avatar, Banner, Modal } from "@/components/md/ui"
import { api, describe } from "@/lib/api"
import type { Catalogue, Page, UserDetail, UserItem } from "@/lib/types"
import { SelectField } from "@/components/md/select-field"

/** Mock 10: the grid, templates, copy from another user, unsaved-changes bar and leave guard. */
export function PermissionsEditor() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { me, can } = useSession()
  const toast = useToast()
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [initial, setInitial] = useState<Set<string>>(new Set())
  const [value, setValue] = useState<Set<string>>(new Set())
  const [error, setError] = useState<unknown>(null)
  const [saveError, setSaveError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const [guard, setGuard] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [others, setOthers] = useState<UserItem[] | null>(null)
  const [copyQ, setCopyQ] = useState("")
  const copyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api<Catalogue>("/api/v1/permissions/catalogue").then(setCatalogue, setError)
    api<UserDetail>(`/api/v1/users/${id}`).then((d) => {
      setDetail(d)
      const perms = new Set(d.user.isOwner ? [] : d.permissions)
      setInitial(perms)
      setValue(perms)
      document.title = `Permissions · ${d.user.fullName} · MasterDB`
    }, setError)
  }, [id])

  const changes = [...new Set([...initial, ...value])].filter((p) => initial.has(p) !== value.has(p)).length
  const dirty = changes > 0

  // Closing the tab or reloading with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  useEffect(() => {
    if (!copyOpen) return
    if (others === null) {
      api<Page<UserItem>>("/api/v1/users?size=100&status=ACTIVE&sort=fullName").then((p) => setOthers(p.items), () => setOthers([]))
    }
    const close = (e: MouseEvent) => !copyRef.current?.contains(e.target as Node) && setCopyOpen(false)
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [copyOpen, others])

  if (!can("USERS:EDIT")) return <Forbidden module="permission editing" />

  const u = detail?.user
  const total = catalogue ? allPermissions(catalogue).length : 0
  const self = u?.publicId === me.publicId

  async function save(): Promise<boolean> {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await api<{ permissions: string[] }>(`/api/v1/users/${id}/permissions`, { method: "PUT", body: { permissions: [...value] } })
      const saved = new Set(res.permissions)
      setInitial(saved)
      setValue(saved)
      toast(`Permissions saved for ${u?.fullName}`)
      return true
    } catch (e) {
      setSaveError(e)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function copyFrom(other: UserItem) {
    setCopyOpen(false)
    try {
      const d = await api<UserDetail>(`/api/v1/users/${other.publicId}`)
      setValue(new Set(d.user.isOwner ? allPermissions(catalogue!) : d.permissions))
      toast(`Copied ${other.fullName}'s permissions. Review, then save.`)
    } catch (e) {
      toast(describe(e), "bad")
    }
  }

  const back = (e: React.MouseEvent) => {
    if (dirty) {
      e.preventDefault()
      setGuard(true)
    }
  }

  return (
    <>
      <div className="page">
        <Link className="back" href={`/users/${id}`} onClick={back}><span className="round"><ArrowLeft /></span>Back to {u?.fullName ?? "user"}</Link>
        {error ? <Banner tone="red" title="Couldn't load the permissions">{describe(error)}</Banner> : null}
        {u && catalogue && (
          <>
            <div className="page-head">
              <Avatar name={u.fullName} id={u.publicId} />
              <h1>Permissions · {u.fullName}</h1>
              {!u.isOwner && <span className="meta">{value.size} of {total} permissions</span>}
              {!u.isOwner && !self && (
                <div className="actions">
                  <SelectField className="input" style={{ width: 220, height: 40 }} aria-label="Apply a template" value=""
                    onChange={(e) => {
                      const t = catalogue.templates.find((x) => x.key === e.target.value)
                      if (e.target.value === "NONE") setValue(new Set())
                      else if (t) setValue(new Set(t.permissions.filter((p) => can(p))))
                    }}>
                    <option value="">Apply a template…</option>
                    {catalogue.templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    <option value="NONE">No access</option>
                  </SelectField>
                  <div ref={copyRef} style={{ position: "relative" }}>
                    <button className="btn" onClick={() => setCopyOpen(!copyOpen)} aria-haspopup="menu"><Copy />Copy from user</button>
                    {copyOpen && (
                      <div className="menu" style={{ position: "absolute", right: 0, top: 46, width: 260, zIndex: 20 }}>
                        <div className="head"><input className="input" style={{ height: 36 }} placeholder="Search users" value={copyQ}
                          onChange={(e) => setCopyQ(e.target.value)} autoFocus /></div>
                        {others === null && <p className="muted small" style={{ padding: 10 }}>Loading…</p>}
                        {others?.filter((o) => o.publicId !== id && `${o.fullName} ${o.email}`.toLowerCase().includes(copyQ.toLowerCase()))
                          .slice(0, 8).map((o) => (
                            <button key={o.publicId} onClick={() => copyFrom(o)}>
                              <Avatar name={o.fullName} id={o.publicId} size="sm" />{o.fullName}
                              <span className="muted small" style={{ marginLeft: "auto" }}>{o.isOwner ? "Owner" : `${o.permissionCount}`}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {saveError ? <Banner tone="red" title="Couldn't save permissions">Nothing was changed. Your edits are still here. {describe(saveError)}</Banner> : null}
            {u.isOwner ? (
              <>
                <Banner tone="blue" icon={<Crown />} title="The Owner has every permission">The Owner role can&apos;t be limited.</Banner>
                <div className="card" style={{ opacity: 0.6 }}>
                  <PermissionGrid catalogue={catalogue} value={new Set(allPermissions(catalogue))} onChange={() => {}} disabled />
                </div>
              </>
            ) : self ? (
              <Banner tone="amber" title="You can't change your own permissions">Ask another person with user management access, or the Owner.</Banner>
            ) : (
              <>
                <p className="muted" style={{ margin: "-8px 0 16px" }}>
                  Tick what {u.fullName.split(" ")[0]} can do. Use the column and row boxes to switch a whole action or module at once.
                  Changed rows are highlighted until you save.{!me.isOwner && " You can only grant or remove permissions you have yourself."}
                </p>
                <div className="card">
                  <PermissionGrid catalogue={catalogue} value={value} initial={initial} onChange={setValue} grantable={can} />
                </div>
              </>
            )}
            {dirty && (
              <div className="savebar" role="region" aria-label="Unsaved changes">
                <CircleDot style={{ color: "#F2C26B" }} /><span><b>{changes}</b> unsaved change{changes === 1 ? "" : "s"}</span>
                <span style={{ marginLeft: "auto" }} />
                <button className="btn" onClick={() => setValue(new Set(initial))} disabled={saving}>Discard</button>
                <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
              </div>
            )}
          </>
        )}
      </div>
      <Modal open={guard} onClose={() => setGuard(false)} size="narrow" tone="amber" icon={<TriangleAlert />}
        title="Leave without saving?"
        text={<>You have <b>{changes}</b> unsaved permission change{changes === 1 ? "" : "s"} for {u?.fullName}. If you leave now, they&apos;re lost.</>}
        footer={<>
          <button className="btn text-danger" onClick={() => { setGuard(false); setValue(new Set(initial)); router.push(`/users/${id}`) }}>Leave anyway</button>
          <button className="btn" onClick={() => setGuard(false)}>Keep editing</button>
          <button className="btn primary" onClick={async () => { if (await save()) { setGuard(false); router.push(`/users/${id}`) } }}>Save and leave</button>
        </>} />
    </>
  )
}
