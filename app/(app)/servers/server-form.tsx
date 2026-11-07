"use client"

import { useEffect, useState } from "react"

import { useSession } from "@/components/md/session"
import { FieldError } from "@/components/md/ui"
import { api, ApiError } from "@/lib/api"
import { validIpv4, validUser } from "@/lib/servers"
import type { DomainItem, Page, ServerItem } from "@/lib/types"

export type ServerFormValue = {
  name: string
  ip: string
  sshPort: string
  sshUser: string
  expiresOn: string
  notes: string
  domainId: string
}

export const EMPTY_SERVER: ServerFormValue = { name: "", ip: "", sshPort: "22", sshUser: "root", expiresOn: "", notes: "", domainId: "" }

export function formOf(s: ServerItem): ServerFormValue {
  return {
    name: s.name, ip: s.ip, sshPort: String(s.sshPort), sshUser: s.sshUser, expiresOn: s.expiresOn,
    notes: s.notes ?? "", domainId: s.domain?.publicId ?? "",
  }
}

/** The request body; the backend checks everything again. */
export function bodyOf(v: ServerFormValue) {
  return {
    name: v.name.trim(), ip: v.ip.trim(), sshPort: Number(v.sshPort) || null, sshUser: v.sshUser.trim(),
    expiresOn: v.expiresOn || null, notes: v.notes.trim() || null, domainId: v.domainId || null,
  }
}

/** Quick checks before sending; field → message. */
export function localErrors(v: ServerFormValue): Record<string, string> {
  const e: Record<string, string> = {}
  if (!v.name.trim()) e.name = "Enter a name."
  if (!validIpv4(v.ip)) e.ip = "Enter the server's public IPv4, like 203.0.113.10."
  const port = Number(v.sshPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) e.sshPort = "1 to 65535."
  if (!validUser(v.sshUser.trim())) e.sshUser = "A Linux user name, like root."
  if (!v.expiresOn) e.expiresOn = "Enter the date the VPS plan ends."
  return e
}

/** Field messages from a 400 VALIDATION_FAILED. */
export function serverErrors(err: unknown): Record<string, string> | null {
  if (!(err instanceof ApiError) || !err.fields.length) return null
  return Object.fromEntries(err.fields.map((f) => [f.field, f.message]))
}

/** Domains for the "linked domain" select (needs DNS view; otherwise the select is not shown). */
function useDomainOptions(): DomainItem[] | null {
  const { can } = useSession()
  const [list, setList] = useState<DomainItem[] | null>(null)
  const allowed = can("DNS:VIEW")
  useEffect(() => {
    if (!allowed) return
    api<Page<DomainItem>>("/api/v1/dns/domains?size=100&sort=name").then((p) => setList(p.items), () => setList([]))
  }, [allowed])
  return allowed ? list : null
}

export function ServerFields(props: {
  value: ServerFormValue
  onChange: (v: ServerFormValue) => void
  errors: Record<string, string>
  /** Shown when the user can't list domains but the server has one. */
  currentDomain?: string
}) {
  const domains = useDomainOptions()
  const { value: v, errors } = props
  const set = (k: keyof ServerFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    props.onChange({ ...v, [k]: e.target.value })
  return (
    <>
      <div className="field">
        <label className="label" htmlFor="srv-name">Name</label>
        <input id="srv-name" className={`input ${errors.name ? "invalid" : ""}`} value={v.name} onChange={set("name")}
          placeholder="Probe 1 (Contabo)" autoComplete="off" />
        {errors.name && <FieldError text={errors.name} />}
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="srv-ip">Public IPv4</label>
          <input id="srv-ip" className={`input mono ${errors.ip ? "invalid" : ""}`} value={v.ip} onChange={set("ip")}
            placeholder="203.0.113.10" autoComplete="off" spellCheck={false} inputMode="decimal" />
          {errors.ip && <FieldError text={errors.ip} />}
        </div>
        <div className="field">
          <label className="label" htmlFor="srv-exp">VPS plan ends</label>
          <input id="srv-exp" type="date" className={`input ${errors.expiresOn ? "invalid" : ""}`} value={v.expiresOn}
            onChange={set("expiresOn")} />
          {errors.expiresOn && <FieldError text={errors.expiresOn} />}
        </div>
        <div className="field">
          <label className="label" htmlFor="srv-port">SSH port</label>
          <input id="srv-port" className={`input mono ${errors.sshPort ? "invalid" : ""}`} value={v.sshPort}
            onChange={set("sshPort")} inputMode="numeric" />
          {errors.sshPort && <FieldError text={errors.sshPort} />}
        </div>
        <div className="field">
          <label className="label" htmlFor="srv-user">SSH user</label>
          <input id="srv-user" className={`input mono ${errors.sshUser ? "invalid" : ""}`} value={v.sshUser}
            onChange={set("sshUser")} autoComplete="off" spellCheck={false} />
          {errors.sshUser && <FieldError text={errors.sshUser} />}
          <span className="help">root, or a user with passwordless sudo (needed for the MTA).</span>
        </div>
      </div>
      {domains !== null ? (
        <div className="field">
          <label className="label" htmlFor="srv-domain">Linked domain (optional)</label>
          <select id="srv-domain" className={`input ${errors.domainId ? "invalid" : ""}`} value={v.domainId} onChange={set("domainId")}>
            <option value="">None</option>
            {(domains ?? []).map((d) => <option key={d.publicId} value={d.publicId}>{d.name}</option>)}
          </select>
          {errors.domainId && <FieldError text={errors.domainId} />}
          <span className="help">Its mail host and sender become this server&apos;s identity; one server per domain.</span>
        </div>
      ) : props.currentDomain ? (
        <p className="help">Linked domain: <span className="mono">{props.currentDomain}</span> (changing it needs DNS view permission).</p>
      ) : null}
      <div className="field" style={{ marginBottom: 0 }}>
        <label className="label" htmlFor="srv-notes">Notes (optional)</label>
        <textarea id="srv-notes" className={`input ${errors.notes ? "invalid" : ""}`} rows={3} value={v.notes} onChange={set("notes")} />
        {errors.notes && <FieldError text={errors.notes} />}
      </div>
    </>
  )
}
