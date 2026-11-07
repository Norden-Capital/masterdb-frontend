"use client"

import { Check, CircleAlert, CircleDashed, Copy, LoaderCircle, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { RecordsCard } from "@/app/(app)/dns/domains/[id]/records-card"
import { LiveStatus, ProgressRing } from "@/components/md/progress"
import { useSession } from "@/components/md/session"
import { ErrorState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { usePoll } from "@/components/md/use-poll"
import { Banner } from "@/components/md/ui"
import { api } from "@/lib/api"
import { when } from "@/lib/format"
import { dkimRecord, installStatus, isFinished, mergeLog } from "@/lib/mta"
import type { DomainItem, InstallStep, MtaInstall } from "@/lib/types"

/**
 * One MTA install, live from the server: steps done of total (only what the
 * backend reports, never an estimate), each step's state, and the command
 * output with secrets already scrubbed by the backend. The job runs on the
 * backend: closing this page doesn't stop it.
 */
export function InstallJob({ id, onFinished }: { id: string; onFinished?: (job: MtaInstall) => void }) {
  const shown = useRef({ text: "", length: 0 })
  const [log, setLog] = useState("")
  const logBox = useRef<HTMLPreElement>(null)
  const finishedFor = useRef<string | null>(null)

  const poll = usePoll<MtaInstall>(async (signal) => {
    const job = await api<MtaInstall>(`/api/v1/mta/installs/${id}?logFrom=${shown.current.length}`, { signal })
    shown.current = mergeLog(shown.current, job)
    setLog(shown.current.text)
    return job
  }, { interval: 1500, isDone: (j) => isFinished(j.status) })

  const job = poll.data
  useEffect(() => {
    const el = logBox.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight
  }, [log])
  useEffect(() => {
    if (job && isFinished(job.status) && finishedFor.current !== job.publicId) {
      finishedFor.current = job.publicId
      onFinished?.(job)
    }
  }, [job, onFinished])

  if (!job) {
    return poll.error ? <ErrorState title="Couldn't load this install" error={poll.error} onRetry={poll.refresh} /> : <p className="muted">Loading the install…</p>
  }

  const st = installStatus(job.status)
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head" style={{ flexWrap: "wrap" }}><h2>Install on {job.serverName ?? "the server"}</h2>
        <span className="right" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className={`pill ${st.tone}`}>{st.label}</span>
          <LiveStatus status={poll.status} updatedAt={poll.updatedAt} failures={poll.failures} />
        </span>
      </div>
      <div className="card-pad">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <ProgressRing done={job.stepsDone} total={job.stepsTotal} label="Steps" tone={job.status === "FAILED" ? "red" : job.status === "SUCCEEDED" ? "green" : "primary"} />
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6, flex: "1 1 260px" }} aria-label="Steps">
            {job.steps.map((s) => <StepLine key={s.key} step={s} />)}
          </ol>
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          {job.domain} · host name {job.heloHost}{job.webmail ? ` · webmail with mailbox ${job.webmailLogin}` : ""} · started by {job.startedBy ?? "—"} {when(job.startedAt ?? job.createdAt)}
          {job.finishedAt ? ` · finished ${when(job.finishedAt)}` : ""}
        </p>
        {job.error && (
          <Banner tone={job.status === "INTERRUPTED" ? "amber" : "red"} title={job.status === "INTERRUPTED" ? "Interrupted" : "The install stopped"}>
            <p>{job.error}</p>
          </Banner>
        )}
        <details open style={{ marginTop: 12 }}>
          <summary className="label" style={{ cursor: "pointer" }}>Output from the server</summary>
          <pre ref={logBox} className="mono" aria-label="Install output" style={{
            maxHeight: 360, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", background: "var(--surface-2)",
            border: "1px solid var(--border)", borderRadius: 8, padding: 12, margin: "8px 0 0", fontSize: 12,
          }}>{log || "No output yet."}</pre>
        </details>
      </div>
      {job.status === "SUCCEEDED" && job.dkimPublicKey && <DnsHandoff job={job} />}
    </div>
  )
}

function StepLine({ step }: { step: InstallStep }) {
  const icon = step.state === "DONE" ? <Check size={16} color="var(--success)" />
    : step.state === "RUNNING" ? <LoaderCircle size={16} className="spin" />
    : step.state === "FAILED" ? <X size={16} color="var(--destructive)" />
    : <CircleDashed size={16} color="var(--muted-fg)" />
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "center" }} aria-label={`${step.label}: ${step.state.toLowerCase()}`}>
      {icon}<span style={{ fontWeight: step.state === "RUNNING" ? 600 : 400, color: step.state === "PENDING" ? "var(--muted-fg)" : undefined }}>{step.label}</span>
    </li>
  )
}

/**
 * The DKIM key was made on the server and only its public key read back; it is
 * now in the domain's DNS settings. Writing DNS is the DNS module's own flow:
 * preview (before / after), confirm, snapshot, write. Never automatic.
 */
function DnsHandoff({ job }: { job: MtaInstall }) {
  const { can } = useSession()
  const toast = useToast()
  const [domain, setDomain] = useState<DomainItem | null>(null)
  const [error, setError] = useState<unknown>(null)
  const canDns = can("DNS:VIEW")
  useEffect(() => {
    if (!job.domainId || !canDns) return
    api<DomainItem>(`/api/v1/dns/domains/${job.domainId}`).then(setDomain, setError)
  }, [job.domainId, canDns])

  const record = dkimRecord(job.dkimPublicKey!)
  return (
    <div className="card-pad" style={{ borderTop: "1px solid var(--border)" }}>
      <h3 style={{ marginTop: 0 }}>DNS records for {job.domain}</h3>
      <p className="muted">The DKIM key was made on the server; only its public key came back, and it is now this
        domain&apos;s DKIM setting. The domain&apos;s mail IP comes from the linked server. Nothing has been written to DNS yet.</p>
      <div className="field">
        <span className="label">DKIM record: <span className="mono">{job.dkimSelector}._domainkey.{job.domain}</span> TXT</span>
        <pre className="mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, margin: 0, fontSize: 12 }}>{record}</pre>
        <button className="btn" style={{ marginTop: 8 }} onClick={() => navigator.clipboard.writeText(record).then(() => toast("DKIM record copied"))}><Copy />Copy</button>
      </div>
      {!canDns && <p className="muted">Writing the records needs DNS permissions.</p>}
      {error ? <ErrorState title="Couldn't load the domain" error={error} /> : null}
      {domain && domain.source === "NAMECHEAP" && can("DNS:EDIT") && (
        <>
          <p>Review the change (A, MX, SPF from the server&apos;s IP and the new DKIM key; other records are kept), then write it.</p>
          <RecordsCard domain={domain} settingsVersion={0} />
        </>
      )}
      {domain && domain.source !== "NAMECHEAP" && (
        <Banner tone="amber" icon={<CircleAlert />} title="Add the records at this domain's DNS host">
          <p>{domain.name} isn&apos;t on the Namecheap account, so MasterDB can&apos;t write it. Add the DKIM record above, plus A, MX and
            SPF for the server&apos;s IP; the <Link href={`/dns/domains/${domain.publicId}`}>domain page</Link> checks them.</p>
        </Banner>
      )}
    </div>
  )
}
