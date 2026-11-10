"use client"

import { SearchX, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { type Column, DataTable } from "@/components/md/data-table"
import { useSession } from "@/components/md/session"
import { EmptyState, ErrorState, Forbidden } from "@/components/md/states"
import { useTableQuery } from "@/components/md/use-table-query"
import { api } from "@/lib/api"
import { dayLabel, timeWithSeconds } from "@/lib/format"
import { count } from "@/lib/table"
import type { Category, EmailResult, ListStatus } from "@/lib/types"
import { CATEGORIES, categoryMeta } from "@/lib/validation"
import { CategoryPill } from "../category-pill"

/**
 * List status: every address validated in any job, counted once by its latest
 * result, in the six sections. Click a section to see its addresses.
 */
export default function ListStatusPage() {
  const { can } = useSession()
  const [summary, setSummary] = useState<ListStatus | null>(null)
  const [error, setError] = useState<unknown>(null)
  const t = useTableQuery<EmailResult>({
    path: "/api/v1/validation/status/emails", enabled: can("VALIDATION:VIEW"), size: 25, filters: { category: "" },
  })
  const load = useCallback(() => {
    api<ListStatus>("/api/v1/validation/status").then((s) => { setError(null); setSummary(s) }, setError)
  }, [])
  useEffect(() => {
    if (can("VALIDATION:VIEW")) load()
  }, [can, load])
  useEffect(() => { document.title = "List status · MasterDB" }, [])
  if (!can("VALIDATION:VIEW")) return <Forbidden module="Validation" />

  const category = (t.filters.category ?? "") as Category | ""
  const columns: Column<EmailResult>[] = [
    { key: "email", header: "Email", className: "mono", render: (e) => <span style={{ wordBreak: "break-all" }}>{e.email}</span> },
    { key: "result", header: "Latest result", render: (e) => e.category ? <CategoryPill category={e.category} /> : "—" },
    { key: "reason", header: "Reason", className: "small", render: (e) => e.reason ?? "—" },
    {
      key: "job", header: "Job", className: "cell2",
      render: (e) => <><b><Link href={`/validation/results/${e.jobId}`} style={{ color: "inherit" }}>{e.jobName}</Link></b>
        {e.checkedAt && <span>{dayLabel(e.checkedAt)} {timeWithSeconds(e.checkedAt)}</span>}</>,
    },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <h1>List status</h1>
        <span className="meta">{summary
          ? `${count(summary.addresses)} addresses from ${count(summary.jobs)} job${summary.jobs === 1 ? "" : "s"}, each by its latest result`
          : "Each address by its latest result"}</span>
      </div>
      {error ? <ErrorState title="Couldn't load the totals" error={error} onRetry={load} /> : null}
      <DataTable
        table={t}
        label="Addresses by latest result"
        filters={
        <div className="seg" role="tablist" aria-label="Section">
          <button role="tab" aria-selected={!category} className={!category ? "on" : ""} onClick={() => t.setFilter("category", "")}>
            All {summary ? count(summary.addresses) : ""}</button>
          {CATEGORIES.map((c) => (
            <button key={c} role="tab" aria-selected={category === c} className={category === c ? "on" : ""} title={categoryMeta(c).meaning}
              onClick={() => t.setFilter("category", c)}>{categoryMeta(c).label} {summary ? count(summary.categories[c] ?? 0) : ""}</button>
          ))}
        </div>
        }
        columns={columns}
        rowKey={(e) => e.email}
        search={{ placeholder: "Search by email", label: "Search addresses" }}
        errorTitle="Couldn't load the addresses"
        empty={(d) => d.totalItems > 0 ? null : (t.filtered || category)
          ? <EmptyState icon={<SearchX />} title="No address here" text="Try another section or search." />
          : <EmptyState icon={<ShieldCheck />} title="Nothing validated yet" text="Addresses show up here once a bulk validation job has checked them." />}
      />
    </div>
  )
}
