"use client"

import { ArrowLeft, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { ErrorState, Forbidden, LoadingState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { api } from "@/lib/api"
import { expiryInfo } from "@/lib/dns"
import { when } from "@/lib/format"
import type { DomainItem } from "@/lib/types"
import { DnsSettingsCard } from "./dns-settings-card"
import { RecordsCard } from "./records-card"

/** One domain: Namecheap metadata, and (jobs 3–4) its records and DNS health. */
export function DomainDetailView() {
  const { id } = useParams<{ id: string }>()
  const { can } = useSession()
  const toast = useToast()
  const router = useRouter()
  const [domain, setDomain] = useState<DomainItem | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [removing, setRemoving] = useState(false)
  const [settingsVersion, setSettingsVersion] = useState(0)
  const today = useMemo(() => new Date(), [])

  const load = useCallback(() => {
    api<DomainItem>(`/api/v1/dns/domains/${id}`).then((d) => { setError(null); setDomain(d) }, setError)
  }, [id])

  useEffect(() => {
    if (can("DNS:VIEW")) load()
  }, [can, load])
  useEffect(() => { if (domain) document.title = `${domain.name} · MasterDB` }, [domain])

  if (!can("DNS:VIEW")) return <Forbidden module="DNS management" />
  if (error) return <div className="page"><ErrorState title="Couldn't load this domain" error={error} onRetry={load} /></div>
  if (!domain) return <div className="page"><LoadingState /></div>

  async function remove() {
    await api(`/api/v1/dns/domains/${id}`, { method: "DELETE" })
    toast(`${domain!.name} deleted`)
    router.replace("/dns/domains")
  }

  const exp = expiryInfo(domain, today)
  const nc = domain.source === "NAMECHEAP"
  return (
    <div className="page">
      <Link href="/dns/domains" className="muted small" style={{ display: "inline-flex", gap: 6, marginBottom: 8 }}>
        <ArrowLeft size={14} />Domain list
      </Link>
      <div className="page-head">
        <h1 className="mono">{domain.name}</h1>
        <span className={`pill ${nc ? "blue" : "grey"}`}>{nc ? "Namecheap" : "Manual"}</span>
        <div className="actions">
          {can("DNS:DELETE") && <button className="btn text-danger" onClick={() => setRemoving(true)}><Trash2 />Delete</button>}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>Domain</h2></div>
        <div className="card-pad">
          <dl className="kv">
            <div><dt>Source</dt><dd>{nc ? "Namecheap account" : "Added by hand"}</dd></div>
            {nc && <div><dt>Expires</dt><dd><span className={`pill ${exp.tone}`}>{exp.label}</span></dd></div>}
            {nc && <div><dt>Auto-renew</dt><dd>{domain.autoRenew ? "On" : "Off"}</dd></div>}
            {nc && <div><dt>Registrar lock</dt><dd>{domain.locked ? "On" : "Off"}</dd></div>}
            {nc && <div><dt>DNS hosted at</dt><dd>{domain.usesNamecheapDns ? "Namecheap" : "Another provider"}</dd></div>}
            {nc && <div><dt>Namecheap data from</dt><dd>{when(domain.namecheapSyncedAt)}</dd></div>}
            <div><dt>Added</dt><dd>{when(domain.createdAt)}</dd></div>
          </dl>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: "start", marginTop: 16 }}>
        <DnsSettingsCard domain={domain} onSaved={() => setSettingsVersion((v) => v + 1)} />
        <RecordsCard domain={domain} settingsVersion={settingsVersion} />
      </div>
      <ConfirmDialog open={removing} onClose={() => setRemoving(false)} danger icon={<Trash2 />}
        title={`Delete ${domain.name}?`}
        text="It's removed from MasterDB with its health results and record snapshots. Nothing changes at Namecheap or in public DNS."
        confirmLabel="Delete domain" onConfirm={remove} />
    </div>
  )
}
