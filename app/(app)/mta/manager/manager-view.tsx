"use client"

import { FileText, Inbox, LoaderCircle, Play, RefreshCw, RotateCcw, RotateCw, Send, Square } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { ConfirmDialog } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { EmptyState, ErrorState, Forbidden, LoadingState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Banner } from "@/components/md/ui"
import { api, describe } from "@/lib/api"
import { when } from "@/lib/format"
import type { MtaItem, MtaLogView, MtaQueue } from "@/lib/types"
import { SelectField } from "@/components/md/select-field"
import { ServicePill } from "../service-pill"

type Act = { service: string; action: "start" | "stop" | "restart" | "reset" }

const ACTION_LABEL: Record<Act["action"], string> = { start: "Start", stop: "Stop", restart: "Restart", reset: "Reset failed" }

/** Server management job 5: per server, start / stop / restart each service, recent logs, mail queue and flush. */
export function ManagerView() {
  const { can } = useSession()
  const router = useRouter()
  const params = useSearchParams()
  const serverId = params.get("server")
  const [list, setList] = useState<MtaItem[] | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (can("MTA:VIEW")) api<MtaItem[]>("/api/v1/mta/servers").then(setList, setError)
  }, [can])
  useEffect(() => { document.title = "MTA manager · MasterDB" }, [])

  if (!can("MTA:VIEW")) return <Forbidden module="MTA" />
  const current = list?.find((m) => m.serverId === serverId) ?? null

  return (
    <div className="page">
      <div className="page-head">
        <h1>MTA manager</h1>
        <div className="actions"><Link className="btn" href="/mta/list">MTA list</Link></div>
      </div>
      {error ? <ErrorState title="Couldn't load the MTAs" error={error} /> : null}
      {!list && !error && <LoadingState />}
      {list && list.length === 0 && (
        <EmptyState icon={<Inbox />} title="No MTA yet" text="Install one first (Install MTA)." />
      )}
      {list && list.length > 0 && (
        <div className="field" style={{ maxWidth: 420 }}>
          <label className="label" htmlFor="mta-server">Server</label>
          <SelectField id="mta-server" className="input" value={serverId ?? ""} onChange={(e) => router.replace(`/mta/manager?server=${e.target.value}`)}>
            <option value="" disabled>Choose a server…</option>
            {list.map((m) => <option key={m.serverId} value={m.serverId}>{m.name} · {m.domain ?? m.ip}</option>)}
          </SelectField>
        </div>
      )}
      {current && <Manager key={current.serverId} initial={current} />}
    </div>
  )
}

function Manager({ initial }: { initial: MtaItem }) {
  const { can } = useSession()
  const toast = useToast()
  const [m, setM] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [confirm, setConfirm] = useState<Act | null>(null)
  const base = `/api/v1/mta/servers/${m.serverId}`

  const refresh = useCallback(async () => {
    setBusy("status")
    setError(null)
    try {
      setM(await api<MtaItem>(`${base}/status`, { method: "POST" }))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }, [base])

  async function act(a: Act) {
    setBusy(`${a.service}:${a.action}`)
    setError(null)
    try {
      setM(await api<MtaItem>(`${base}/services/${a.service}/${a.action}`, { method: "POST" }))
      toast(`${ACTION_LABEL[a.action]}: ${a.service} done`)
    } catch (e) {
      setError(e)
      throw e
    } finally {
      setBusy(null)
    }
  }

  // Stop and restart interrupt mail: confirm first. Start and reset don't.
  const ask = (a: Act) => (a.action === "stop" || a.action === "restart" ? setConfirm(a) : act(a).catch(() => undefined))
  const run = can("MTA:RUN")
  const rows = [...(m.status?.services ?? [{ name: "postfix", state: "unknown" }, { name: "dovecot", state: "unknown" }, { name: "opendkim", state: "unknown" }]), { name: "all", state: "" }]

  return (
    <>
      <div className="card">
        <div className="card-head" style={{ flexWrap: "wrap" }}><h2>Services on {m.name}</h2>
          <span className="right" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="muted small">Read {when(m.checkedAt)}</span>
            <button className="btn" onClick={refresh} disabled={!!busy}>{busy === "status" ? <LoaderCircle className="spin" /> : <RefreshCw />}Refresh</button>
          </span>
        </div>
        <div className="card-pad">
          {error ? <Banner tone="red" title="That didn't work">{describe(error)}</Banner> : null}
          {m.message && <Banner tone="amber" title="Last read failed"><p>{m.message}</p></Banner>}
          {!m.status && <p className="muted">Not read yet: press Refresh.</p>}
          <div className="tbl-scroll">
            <table className="t" aria-label="Services">
              <thead><tr><th>Service</th><th>State</th><th>Version</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.name}>
                    <td><b>{s.name === "all" ? "All three" : s.name}</b></td>
                    <td>{s.name === "all" ? "" : <ServicePill name={s.name} state={s.state} />}</td>
                    <td className="small">{s.name === "all" ? "" : m.status?.versions[s.name] ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {run ? (["start", "stop", "restart", "reset"] as const).map((a) => (
                        <button key={a} className={`btn ${a === "stop" ? "text-danger" : ""}`} style={{ marginRight: 4 }} disabled={!!busy}
                          onClick={() => ask({ service: s.name, action: a })} aria-label={`${ACTION_LABEL[a]} ${s.name}`}>
                          {busy === `${s.name}:${a}` ? <LoaderCircle className="spin" /> : a === "start" ? <Play /> : a === "stop" ? <Square /> : a === "restart" ? <RotateCw /> : <RotateCcw />}
                          {ACTION_LABEL[a]}
                        </button>
                      )) : <span className="muted small">Needs MTA run permission</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: "start", marginTop: 16 }}>
        <QueueCard base={base} canFlush={run} />
        <LogsCard base={base} />
      </div>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} danger={confirm?.action === "stop"}
        icon={confirm?.action === "stop" ? <Square /> : <RotateCw />}
        title={confirm ? `${ACTION_LABEL[confirm.action]} ${confirm.service === "all" ? "all three services" : confirm.service} on ${m.name}?` : ""}
        text={confirm?.action === "stop" ? "Mail stops being received, signed or served until it is started again." : "Mail is interrupted for a few seconds."}
        confirmLabel={confirm ? ACTION_LABEL[confirm.action] : ""} onConfirm={() => confirm ? act(confirm) : undefined} />
    </>
  )
}

