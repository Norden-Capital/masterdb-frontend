"use client"

import { FileUp, Play } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { useSession } from "@/components/md/session"
import { ErrorState, Forbidden, LoadingState } from "@/components/md/states"
import { Banner, FieldError } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import { count } from "@/lib/table"
import type { ValidationJob, ValidationServer } from "@/lib/types"
import { lineCount } from "@/lib/validation"
import { PacingCard } from "./pacing-card"

const MAX_EMAILS = 50_000
const MAX_FILE = 3 * 1024 * 1024

/**
 * Bulk validation: paste addresses (or open a .txt / .csv file), choose one or
 * more servers, start. The job runs in the background: closing the page
 * changes nothing. Lists from List management come later.
 */
export default function BulkValidationPage() {
  const { can } = useSession()
  const router = useRouter()
  const file = useRef<HTMLInputElement>(null)
  const [servers, setServers] = useState<ValidationServer[] | null>(null)
  const [serversError, setServersError] = useState<unknown>(null)
  const [name, setName] = useState("")
  const [emails, setEmails] = useState("")
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const loadServers = useCallback(() => {
    api<ValidationServer[]>("/api/v1/validation/servers").then((l) => {
      setServersError(null)
      setServers(l)
      setChosen((cur) => cur.size > 0 ? cur : new Set(l.filter((s) => s.ready).slice(0, 1).map((s) => s.publicId)))
    }, setServersError)
  }, [])
  useEffect(() => {
    if (can("VALIDATION:VIEW")) loadServers()
  }, [can, loadServers])
  useEffect(() => { document.title = "Bulk validation · MasterDB" }, [])

  if (!can("VALIDATION:VIEW")) return <Forbidden module="Validation" />

  const lines = lineCount(emails)
  const ready = servers?.filter((s) => s.ready) ?? []

  async function openFile(f: File | undefined) {
    if (!f) return
    if (f.size > MAX_FILE) {
      setFieldErrors({ emails: "This file is over 3 MB. Split it, or wait for List management (big lists go there)." })
      return
    }
    const text = await f.text()
    setEmails(text)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""))
    setFieldErrors({})
  }

  async function start(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const errs: Record<string, string> = {}
    if (lines === 0) errs.emails = "Paste at least one email address."
    if (lines > MAX_EMAILS) errs.emails = `${count(lines)} lines: at most ${count(MAX_EMAILS)} per job.`
    if (chosen.size === 0) errs.servers = "Choose at least one server."
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const job = await api<ValidationJob>("/api/v1/validation/jobs", {
        method: "POST", body: { name: name.trim() || undefined, emails, serverIds: [...chosen] },
      })
      router.push(`/validation/results/${job.publicId}`)
    } catch (err) {
      if (err instanceof ApiError && err.fields.length) {
        setFieldErrors(Object.fromEntries(err.fields.map((f) => [f.field === "serverIds" ? "servers" : f.field, f.message])))
      } else {
        setError(err)
      }
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Bulk validation</h1>
        <span className="meta">Runs in the background: you can close the page.</span>
        <div className="actions"><Link className="btn" href="/validation/results">Results</Link></div>
      </div>

      {serversError ? <ErrorState title="Couldn't load the servers" error={serversError} onRetry={loadServers} /> : null}
      {!servers && !serversError && <LoadingState />}
      {servers && ready.length === 0 && (
        <Banner tone="amber" title="No server can validate yet" style={{ marginBottom: 16 }}>
          <p>A server needs to be connected over SSH and linked to a domain. {can("SERVERS:VIEW") && <Link href="/servers/list">Open the server list</Link>}</p>
        </Banner>
      )}

      {servers && ready.length > 0 && (can("VALIDATION:RUN") ? (
        <form className="card card-pad" onSubmit={start} noValidate style={{ marginBottom: 24 }}>
          <div className="field">
            <label className="label" htmlFor="b-name">Name (optional)</label>
            <input id="b-name" className={`input ${fieldErrors.name ? "invalid" : ""}`} maxLength={120} value={name}
              placeholder="e.g. March leads Canada" onChange={(e) => setName(e.target.value)} disabled={busy} />
            {fieldErrors.name && <FieldError text={fieldErrors.name} />}
          </div>
          <div className="field">
            <div className="label-row">
              <label className="label" htmlFor="b-emails">Email addresses</label>
              <span className="small muted">{count(lines)} line{lines === 1 ? "" : "s"} · at most {count(MAX_EMAILS)}</span>
            </div>
            <textarea id="b-emails" className={`input mono ${fieldErrors.emails ? "invalid" : ""}`} rows={10}
              style={{ height: "auto", padding: 12, resize: "vertical" }} value={emails} disabled={busy} spellCheck={false}
              placeholder={"jane@example.com\nbob@example.org\n…"} onChange={(e) => { setEmails(e.target.value); setFieldErrors({}) }} />
            <span className="small muted">One per line. CSV rows work too (the first field with an @ is taken). Duplicates and bad lines are
              dropped and counted.</span>
            {fieldErrors.emails && <FieldError text={fieldErrors.emails} />}
            <div>
              <input ref={file} type="file" accept=".txt,.csv,text/plain,text/csv" hidden onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = "" }} />
              <button type="button" className="btn" onClick={() => file.current?.click()} disabled={busy}><FileUp />Open a .txt or .csv file</button>
            </div>
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
            <legend className="label" style={{ marginBottom: 6 }}>Servers (the work rotates between them)</legend>
            <div style={{ display: "grid", gap: 6 }}>
              {servers.map((s) => (
                <label key={s.publicId} style={{ display: "flex", gap: 8, alignItems: "flex-start", opacity: s.ready ? 1 : 0.6 }}>
                  <input type="checkbox" disabled={!s.ready || busy} checked={chosen.has(s.publicId)} style={{ marginTop: 3 }}
                    onChange={(e) => setChosen((cur) => {
                      const next = new Set(cur)
                      if (e.target.checked) next.add(s.publicId)
                      else next.delete(s.publicId)
                      return next
                    })} />
                  <span><b>{s.name}</b> <span className="mono small muted">{s.ip}</span>
                    {s.ready ? <span className="small muted"> · greets as <span className="mono">{s.heloHost}</span></span>
                      : <span className="small text-danger"> · {s.reason}</span>}</span>
                </label>
              ))}
            </div>
            {fieldErrors.servers && <FieldError text={fieldErrors.servers} />}
          </fieldset>
          <button className="btn primary" type="submit" disabled={busy}><Play className={busy ? "spin" : undefined} />{busy ? "Starting…" : "Start validation"}</button>
          {error ? <p className="small text-danger" role="alert" style={{ margin: "10px 0 0" }}>{describe(error)}</p> : null}
        </form>
      ) : (
        <p className="muted">Starting a validation needs the Validation run permission. <Link href="/validation/results">See the results</Link></p>
      ))}

      <PacingCard />
    </div>
  )
}
