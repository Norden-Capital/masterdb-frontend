"use client"

import { ListChecks, Play, SearchX } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

import { type Column, DataTable } from "@/components/md/data-table"
import { useSession } from "@/components/md/session"
import { EmptyState, Forbidden } from "@/components/md/states"
import { useTableQuery } from "@/components/md/use-table-query"
import { when } from "@/lib/format"
import { count } from "@/lib/table"
import type { ValidationJob } from "@/lib/types"
import { CATEGORIES, categoryMeta, jobCounts, jobStatus } from "@/lib/validation"
import { SelectField } from "@/components/md/select-field"

/** Results: one row per validation job, newest first, with its counts. Opening one shows it live, with its exports. */
export default function ValidationResultsPage() {
  const { can } = useSession()
  const t = useTableQuery<ValidationJob>({
    path: "/api/v1/validation/jobs", enabled: can("VALIDATION:VIEW"), size: 25, filters: { status: "" },
  })
  useEffect(() => { document.title = "Validation results · MasterDB" }, [])
  if (!can("VALIDATION:VIEW")) return <Forbidden module="Validation" />

  const { status = "" } = t.filters
  const columns: Column<ValidationJob>[] = [
    {
      key: "name", header: "Job", className: "cell2",
      render: (j) => <><b><Link href={`/validation/results/${j.publicId}`} style={{ color: "inherit" }}>{j.name}</Link></b>
        <span>{when(j.startedAt)}{j.startedBy ? ` · ${j.startedBy}` : ""}{j.source === "LIST" ? " · from a list" : ""}</span></>,
    },
    { key: "status", header: "Status", render: (j) => { const s = jobStatus(j.status); return <span className={`pill ${s.tone}`}>{s.label}</span> } },
    { key: "checked", header: "Checked", className: "num", render: (j) => `${count(j.checked)} of ${count(j.total)}` },
    {
      key: "results", header: "Results",
      render: (j) => {
        const c = jobCounts(j)
        const shown = CATEGORIES.filter((k) => c[k] > 0)
        return shown.length === 0 ? <span className="muted">—</span> : (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {shown.map((k) => (
              <span key={k} className={`pill ${categoryMeta(k).tone}`} title={categoryMeta(k).meaning}>{categoryMeta(k).label} {count(c[k])}</span>
            ))}
          </div>
        )
      },
    },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t.data ? `${count(t.data.totalItems)} validation job${t.data.totalItems === 1 ? "" : "s"}` : "Results"}</h1>
        <div className="actions">
          {can("VALIDATION:RUN") && <Link className="btn primary" href="/validation/bulk"><Play />New bulk validation</Link>}
        </div>
      </div>
      <DataTable
        filters={<>
        <SelectField className={`filter ${status ? "on" : ""}`} aria-label="Status" value={status} onChange={(e) => t.setFilter("status", e.target.value)}>
          <option value="">Status: All</option>
          <option value="PREPARING">Status: Preparing</option>
          <option value="RUNNING">Status: Running</option>
          <option value="STOPPED">Status: Stopped</option>
          <option value="COMPLETED">Status: Done</option>
        </SelectField>
        </>}
        table={t}
        label="Validation jobs"
        columns={columns}
        rowKey={(j) => j.publicId}
        errorTitle="Couldn't load the jobs"
        empty={(d) => d.totalItems > 0 ? null : status
          ? <EmptyState icon={<SearchX />} title="No job with this status" />
          : <EmptyState icon={<ListChecks />} title="No validation job yet" text="Start one from Bulk validation."
            action={can("VALIDATION:RUN") && <Link className="btn primary" href="/validation/bulk"><Play />New bulk validation</Link>} />}
      />
    </div>
  )
}
