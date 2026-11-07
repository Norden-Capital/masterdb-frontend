"use client"

import { LoaderCircle, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { useSession } from "@/components/md/session"
import { ErrorState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { api, describe } from "@/lib/api"
import { when } from "@/lib/format"
import { CHECK_LABELS } from "@/lib/servers"
import type { ServerHealthReport, ServerItem } from "@/lib/types"
import { ServerHealthPill } from "../../server-health-pill"

/**
 * Server management job 2: green/red per check with the reason. SSH and port
 * 25 run on the VPS over SSH; PTR and blocklists from MasterDB; plus the plan
 * expiry. Every server is also re-checked daily.
 */
export function ServerHealthCard({ server, onChecked }: { server: ServerItem; onChecked: () => void }) {
  const { can } = useSession()
  const toast = useToast()
  const path = `/api/v1/servers/${server.publicId}/health`
  const [report, setReport] = useState<ServerHealthReport | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api<ServerHealthReport>(path).then((r) => { setError(null); setReport(r) }, setError)
  }, [path])
  useEffect(load, [load])

  async function recheck() {
    setBusy(true)
    try {
      const r = await api<ServerHealthReport>(`${path}/check`, { method: "POST" })
      setReport(r)
      toast(r.status === "OK" ? "All checks passed" : r.status === "PROBLEM" ? "Some checks failed"
        : r.status === "WARNING" ? "Passed, with a warning" : "Some checks couldn't run", r.status === "OK" ? undefined : "bad")
      onChecked()
    } catch (e) {
      toast(describe(e), "bad")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head"><h2>Health</h2>
        <span className="right" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {report?.checkedAt && <span className="muted small">Checked {when(report.checkedAt)}</span>}
          {can("SERVERS:RUN") && (
            <button className="btn" onClick={recheck} disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <RefreshCw />}{busy ? "Checking…" : "Re-check"}
            </button>
          )}
        </span>
      </div>
      <div className="card-pad">
        {error ? <ErrorState title="Couldn't load the health check" error={error} onRetry={load} /> : null}
        {busy && <p className="muted small">Running on the server; a blocked port 25 takes up to about 40 seconds to show.</p>}
        {report && report.checks.length === 0 && (
          <p className="muted">Not checked yet. It runs daily for every server{can("SERVERS:RUN") ? ", or press Re-check" : ""}.</p>
        )}
        {report && report.checks.length > 0 && (
          <div className="tbl-scroll">
            <table className="t" style={{ minWidth: 560 }} aria-label="Health per check">
              <thead><tr><th>Check</th><th>Result</th><th>Why</th></tr></thead>
              <tbody>
                {report.checks.map((c) => (
                  <tr key={c.check}>
                    <td><b>{CHECK_LABELS[c.check] ?? c.check}</b></td>
                    <td><ServerHealthPill status={c.status} /></td>
                    <td>{c.detail}{c.check === "DNSBL" && c.found && (
                      <details style={{ marginTop: 4 }}><summary className="muted small">Each list</summary>
                        <ul className="small" style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                          {c.found.split("; ").map((l) => <li key={l}>{l}</li>)}
                        </ul>
                      </details>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="help" style={{ marginTop: 12 }}>Port 25 is tested from the VPS to Gmail, Yahoo and Outlook MX hosts.
          Blocklists: Spamhaus ZEN, Barracuda, SpamCop, PSBL, UCEPROTECT, Mailspike; a list that refuses to answer shows as
          &quot;couldn&apos;t check&quot;, never as clean. A plan ending within 14 days is a warning.</p>
      </div>
    </div>
  )
}
