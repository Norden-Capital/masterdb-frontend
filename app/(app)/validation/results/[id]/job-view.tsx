"use client"

import { ArrowLeft, Download, FileSpreadsheet, Play, RotateCcw, SearchX, Square, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { type Column, DataTable } from "@/components/md/data-table"
import { ConfirmDialog } from "@/components/md/dialogs"
import { Counter, LiveStatus } from "@/components/md/progress"
import { useSession } from "@/components/md/session"
import { EmptyState, ErrorState, Forbidden, LoadingState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Banner } from "@/components/md/ui"
import { usePoll } from "@/components/md/use-poll"
import { useTableQuery } from "@/components/md/use-table-query"
import { api } from "@/lib/api"
import { dayLabel, timeWithSeconds, when } from "@/lib/format"
import { count } from "@/lib/table"
import type { EmailResult, ValidationJob } from "@/lib/types"
import { CATEGORIES, categoryMeta, jobCounts, jobStatus, serverState } from "@/lib/validation"
import { CategoryPill } from "../../category-pill"
import { CategoryRing } from "../../category-ring"

/**
 * One bulk job, live: the round chart and counters come from the server every
 * 2 seconds while it runs (nothing is guessed in between); stop, resume,
 * retry unknown, delete; exports per category and the detailed CSV; and the
 * addresses with their results.
 */
export function JobView() {
  const { id } = useParams<{ id: string }>()
  const { can } = useSession()
  const toast = useToast()
  const router = useRouter()
  const [confirm, setConfirm] = useState<"stop" | "retry" | "delete" | null>(null)
  const [busy, setBusy] = useState(false)
  const poll = usePoll<ValidationJob>(
    (signal) => api<ValidationJob>(`/api/v1/validation/jobs/${id}`, { signal }),
    { interval: 2000, enabled: can("VALIDATION:VIEW"), isDone: (j) => j.status !== "RUNNING" },
  )
  const job = poll.data
  const emails = useTableQuery<EmailResult>({
    path: `/api/v1/validation/jobs/${id}/emails`, enabled: can("VALIDATION:VIEW"), size: 25, filters: { category: "" },
  })
  const reloadEmails = emails.reload
  const checked = job?.checked
  useEffect(() => {
    if (checked !== undefined) reloadEmails()
  }, [checked, reloadEmails])
  useEffect(() => { document.title = `${job?.name ?? "Validation job"} · MasterDB` }, [job?.name])

  if (!can("VALIDATION:VIEW")) return <Forbidden module="Validation" />
  if (!job) {
    return (
      <div className="page">
        {poll.error ? <ErrorState title="Couldn't load this job" error={poll.error} onRetry={poll.refresh} /> : <LoadingState />}
      </div>
    )
  }

  const status = jobStatus(job.status)
  const running = job.status === "RUNNING"
  const counts = jobCounts(job)

  async function act(path: string, done: string) {
    setBusy(true)
    try {
      await api(`/api/v1/validation/jobs/${id}/${path}`, { method: "POST" })
      toast(done)
      poll.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    await api(`/api/v1/validation/jobs/${id}`, { method: "DELETE" })
    toast("Job deleted")
    router.push("/validation/results")
  }

  const { category = "" } = emails.filters
  const columns: Column<EmailResult>[] = [
    { key: "email", header: "Email", className: "mono", render: (e) => <span style={{ wordBreak: "break-all" }}>{e.email}</span> },
    { key: "result", header: "Result", render: (e) => e.category ? <CategoryPill category={e.category} /> : <span className="pill grey">To check</span> },
    { key: "reason", header: "Reason", className: "small", render: (e) => e.reason ?? "—" },
    { key: "server", header: "Server", className: "cell2", render: (e) => e.serverName
      ? <><b>{e.serverName}</b>{e.checkedAt && <span>{dayLabel(e.checkedAt)} {timeWithSeconds(e.checkedAt)}</span>}</> : "—" },
  ]

  return (
    <div className="page">
      <Link href="/validation/results" className="small muted" style={{ display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
        <ArrowLeft size={14} />Results</Link>
      <div className="page-head">
        <h1 style={{ wordBreak: "break-word" }}>{job.name}</h1>
        <span className={`pill ${status.tone}`}>{status.label}</span>
        <div className="actions">
          {can("VALIDATION:RUN") && running && <button className="btn" disabled={busy} onClick={() => setConfirm("stop")}><Square />Stop</button>}
          {can("VALIDATION:RUN") && job.status === "STOPPED" && job.pending > 0 &&
            <button className="btn primary" disabled={busy} onClick={() => act("resume", "Job resumed")}><Play />Resume</button>}
          {can("VALIDATION:RUN") && !running && job.unknown > 0 &&
            <button className="btn" disabled={busy} onClick={() => setConfirm("retry")}><RotateCcw />Retry unknown ({count(job.unknown)})</button>}
          {can("VALIDATION:DELETE") && !running &&
            <button className="btn text-danger" disabled={busy} onClick={() => setConfirm("delete")} aria-label="Delete job"><Trash2 /></button>}
        </div>
      </div>
      <p className="small muted" style={{ marginTop: -14, marginBottom: 18 }}>
        Started {when(job.startedAt)}{job.startedBy ? ` by ${job.startedBy}` : ""}
        {job.finishedAt ? ` · finished ${when(job.finishedAt)}` : ""}
        {job.retries > 0 ? ` · unknown retried ${job.retries}×` : ""}
        {" · "}<LiveStatus status={poll.status} updatedAt={poll.updatedAt} failures={poll.failures} />
      </p>

      {job.message && (
        <Banner tone={job.status === "STOPPED" ? "amber" : "blue"} title={job.status === "STOPPED" ? "Stopped" : "Note"} style={{ marginBottom: 16 }}>
          <p>{job.message}</p>
        </Banner>
      )}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <CategoryRing counts={counts} total={job.total} checked={job.checked} />
      </div>

      <div className="counters" style={{ marginBottom: 16 }}>
        <Counter label="To check" value={job.pending} tone="blue" />
        <Counter label="Checks per minute" value={running ? job.perMinute ?? 0 : null} hint={running ? "over the last 5 minutes" : "only while running"} />
        <Counter label="Duplicates dropped" value={job.duplicates} />
        <Counter label="Bad lines dropped" value={job.invalid} />
      </div>

      <div className="grid-2" style={{ gap: 16, alignItems: "start", marginBottom: 24 }}>
        <div className="card">
          <div className="card-head"><h2>Servers</h2><span className="right small muted">The work rotates between them</span></div>
          <div className="tbl-scroll">
            <table className="t" aria-label="Servers of this job">
              <thead><tr><th>Server</th><th className="num">Checked</th><th>Now</th></tr></thead>
              <tbody>
                {job.servers.map((s) => {
                  const st = serverState(s.state)
                  return (
                    <tr key={s.publicId}>
                      <td><b>{s.name}</b><div className="muted small mono">{s.ip}</div></td>
                      <td className="num">{count(s.checked)}</td>
                      <td>{st ? <span className={`pill ${st.tone}`}>{st.label}</span> : <span className="muted">—</span>}
                        {s.message && <div className="small muted" style={{ marginTop: 4 }}>{s.message}</div>}</td>
                    </tr>
                  )
                })}
                {job.servers.length === 0 && <tr><td colSpan={3} className="muted">The job&apos;s servers were deleted.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {can("VALIDATION:EXPORT") && (
          <div className="card">
            <div className="card-head"><h2>Exports</h2>{running && <span className="right small muted">So far: the job is still running</span>}</div>
            <div className="card-pad" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CATEGORIES.map((c) => {
                const n = counts[c]
                const label = `${categoryMeta(c).label} (${count(n)})`
                return n > 0
                  ? <a key={c} className="btn" href={`/api/v1/validation/jobs/${id}/export?category=${c}`} download><Download />{label}</a>
                  : <button key={c} className="btn" disabled><Download />{label}</button>
              })}
              {job.checked > 0
                ? <a className="btn" href={`/api/v1/validation/jobs/${id}/export?category=DETAILS`} download><FileSpreadsheet />Detailed CSV</a>
                : <button className="btn" disabled><FileSpreadsheet />Detailed CSV</button>}
            </div>
          </div>
        )}
      </div>

      <div className="toolbar">
        <select className={`filter ${category ? "on" : ""}`} aria-label="Result" value={category}
          onChange={(e) => emails.setFilter("category", e.target.value)}>
          <option value="">Result: All ({count(job.total)})</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>Result: {categoryMeta(c).label} ({count(counts[c])})</option>)}
          <option value="PENDING">Result: To check ({count(job.pending)})</option>
        </select>
      </div>
      <DataTable
        table={emails}
        label="Addresses"
        columns={columns}
        rowKey={(e) => e.email}
        search={{ placeholder: "Search by email", label: "Search addresses" }}
        sizes={[25, 50, 100]}
        errorTitle="Couldn't load the addresses"
        empty={(d) => d.totalItems > 0 ? null : <EmptyState icon={<SearchX />} title="No address here" text="Try another result or search." />}
      />

      <ConfirmDialog open={confirm === "stop"} onClose={() => setConfirm(null)} icon={<Square />}
        title="Stop this job?" text="Results so far are kept. Resume goes on with the addresses still to check."
        confirmLabel="Stop" onConfirm={() => act("stop", "Job stopped")} />
      <ConfirmDialog open={confirm === "retry"} onClose={() => setConfirm(null)} icon={<RotateCcw />}
        title={`Check the ${count(job.unknown)} unknown addresses again?`}
        text="They go back to “to check” in this same job and are counted once, never twice."
        confirmLabel="Retry unknown" onConfirm={() => act("retry-unknown", "Retrying the unknown addresses")} />
      <ConfirmDialog open={confirm === "delete"} onClose={() => setConfirm(null)} danger icon={<Trash2 />}
        title="Delete this job?" text={`The job and the results of its ${count(job.total)} addresses are deleted. This can't be undone.`}
        confirmLabel="Delete job" onConfirm={remove} />
    </div>
  )
}
