"use client"

import { CircleAlert, FileUp, Play, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { Counter, LiveStatus, ProgressRing } from "@/components/md/progress"
import { ErrorState, LoadingState } from "@/components/md/states"
import { Banner } from "@/components/md/ui"
import { usePoll } from "@/components/md/use-poll"
import { api, ApiError, describe } from "@/lib/api"
import {
  bytes, delimiterLabel, isBusy, type ListDetail, type ListItem, type ListPreview, putChunkFor, sendFile, type UploadState,
} from "@/lib/lists"
import { count } from "@/lib/table"

function apiError(status: number, body: Record<string, unknown>, requestId: string | null): Error {
  return new ApiError(status, String(body.code ?? (status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST")),
    String(body.detail ?? "The upload was refused."), [], null, requestId)
}

/**
 * Everything between "Add list" and a ready list: the upload (chunks under
 * 4 MB through the site's /api proxy; the bar shows only bytes the server
 * has saved), or the Drive download done by the server; then the email
 * column; then the import running in the background, then its report. Works
 * from the Add list page (with the chosen file) and from a list's page (to go
 * on with an upload that stopped: choose the same file again).
 */
export function ImportFlow({ listId, file, onChange }: { listId: string; file?: File | null; onChange?: (l: ListItem) => void }) {
  const poll = usePoll<ListDetail>(
    (signal) => api<ListDetail>(`/api/v1/lists/${listId}`, { signal }),
    { interval: 1500, isDone: (d) => !isBusy(d.list.status) },
  )
  const list = poll.data?.list
  const refresh = poll.refresh
  useEffect(() => {
    if (list) onChange?.(list)
  }, [list, onChange])

  if (!list) {
    return poll.error ? <ErrorState title="Couldn't load the list" error={poll.error} onRetry={refresh} /> : <LoadingState />
  }
  switch (list.status) {
    case "UPLOADING":
      return <UploadStage list={list} file={file} onDone={refresh} />
    case "DOWNLOADING":
      return (
        <div className="card card-pad" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <ProgressRing done={list.upload.size ? list.upload.received : null} total={list.upload.size ?? null} label="Downloaded" />
          <div>
            <h2 style={{ margin: "0 0 6px" }}>Downloading from Google Drive</h2>
            <p className="muted" style={{ margin: 0 }}>
              The server has {bytes(list.upload.received)}{list.upload.size ? ` of ${bytes(list.upload.size)}` : " so far (Google didn't say the size)"}.
              You can leave this page: the download goes on.
            </p>
            <p className="small" style={{ marginTop: 8 }}><LiveStatus status={poll.status} updatedAt={poll.updatedAt} failures={poll.failures} /></p>
          </div>
        </div>
      )
    case "MAPPING":
      return <MappingStage list={list} onStarted={refresh} />
    case "QUEUED":
    case "IMPORTING":
      return <ImportProgress list={list} poll={<LiveStatus status={poll.status} updatedAt={poll.updatedAt} failures={poll.failures} />} />
    case "FAILED":
      return (
        <Banner tone="red" icon={<CircleAlert />} title="This list couldn't be imported">
          <p>{list.message ?? "Something went wrong."}</p>
        </Banner>
      )
    default:
      return <ImportReport list={list} link />
  }
}

function UploadStage({ list, file, onDone }: { list: ListItem; file?: File | null; onDone: () => void }) {
  const [chosen, setChosen] = useState<File | null>(file && file.name === list.sourceName && file.size === list.upload.size ? file : null)
  const [state, setState] = useState<UploadState | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [running, setRunning] = useState(false)
  const [mismatch, setMismatch] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const started = useRef(false)

  const run = useCallback(async (f: File) => {
    setRunning(true)
    setError(null)
    const ctl = new AbortController()
    try {
      // Always ask the server where it stands: only bytes it has saved count.
      const now = await api<UploadState>(`/api/v1/lists/${list.publicId}/upload`)
      setState(now)
      if (now.status === "UPLOADING") {
        await sendFile({ file: f, from: now.received, put: putChunkFor(list.publicId, apiError), onProgress: setState, signal: ctl.signal })
      }
      onDone()
    } catch (e) {
      setError(e)
    } finally {
      setRunning(false)
    }
  }, [list.publicId, onDone])

  useEffect(() => {
    if (chosen && !started.current) {
      started.current = true
      run(chosen)
    }
  }, [chosen, run])

  // Leaving the page mid-upload: the browser asks first (the upload can be finished later from the list's page).
  useEffect(() => {
    if (!running) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [running])

  const received = state?.received ?? list.upload.received
  const size = list.upload.size ?? null
  return (
    <div className="card card-pad">
      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <ProgressRing done={received} total={size} label="Uploaded" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: "0 0 6px" }}>{running ? "Uploading" : chosen ? "Upload stopped" : "Upload not finished"}</h2>
          <p className="muted" style={{ margin: 0, wordBreak: "break-word" }}>
            <span className="mono">{list.sourceName}</span>: the server has saved {bytes(received)} of {bytes(size)}.
          </p>
          {running && <p className="small muted" style={{ margin: "6px 0 0" }}>Keep this page open until the upload is done. If it stops, you can go on later from where it stood.</p>}
          {error ? (
            <div style={{ marginTop: 12 }}>
              <ErrorState title="The upload stopped" error={error} />
              {chosen && <button className="btn" style={{ marginTop: 8 }} onClick={() => run(chosen)}><RotateCcw />Go on from {bytes(received)}</button>}
            </div>
          ) : null}
          {!chosen && !running && (
            <div style={{ marginTop: 12 }}>
              <input ref={input} type="file" accept=".txt,.csv,text/plain,text/csv" hidden onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (!f) return
                if (f.name !== list.sourceName || f.size !== list.upload.size) {
                  setMismatch(`That's not the same file: choose ${list.sourceName} (${bytes(list.upload.size)}).`)
                  return
                }
                setMismatch(null)
                setChosen(f)
              }} />
              <button className="btn primary" onClick={() => input.current?.click()}><FileUp />Choose the same file to go on</button>
              {mismatch && <p className="small text-danger" role="alert" style={{ margin: "8px 0 0" }}>{mismatch}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MappingStage({ list, onStarted }: { list: ListItem; onStarted: () => void }) {
  const [preview, setPreview] = useState<ListPreview | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [column, setColumn] = useState(0)
  const [header, setHeader] = useState(false)
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState<unknown>(null)

  const load = useCallback(() => {
    api<ListPreview>(`/api/v1/lists/${list.publicId}/preview`).then((p) => {
      setPreview(p)
      setColumn(p.emailColumn)
      setHeader(p.hasHeader)
    }, setError)
  }, [list.publicId])
  useEffect(load, [load])

  if (error) return <ErrorState title="Couldn't read the start of the file" error={error} onRetry={() => { setError(null); load() }} />
  if (!preview) return <LoadingState />

  const width = Math.max(preview.columns.length, ...preview.rows.map((r) => r.length), 1)
  const names = Array.from({ length: width }, (_, i) => header ? (preview.rows[0]?.[i]?.trim() || `Column ${i + 1}`) : `Column ${i + 1}`)
  const rows = (header ? preview.rows.slice(1) : preview.rows).slice(0, 10)
  const looks = (c: number) => rows.filter((r) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test((r[c] ?? "").trim())).length

  async function start() {
    setBusy(true)
    setStartError(null)
    try {
      await api(`/api/v1/lists/${list.publicId}/import`, { body: { emailColumn: column, hasHeader: header } })
      onStarted()
    } catch (e) {
      setStartError(e)
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card-head"><h2>Which column holds the email?</h2>
        <span className="right small muted">Separator: {delimiterLabel(preview.delimiter)}</span></div>
      <div className="card-pad">
        <p className="muted" style={{ marginTop: 0 }}>The whole file is on the server ({bytes(list.upload.size)}). This is our guess from its first rows; change it if it&apos;s wrong.</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
          <div className="field" style={{ margin: 0, minWidth: 220 }}>
            <label className="label" htmlFor="map-col">Email column</label>
            <select id="map-col" className="input" value={column} onChange={(e) => setColumn(Number(e.target.value))} disabled={busy}>
              {names.map((n, i) => <option key={i} value={i}>{n} ({looks(i)} of {rows.length} rows look like an email)</option>)}
            </select>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 8 }}>
            <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} disabled={busy} />
            The first row is a header (not imported)
          </label>
        </div>
        <div className="tbl-scroll" style={{ marginBottom: 16 }}>
          <table className="t" aria-label="First rows of the file">
            <thead><tr>{names.map((n, i) => <th key={i} style={i === column ? { background: "var(--primary-soft)", color: "var(--primary-text)" } : undefined}>{n}{i === column ? " · email" : ""}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{names.map((_, i) => <td key={i} className={i === column ? "mono" : undefined} style={i === column ? { fontWeight: 600 } : undefined}>{r[i] ?? ""}</td>)}</tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={width} className="muted">No rows in the start of the file.</td></tr>}
            </tbody>
          </table>
        </div>
        <button className="btn primary" onClick={start} disabled={busy}><Play className={busy ? "spin" : undefined} />{busy ? "Starting…" : "Import the list"}</button>
        {startError ? <p className="small text-danger" role="alert" style={{ margin: "10px 0 0" }}>{describe(startError)}</p> : null}
      </div>
    </div>
  )
}

function ImportProgress({ list, poll }: { list: ListItem; poll: React.ReactNode }) {
  const p = list.progress
  const reading = p?.phase === "READING"
  const saving = p?.phase === "SAVING"
  return (
    <div className="card card-pad" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <ProgressRing done={p && (reading || saving) ? p.done : null} total={p && (reading || saving) ? p.total : null}
        label={reading ? "File read" : saving ? "Addresses saved" : "Waiting"} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <h2 style={{ margin: "0 0 6px" }}>
          {list.status === "QUEUED" ? "Waiting to import" : reading ? "Step 1 of 2: reading the file" : "Step 2 of 2: saving the addresses"}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {list.status === "QUEUED" && "Another list is being imported; this one starts right after it."}
          {reading && p && `${bytes(p.done)} of ${bytes(p.total)} read; each address is checked as it is read.`}
          {saving && p && `${count(p.done)} of ${count(p.total)} valid addresses saved to the list.`}
          {" "}It runs on the server: you can leave this page.
        </p>
        <p className="small" style={{ marginTop: 8 }}>{poll}</p>
      </div>
    </div>
  )
}

/** The import report: every non-blank line of the file is in one of these numbers. */
export function ImportReport({ list, link }: { list: ListItem; link?: boolean }) {
  const r = list.report
  if (!r) return null
  return (
    <div className="card">
      <div className="card-head"><h2>Import report</h2>
        <span className="right small muted">{list.importedAt ? `Imported ${new Date(list.importedAt).toLocaleString("en-CA")}` : ""}</span></div>
      <div className="card-pad">
        <div className="counters">
          <Counter label="Lines in the file" value={r.totalLines} hint="blank lines and the header not counted" />
          <Counter label="Imported" value={r.imported} tone="green" hint={`${count(list.parts)} part${list.parts === 1 ? "" : "s"}`} />
          <Counter label="Invalid syntax" value={r.invalid} tone={r.invalid ? "red" : undefined} hint="no valid email in the column" />
          <Counter label={r.duplicatesRemoved ? "Duplicates removed" : "Repeated (kept)"} value={r.duplicates} tone={r.duplicates ? "amber" : undefined}
            hint={r.duplicatesRemoved ? "the first one of each was kept" : "remove duplicates was No"} />
          <Counter label="Already in other lists" value={r.inOtherLists} hint="counted, not removed" />
        </div>
        {link && list.status === "READY" && (
          <p className="small muted" style={{ margin: "12px 0 0" }}>
            <Link href={`/lists/emails/${list.publicId}`}>Open the list</Link>
          </p>
        )}
      </div>
    </div>
  )
}
