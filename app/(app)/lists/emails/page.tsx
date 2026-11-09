"use client"

import { List, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { type Column, DataTable } from "@/components/md/data-table"
import { ConfirmDialog } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { EmptyState, Forbidden } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { useTableQuery } from "@/components/md/use-table-query"
import { api, describe } from "@/lib/api"
import { when } from "@/lib/format"
import { type ListFacets, type ListItem, listStatus } from "@/lib/lists"
import { count } from "@/lib/table"
import { ValidationSummary } from "../validation-summary"

/** List emails: every list with its records and details, search, filters, delete. */
export default function ListsPage() {
  const { can } = useSession()
  const toast = useToast()
  const t = useTableQuery<ListItem>({
    path: "/api/v1/lists", enabled: can("LISTS:VIEW"), filters: { esp: "", country: "", vertical: "", source: "", status: "" },
  })
  const [facets, setFacets] = useState<ListFacets | null>(null)
  const [confirm, setConfirm] = useState<ListItem[] | null>(null)

  useEffect(() => { document.title = "List emails · MasterDB" }, [])
  const reloadKey = t.data?.totalItems
  useEffect(() => {
    if (can("LISTS:VIEW")) api<ListFacets>("/api/v1/lists/facets").then(setFacets, () => setFacets(null))
  }, [can, reloadKey])
  // Lists still uploading, importing or being validated: refresh their numbers.
  const busy = t.data?.items.some((l) => ["DOWNLOADING", "QUEUED", "IMPORTING"].includes(l.status) || l.validation?.running)
  const reload = t.reload
  useEffect(() => {
    if (!busy) return
    const timer = setInterval(reload, 5000)
    return () => clearInterval(timer)
  }, [busy, reload])

  if (!can("LISTS:VIEW")) return <Forbidden module="Lists" />

  async function remove(list: ListItem[]) {
    let ok = 0
    for (const l of list) {
      try {
        await api(`/api/v1/lists/${l.publicId}`, { method: "DELETE" })
        ok++
      } catch (e) {
        toast(`${l.name}: ${describe(e)}`, "bad")
      }
    }
    if (ok) toast(`${ok} list${ok === 1 ? "" : "s"} deleted`)
    t.reload()
  }

  const columns: Column<ListItem>[] = [
    {
      key: "name", header: "List", sortField: "name", className: "cell2",
      render: (l) => {
        const st = listStatus(l.status)
        return <>
          <Link href={`/lists/emails/${l.publicId}`} style={{ fontWeight: 600, wordBreak: "break-word" }}>{l.name}</Link>
          {l.status !== "READY" && <span><span className={`pill ${st.tone}`}>{st.label}</span></span>}
        </>
      },
    },
    { key: "records", header: "Records", sortField: "records", className: "num", render: (l) => l.status === "READY" ? count(l.records) : <span className="muted">—</span> },
    { key: "esp", header: "ESP", sortField: "esp", render: (l) => l.esp || <span className="muted">—</span> },
    { key: "country", header: "Country", sortField: "country", render: (l) => l.country || <span className="muted">—</span> },
    { key: "vertical", header: "Vertical", sortField: "vertical", render: (l) => l.vertical || <span className="muted">—</span> },
    { key: "parts", header: "Parts", sortField: "parts", className: "num", render: (l) => l.status === "READY" ? count(l.parts) : <span className="muted">—</span> },
    { key: "source", header: "Source", sortField: "source", render: (l) => <span className="pill grey">{l.source === "DRIVE" ? "Google Drive" : "Local file"}</span> },
    { key: "validation", header: "Latest validation", render: (l) => l.status === "READY" ? <ValidationSummary list={l} compact /> : <span className="muted">—</span> },
    { key: "created", header: "Created", sortField: "createdAt", render: (l) => when(l.createdAt) },
  ]

  const f = t.filters
  const facet = (key: "esp" | "country" | "vertical", label: string) => (
    <select className={`filter ${f[key] ? "on" : ""}`} aria-label={label} value={f[key] ?? ""} onChange={(e) => t.setFilter(key, e.target.value)}>
      <option value="">{label}: All</option>
      {(facets?.[key] ?? []).map((v) => <option key={v} value={v}>{label}: {v}</option>)}
    </select>
  )
  return (
    <div className="page">
      <div className="page-head">
        <h1>{t.data ? `${count(t.data.totalItems)} List${t.data.totalItems === 1 ? "" : "s"}` : "Lists"}</h1>
        {t.data && <span className="meta">{t.filtered ? "matching" : "in MasterDB"}</span>}
        <div className="actions">{can("LISTS:CREATE") && <Link className="btn primary" href="/lists/add"><Plus />Add list</Link>}</div>
      </div>
      <div className="toolbar">
        {facet("esp", "ESP")}
        {facet("country", "Country")}
        {facet("vertical", "Vertical")}
        <select className={`filter ${f.source ? "on" : ""}`} aria-label="Source" value={f.source ?? ""} onChange={(e) => t.setFilter("source", e.target.value)}>
          <option value="">Source: All</option>
          <option value="FILE">Source: Local file</option>
          <option value="DRIVE">Source: Google Drive</option>
        </select>
        <select className={`filter ${f.status ? "on" : ""}`} aria-label="Status" value={f.status ?? ""} onChange={(e) => t.setFilter("status", e.target.value)}>
          <option value="">Status: All</option>
          {(["READY", "IMPORTING", "QUEUED", "MAPPING", "UPLOADING", "DOWNLOADING", "FAILED"] as const).map((s) =>
            <option key={s} value={s}>Status: {listStatus(s).label}</option>)}
        </select>
      </div>
      <DataTable
        table={t}
        label="Lists"
        columns={columns}
        rowKey={(l) => l.publicId}
        rowLabel={(l) => l.name}
        selectable={can("LISTS:DELETE") ? () => true : undefined}
        search={{ placeholder: "Search lists", label: "Search lists" }}
        errorTitle="Couldn't load the lists"
        empty={(d) => {
          if (d.totalItems > 0) return null
          if (t.filtered) {
            return <EmptyState icon={<Search />} title="No lists match" text="Try another name or clear the filters."
              action={<button className="btn" onClick={t.clearFilters}>Clear filters</button>} />
          }
          return <EmptyState icon={<List />} title="No lists yet" text="Upload a .txt or .csv file, or add one from a Google Drive link."
            action={can("LISTS:CREATE") && <Link className="btn primary" href="/lists/add"><Plus />Add list</Link>} />
        }}
        bulkActions={(chosen) => can("LISTS:DELETE") && <button className="btn text-danger" onClick={() => setConfirm(chosen)}><Trash2 />Delete</button>}
      />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} danger icon={<Trash2 />}
        title={confirm?.length === 1 ? `Delete ${confirm[0].name}?` : `Delete ${confirm?.length ?? 0} lists?`}
        text={<>Their addresses and parts are removed from the lists (the contacts and past validation results stay). A list with a validation job running can&apos;t be deleted. This can&apos;t be undone.</>}
        typed={confirm?.length === 1 ? confirm[0].name : undefined}
        confirmLabel={confirm?.length === 1 ? "Delete list" : `Delete ${confirm?.length ?? 0} lists`}
        onConfirm={() => confirm ? remove(confirm) : undefined} />
    </div>
  )
}
