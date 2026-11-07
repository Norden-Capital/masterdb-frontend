"use client"

import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { ConfirmDialog, ModalForm } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { ErrorState, Forbidden, LoadingState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { api } from "@/lib/api"
import { when } from "@/lib/format"
import type { ServerItem } from "@/lib/types"
import { bodyOf, formOf, localErrors, ServerFields, serverErrors, type ServerFormValue } from "../../server-form"
import { ServerHealthPill } from "../../server-health-pill"
import { ConnectionPill, ExpiryPill } from "../../server-pills"
import { ConnectionCard } from "./connection-card"
import { ServerHealthCard } from "./health-card"

/** One server: details, SSH connection and (later jobs) health, identity and MTA. */
export function ServerDetailView() {
  const { id } = useParams<{ id: string }>()
  const { can } = useSession()
  const toast = useToast()
  const router = useRouter()
  const [server, setServer] = useState<ServerItem | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [removing, setRemoving] = useState(false)
  const [editing, setEditing] = useState<ServerFormValue | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    api<ServerItem>(`/api/v1/servers/${id}`).then((s) => { setError(null); setServer(s) }, setError)
  }, [id])

  useEffect(() => {
    if (can("SERVERS:VIEW")) load()
  }, [can, load])
  useEffect(() => { if (server) document.title = `${server.name} · MasterDB` }, [server])

  if (!can("SERVERS:VIEW")) return <Forbidden module="Server management" />
  if (error) return <div className="page"><ErrorState title="Couldn't load this server" error={error} onRetry={load} /></div>
  if (!server) return <div className="page"><LoadingState /></div>

  async function remove() {
    await api(`/api/v1/servers/${id}`, { method: "DELETE" })
    toast(`${server!.name} deleted`)
    router.replace("/servers/list")
  }

  async function save(): Promise<boolean | void> {
    if (!editing) return
    const local = localErrors(editing)
    setErrors(local)
    if (Object.keys(local).length) return false
    try {
      const s = await api<ServerItem>(`/api/v1/servers/${id}`, { method: "PUT", body: bodyOf(editing) })
      setServer(s)
      toast("Server saved")
    } catch (e) {
      const fields = serverErrors(e)
      if (fields) {
        setErrors(fields)
        return false
      }
      throw e
    }
  }

  const s = server
  return (
    <div className="page">
      <Link href="/servers/list" className="muted small" style={{ display: "inline-flex", gap: 6, marginBottom: 8 }}>
        <ArrowLeft size={14} />Server list
      </Link>
      <div className="page-head">
        <h1>{s.name}</h1>
        <ConnectionPill status={s.connectionStatus} />
        <ServerHealthPill status={s.healthStatus} />
        <div className="actions">
          {can("SERVERS:EDIT") && <button className="btn" onClick={() => { setErrors({}); setEditing(formOf(s)) }}><Pencil />Edit</button>}
          {can("SERVERS:DELETE") && <button className="btn text-danger" onClick={() => setRemoving(true)}><Trash2 />Delete</button>}
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card-head"><h2>Server</h2></div>
          <div className="card-pad">
            <dl className="kv">
              <div><dt>Address</dt><dd className="mono">{s.ip}</dd></div>
              <div><dt>SSH</dt><dd className="mono">{s.sshUser}@{s.ip} -p {s.sshPort}</dd></div>
              <div><dt>VPS plan ends</dt><dd><ExpiryPill server={s} /></dd></div>
              <div><dt>Linked domain</dt><dd>{s.domain
                ? (can("DNS:VIEW") ? <Link className="mono" href={`/dns/domains/${s.domain.publicId}`}>{s.domain.name}</Link> : <span className="mono">{s.domain.name}</span>)
                : <span className="muted">None</span>}</dd></div>
              {s.notes && <div><dt>Notes</dt><dd style={{ whiteSpace: "pre-wrap", fontWeight: 400 }}>{s.notes}</dd></div>}
              <div><dt>Added</dt><dd>{when(s.createdAt)}</dd></div>
            </dl>
          </div>
        </div>
        <ConnectionCard server={s} onChange={setServer} />
      </div>
      <ServerHealthCard server={s} onChecked={load} />
      <ModalForm open={!!editing} onClose={() => setEditing(null)} onSubmit={save} title={`Edit ${s.name}`} size="wide"
        icon={<Pencil />} submitLabel="Save"
        text="A new IP or SSH port forgets the trusted host key: connect again afterwards.">
        {editing && <ServerFields value={editing} onChange={setEditing} errors={errors} currentDomain={s.domain?.name} />}
      </ModalForm>
      <ConfirmDialog open={removing} onClose={() => setRemoving(false)} danger icon={<Trash2 />}
        title={`Delete ${s.name}?`}
        text="It's removed from MasterDB with its trusted host key and history. Nothing changes on the VPS itself."
        confirmLabel="Delete server" onConfirm={remove} />
    </div>
  )
}
