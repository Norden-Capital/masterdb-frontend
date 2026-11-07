"use client"

import { PackagePlus, RotateCcw, Server } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { useSession } from "@/components/md/session"
import { EmptyState, ErrorState, Forbidden, LoadingState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Banner, FieldError, PasswordField } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import { when } from "@/lib/format"
import { installStatus } from "@/lib/mta"
import type { MtaCandidate, MtaInstall } from "@/lib/types"
import { InstallJob } from "../install-job"

const WHAT = [
  "Check the OS (Ubuntu 22.04 / 24.04, AlmaLinux 8 / 9 / 10)",
  "Install Postfix, Dovecot (IMAP) and OpenDKIM",
  "Set the host name to the server's HELO host",
  "Configure Postfix for the linked domain",
  "Make the DKIM key on the server (selector mail), once",
  "Configure OpenDKIM signing",
  "Start the services",
  "Read back the DKIM public key, and put it in the domain's DNS settings",
]

/** Server management job 4: install the MTA on a server as a background job. */
export function InstallView() {
  const { can } = useSession()
  const toast = useToast()
  const router = useRouter()
  const params = useSearchParams()
  const serverId = params.get("server")
  const jobId = params.get("job")
  const [list, setList] = useState<MtaCandidate[] | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(() => {
    api<MtaCandidate[]>("/api/v1/mta/candidates").then((l) => { setError(null); setList(l) }, setError)
  }, [])
  useEffect(() => {
    if (can("MTA:VIEW")) load()
  }, [can, load])
  useEffect(() => { document.title = "Install MTA · MasterDB" }, [])

  if (!can("MTA:CREATE")) return <Forbidden module="MTA" />

  const chosen = list?.find((c) => c.publicId === serverId) ?? null
  const running = chosen?.lastInstallStatus === "RUNNING" || chosen?.lastInstallStatus === "QUEUED"
  const shownJob = jobId ?? (chosen?.lastInstallId ?? null)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Install MTA</h1>
        <div className="actions">{can("SERVERS:VIEW") && <Link className="btn" href="/servers/list">Server list</Link>}</div>
      </div>
      {error ? <ErrorState title="Couldn't load the servers" error={error} onRetry={load} /> : null}
      {!list && !error && <LoadingState />}
      {list && list.length === 0 && (
        <EmptyState icon={<Server />} title="No servers yet" text="Add a VPS and connect to it first."
          action={can("SERVERS:CREATE") && <Link className="btn primary" href="/servers/add">Add VPS server</Link>} />
      )}
      {list && list.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>1. Choose a server</h2></div>
          <div className="tbl-scroll">
            <table className="t" aria-label="Servers">
              <thead><tr><th>Server</th><th>Domain / host name</th><th>OS</th><th>Ready?</th><th>MTA</th><th /></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.publicId} aria-selected={c.publicId === serverId} style={c.publicId === serverId ? { background: "var(--surface-2)" } : undefined}>
                    <td><b>{c.name}</b><div className="muted small mono">{c.ip}</div></td>
                    <td className="mono">{c.domain ?? <span className="muted">—</span>}{c.heloHost && <div className="muted small">{c.heloHost}</div>}</td>
                    <td>{c.os ?? <span className="muted">—</span>}</td>
                    <td>{c.ready ? <span className="pill green">Ready</span> : <span className="small">{c.reason}</span>}</td>
                    <td>{c.mtaInstalledAt ? <span className="pill green">Installed {when(c.mtaInstalledAt)}</span>
                      : c.lastInstallStatus ? <span className={`pill ${installStatus(c.lastInstallStatus).tone}`}>{installStatus(c.lastInstallStatus).label}</span>
                      : <span className="muted">None</span>}</td>
                    <td><button className="btn" onClick={() => router.replace(`/mta/install?server=${c.publicId}`)}>Choose</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {chosen && !running && !jobId && (
        <StartForm key={chosen.publicId} server={chosen} onStarted={(job) => {
          toast("Install started")
          load()
          router.replace(`/mta/install?server=${chosen.publicId}&job=${job.publicId}`)
        }} />
      )}
      {chosen && shownJob && (
        <InstallJob key={shownJob} id={shownJob} onFinished={() => load()} />
      )}
      {chosen && jobId && !running && (
        <p style={{ marginTop: 12 }}><button className="btn" onClick={() => router.replace(`/mta/install?server=${chosen.publicId}`)}>
          <RotateCcw />Run the install again…</button></p>
      )}
    </div>
  )
}

function StartForm({ server, onStarted }: { server: MtaCandidate; onStarted: (job: MtaInstall) => void }) {
  const { can } = useSession()
  const [webmail, setWebmail] = useState(false)
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [fields, setFields] = useState<ApiError | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const rerun = !!server.mtaInstalledAt

  async function start(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setFields(null)
    setError(null)
    try {
      const job = await api<MtaInstall>("/api/v1/mta/installs", {
        body: { serverId: server.publicId, webmail, webmailLogin: webmail ? login : null, webmailPassword: webmail ? password : null },
      })
      setPassword("")
      onStarted(job)
    } catch (err) {
      if (err instanceof ApiError && err.fields.length) setFields(err)
      else setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" style={{ marginTop: 16 }} onSubmit={start} noValidate>
      <div className="card-head"><h2>2. Install on {server.name}</h2></div>
      <div className="card-pad">
        {!server.ready && <Banner tone="amber" title="This server isn't ready">{server.reason}</Banner>}
        {error ? <Banner tone="red" title="Couldn't start">{describe(error)}</Banner> : null}
        {server.ready && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>For <span className="mono">{server.domain}</span>, host name <span className="mono">{server.heloHost}</span>.
              Each step is safe to run again. The install runs on MasterDB: you can close this page.</p>
            <ol className="small" style={{ margin: "0 0 16px", paddingLeft: 20 }}>{WHAT.map((w) => <li key={w}>{w}</li>)}</ol>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <input type="checkbox" checked={webmail} onChange={(e) => setWebmail(e.target.checked)} />
              Also install Roundcube webmail with one mailbox (as the old app did)
            </label>
            {webmail && (
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label className="label" htmlFor="wm-login">Mailbox login</label>
                  <input id="wm-login" className={`input mono ${fields?.field("webmailLogin") ? "invalid" : ""}`} value={login}
                    onChange={(e) => setLogin(e.target.value)} autoComplete="off" spellCheck={false} placeholder="anna" />
                  {fields?.field("webmailLogin") && <FieldError text={fields.field("webmailLogin")!} />}
                </div>
                <PasswordField id="wm-pass" label="Mailbox password" value={password} onChange={setPassword}
                  error={fields?.field("webmailPassword")} autoComplete="new-password" />
              </div>
            )}
            {webmail && (
              <p className="help" style={{ marginTop: 0 }}>12+ characters. Sent to the server once for this install and never stored by MasterDB.</p>
            )}
            {rerun && !can("MTA:EDIT") && <p className="muted">This server already has an MTA: running the install again needs the MTA edit permission.</p>}
            <button className="btn primary" type="submit" disabled={busy || (rerun && !can("MTA:EDIT"))}>
              <PackagePlus />{busy ? "Starting…" : rerun ? "Run the install again" : "Install MTA"}
            </button>
          </>
        )}
      </div>
    </form>
  )
}
