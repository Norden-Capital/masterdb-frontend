"use client"

import { Archive, CircleSlash, Inbox, ListPlus, Play, Plus, RotateCcw, Search, Trash2, TriangleAlert } from "lucide-react"
import { useCallback, useState } from "react"

import { type Column, DataTable } from "@/components/md/data-table"
import { ConfirmDialog, ModalForm } from "@/components/md/dialogs"
import { Counter, LiveStatus, ProgressRing } from "@/components/md/progress"
import { EmptyState, ErrorState, LoadingState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Banner, StatusPill } from "@/components/md/ui"
import { usePoll } from "@/components/md/use-poll"
import { useTableQuery } from "@/components/md/use-table-query"
import { api, ApiError } from "@/lib/api"
import { date } from "@/lib/format"
import { count } from "@/lib/table"

type DemoRow = { id: string; name: string; status: "READY" | "VALIDATING" | "DRAFT"; rows: number; createdAt: string }
type DemoJob = { state: "RUNNING" | "FINISHED"; total: number; done: number; valid: number; invalid: number; unknown: number }

const STATUS_PILL = {
  READY: <span className="pill green">Ready</span>,
  VALIDATING: <span className="pill blue">Validating</span>,
  DRAFT: <span className="pill grey">Draft</span>,
}

function Section(props: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ marginBottom: 24 }}>
      <div className="card-head"><h2>{props.title}</h2>{props.note && <span className="muted small">{props.note}</span>}</div>
      <div className="card-pad">{props.children}</div>
    </section>
  )
}

/** /dev/components: every shared component, wired to dev-only endpoints (app/dev/*). */
export function Showcase() {
  const toast = useToast()
  return (
    <div className="page">
      <div className="page-head">
        <h1>Components</h1>
        <span className="meta">Development only · this page answers 404 in production</span>
      </div>
      <Banner tone="blue" title="How to use this page" style={{ marginBottom: 24 }}>
        The frame around it is the real app shell: collapse the sidebar, switch the theme in the user menu, or make the
        window narrower than 600 px to get the phone menu.
      </Banner>
      <TableDemo />
      <ProgressDemo />
      <DialogsDemo />
      <Section title="Toasts" note="Bottom right, gone after 5 s">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => toast("List saved")}>Success toast</button>
          <button className="btn" onClick={() => toast("The server cannot be reached right now.", "bad")}>Error toast</button>
        </div>
      </Section>
      <Section title="Empty, loading and error states">
        <div className="grid-2">
          <div className="card"><EmptyState icon={<Inbox />} title="No lists yet" text="Upload a CSV file to create your first list."
            action={<button className="btn primary"><Plus />Upload list</button>} /></div>
          <div className="card"><LoadingState label="Loading demo" /></div>
          <div><ErrorState title="Couldn't load lists" error={new ApiError(503, "SERVICE_UNAVAILABLE", "")} onRetry={() => toast("Retrying")} /></div>
          <div><ErrorState title="Couldn't save" error={new ApiError(500, "INTERNAL_ERROR", "", [], null, "req-4f2a")} /></div>
        </div>
      </Section>
      <Section title="Buttons, pills, banners">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <button className="btn primary">Primary</button>
          <button className="btn">Secondary</button>
          <button className="btn ghost">Ghost</button>
          <button className="btn danger">Danger</button>
          <button className="btn text-danger">Text danger</button>
          <button className="btn sm">Small</button>
          <button className="btn" disabled>Disabled</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {(["green", "red", "amber", "purple", "teal", "grey", "blue"] as const).map((c) => <span key={c} className={`pill ${c}`}>{c}</span>)}
          <StatusPill user={{ status: "ACTIVE", locked: false }} />
          <StatusPill user={{ status: "INVITED", locked: false }} />
          <StatusPill user={{ status: "ACTIVE", locked: true }} />
          <StatusPill user={{ status: "DISABLED", locked: false }} />
          <span className="chip">Chip</span>
          <span className="count">42</span>
        </div>
        {(["blue", "green", "amber", "red"] as const).map((t) => (
          <Banner key={t} tone={t} title={`${t[0].toUpperCase()}${t.slice(1)} banner`}>One short sentence of detail.</Banner>
        ))}
      </Section>
    </div>
  )
}

