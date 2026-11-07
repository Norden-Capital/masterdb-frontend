"use client"

import { CloudDownload, Plus } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { ImportModal } from "@/app/(app)/dns/import-modal"
import { useSession } from "@/components/md/session"
import { Forbidden } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Banner, FieldError } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import { normalizeDomain } from "@/lib/dns"
import type { DomainItem, ImportResult } from "@/lib/types"

/** DNS job 2: add a domain by hand, or pick domains from the Namecheap account. */
export default function AddDomainPage() {
  const { can } = useSession()
  const toast = useToast()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState<DomainItem | null>(null)
  const [fetching, setFetching] = useState(false)
  const [imported, setImported] = useState<ImportResult | null>(null)

  useEffect(() => { document.title = "Add domain · MasterDB" }, [])

  if (!can("DNS:CREATE")) return <Forbidden module="DNS management" />

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
      setAdded(d)
      setName("")
      toast(`${d.name} added`)
    } catch (err) {
      setError(err instanceof ApiError ? err.field("name") ?? describe(err) : describe(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Add domain</h1>
        <div className="actions">{can("DNS:VIEW") && <Link className="btn" href="/dns/domains">Domain list</Link>}</div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card-head"><h2>By hand</h2></div>
          <form className="card-pad" onSubmit={add} noValidate>
            <div className="field">
              <label className="label" htmlFor="dom-name">Domain name</label>
              <input id="dom-name" className={`input mono ${error ? "invalid" : ""}`} placeholder="example.com" value={name}
                autoComplete="off" spellCheck={false} onChange={(e) => { setName(e.target.value); setError(null) }} />
              {error && <FieldError text={error} />}
              <span className="help">Any domain, wherever it is registered. Its DNS health can be checked; records can
                only be written for domains on the Namecheap account.</span>
            </div>
            <button className="btn primary" type="submit" disabled={busy || !name.trim()}><Plus />Add domain</button>
            {added && (
              <Banner tone="green" title={`${added.name} added`} style={{ marginTop: 16 }}>
                <Link href={`/dns/domains/${added.publicId}`}>Open it</Link>
              </Banner>
            )}
          </form>
        </div>
        <div className="card">
          <div className="card-head"><h2>From Namecheap</h2></div>
          <div className="card-pad">
            <p className="muted" style={{ marginBottom: 16 }}>Lists every domain on the Namecheap account. You choose
              which ones MasterDB may use; nothing is added until you import.</p>
            <button className="btn" onClick={() => setFetching(true)}><CloudDownload />Fetch from Namecheap</button>
            {imported && (
              <Banner tone="green" title={`${imported.added.length} added, ${imported.updated.length} refreshed`} style={{ marginTop: 16 }}>
                <Link href="/dns/domains">See the domain list</Link>
              </Banner>
            )}
          </div>
        </div>
      </div>
      {fetching && (
        <ImportModal onClose={() => setFetching(false)} onImported={(r) => {
          setImported(r)
          toast(`${r.added.length} domain${r.added.length === 1 ? "" : "s"} imported`)
        }} />
      )}
    </div>
  )
}
