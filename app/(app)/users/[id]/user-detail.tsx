"use client"

import { ArrowLeft, Calendar, CircleSlash, Ellipsis, KeyRound, Laptop, LogOut, Monitor, RotateCcw, Send, Smartphone } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { PermissionSummary, allPermissions } from "@/components/md/permission-grid"
import { useSession } from "@/components/md/session"
import { Forbidden } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Avatar, Banner, Modal, StatusPill } from "@/components/md/ui"
import { actionMeta, detailLine } from "@/lib/activity"
import { api, ApiError, describe } from "@/lib/api"
import { date, dayLabel, device, relative, when } from "@/lib/format"
import type { ActivityEntry, Catalogue, Page, SessionView, UserDetail } from "@/lib/types"

export function DeviceIcon({ ua }: { ua?: string }) {
  const kind = device(ua).kind
  return kind === "phone" ? <Smartphone /> : kind === "laptop" ? <Laptop /> : <Monitor />
}

/** Mock 09: profile | activity & sessions | permissions & sessions. */
export function UserDetailView() {
  const { id } = useParams<{ id: string }>()
  const { me, can } = useSession()
  const toast = useToast()
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null)
  const [tab, setTab] = useState<"activity" | "sessions">("activity")
  const [confirm, setConfirm] = useState(false)
  const [more, setMore] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    api<Catalogue>("/api/v1/permissions/catalogue").then(setCatalogue, () => {})
  }, [])

  useEffect(() => {
    if (!can("USERS:VIEW")) return
    api<UserDetail>(`/api/v1/users/${id}`).then((d) => {
      setDetail(d)
      setError(null)
      document.title = `${d.user.fullName} · MasterDB`
    }, setError)
    if (can("ACTIVITY_LOG:VIEW")) {
      api<Page<ActivityEntry>>(`/api/v1/activity?user=${id}&size=15`).then((p) => setActivity(p.items), () => setActivity([]))
    }
  }, [id, can, reload])

  const refresh = useCallback(() => setReload((r) => r + 1), [])

  if (!can("USERS:VIEW")) return <Forbidden module="Users & permissions" />
  const notFound = error instanceof ApiError && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED")

  async function act(label: string, run: () => Promise<unknown>) {
    setMore(false)
    try {
      await run()
      toast(label)
      refresh()
    } catch (e) {
      toast(describe(e), "bad")
    }
  }

  const u = detail?.user
  const editable = !!u && !u.isOwner && u.publicId !== me.publicId && can("USERS:EDIT")
  const perms = new Set(detail?.permissions ?? [])
  const total = catalogue ? allPermissions(catalogue).length : null
  const sessions = detail?.sessions ?? []

  const endSession = (s: SessionView) =>
    act("Session ended", () => api(`/api/v1/users/${id}/sessions/${s.publicId}`, { method: "DELETE" }))

  return (
    <>
      <div className="page">
        <Link className="back" href="/users"><span className="round"><ArrowLeft /></span>Back to users</Link>
        {error ? (
          <Banner tone="red" title={notFound ? "This user doesn't exist" : "Couldn't load this user"}>
            {notFound ? "It may have been an invitation that was cancelled." : describe(error)}{" "}
            {!notFound && <button className="link-btn" onClick={refresh}>Try again</button>}
          </Banner>
        ) : null}
        {u?.status === "DISABLED" && (
          <Banner tone="amber" icon={<CircleSlash />} title={`${u.fullName} is disabled`}>
            They can&apos;t log in.{" "}
            {editable && <button className="link-btn" onClick={() => act(`${u.fullName} can log in again`, () => api(`/api/v1/users/${id}/enable`, { method: "POST" }))}>Enable user</button>}
          </Banner>
        )}
        {!error && (
          <div className="cols-3">
            {/* left: profile */}
            <div>
              <div className="section" style={{ textAlign: "center", paddingTop: 28 }}>
                {!u ? (
                  <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                    <span className="avatar lg" style={{ background: "var(--muted)" }} />
                    <span className="skel" style={{ width: 140, height: 16 }} /><span className="skel" style={{ width: 180 }} />
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Avatar name={u.fullName} id={u.publicId} size="lg" /></div>
                    <h2 style={{ fontSize: 22, lineHeight: "28px", fontWeight: 700 }}>{u.fullName}</h2>
                    <p className="muted" style={{ margin: "4px 0 10px" }}>{u.email}</p>
                    <StatusPill user={u} />
                    {editable && (
                      <div className="qa" style={{ margin: "20px 0" }}>
                        {u.status === "ACTIVE" && (
                          <div className="qa-item"><button className="round" title="Reset two-factor" aria-label="Reset two-factor"
                            onClick={() => act(`Two-factor reset. ${u.fullName} sets it up at next login.`, () => api(`/api/v1/users/${id}/2fa/reset`, { method: "POST" }))}><KeyRound /></button>Reset 2FA</div>
                        )}
                        {u.status !== "INVITED" && (
                          <div className="qa-item"><button className="round" title="Log out all sessions" aria-label="Log out all sessions"
                            onClick={() => act(`${u.fullName} was logged out everywhere`, () => api(`/api/v1/users/${id}/sessions`, { method: "DELETE" }))}><LogOut /></button>Log out all</div>
                        )}
                        {u.status === "ACTIVE" && (
                          <div className="qa-item"><button className="round" title="Disable user" aria-label="Disable user" style={{ color: "var(--destructive-text)" }}
                            onClick={() => setConfirm(true)}><CircleSlash /></button>Disable</div>
                        )}
                        {u.status === "DISABLED" && (
                          <div className="qa-item"><button className="round" title="Enable user" aria-label="Enable user"
                            onClick={() => act(`${u.fullName} can log in again`, () => api(`/api/v1/users/${id}/enable`, { method: "POST" }))}><RotateCcw /></button>Enable</div>
                        )}
                        {u.status === "INVITED" && can("USERS:CREATE") && (
                          <div className="qa-item" style={{ position: "relative" }}>
                            <button className="round" title="More" aria-label="More" onClick={() => setMore(!more)}><Ellipsis /></button>More
                            {more && (
                              <div className="menu" style={{ position: "absolute", top: 44, right: -60, width: 220, zIndex: 20, textAlign: "left" }}>
                                <button onClick={() => act("Invite sent again", () => api(`/api/v1/users/${id}/invite/resend`, { method: "POST" }))}><Send />Resend invite</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {editable && <Link className="btn primary block" href={`/users/${id}/permissions`}>Edit permissions</Link>}
                    <p className="small muted" style={{ marginTop: 12, display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
                      {u.lastLoginAt && <span className="dot" />}Last login: {when(u.lastLoginAt)}
                    </p>
                  </div>
                )}
              </div>
              <div className="section">
                {u ? (
                  <dl className="kv">
                    <div><dt>Permissions</dt><dd>{u.isOwner ? "Owner · everything" : `${perms.size}${total ? ` of ${total}` : ""}`}</dd></div>
                    <div><dt>Two-factor</dt><dd>{u.twoFactorEnabled ? "On · authenticator app" : u.status === "INVITED" ? "Set up when they accept" : "Not set up yet (asked at next login)"}</dd></div>
                    {u.twoFactorEnabled && <div><dt>Recovery codes left</dt><dd>{detail.recoveryCodesRemaining} of 10</dd></div>}
                    {u.status === "INVITED" && <div><dt>Invite</dt><dd>{u.inviteExpiresAt ? `Expires ${relative(u.inviteExpiresAt)}` : "Expired"}</dd></div>}
                    <div><dt>Added</dt><dd>{date(u.createdAt)}</dd></div>
                  </dl>
                ) : (
                  <div style={{ display: "grid", gap: 16 }}><span className="skel" style={{ width: "70%" }} /><span className="skel" style={{ width: "60%" }} /></div>
                )}
              </div>
            </div>

            {/* middle: activity / sessions */}
            <div className="mid">
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
                <div className="seg" role="tablist">
                  <button role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Activity</button>
                  <button role="tab" aria-selected={tab === "sessions"} className={tab === "sessions" ? "on" : ""} onClick={() => setTab("sessions")}>Sessions</button>
                </div>
              </div>
              {tab === "activity" && (
                !can("ACTIVITY_LOG:VIEW") ? <p className="muted">Your permissions don&apos;t include the activity log.</p>
                  : activity === null ? (<><div className="ev"><span className="skel" style={{ width: "100%" }} /></div><div className="ev"><span className="skel" style={{ width: "80%" }} /></div></>)
                  : activity.length === 0 ? <p className="muted">Nothing recorded yet.</p>
                  : (
                    <>
                      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Recent activity</h3>
                      {activity.map((e, i) => {
                        const m = actionMeta(e.action)
                        const Icon = m.icon
                        const showDay = i === 0 || dayLabel(e.occurredAt) !== dayLabel(activity[i - 1].occurredAt)
                        const byThem = e.actorPublicId === id
                        return (
                          <div key={e.id}>
                            {showDay && <p className="muted small" style={{ margin: i ? "18px 0 14px" : "0 0 14px" }}>{dayLabel(e.occurredAt)}</p>}
                            <div className="ev">
                              <span className="ic" style={m.failed ? { background: "var(--red-bg)", color: "var(--red-fg)" } : undefined}><Icon /></span>
                              <div>
                                <b>{m.label}</b>
                                <p className="muted small">
                                  {!byThem && e.actorLabel ? `By ${e.actorLabel}` : e.targetPublicId && e.targetPublicId !== id ? e.targetLabel : ""}
                                  {detailLine(e) ? ` ${!byThem && e.actorLabel ? "· " : ""}${detailLine(e)}` : ""}
                                  {e.ip ? <> · <span className="mono">{e.ip}</span></> : null}
                                </p>
                              </div>
                              <span className="when"><Calendar size={14} />{when(e.occurredAt)}</span>
                            </div>
                          </div>
                        )
                      })}
                      <Link href={`/activity?user=${id}`} className="small" style={{ display: "inline-block", marginTop: 6 }}>View all in activity log ›</Link>
                    </>
                  )
              )}
              {tab === "sessions" && (
                sessions.length === 0 ? <p className="muted">No open sessions.</p> : sessions.map((s) => (
                  <div className="ev" key={s.publicId}>
                    <span className="ic"><DeviceIcon ua={s.userAgent} /></span>
                    <div><b>{device(s.userAgent).label}</b>
                      <p className="muted small">Logged in {when(s.createdAt)} · last active {when(s.lastSeenAt)}{s.ip ? <> · <span className="mono">{s.ip}</span></> : null}</p></div>
                    {editable && <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => endSession(s)}>Log out</button>}
                  </div>
                ))
              )}
            </div>

            {/* right: permissions + sessions */}
            <div>
              <div className="section">
                <h3>Permissions <span className="count">{u?.isOwner ? "all" : perms.size}</span>
                  {editable && <Link href={`/users/${id}/permissions`} className="small" style={{ marginLeft: "auto", fontWeight: 500 }}>Edit ›</Link>}
                </h3>
                {u?.isOwner ? <p className="muted small">The Owner can do everything.</p>
                  : catalogue && <PermissionSummary catalogue={catalogue} perms={perms} />}
              </div>
              <div className="section">
                <h3>Sessions <span className="count">{sessions.length}</span></h3>
                {sessions.length === 0 && <p className="muted small">Not logged in anywhere.</p>}
                {sessions.map((s) => (
                  <div className="sess" key={s.publicId}>
                    <span className="ic"><DeviceIcon ua={s.userAgent} /></span>
                    <div style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{device(s.userAgent).label}</b>
                      <p className="muted small">{s.ip ?? "—"} · {relative(s.lastSeenAt)}</p></div>
                    {editable && <button className="btn sm" onClick={() => endSession(s)}>Log out</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} size="narrow" tone="red" icon={<CircleSlash />}
        title={`Disable ${u?.fullName}?`}
        text={`${u?.fullName} is logged out of ${sessions.length} session${sessions.length === 1 ? "" : "s"} right away and can't log in until you enable the account. Their history stays.`}
        footer={<>
          <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="btn danger" onClick={() => { setConfirm(false); act(`${u?.fullName} disabled`, () => api(`/api/v1/users/${id}/disable`, { method: "POST" })) }}>
            Disable {u?.fullName}
          </button>
        </>} />
    </>
  )
}