function TableDemo() {
  const toast = useToast()
  const t = useTableQuery<DemoRow>({ path: "/dev/demo-rows", size: 10, sort: { field: "createdAt", dir: "desc" }, filters: { status: "" } })
  const columns: Column<DemoRow>[] = [
    { key: "name", header: "List", sortField: "name", render: (r) => <span className="cell2"><b>{r.name}</b><span>{r.id}</span></span> },
    { key: "status", header: "Status", render: (r) => STATUS_PILL[r.status] },
    { key: "rows", header: "Rows", sortField: "rows", className: "num", render: (r) => count(r.rows) },
    { key: "created", header: "Created", sortField: "createdAt", render: (r) => date(r.createdAt) },
  ]
  return (
    <Section title="Data table" note="Sort, search, filter, select-all, bulk bar, page size, pager · fed by /dev/demo-rows">
      <div className="toolbar">
        <select className={`filter ${t.filters.status ? "on" : ""}`} aria-label="Status" value={t.filters.status}
          onChange={(e) => t.setFilter("status", e.target.value)}>
          <option value="">Status: All</option>
          <option value="READY">Status: Ready</option>
          <option value="VALIDATING">Status: Validating</option>
          <option value="DRAFT">Status: Draft</option>
        </select>
      </div>
      <DataTable table={t} label="Demo lists" columns={columns} rowKey={(r) => r.id} rowLabel={(r) => r.name}
        selectable={(r) => r.status !== "VALIDATING"}
        search={{ placeholder: "Search lists", label: "Search demo lists" }}
        errorTitle="Couldn't load demo lists"
        empty={(d) => d.totalItems > 0 ? null : (
          <EmptyState icon={<Search />} title="No lists match" text="Try another name or clear the filters."
            action={<button className="btn" onClick={t.clearFilters}>Clear filters</button>} />
        )}
        bulkActions={(chosen) => (
          <>
            <button className="btn" onClick={() => { toast(`${chosen.length} demo lists archived (nothing was changed)`); t.setSelected(new Set()) }}><Archive />Archive</button>
            <span className="vr" />
            <button className="btn text-danger" onClick={() => toast("Demo only: nothing deleted", "bad")}><Trash2 />Delete</button>
          </>
        )} />
      <p className="help" style={{ marginTop: 10 }}>Rows that are &quot;Validating&quot; can&apos;t be ticked, like a list a job is using.</p>
    </Section>
  )
}

function ProgressDemo() {
  const [run, setRun] = useState<{ started: number; fail: boolean } | null>(null)
  const fetcher = useCallback(
    (signal: AbortSignal) => api<DemoJob>(`/dev/demo-job?started=${run?.started}&total=2400${run?.fail ? "&fail=1" : ""}`, { signal }),
    [run],
  )
  const p = usePoll<DemoJob>(fetcher, { interval: 1000, enabled: !!run, isDone: (j) => j.state === "FINISHED" })
  const job = run ? p.data : null
  const start = (fail: boolean) => setRun({ started: Date.now(), fail })
  return (
    <Section title="Live progress" note="Ring + counters polled from /dev/demo-job every second; nothing is estimated">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <button className="btn primary" onClick={() => start(false)}><Play />Start demo job</button>
        <button className="btn" onClick={() => start(true)}><TriangleAlert />Start with outages</button>
        {run && <button className="btn" onClick={() => setRun(null)}><RotateCcw />Reset</button>}
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <ProgressRing done={job?.done} total={job?.total} label="Checked" />
        <div style={{ flex: 1, minWidth: 240, display: "grid", gap: 12 }}>
          <div className="counters">
            <Counter label="Valid" value={job?.valid} tone="green" />
            <Counter label="Bounce" value={job?.invalid} tone="red" />
            <Counter label="Unknown" value={job?.unknown} tone="amber" />
          </div>
          {run ? <LiveStatus status={p.status} updatedAt={p.updatedAt} failures={p.failures} />
            : <span className="muted small">No job running: the ring shows “—”, not 0 %.</span>}
        </div>
      </div>
    </Section>
  )
}

function DialogsDemo() {
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState(false)
  const [form, setForm] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  return (
    <Section title="Dialogs" note="Confirm, typed confirm for dangerous actions, modal form">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => setConfirm(true)}><CircleSlash />Confirm dialog</button>
        <button className="btn" onClick={() => setTyped(true)}><Trash2 />Typed confirmation</button>
        <button className="btn" onClick={() => { setName(""); setNameError(""); setForm(true) }}><ListPlus />Modal form</button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} danger icon={<CircleSlash />}
        title="Disable Demo Person?" text="They're logged out right away. Their history stays."
        confirmLabel="Disable" onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 600))
          toast("Demo only: nothing was disabled")
        }} />
      <ConfirmDialog open={typed} onClose={() => setTyped(false)} danger icon={<Trash2 />}
        title="Delete “Demo list 001”?" text="Its 12,345 contacts leave this list. This can't be undone."
        confirmLabel="Delete list" typed="Demo list 001" onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 600))
          throw new ApiError(409, "LIST_IN_USE", "A validation job is using this list. Cancel the job first.")
        }} />
      <ModalForm open={form} onClose={() => setForm(false)} title="New list" text="Demo: nothing is saved."
        icon={<ListPlus />} submitLabel="Create list" canSubmit={name.trim() !== ""}
        onSubmit={async () => {
          await new Promise((r) => setTimeout(r, 500))
          if (name.trim().length < 3) {
            setNameError("At least 3 characters.")
            return false
          }
          toast(`Demo only: “${name.trim()}” not created`)
        }}>
        <div className="field">
          <label className="label" htmlFor="demo-name">List name</label>
          <input id="demo-name" className={`input ${nameError ? "invalid" : ""}`} value={name} autoFocus
            onChange={(e) => { setName(e.target.value); setNameError("") }} />
          {nameError ? <span className="err" role="alert">{nameError}</span> : <span className="help">Shown in Lists and exports.</span>}
        </div>
      </ModalForm>
    </Section>
  )
}
