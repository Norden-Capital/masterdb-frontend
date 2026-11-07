"use client"

import { CloudDownload, LoaderCircle, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Banner, Modal } from "@/components/md/ui"
import { api, describe } from "@/lib/api"
import { expiryInfo, importable } from "@/lib/dns"
import type { AccountDomain, ImportResult } from "@/lib/types"

/**
 * "Fetch from Namecheap" (DNS job 2): lists every domain on the account, the
 * user ticks some, only those are imported. Domains already in MasterDB are
 * marked and can't be ticked. Mounted only while open, so each opening
 * fetches the list again.
 */
export function ImportModal(props: { onClose: () => void; onImported: (r: ImportResult) => void }) {
  const [list, setList] = useState<AccountDomain[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState("")
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const today = useMemo(() => new Date(), [])

  useEffect(() => {
    let live = true
    api<AccountDomain[]>("/api/v1/dns/namecheap/domains").then(
      (l) => { if (live) { setError(null); setList(l) } },
      (e) => { if (live) setError(e) },
    )
    return () => { live = false }
  }, [attempt])

  const shown = (list ?? []).filter((d) => d.name.includes(filter.trim().toLowerCase()))
  const open = importable(shown)
  const allOn = open.length > 0 && open.every((n) => picked.has(n))

  function toggle(name: string, on: boolean) {
    const next = new Set(picked)
    if (on) next.add(name)
    else next.delete(name)
    setPicked(next)
  }

  function toggleAll() {
    const next = new Set(picked)
    open.forEach((n) => (allOn ? next.delete(n) : next.add(n)))
    setPicked(next)
  }

  async function submit() {
    if (!picked.size || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await api<ImportResult>("/api/v1/dns/domains/import", { body: { names: [...picked] } })
      props.onImported(result)
      props.onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const retry = () => { setList(null); setError(null); setAttempt(attempt + 1) }
  return (
    <Modal open onClose={props.onClose} size="wide" icon={<CloudDownload />} tone="blue" locked={busy}
      title="Fetch from Namecheap"
      text="Tick the domains MasterDB may use. Only those are added."
      onSubmit={submit}
      footer={<>
        <span className="muted small" style={{ marginRight: "auto" }}>{picked.size} selected</span>
        <button type="button" className="btn" onClick={props.onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn primary" disabled={!picked.size || busy}>
          {busy && <LoaderCircle className="spin" />}Import {picked.size || ""} domain{picked.size === 1 ? "" : "s"}
        </button>
      </>}>
      {error ? (
        <Banner tone="red" title="Namecheap didn't answer as expected">
          <p>{describe(error)}</p>
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={retry}><RefreshCw />Try again</button>
        </Banner>
      ) : null}
      {!list && !error && <p className="muted"><LoaderCircle className="spin" size={14} /> Asking Namecheap for the domain list…</p>}
      {list && list.length === 0 && <p className="muted">Namecheap lists no domains on this account.</p>}
      {list && list.length > 0 && (
        <>
          <div className="field">
            <input className="input" type="search" placeholder={`Filter ${list.length} domains`} value={filter}
              aria-label="Filter Namecheap domains" onChange={(e) => setFilter(e.target.value)} />
          </div>
          <div className="tbl-scroll" style={{ maxHeight: 380, overflowY: "auto" }}>
            <table className="t" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" aria-label="Select all that can be imported" checked={allOn}
                      disabled={!open.length} onChange={toggleAll} />
                  </th>
                  <th>Domain</th><th>Expires</th><th>Auto-renew</th><th>DNS</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => {
                  const exp = expiryInfo(d, today)
                  return (
                    <tr key={d.name} className={d.alreadyAdded ? "muted" : undefined}>
                      <td>
                        <input type="checkbox" aria-label={`Select ${d.name}`} disabled={d.alreadyAdded}
                          checked={d.alreadyAdded || picked.has(d.name)} onChange={(e) => toggle(d.name, e.target.checked)} />
                      </td>
                      <td><b className="mono">{d.name}</b>{d.alreadyAdded && <span className="pill grey" style={{ marginLeft: 8 }}>Already added</span>}</td>
                      <td><span className={`pill ${exp.tone}`}>{exp.label}</span></td>
                      <td>{d.autoRenew ? "On" : "Off"}</td>
                      <td>{d.usesNamecheapDns ? "Namecheap" : <span title="Records can only be written when the domain uses Namecheap DNS">Other</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}
