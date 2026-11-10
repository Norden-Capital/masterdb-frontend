"use client"

import { CloudDownload, LoaderCircle, Plus } from "lucide-react"
import { useState } from "react"

import { ImportModal } from "@/app/(app)/dns/import-modal"
import { useToast } from "@/components/md/toast"
import { FieldError, Sheet } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import { normalizeDomain } from "@/lib/dns"
import type { DomainItem } from "@/lib/types"

/** DNS job 2, as a side sheet over the domain list: add a domain by hand, or pick domains from the Namecheap account. */
export function AddDomainSheet(props: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const toast = useToast()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fetching, setFetching] = useState(false)

  function close() {
    if (busy) return
    setName("")
    setError(null)
    props.onClose()
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!normalizeDomain(name)) {
      setError("Enter a domain like example.com (no http://, no path).")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const d = await api<DomainItem>("/api/v1/dns/domains", { body: { name } })
      toast(`${d.name} added`)
      props.onAdded()
      setBusy(false)
      setName("")
      props.onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.field("name") ?? describe(err) : describe(err))
      setBusy(false)
    }
  }

  return (
    <>
      <Sheet open={props.open && !fetching} onClose={close} title="Add domain"
        footer={<>
          <button className="btn" type="button" onClick={close} disabled={busy}>Cancel</button>
          <button className="btn primary" type="submit" form="add-domain" disabled={busy || !name.trim()}>
            {busy ? <LoaderCircle className="spin" /> : <Plus />}{busy ? "Adding…" : "Add domain"}
          </button>
        </>}>
        <form id="add-domain" className="sheet-section" onSubmit={add} noValidate>
          <h3>By hand</h3>
          <div className="field">
            <label className="label" htmlFor="dom-name">Domain name</label>
            <input id="dom-name" className={`input mono ${error ? "invalid" : ""}`} placeholder="example.com" value={name}
              autoComplete="off" spellCheck={false} onChange={(e) => { setName(e.target.value); setError(null) }} />
            {error && <FieldError text={error} />}
            <span className="help">Any domain, wherever it is registered. Its DNS health can be checked; records can
              only be written for domains on the Namecheap account.</span>
          </div>
        </form>
        <div className="sheet-section">
          <h3>From Namecheap</h3>
          <p className="muted" style={{ margin: "0 0 14px" }}>Lists every domain on the Namecheap account. You choose
            which ones MasterDB may use; nothing is added until you import.</p>
          <button className="btn" type="button" onClick={() => setFetching(true)}><CloudDownload />Fetch from Namecheap</button>
        </div>
      </Sheet>
      {fetching && (
        <ImportModal onClose={() => setFetching(false)} onImported={(r) => {
          toast(`${r.added.length} domain${r.added.length === 1 ? "" : "s"} imported`)
          props.onAdded()
        }} />
      )}
    </>
  )
}
