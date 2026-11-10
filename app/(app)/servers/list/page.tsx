"use client"

import { Plus, RefreshCw, Search, Server, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { type Column, DataTable } from "@/components/md/data-table"
import { ConfirmDialog } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { EmptyState, Forbidden } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { useAddSheet } from "@/components/md/use-add-sheet"
import { useTableQuery } from "@/components/md/use-table-query"
import { api, describe } from "@/lib/api"
import { when } from "@/lib/format"
import { count } from "@/lib/table"
import type { ServerItem } from "@/lib/types"
import { SelectField } from "@/components/md/select-field"
import { ServerHealthPill } from "../server-health-pill"
import { ConnectionPill, ExpiryPill } from "../server-pills"
import { AddServerSheet } from "../add-server-sheet"

/** Server management job 1: every VPS with search, filters, expiry warning and delete. */
export default function ServerListPage() {
  const { can } = useSession()
  const [adding, setAdding] = useAddSheet()
  const toast = useToast()
  const t = useTableQuery<ServerItem>({
    path: "/api/v1/servers", enabled: can("SERVERS:VIEW"), sort: { field: "name", dir: "asc" },
    filters: { connection: "", expiry: "", health: "" },
  })
  const [confirm, setConfirm] = useState<ServerItem[] | null>(null)

  useEffect(() => { document.title = "Servers · MasterDB" }, [])

  if (!can("SERVERS:VIEW")) return <Forbidden module="Server management" />

  async function remove(list: ServerItem[]) {
    let ok = 0
    for (const s of list) {
      try {
        await api(`/api/v1/servers/${s.publicId}`, { method: "DELETE" })
        ok++
      } catch (e) {
        toast(`${s.name}: ${describe(e)}`, "bad")
      }
    }
    if (ok) toast(`${ok} server${ok === 1 ? "" : "s"} deleted`)
    t.reload()
  }

  async function recheck(list: ServerItem[]) {
    let bad = 0
    for (const s of list) {
      try {
        const r = await api<{ status?: string }>(`/api/v1/servers/${s.publicId}/health/check`, { method: "POST" })
        if (r.status !== "OK") bad++
      } catch (e) {
        toast(`${s.name}: ${describe(e)}`, "bad")
      }
    }
    toast(`${list.length} server${list.length === 1 ? "" : "s"} re-checked${bad ? `, ${bad} not all good` : ""}`, bad ? "bad" : undefined)
    t.reload()
  }

  const columns: Column<ServerItem>[] = [
    {
      key: "name", header: "Server", sortField: "name",
      render: (s) => <Link href={`/servers/list/${s.publicId}`} style={{ fontWeight: 600 }}>{s.name}</Link>,
    },
    { key: "ip", header: "Address", sortField: "ip", render: (s) => <span className="mono">{s.ip}{s.sshPort === 22 ? "" : `:${s.sshPort}`}</span> },
    { key: "connection", header: "SSH", sortField: "connectionStatus", render: (s) => <ConnectionPill status={s.connectionStatus} /> },
    {
      key: "health", header: "Health", sortField: "healthStatus", className: "cell2",
      render: (s) => <><ServerHealthPill status={s.healthStatus} />{s.healthCheckedAt && <span>{when(s.healthCheckedAt)}</span>}</>,
    },
    { key: "expires", header: "Plan ends", sortField: "expiresOn", render: (s) => <ExpiryPill server={s} /> },
    { key: "domain", header: "Domain", render: (s) => s.domain ? <span className="mono">{s.domain.name}</span> : <span className="muted">—</span> },
    { key: "os", header: "OS", render: (s) => s.os ?? <span className="muted">—</span> },
    { key: "created", header: "Added", sortField: "createdAt", render: (s) => when(s.createdAt) },
  ]

  const f = t.filters
  return (
    <div className="page">
      <div className="page-head">
        <h1>{t.data ? `${count(t.data.totalItems)} Server${t.data.totalItems === 1 ? "" : "s"}` : "Servers"}</h1>
        {t.data && <span className="meta">{t.filtered ? "matching" : "in MasterDB"}</span>}
        <div className="actions">
          {can("SERVERS:CREATE") && <button className="btn primary" onClick={() => setAdding(true)}><Plus />Add VPS server</button>}
        </div>
      </div>
      <DataTable
        filters={<>
        <SelectField className={`filter ${f.connection ? "on" : ""}`} aria-label="SSH" value={f.connection ?? ""}
          onChange={(e) => t.setFilter("connection", e.target.value)}>
          <option value="">SSH: All</option>
          <option value="CONNECTED">SSH: Connected</option>
          <option value="KEY_PENDING">SSH: Key to check</option>
          <option value="KEY_CHANGED">SSH: Blocked (key changed)</option>
          <option value="AUTH_FAILED">SSH: Key refused</option>
          <option value="UNREACHABLE">SSH: Unreachable</option>
          <option value="NEW">SSH: Not connected</option>
        </SelectField>
        <SelectField className={`filter ${f.health ? "on" : ""}`} aria-label="Health" value={f.health ?? ""}
          onChange={(e) => t.setFilter("health", e.target.value)}>
          <option value="">Health: All</option>
          <option value="OK">Health: All good</option>
          <option value="PROBLEM">Health: Problems</option>
          <option value="WARNING">Health: Warnings</option>
          <option value="ERROR">Health: Couldn&apos;t check</option>
          <option value="UNCHECKED">Health: Never checked</option>
        </SelectField>
        <SelectField className={`filter ${f.expiry ? "on" : ""}`} aria-label="Plan ends" value={f.expiry ?? ""}
          onChange={(e) => t.setFilter("expiry", e.target.value)}>
          <option value="">Plan ends: All</option>
          <option value="EXPIRED">Plan ends: Expired</option>
          <option value="DAYS_14">Plan ends: Within 14 days</option>
          <option value="DAYS_30">Plan ends: Within 30 days</option>
        </SelectField>
        </>}
        table={t}
        label="Servers"
        columns={columns}
        rowKey={(s) => s.publicId}
        rowLabel={(s) => s.name}
        selectable={can("SERVERS:DELETE") || can("SERVERS:RUN") ? () => true : undefined}
        search={{ placeholder: "Search name or IP", label: "Search servers" }}
        errorTitle="Couldn't load servers"
        empty={(d) => {
          if (d.totalItems > 0) return null
          if (t.filtered) {
            return <EmptyState icon={<Search />} title="No servers match" text="Try another search or clear the filters."
              action={<button className="btn" onClick={t.clearFilters}>Clear filters</button>} />
          }
          return <EmptyState icon={<Server />} title="No servers yet" text="Add a VPS: MasterDB logs in with its own SSH key."
            action={can("SERVERS:CREATE") && <button className="btn primary" onClick={() => setAdding(true)}><Plus />Add VPS server</button>} />
        }}
        bulkActions={(chosen) => (
          <>
            {can("SERVERS:RUN") && <button className="btn" onClick={() => recheck(chosen)}><RefreshCw />Re-check health</button>}
            {can("SERVERS:DELETE") && <button className="btn text-danger" onClick={() => setConfirm(chosen)}><Trash2 />Delete</button>}
          </>
        )}
      />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} danger icon={<Trash2 />}
        title={confirm?.length === 1 ? `Delete ${confirm[0].name}?` : `Delete ${confirm?.length ?? 0} servers?`}
        text="They're removed from MasterDB with their trusted host keys and history. Nothing changes on the VPS itself."
        confirmLabel={confirm?.length === 1 ? "Delete server" : `Delete ${confirm?.length ?? 0} servers`}
        onConfirm={() => confirm ? remove(confirm) : undefined} />
      {can("SERVERS:CREATE") && <AddServerSheet open={adding} onClose={() => setAdding(false)}/>}
    </div>
  )
}
