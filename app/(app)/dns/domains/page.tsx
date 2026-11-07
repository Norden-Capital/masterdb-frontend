"use client"

import { CloudDownload, Globe, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { ImportModal } from "@/app/(app)/dns/import-modal"
import { type Column, DataTable } from "@/components/md/data-table"
import { ConfirmDialog } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { EmptyState, Forbidden } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { useTableQuery } from "@/components/md/use-table-query"
import { api, describe } from "@/lib/api"
import { expiryInfo } from "@/lib/dns"
import { when } from "@/lib/format"
import { count } from "@/lib/table"
import type { DomainItem } from "@/lib/types"
import { HealthPill } from "./health-pill"

/** DNS job 2: every domain, by hand or from Namecheap, with search, filters, sort and delete. */
export default function DomainListPage() {
  const { can } = useSession()
  const toast = useToast()
  const t = useTableQuery<DomainItem>({
    path: "/api/v1/dns/domains", enabled: can("DNS:VIEW"), sort: { field: "name", dir: "asc" },
    filters: { source: "", health: "", expiry: "" },
  })
  const [confirm, setConfirm] = useState<DomainItem[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const today = useMemo(() => new Date(), [])

  useEffect(() => { document.title = "Domains · MasterDB" }, [])

  if (!can("DNS:VIEW")) return <Forbidden module="DNS management" />

  async function remove(list: DomainItem[]) {
    let ok = 0
    for (const d of list) {
      try {
        await api(`/api/v1/dns/domains/${d.publicId}`, { method: "DELETE" })
        ok++
      } catch (e) {
        toast(`${d.name}: ${describe(e)}`, "bad")
      }
    }
    if (ok) toast(`${ok} domain${ok === 1 ? "" : "s"} deleted`)
    t.reload()
  }

  const columns: Column<DomainItem>[] = [
    {
      key: "name", header: "Domain", sortField: "name",
      render: (d) => <Link className="mono" href={`/dns/domains/${d.publicId}`} style={{ fontWeight: 600 }}>{d.name}</Link>,
    },
    {
      key: "source", header: "Source", sortField: "source",
      render: (d) => <span className={`pill ${d.source === "NAMECHEAP" ? "blue" : "grey"}`}>{d.source === "NAMECHEAP" ? "Namecheap" : "Manual"}</span>,
    },
    {
      key: "health", header: "DNS health", sortField: "healthStatus", className: "cell2",
      render: (d) => <><HealthPill status={d.healthStatus} />{d.healthCheckedAt && <span>{when(d.healthCheckedAt)}</span>}</>,
    },
    {
      key: "expires", header: "Expires", sortField: "expiresAt",
      render: (d) => {
        const e = expiryInfo(d, today)
        return d.expiresAt ? <span className={`pill ${e.tone}`}>{e.label}</span> : <span className="muted">—</span>
      },
    },
    {
      key: "renew", header: "Auto-renew",
      render: (d) => d.source === "NAMECHEAP" ? (d.autoRenew ? "On" : "Off") : <span className="muted">—</span>,
    },
    { key: "created", header: "Added", sortField: "createdAt", render: (d) => when(d.createdAt) },
  ]

  const f = t.filters
  return (
    <div className="page">
      <div className="page-head">
        <h1>{t.data ? `${count(t.data.totalItems)} Domain${t.data.totalItems === 1 ? "" : "s"}` : "Domains"}</h1>
        {t.data && <span className="meta">{t.filtered ? "matching" : "in MasterDB"}</span>}
        <div className="actions">
          {can("DNS:CREATE") && <button className="btn" onClick={() => setFetching(true)}><CloudDownload />Fetch from Namecheap</button>}
          {can("DNS:CREATE") && <Link className="btn primary" href="/dns/add-domain"><Plus />Add domain</Link>}
        </div>
      </div>
      <div className="toolbar">
        <select className={`filter ${f.source ? "on" : ""}`} aria-label="Source" value={f.source ?? ""}
          onChange={(e) => t.setFilter("source", e.target.value)}>
          <option value="">Source: All</option>
          <option value="NAMECHEAP">Source: Namecheap</option>
          <option value="MANUAL">Source: Manual</option>
        </select>
        <select className={`filter ${f.health ? "on" : ""}`} aria-label="DNS health" value={f.health ?? ""}
          onChange={(e) => t.setFilter("health", e.target.value)}>
          <option value="">Health: All</option>
          <option value="OK">Health: All good</option>
          <option value="PROBLEM">Health: Problems</option>
          <option value="ERROR">Health: Lookup failed</option>
          <option value="UNCHECKED">Health: Not checked</option>
        </select>
        <select className={`filter ${f.expiry ? "on" : ""}`} aria-label="Expiry" value={f.expiry ?? ""}
          onChange={(e) => t.setFilter("expiry", e.target.value)}>
          <option value="">Expiry: All</option>
          <option value="EXPIRED">Expiry: Expired</option>
          <option value="DAYS_30">Expiry: Within 30 days</option>
          <option value="DAYS_90">Expiry: Within 90 days</option>
          <option value="UNKNOWN">Expiry: Unknown</option>
        </select>
      </div>
      <DataTable
        table={t}
        label="Domains"
        columns={columns}
        rowKey={(d) => d.publicId}
        rowLabel={(d) => d.name}
        selectable={can("DNS:DELETE") ? () => true : undefined}
        search={{ placeholder: "Search domains", label: "Search domains" }}
        errorTitle="Couldn't load domains"
        empty={(d) => {
          if (d.totalItems > 0) return null
          if (t.filtered) {
            return <EmptyState icon={<Search />} title="No domains match" text="Try another name or clear the filters."
              action={<button className="btn" onClick={t.clearFilters}>Clear filters</button>} />
          }
          return <EmptyState icon={<Globe />} title="No domains yet"
            text="Add one by hand, or fetch the domains on the Namecheap account."
            action={can("DNS:CREATE") && <Link className="btn primary" href="/dns/add-domain"><Plus />Add domain</Link>} />
        }}
        bulkActions={(chosen) => (
          <button className="btn text-danger" onClick={() => setConfirm(chosen)}><Trash2 />Delete</button>
        )}
      />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} danger icon={<Trash2 />}
        title={confirm?.length === 1 ? `Delete ${confirm[0].name}?` : `Delete ${confirm?.length ?? 0} domains?`}
        text="They're removed from MasterDB with their health results and record snapshots. Nothing changes at Namecheap or in public DNS."
        confirmLabel={confirm?.length === 1 ? "Delete domain" : `Delete ${confirm?.length ?? 0} domains`}
        onConfirm={() => confirm ? remove(confirm) : undefined} />
      {fetching && <ImportModal onClose={() => setFetching(false)} onImported={(r) => {
        toast(`${r.added.length} domain${r.added.length === 1 ? "" : "s"} imported`)
        t.reload()
      }} />}
    </div>
  )
}
