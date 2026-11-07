"use client"

import { Mails, PackagePlus, RefreshCw, ServerCog, Trash2 } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { ConfirmDialog } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { EmptyState, ErrorState, Forbidden, LoadingState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Banner } from "@/components/md/ui"
import { api, describe } from "@/lib/api"
import { when } from "@/lib/format"
import type { MtaItem } from "@/lib/types"
import { ServicePill } from "../service-pill"

/** Server management job 5: every server with an MTA, its service states and versions (last read over SSH). */
export default function MtaListPage() {
  const { can } = useSession()
  const toast = useToast()
  const [list, setList] = useState<MtaItem[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [removing, setRemoving] = useState<MtaItem | null>(null)

  const load = useCallback(() => {
    api<MtaItem[]>("/api/v1/mta/servers").then((l) => { setError(null); setList(l) }, setError)
  }, [])
  useEffect(() => {
    if (can("MTA:VIEW")) load()
  }, [can, load])
  useEffect(() => { document.title = "MTA list · MasterDB" }, [])

  if (!can("MTA:VIEW")) return <Forbidden module="MTA" />

  async function refresh(items: MtaItem[]) {
    for (const m of items) {
      setBusy(m.serverId)
      try {
        const fresh = await api<MtaItem>(`/api/v1/mta/servers/${m.serverId}/status`, { method: "POST" })
        setList((l) => l?.map((x) => x.serverId === fresh.serverId ? fresh : x) ?? null)
      } catch (e) {
        toast(`${m.name}: ${describe(e)}`, "bad")
      }
    }
    setBusy(null)
    load()
  }

  async function remove(m: MtaItem) {
    await api(`/api/v1/mta/servers/${m.serverId}`, { method: "DELETE" })
    toast(`${m.name} removed from the MTA list`)
    load()
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>{list ? `${list.length} MTA${list.length === 1 ? "" : "s"}` : "MTA list"}</h1>
        <div className="actions">
          {list && list.length > 0 && <button className="btn" disabled={!!busy} onClick={() => refresh(list)}><RefreshCw />Refresh all</button>}
          {can("MTA:CREATE") && <Link className="btn primary" href="/mta/install"><PackagePlus />Install MTA</Link>}
        </div>
      </div>
      {error ? <ErrorState title="Couldn't load the MTA list" error={error} onRetry={load} /> : null}
      {!list && !error && <LoadingState />}
      {list && list.length === 0 && (
        <EmptyState icon={<Mails />} title="No MTA yet" text="Install one on a connected server with a linked domain."
          action={can("MTA:CREATE") && <Link className="btn primary" href="/mta/install"><PackagePlus />Install MTA</Link>} />
      )}
      {list && list.length > 0 && (
        <div className="card">
          <div className="tbl-scroll">
            <table className="t" aria-label="MTAs">
              <thead><tr><th>Server</th><th>Domain</th><th>Services</th><th>Versions</th><th>Queue</th><th>Read</th><th /></tr></thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.serverId}>
                    <td><b>{m.name}</b><div className="muted small mono">{m.ip}</div></td>
                    <td className="mono">{m.domain ?? "—"}{m.webmail && <div className="muted small">+ webmail</div>}</td>
                    <td>{m.status
                      ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{m.status.services.map((s) => <ServicePill key={s.name} name={s.name} state={s.state} />)}</div>
                      : <span className="muted">Not read yet</span>}
                      {m.message && <div className="small text-danger">{m.message}</div>}
                      {m.connectionStatus === "KEY_CHANGED" && <div className="small text-danger">Blocked: host key changed</div>}
                    </td>
                    <td className="small">{m.status ? Object.entries(m.status.versions).map(([k, v]) => <div key={k}><span className="muted">{k}</span> {v}</div>) : "—"}</td>
                    <td className="num">{m.status?.queue ?? "—"}</td>
                    <td className="small">{when(m.checkedAt)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn" disabled={!!busy} onClick={() => refresh([m])} aria-label={`Refresh ${m.name}`}>
                        <RefreshCw className={busy === m.serverId ? "spin" : undefined} /></button>{" "}
                      <Link className="btn" href={`/mta/manager?server=${m.serverId}`}><ServerCog />Manage</Link>{" "}
                      {can("MTA:DELETE") && <button className="btn text-danger" onClick={() => setRemoving(m)} aria-label={`Remove ${m.name}`}><Trash2 /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {list && list.length > 0 && <Banner tone="blue" title="States are read over SSH" style={{ marginTop: 16 }}>
        <p>&quot;Read&quot; is when MasterDB last asked the server; Refresh asks again. Nothing is guessed in between.</p></Banner>}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} danger icon={<Trash2 />}
        title={`Remove ${removing?.name ?? ""} from the MTA list?`}
        text="MasterDB forgets this MTA. Nothing changes on the server: the mail services keep running. Install MTA brings it back."
        confirmLabel="Remove from list" onConfirm={() => removing ? remove(removing) : undefined} />
    </div>
  )
}
