"use client"

import { LoaderCircle, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { useSession } from "@/components/md/session"
import { ErrorState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { api, describe } from "@/lib/api"
import { when } from "@/lib/format"
import type { DomainItem, HealthReport } from "@/lib/types"
import { HealthPill } from "../health-pill"

/**
 * DNS job 4: green/red per record from public DNS, with the reason. Every
 * domain is also re-checked daily by the backend.
 */
export function HealthCard({ domain, onChecked }: { domain: DomainItem; onChecked: () => void }) {
  const { can } = useSession()
  const toast = useToast()
  const path = `/api/v1/dns/domains/${domain.publicId}/health`
  const [report, setReport] = useState<HealthReport | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api<HealthReport>(path).then((r) => { setError(null); setReport(r) }, setError)
  }, [path])
  useEffect(load, [load])

  async function recheck() {
    setBusy(true)
    try {
      const r = await api<HealthReport>(`${path}/check`, { method: "POST" })
      setReport(r)
      toast(r.status === "OK" ? "DNS looks good" : r.status === "PROBLEM" ? "DNS has problems" : "Some lookups failed",
        r.status === "OK" ? undefined : "bad")
      onChecked()
    } catch (e) {
      toast(describe(e), "bad")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head"><h2>DNS health</h2>
        <span className="right" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {report?.checkedAt && <span className="muted small">Checked {when(report.checkedAt)}</span>}
          {can("DNS:RUN") && (
            <button className="btn" onClick={recheck} disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <RefreshCw />}Re-check
            </button>
          )}
        </span>
      </div>
      <div className="card-pad">
        {error ? <ErrorState title="Couldn't load the health check" error={error} onRetry={load} /> : null}
        {report && report.records.length === 0 && (
          <p className="muted">Not checked yet. It runs daily for every domain{can("DNS:RUN") ? ", or press Re-check" : ""}.</p>
        )}
        {report && report.records.length > 0 && (
          <div className="tbl-scroll">
            <table className="t" style={{ minWidth: 560 }} aria-label="DNS health per record">
              <thead><tr><th>Record</th><th>Result</th><th>Why</th><th>Found</th></tr></thead>
              <tbody>
                {report.records.map((r) => (
                  <tr key={r.record}>
                    <td><b>{r.record}</b></td>
                    <td><HealthPill status={r.status} /></td>
                    <td>{r.detail}{r.expected && r.status !== "OK" && <div className="muted small mono" style={{ wordBreak: "break-all" }}>Expected: {r.expected}</div>}</td>
                    <td className="mono small" style={{ wordBreak: "break-all", maxWidth: 360 }}>{r.found ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="help" style={{ marginTop: 12 }}>Asked of public resolvers (1.1.1.1, 8.8.8.8). After a change,
          public DNS can take up to 30 minutes to follow. Expected values come from Managed records.</p>
      </div>
    </div>
  )
}
