"use client"

import { ArrowLeft, CircleAlert, Download, Pencil, SearchX, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { type Column, DataTable } from "@/components/md/data-table"
import { ConfirmDialog, ModalForm } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { EmptyState, ErrorState, Forbidden, LoadingState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Banner, FieldError } from "@/components/md/ui"
import { useTableQuery } from "@/components/md/use-table-query"
import { api, ApiError } from "@/lib/api"
import { when } from "@/lib/format"
import { delimiterLabel, type ListDetail, type ListItem, type ListMember, type ListPart, listStatus } from "@/lib/lists"
import { count } from "@/lib/table"
import { SelectField } from "@/components/md/select-field"
import { ImportFlow, ImportReport } from "../../import-flow"
import { PartActions, ValidateListButton } from "../../validate-actions"
import { RunningBadge, ValidationSummary } from "../../validation-summary"

/** One list: its details, import report, latest validation, parts, and its addresses page by page. */
export function ListDetailView() {
  const { id } = useParams<{ id: string }>()
  const { can } = useSession()
  const toast = useToast()
  const router = useRouter()
  const [detail, setDetail] = useState<ListDetail | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    api<ListDetail>(`/api/v1/lists/${id}`).then((d) => { setDetail(d); setError(null) }, setError)
  }, [id])
  useEffect(() => { if (can("LISTS:VIEW")) load() }, [can, load])
  useEffect(() => { document.title = `${detail?.list.name ?? "List"} · MasterDB` }, [detail?.list.name])

  // While a validation job runs on it, keep its progress fresh.
  const running = !!detail?.list.validation?.running || !!detail?.parts.some((p) => p.running)
  useEffect(() => {
    if (!running) return
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [running, load])

  const status = detail?.list.status
  const onFlowChange = useCallback((l: ListItem) => {
    if (l.status !== status && (l.status === "READY" || l.status === "FAILED")) load()
  }, [status, load])

  if (!can("LISTS:VIEW")) return <Forbidden module="Lists" />
  if (!detail) {
    return <div className="page">{error ? <ErrorState title="Couldn't load this list" error={error} onRetry={load} /> : <LoadingState />}</div>
  }

  const { list, parts } = detail
  const st = listStatus(list.status)
  const ready = list.status === "READY"

  async function remove() {
    await api(`/api/v1/lists/${id}`, { method: "DELETE" })
    toast("List deleted")
    router.push("/lists/emails")
  }

  return (
    <div className="page">
      <Link href="/lists/emails" className="small muted" style={{ display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
        <ArrowLeft size={14} />List emails</Link>
      <div className="page-head">
        <h1 style={{ wordBreak: "break-word" }}>{list.name}</h1>
        <span className={`pill ${st.tone}`}>{st.label}</span>
        <div className="actions" style={{ flexWrap: "wrap" }}>
          {ready && <ValidateListButton list={list} />}
          {ready && can("LISTS:EXPORT") && <a className="btn" href={`/api/v1/lists/${id}/export`} download><Download />Export CSV</a>}
          {can("LISTS:EDIT") && <button className="btn" onClick={() => setEditing(true)}><Pencil />Edit</button>}
          {can("LISTS:DELETE") && <button className="btn text-danger" onClick={() => setDeleting(true)} aria-label="Delete list"><Trash2 /></button>}
        </div>
      </div>
      <p className="small muted" style={{ marginTop: -14, marginBottom: 18 }}>
        {ready ? `${count(list.records)} addresses in ${count(list.parts)} part${list.parts === 1 ? "" : "s"} · ` : ""}
        Added {when(list.createdAt)}{list.createdBy ? ` by ${list.createdBy}` : ""}
      </p>

      {list.status === "FAILED" && (
        <Banner tone="red" icon={<CircleAlert />} title="This list couldn't be imported" style={{ marginBottom: 16 }}>
          <p>{list.message ?? "Something went wrong."}</p>
        </Banner>
      )}
      {!ready && list.status !== "FAILED" && <div style={{ marginBottom: 16 }}><ImportFlow listId={list.publicId} onChange={onFlowChange} /></div>}

      <div className="grid-2" style={{ gap: 16, alignItems: "start", marginBottom: 16 }}>
        <div className="card">
          <div className="card-head"><h2>Details</h2></div>
          <div className="card-pad">
            <dl className="kv" style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px", margin: 0 }}>
              <dt className="muted">ESP</dt><dd style={{ margin: 0 }}>{list.esp || "—"}</dd>
              <dt className="muted">Country</dt><dd style={{ margin: 0 }}>{list.country || "—"}</dd>
              <dt className="muted">Vertical</dt><dd style={{ margin: 0 }}>{list.vertical || "—"}</dd>
              <dt className="muted">Remove duplicates</dt><dd style={{ margin: 0 }}>{list.removeDuplicates ? "Yes" : "No"}</dd>
              <dt className="muted">Split by</dt><dd style={{ margin: 0 }}>{list.splitSize > 0 ? count(list.splitSize) : "No split"}</dd>
              <dt className="muted">Source</dt>
              <dd style={{ margin: 0, wordBreak: "break-all" }}>{list.source === "DRIVE" ? "Google Drive: " : "Local file: "}<span className="mono small">{list.sourceName}</span></dd>
              {list.mapping && <>
                <dt className="muted">Email column</dt>
                <dd style={{ margin: 0 }}>{list.mapping.columns[list.mapping.emailColumn] ?? `Column ${list.mapping.emailColumn + 1}`}
                  <span className="muted small"> · {delimiterLabel(list.mapping.delimiter)}{list.mapping.hasHeader ? ", with a header" : ""}</span></dd>
              </>}
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Latest validation</h2>
            {list.validation?.at && <span className="right small muted">Counted {when(list.validation.at)}</span>}</div>
          <div className="card-pad">
            {ready ? <ValidationSummary list={list} /> : <span className="muted">Not imported yet.</span>}
            <p className="small muted" style={{ margin: "10px 0 0" }}>The newest answer for each address over every validation of this list and its parts.</p>
          </div>
        </div>
      </div>

      {list.report && <div style={{ marginBottom: 16 }}><ImportReport list={list} /></div>}

      {ready && parts.length > 0 && <PartsCard list={list} parts={parts} />}
      {ready && <Members list={list} parts={parts} />}

      {editing && <EditList list={list} onClose={() => setEditing(false)} onSaved={(l) => { setDetail((d) => d && { ...d, list: l }); toast("List saved") }} />}
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} danger icon={<Trash2 />}
        title={`Delete ${list.name}?`}
        text={<>Its {count(list.records)} addresses and its parts are removed from the list (the contacts and past validation results stay). This can&apos;t be undone.</>}
        typed={list.name} confirmLabel="Delete list" onConfirm={remove} />
    </div>
  )
}

function PartsCard({ list, parts }: { list: ListItem; parts: ListPart[] }) {
  const { can } = useSession()
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><h2>Parts</h2><span className="right small muted">Split by {count(list.splitSize || list.records)}</span></div>
      <div className="tbl-scroll" style={{ maxHeight: 420, overflowY: "auto" }}>
        <table className="t" aria-label="Parts of this list">
          <thead><tr><th>Part</th><th className="num">Records</th><th>Lines</th><th>Validation</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.publicId}>
                <td><b>Part {p.partNo}</b></td>
                <td className="num">{count(p.records)}</td>
                <td className="muted small num">{count(p.firstSeq)}–{count(p.lastSeq)}</td>
                <td>{p.running ? <RunningBadge job={p.running} /> : <span className="muted">—</span>}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <PartActions list={list} part={p} />
                  {can("LISTS:EXPORT") && <a className="btn sm" href={`/api/v1/lists/${list.publicId}/export?part=${p.partNo}`} download aria-label={`Export part ${p.partNo}`}><Download /></a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Members({ list, parts }: { list: ListItem; parts: ListPart[] }) {
  const t = useTableQuery<ListMember>({ path: `/api/v1/lists/${list.publicId}/emails`, size: 25, filters: { part: "" } })
  const own = list.mapping && list.mapping.columns.length > 1 ? list.mapping.columns : null
  const columns: Column<ListMember>[] = [
    { key: "seq", header: "#", className: "num muted", render: (m) => count(m.seq) },
    { key: "email", header: "Email", className: "mono", render: (m) => <span style={{ wordBreak: "break-all" }}>{m.email}</span> },
    ...(parts.length > 1 ? [{ key: "part", header: "Part", className: "num", render: (m: ListMember) => m.partNo }] : []),
    ...(own ?? []).map((name, i) => ({
      key: `c${i}`, header: name, className: "small",
      render: (m: ListMember) => m.fields?.[i] ?? "",
    })).filter((_, i) => i !== list.mapping?.emailColumn),
  ]
  return (
    <>
      <h2 style={{ margin: "8px 0 12px" }}>Addresses</h2>
      <DataTable
        table={t}
        label="Addresses"
        filters={parts.length > 1 ? <>
          <SelectField className={`filter ${t.filters.part ? "on" : ""}`} aria-label="Part" value={t.filters.part ?? ""} onChange={(e) => t.setFilter("part", e.target.value)}>
            <option value="">Part: All ({count(list.records)})</option>
            {parts.map((p) => <option key={p.partNo} value={p.partNo}>Part {p.partNo} ({count(p.records)})</option>)}
          </SelectField>
        </> : undefined}
        columns={columns}
        rowKey={(m) => String(m.seq)}
        search={{ placeholder: "Search by email", label: "Search addresses" }}
        sizes={[25, 50, 100]}
        errorTitle="Couldn't load the addresses"
        empty={(d) => d.totalItems > 0 ? null : <EmptyState icon={<SearchX />} title="No address here" text="Try another search or part." />}
      />
    </>
  )
}

function EditList({ list, onClose, onSaved }: { list: ListItem; onClose: () => void; onSaved: (l: ListItem) => void }) {
  const [v, setV] = useState({ name: list.name, esp: list.esp, country: list.country, vertical: list.vertical })
  const [nameError, setNameError] = useState<string | null>(null)
  const field = (k: keyof typeof v, label: string) => (
    <div className="field">
      <label className="label" htmlFor={`e-${k}`}>{label}</label>
      <input id={`e-${k}`} className={`input ${k === "name" && nameError ? "invalid" : ""}`} maxLength={255} value={v[k]}
        onChange={(e) => { setV((x) => ({ ...x, [k]: e.target.value })); if (k === "name") setNameError(null) }} />
      {k === "name" && nameError && <FieldError text={nameError} />}
    </div>
  )
  return (
    <ModalForm open onClose={onClose} title="Edit list" icon={<Pencil />} submitLabel="Save" canSubmit={!!v.name.trim()}
      text="Remove duplicates and split size were used at import and can't change."
      onSubmit={async () => {
        try {
          onSaved(await api<ListItem>(`/api/v1/lists/${list.publicId}`, { method: "PUT", body: v }))
        } catch (e) {
          if (e instanceof ApiError && e.field("name")) {
            setNameError(e.field("name")!)
            return false
          }
          throw e
        }
      }}>
      {field("name", "List name")}
      {field("esp", "ESP")}
      {field("country", "Country")}
      {field("vertical", "Vertical")}
    </ModalForm>
  )
}
