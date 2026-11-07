"use client"

import { Crown } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { PermissionSummary } from "@/components/md/permission-grid"
import { useSession } from "@/components/md/session"
import { Avatar } from "@/components/md/ui"
import { api } from "@/lib/api"
import type { Catalogue } from "@/lib/types"

/** My profile: who I am and what I may do (the "See my permissions" target of the 403 page). */
export default function AccountPage() {
  const { me } = useSession()
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  useEffect(() => {
    document.title = "My account · MasterDB"
    api<Catalogue>("/api/v1/permissions/catalogue").then(setCatalogue, () => {})
  }, [])
  return (
    <>
      <div className="subtabs">
        <Link className="active" href="/account">Profile</Link>
        <Link href="/account/security">Security</Link>
      </div>
      <div className="page">
        <div className="page-head">
          <Avatar name={me.fullName} id={me.publicId} />
          <h1>{me.fullName}</h1>
          <span className="meta">{me.email}</span>
        </div>
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="card">
            <div className="card-head"><h2>Profile</h2></div>
            <div className="card-pad">
              <dl className="kv">
                <div><dt>Name</dt><dd>{me.fullName}</dd></div>
                <div><dt>Email</dt><dd>{me.email}</dd></div>
                <div><dt>Role</dt><dd>{me.isOwner ? "Owner" : "Custom permissions"}</dd></div>
              </dl>
              <p className="help" style={{ marginTop: 16 }}>To change your name or email, ask {me.isOwner ? "support" : "the Owner"}.</p>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2>What I can do</h2>
              <span className="right">{me.isOwner ? <span className="chip" style={{ background: "var(--primary-soft)", color: "var(--primary-text)" }}><Crown size={13} />Everything</span>
                : <span className="count">{me.permissions.length}</span>}</span></div>
            <div className="card-pad">
              {me.isOwner ? <p className="muted">The Owner can do everything in MasterDB.</p>
                : catalogue ? <PermissionSummary catalogue={catalogue} perms={new Set(me.permissions)} />
                : <span className="skel" style={{ width: "60%" }} />}
              {!me.isOwner && <p className="help" style={{ marginTop: 16 }}>Need more? Ask an Owner or someone who manages users.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
