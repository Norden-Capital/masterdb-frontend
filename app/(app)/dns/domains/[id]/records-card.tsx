"use client"

import { Eye, History, LoaderCircle, RotateCcw, Upload } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { ConfirmDialog } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { useToast } from "@/components/md/toast"
import { Banner } from "@/components/md/ui"
import { api, describe } from "@/lib/api"
import { changeCounts, recordLine } from "@/lib/dns"
import { when } from "@/lib/format"
import type { DnsSnapshot, DomainItem, RecordPlan, WriteResult } from "@/lib/types"

/**
 * DNS job 3: write the managed records at Namecheap. Always a preview first
 * (Namecheap's setHosts replaces every record, so MasterDB reads, merges and
 * shows the before/after), then a confirm. Each write saves the previous
 * records as a snapshot that can be restored the same way.
 */
export function RecordsCard({ domain, settingsVersion }: { domain: DomainItem; settingsVersion: number }) {
  const { can } = useSession()
  const toast = useToast()
  const base = `/api/v1/dns/domains/${domain.publicId}`
  const [plan, setPlan] = useState<RecordPlan | null>(null)
  const [restoreOf, setRestoreOf] = useState<DnsSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<WriteResult | null>(null)
  const [snapshots, setSnapshots] = useState<DnsSnapshot[] | null>(null)

  const loadSnapshots = useCallback(() => {
    api<DnsSnapshot[]>(`${base}/snapshots`).then(setSnapshots, () => setSnapshots([]))
  }, [base])
  useEffect(loadSnapshots, [loadSnapshots])
  // Settings changed: an open preview is out of date.
  const [seen, setSeen] = useState(settingsVersion)
  if (seen !== settingsVersion) {
    setSeen(settingsVersion)
    setPlan(null)
  }

  async function preview(snapshot: DnsSnapshot | null) {
    setBusy(true)
    setError(null)
    setResult(null)
    setPlan(null)
    setRestoreOf(snapshot)
    try {
      setPlan(await api<RecordPlan>(snapshot ? `${base}/snapshots/${snapshot.publicId}/restore-preview` : `${base}/records/preview`))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  async function write() {
    if (!plan) return
    const r = await api<WriteResult>(restoreOf ? `${base}/snapshots/${restoreOf.publicId}/restore` : `${base}/records/apply`,
      { body: { token: plan.token } })
    setResult(r)
    setPlan(null)
    toast(restoreOf ? "Records restored at Namecheap" : "Records written to Namecheap", r.verified ? undefined : "bad")
    loadSnapshots()
  }

  const counts = plan ? changeCounts(plan.changes) : null
  const canWrite = can("DNS:EDIT")
  const namecheap = domain.source === "NAMECHEAP"
  return (
    <div className="card">
      <div className="card-head"><h2>Records at Namecheap</h2>
        {namecheap && canWrite && (
          <span className="right">
            <button className="btn" onClick={() => preview(null)} disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <Eye />}Preview changes
            </button>
          </span>
        )}
      </div>
      <div className="card-pad">
        {!namecheap && <p className="muted">This domain was added by hand. Records can only be written for domains on the Namecheap account (fetch it from Namecheap to switch).</p>}
        {namecheap && !canWrite && <p className="muted">You can see snapshots; writing records needs DNS edit permission.</p>}
        {error ? <Banner tone="red" title="Couldn't prepare the change">{describe(error)}</Banner> : null}
        {result && (
          <Banner tone={result.verified ? "green" : "amber"} title={result.verified ? "Namecheap has the new records" : "Written, but Namecheap didn't return every record"}>
            {result.verified ? <p>Public DNS can take up to 30 minutes to follow.</p>
              : <p>Missing: {result.missing.map(recordLine).join(" · ")}</p>}
          </Banner>
        )}
        {plan && counts && (
          <>
            <Banner tone="blue" title={restoreOf ? `Restore the snapshot from ${when(restoreOf.createdAt)}` : "Before / after"}>
              <p>{counts.add} to add, {counts.remove} to remove, {counts.keep} kept. Records MasterDB doesn&apos;t manage are always kept.</p>
              {plan.warnings.map((w) => <p key={w}>{w}</p>)}
            </Banner>
            <div className="tbl-scroll" style={{ marginTop: 12 }}>
              <table className="t" style={{ minWidth: 560 }} aria-label="Record changes">
                <thead><tr><th>Change</th><th>Host</th><th>Type</th><th>Value</th><th>TTL</th></tr></thead>
                <tbody>
                  {plan.changes.map((c, i) => (
                    <tr key={i} style={c.change === "REMOVE" ? { textDecoration: "line-through", opacity: 0.75 } : undefined}>
                      <td><span className={`pill ${c.change === "ADD" ? "green" : c.change === "REMOVE" ? "red" : "grey"}`}>
                        {c.change === "ADD" ? "Add" : c.change === "REMOVE" ? "Remove" : c.managed ? "Unchanged" : "Kept (not managed)"}</span></td>
                      <td className="mono">{c.record.name}</td>
                      <td className="mono">{c.record.type}{c.record.type === "MX" && c.record.mxPref ? ` ${c.record.mxPref}` : ""}</td>
                      <td className="mono" style={{ wordBreak: "break-all", maxWidth: 420 }}>{c.record.address}</td>
                      <td className="mono">{c.record.ttl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn primary" onClick={() => setConfirm(true)} disabled={counts.add + counts.remove === 0}>
                <Upload />{restoreOf ? "Restore at Namecheap" : "Write to Namecheap"}
              </button>
              <button className="btn" onClick={() => setPlan(null)}>Cancel</button>
              {counts.add + counts.remove === 0 && <span className="muted small" style={{ alignSelf: "center" }}>Nothing to change.</span>}
            </div>
          </>
        )}

        <h3 style={{ margin: "20px 0 8px", display: "flex", gap: 6, alignItems: "center" }}><History size={16} />Snapshots</h3>
        {snapshots === null ? <p className="muted">Loading…</p>
          : snapshots.length === 0 ? <p className="muted">None yet. Each write saves the records it replaced here.</p>
          : (
            <ul className="plain" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {snapshots.map((s) => (
                <li key={s.publicId} style={{ display: "flex", gap: 12, alignItems: "center", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                  <span>{when(s.createdAt)}</span>
                  <span className="muted small">{s.reason === "BEFORE_RESTORE" ? "before a restore" : "before a write"} · {s.recordCount} records · {s.actorLabel ?? "—"}</span>
                  {namecheap && canWrite && (
                    <button className="btn" style={{ marginLeft: "auto" }} onClick={() => preview(s)} disabled={busy}><RotateCcw />Restore…</button>
                  )}
                </li>
              ))}
            </ul>
          )}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} icon={<Upload />}
        title={restoreOf ? `Restore ${domain.name} at Namecheap?` : `Write records for ${domain.name}?`}
        text={counts ? `${counts.add} added, ${counts.remove} removed. Namecheap replaces the whole record set with the "after" list; the current records are saved as a snapshot first.` : undefined}
        confirmLabel={restoreOf ? "Restore" : "Write records"} onConfirm={write} />
    </div>
  )
}