function QueueCard({ base, canFlush }: { base: string; canFlush: boolean }) {
  const toast = useToast()
  const [queue, setQueue] = useState<MtaQueue | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [flushing, setFlushing] = useState(false)

  const load = useCallback(() => {
    setBusy(true)
    api<MtaQueue>(`${base}/queue`).then((q) => { setError(null); setQueue(q) }, setError).finally(() => setBusy(false))
  }, [base])

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap" }}><h2>Mail queue</h2>
        <span className="right" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={load} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Inbox />}{queue ? "Read again" : "Read queue"}</button>
          {canFlush && <button className="btn" onClick={() => setFlushing(true)} disabled={busy}><Send />Flush</button>}
        </span>
      </div>
      <div className="card-pad">
        {error ? <ErrorState title="Couldn't read the queue" error={error} onRetry={load} /> : null}
        {!queue && !error && <p className="muted" style={{ margin: 0 }}>Press Read queue to ask the server.</p>}
        {queue && (
          <>
            <p style={{ marginTop: 0 }}><b className="num">{queue.count}</b> message{queue.count === 1 ? "" : "s"} queued <span className="muted small">· read {when(queue.readAt)}</span></p>
            {queue.entries.length > 0 && (
              <div className="tbl-scroll">
                <table className="t" aria-label="Queued messages">
                  <thead><tr><th>Id</th><th>Queue</th><th>Sender</th><th>To</th><th>Why waiting</th></tr></thead>
                  <tbody>{queue.entries.map((e) => (
                    <tr key={e.queueId}><td className="mono small">{e.queueId}</td><td>{e.queue}</td><td className="mono small">{e.sender || "<>"}</td>
                      <td>{e.recipients}</td><td className="small">{e.reason ?? "—"}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmDialog open={flushing} onClose={() => setFlushing(false)} icon={<Send />} title="Flush the mail queue?"
        text="Postfix tries to deliver every queued message now (postqueue -f). Nothing is deleted."
        confirmLabel="Flush queue" onConfirm={async () => {
          const q = await api<MtaQueue>(`${base}/queue/flush`, { method: "POST" })
          setQueue(q)
          toast("Queue flushed")
        }} />
    </div>
  )
}

function LogsCard({ base }: { base: string }) {
  const [source, setSource] = useState("mail")
  const [lines, setLines] = useState(100)
  const [view, setView] = useState<MtaLogView | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    setError(null)
    try {
      setView(await api<MtaLogView>(`${base}/logs?source=${source}&lines=${lines}`))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap" }}><h2>Recent logs</h2></div>
      <div className="card-pad">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <SelectField className="input" style={{ width: "auto" }} aria-label="Log source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="mail">All mail logs</option>
            <option value="postfix">postfix</option>
            <option value="dovecot">dovecot</option>
            <option value="opendkim">opendkim</option>
          </SelectField>
          <SelectField className="input" style={{ width: "auto" }} aria-label="Lines" value={lines} onChange={(e) => setLines(Number(e.target.value))}>
            {[50, 100, 200, 500].map((n) => <option key={n} value={n}>Last {n} lines</option>)}
          </SelectField>
          <button className="btn" onClick={load} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <FileText />}Show</button>
        </div>
        {error ? <ErrorState title="Couldn't read the logs" error={error} /> : null}
        {view && (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>{view.source}, last {view.lines} lines, read {when(view.readAt)}</p>
            <pre className="mono" aria-label="Log lines" style={{ maxHeight: 360, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
              background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, margin: 0, fontSize: 12 }}>
              {view.text || "No log lines."}
            </pre>
          </>
        )}
      </div>
    </div>
  )
}
