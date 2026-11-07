"use client"

import { Pencil } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { ModalForm } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { useToast } from "@/components/md/toast"
import { FieldError } from "@/components/md/ui"
import { api, ApiError } from "@/lib/api"
import type { ServerItem } from "@/lib/types"

/**
 * Server management job 3: the linked domain gives this server its mail
 * identity. Validation will greet (HELO) and send (MAIL FROM) with these, and
 * the server's reverse DNS must equal the HELO host.
 */
export function IdentityCard({ server, onChange }: { server: ServerItem; onChange: (s: ServerItem) => void }) {
  const { can } = useSession()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [helo, setHelo] = useState("")
  const [from, setFrom] = useState("")
  const [fields, setFields] = useState<ApiError | null>(null)

  async function save(): Promise<boolean | void> {
    setFields(null)
    try {
      const s = await api<ServerItem>(`/api/v1/servers/${server.publicId}/identity`, { method: "PUT", body: { heloHost: helo, mailFrom: from } })
      onChange(s)
      toast("Identity saved")
    } catch (e) {
      if (e instanceof ApiError && e.fields.length) {
        setFields(e)
        return false
      }
      throw e
    }
  }

  const d = server.domain
  return (
    <div className="card">
      <div className="card-head"><h2>Domain and probe identity</h2>
        {d && can("SERVERS:EDIT") && (
          <span className="right"><button className="btn" onClick={() => {
            setHelo(server.heloHost ?? ""); setFrom(server.mailFrom ?? ""); setFields(null); setEditing(true)
          }}><Pencil />Edit</button></span>
        )}
      </div>
      <div className="card-pad">
        {!d ? (
          <p className="muted" style={{ margin: 0 }}>No domain linked. Link one (Edit at the top) so this server gets a HELO
            host and sender on it, and gives the domain its mail IP.</p>
        ) : (
          <>
            <dl className="kv">
              <div><dt>Linked domain</dt><dd className="mono">{can("DNS:VIEW") ? <Link href={`/dns/domains/${d.publicId}`}>{d.name}</Link> : d.name}</dd></div>
              <div><dt>HELO host</dt><dd className="mono">{server.heloHost}</dd></div>
              <div><dt>MAIL FROM</dt><dd className="mono">{server.mailFrom}</dd></div>
              <div><dt>Reverse DNS (PTR) of {server.ip} must be</dt><dd className="mono">{server.heloHost}</dd></div>
            </dl>
            <p className="help" style={{ marginTop: 12 }}>Validation will use these from this server. The domain&apos;s managed
              records take their mail IP ({server.ip}) from here, and its DNS health checks the PTR.</p>
          </>
        )}
      </div>
      <ModalForm open={editing} onClose={() => setEditing(false)} onSubmit={save} title="Probe identity" icon={<Pencil />}
        submitLabel="Save" text={d ? `Both must be on ${d.name} (or a host under it).` : undefined}>
        <div className="field">
          <label className="label" htmlFor="id-helo">HELO host</label>
          <input id="id-helo" className={`input mono ${fields?.field("heloHost") ? "invalid" : ""}`} value={helo}
            onChange={(e) => setHelo(e.target.value)} autoComplete="off" spellCheck={false} placeholder={d ? `mail.${d.name}` : ""} />
          {fields?.field("heloHost") ? <FieldError text={fields.field("heloHost")!} /> : <span className="help">Set the VPS&apos;s reverse DNS to this name.</span>}
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label" htmlFor="id-from">MAIL FROM</label>
          <input id="id-from" className={`input mono ${fields?.field("mailFrom") ? "invalid" : ""}`} value={from}
            onChange={(e) => setFrom(e.target.value)} autoComplete="off" spellCheck={false} placeholder={d ? `postmaster@${d.name}` : ""} />
          {fields?.field("mailFrom") && <FieldError text={fields.field("mailFrom")!} />}
        </div>
      </ModalForm>
    </div>
  )
}
