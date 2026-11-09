"use client"

import { CloudDownload, FileUp, Plus, Upload } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { useSession } from "@/components/md/session"
import { Forbidden } from "@/components/md/states"
import { FieldError } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import { bytes, driveLinkProblem, isListFile, type ListItem, type ListSource } from "@/lib/lists"
import { ImportFlow } from "../import-flow"

/** Most the server takes in one list (APP_LISTS_MAX_FILE_SIZE); the server checks it again. */
const MAX_FILE = 2 * 1024 ** 3

type Form = { name: string; esp: string; country: string; vertical: string; removeDuplicates: "no" | "yes"; splitBy: string; driveUrl: string }

const EMPTY: Form = { name: "", esp: "", country: "", vertical: "", removeDuplicates: "no", splitBy: "0", driveUrl: "" }

/**
 * Add list (old app's form): name, ESP, country, remove duplicates, vertical,
 * split by; then the file from the PC or a Google Drive link. After "Add list"
 * the same page shows the real upload progress, the email column, the import
 * progress and the report.
 */
export default function AddListPage() {
  const { can } = useSession()
  const fileInput = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [source, setSource] = useState<ListSource>("FILE")
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<ListItem | null>(null)

  useEffect(() => { document.title = "Add list · MasterDB" }, [])

  if (!can("LISTS:CREATE")) return <Forbidden module="Lists" />

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: "" }))
  }

  function pick(f: File | undefined) {
    if (!f) return
    if (!isListFile(f.name)) {
      setErrors((x) => ({ ...x, file: "Choose a .txt or .csv file." }))
      return
    }
    if (f.size === 0) {
      setErrors((x) => ({ ...x, file: "This file is empty." }))
      return
    }
    if (f.size > MAX_FILE) {
      setErrors((x) => ({ ...x, file: `This file is ${bytes(f.size)}; at most ${bytes(MAX_FILE)} per list.` }))
      return
    }
    setFile(f)
    setErrors((x) => ({ ...x, file: "" }))
    if (!form.name.trim()) setForm((v) => ({ ...v, name: f.name.replace(/\.[^.]+$/, "") }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = "Give the list a name."
    const split = Number(form.splitBy || "0")
    if (!Number.isInteger(split) || split < 0) errs.splitBy = "A whole number, 0 for no split."
    if (source === "FILE" && !file) errs.file = "Choose the file."
    if (source === "DRIVE") {
      const problem = driveLinkProblem(form.driveUrl)
      if (problem) errs.driveUrl = problem
    }
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return
    setBusy(true)
    setError(null)
    try {
      const list = await api<ListItem>("/api/v1/lists", {
        body: {
          name: form.name.trim(), esp: form.esp.trim(), country: form.country.trim(), vertical: form.vertical.trim(),
          removeDuplicates: form.removeDuplicates === "yes", splitBy: split, source,
          ...(source === "FILE" ? { fileName: file!.name, fileSize: file!.size } : { driveUrl: form.driveUrl.trim() }),
        },
      })
      setCreated(list)
    } catch (err) {
      if (err instanceof ApiError && err.fields.length) {
        setErrors(Object.fromEntries(err.fields.map((f) => [f.field === "fileName" || f.field === "fileSize" ? "file" : f.field, f.message])))
      } else {
        setError(err)
      }
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div className="page">
        <div className="page-head">
          <h1 style={{ wordBreak: "break-word" }}>{created.name}</h1>
          <div className="actions">
            <Link className="btn" href={`/lists/emails/${created.publicId}`}>Open the list</Link>
            <button className="btn" onClick={() => { setCreated(null); setFile(null); setForm(EMPTY) }}><Plus />Add another list</button>
          </div>
        </div>
        <ImportFlow listId={created.publicId} file={file} />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Add list</h1>
        <span className="meta">A .txt or .csv file from your PC, or a Google Drive link. Up to 2 GB.</span>
        <div className="actions">{can("LISTS:VIEW") && <Link className="btn" href="/lists/emails">List emails</Link>}</div>
      </div>
      <form className="card card-pad" onSubmit={submit} noValidate style={{ maxWidth: 760 }}>
        <div className="grid-2" style={{ gap: "0 16px" }}>
          <div className="field">
            <label className="label" htmlFor="l-name">List name</label>
            <input id="l-name" className={`input ${errors.name ? "invalid" : ""}`} maxLength={255} value={form.name} placeholder="e.g. Expo 2026 attendees" onChange={set("name")} disabled={busy} />
            {errors.name && <FieldError text={errors.name} />}
          </div>
          <div className="field">
            <label className="label" htmlFor="l-esp">ESP</label>
            <input id="l-esp" className="input" maxLength={255} placeholder="Gmail, Outlook, mixed…" value={form.esp} onChange={set("esp")} disabled={busy} />
          </div>
          <div className="field">
            <label className="label" htmlFor="l-country">Country</label>
            <input id="l-country" className="input" maxLength={255} value={form.country} placeholder="e.g. Canada" onChange={set("country")} disabled={busy} />
          </div>
          <div className="field">
            <label className="label" htmlFor="l-dup">Remove duplicates</label>
            <select id="l-dup" className="input" value={form.removeDuplicates} onChange={set("removeDuplicates")} disabled={busy}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            <span className="help">Yes keeps the first of each address in this file (capitals ignored). Addresses already in other lists are counted, never removed.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="l-vertical">Vertical</label>
            <input id="l-vertical" className="input" maxLength={255} placeholder="Industry or niche" value={form.vertical} onChange={set("vertical")} disabled={busy} />
          </div>
          <div className="field">
            <label className="label" htmlFor="l-split">Split by number</label>
            <input id="l-split" className={`input ${errors.splitBy ? "invalid" : ""}`} type="number" min={0} step={1} value={form.splitBy} placeholder="0 = one part" onChange={set("splitBy")} disabled={busy} />
            {errors.splitBy ? <FieldError text={errors.splitBy} /> : <span className="help">0 keeps one part; a larger number makes parts of that many addresses, each validated on its own.</span>}
          </div>
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: "4px 0 16px" }}>
          <legend className="label" style={{ marginBottom: 6 }}>File</legend>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }} role="radiogroup" aria-label="Where the file is">
            <button type="button" role="radio" aria-checked={source === "FILE"} className={`btn ${source === "FILE" ? "primary" : ""}`}
              onClick={() => setSource("FILE")} disabled={busy}><Upload />From the PC</button>
            <button type="button" role="radio" aria-checked={source === "DRIVE"} className={`btn ${source === "DRIVE" ? "primary" : ""}`}
              onClick={() => setSource("DRIVE")} disabled={busy}><CloudDownload />Google Drive link</button>
          </div>
          {source === "FILE" ? (
            <div>
              <input ref={fileInput} type="file" accept=".txt,.csv,text/plain,text/csv" hidden
                onChange={(e) => { pick(e.target.files?.[0]); e.target.value = "" }} />
              <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={busy}><FileUp />{file ? "Choose another file" : "Choose a .txt or .csv file"}</button>
              {file && <span className="small" style={{ marginLeft: 10, wordBreak: "break-all" }}><span className="mono">{file.name}</span> · {bytes(file.size)}</span>}
              {errors.file && <FieldError text={errors.file} />}
              <span className="help" style={{ display: "block", marginTop: 6 }}>One address per line, or a CSV with a header: you choose the email column after the upload. The other columns are kept for exports.</span>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="l-drive" style={{ fontWeight: 400 }}>Link shared as “Anyone with the link”</label>
              <input id="l-drive" className={`input mono ${errors.driveUrl ? "invalid" : ""}`} type="url" placeholder="https://drive.google.com/file/d/…/view"
                value={form.driveUrl} onChange={set("driveUrl")} disabled={busy} spellCheck={false} />
              {errors.driveUrl && <FieldError text={errors.driveUrl} />}
              <span className="help" style={{ display: "block", marginTop: 6 }}>A .txt or .csv file, or a Google Sheet (taken as CSV). The server downloads it; nothing goes through your browser.</span>
            </div>
          )}
        </fieldset>

        <button className="btn primary" type="submit" disabled={busy}><Plus className={busy ? "spin" : undefined} />{busy ? "Adding…" : "Add list"}</button>
        {error ? <p className="small text-danger" role="alert" style={{ margin: "10px 0 0" }}>{describe(error)}</p> : null}
      </form>
    </div>
  )
}
