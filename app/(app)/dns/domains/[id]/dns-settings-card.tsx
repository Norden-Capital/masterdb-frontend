"use client"

import { Pencil } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { ModalForm } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { ErrorState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { FieldError } from "@/components/md/ui"
import { api, ApiError } from "@/lib/api"
import { dkimKey } from "@/lib/dns"
import { when } from "@/lib/format"
import type { DnsSettings, DomainItem } from "@/lib/types"
import { SelectField } from "@/components/md/select-field"

/**
 * What the managed records should say (DNS job 3), used both to write them at
 * Namecheap and (job 4) to check public DNS. Any domain may have these.
 */
export function DnsSettingsCard(props: { domain: DomainItem; onSaved: () => void }) {
  const { can } = useSession()
  const toast = useToast()
  const [settings, setSettings] = useState<DnsSettings | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [editing, setEditing] = useState(false)
  const path = `/api/v1/dns/domains/${props.domain.publicId}/dns-settings`

  const load = useCallback(() => {
    api<DnsSettings>(path).then((s) => { setError(null); setSettings(s) }, setError)
  }, [path])
  useEffect(load, [load])

  return (
    <div className="card">
      <div className="card-head"><h2>Managed records</h2>
        {settings && can("DNS:EDIT") && (
          <span className="right"><button className="btn" onClick={() => setEditing(true)}><Pencil />Edit</button></span>
        )}
      </div>
      <div className="card-pad">
        {error ? <ErrorState title="Couldn't load the settings" error={error} onRetry={load} /> : null}
        {settings && (
          <dl className="kv">
            <div><dt>Mail server IP</dt><dd className="mono">{settings.mailIp ?? <span className="muted">Not set</span>}
              {settings.mailServer && <span className="muted small" style={{ fontFamily: "inherit" }}> from server{" "}
                {can("SERVERS:VIEW") ? <Link href={`/servers/list/${settings.mailServer.publicId}`}>{settings.mailServer.name}</Link> : settings.mailServer.name}</span>}
            </dd></div>
            <div><dt>DKIM selector</dt><dd className="mono">{settings.dkimSelector}</dd></div>
            <div><dt>DKIM public key</dt><dd>{settings.dkimPublicKey
              ? <span className="mono" title={settings.dkimPublicKey}>{settings.dkimPublicKey.slice(0, 24)}… ({settings.dkimPublicKey.length} chars)</span>
              : <span className="muted">Not set: no DKIM record is written</span>}</dd></div>
            <div><dt>DMARC policy</dt><dd className="mono">{settings.dmarcPolicy}</dd></div>
            <div><dt>BIMI logo</dt><dd className="mono" style={{ wordBreak: "break-all" }}>{settings.bimiLogoUrl ?? <span className="muted">None (optional)</span>}</dd></div>
            {settings.bimiLogoUrl && <div><dt>BIMI certificate</dt><dd className="mono" style={{ wordBreak: "break-all" }}>{settings.bimiCertificateUrl ?? "—"}</dd></div>}
            {settings.updatedAt && <div><dt>Changed</dt><dd>{when(settings.updatedAt)}</dd></div>}
          </dl>
        )}
        <p className="help" style={{ marginTop: 12 }}>
          Written as: A for @, mail and webmail; MX 10 mail.{props.domain.name}.; SPF v=spf1 ip4:IP -all;
          DKIM at &lt;selector&gt;._domainkey; DMARC at _dmarc; BIMI at default._bimi. TTL 1800.
        </p>
      </div>
      {editing && settings && (
        <SettingsForm path={path} settings={settings} onClose={() => setEditing(false)}
          onSaved={(s) => { setSettings(s); toast("Managed records saved"); props.onSaved() }} />
      )}
    </div>
  )
}

function SettingsForm(props: { path: string; settings: DnsSettings; onClose: () => void; onSaved: (s: DnsSettings) => void }) {
  const s = props.settings
  const [mailIp, setMailIp] = useState(s.mailIp ?? "")
  const [selector, setSelector] = useState(s.dkimSelector)
  const [key, setKey] = useState(s.dkimPublicKey ?? "")
  const [policy, setPolicy] = useState(s.dmarcPolicy)
  const [logo, setLogo] = useState(s.bimiLogoUrl ?? "")
  const [cert, setCert] = useState(s.bimiCertificateUrl ?? "")
  const [fields, setFields] = useState<ApiError | null>(null)

  async function submit() {
    setFields(null)
    try {
      props.onSaved(await api<DnsSettings>(props.path, {
        method: "PUT",
        body: { mailIp, dkimSelector: selector, dkimPublicKey: dkimKey(key), dmarcPolicy: policy, bimiLogoUrl: logo, bimiCertificateUrl: cert },
      }))
    } catch (e) {
      if (e instanceof ApiError && e.fields.length) {
        setFields(e)
        return false
      }
      throw e
    }
  }

  const err = (f: string) => fields?.field(f)
  const input = (id: string, label: string, value: string, set: (v: string) => void, help?: string, placeholder?: string) => (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className={`input mono ${err(id) ? "invalid" : ""}`} value={value} placeholder={placeholder}
        autoComplete="off" spellCheck={false} onChange={(e) => set(e.target.value)} />
      {err(id) ? <FieldError text={err(id)!} /> : help ? <span className="help">{help}</span> : null}
    </div>
  )

  return (
    <ModalForm open onClose={props.onClose} onSubmit={submit} title="Managed records" size="wide" icon={<Pencil />}
      text="Saving changes nothing at Namecheap. Preview and write the records afterwards." submitLabel="Save">
      {s.mailServer ? (
        <div className="field">
          <span className="label">Mail server IP</span>
          <p className="mono" style={{ margin: 0 }}>{s.mailServer.ip}</p>
          <span className="help">From the linked server {s.mailServer.name}. Unlink it (Server management) to type an IP here.</span>
        </div>
      ) : input("mailIp", "Mail server IP (IPv4)", mailIp, setMailIp, "Used for A @/mail/webmail and SPF. Linking a server to this domain fills it from the server.", "203.0.113.10")}
      {input("dkimSelector", "DKIM selector", selector, setSelector, "The old app used \"mail\".")}
      <div className="field">
        <label className="label" htmlFor="dkimPublicKey">DKIM public key <span className="muted">(optional)</span></label>
        <textarea id="dkimPublicKey" className={`input mono ${err("dkimPublicKey") ? "invalid" : ""}`} rows={4} value={key}
          spellCheck={false} placeholder="MIIBIjANBgkqh… or the whole v=DKIM1; k=rsa; p=… record"
          onChange={(e) => setKey(e.target.value)} style={{ height: "auto", paddingTop: 8 }} />
        {err("dkimPublicKey") ? <FieldError text={err("dkimPublicKey")!} />
          : <span className="help">Filled by Install MTA (the key is made on the server), or paste one from another mail server.</span>}
      </div>
      <div className="field">
        <label className="label" htmlFor="dmarcPolicy">DMARC policy</label>
        <SelectField id="dmarcPolicy" className="input" value={policy} onChange={(e) => setPolicy(e.target.value as DnsSettings["dmarcPolicy"])}>
          <option value="none">none (monitor only)</option>
          <option value="quarantine">quarantine (old app default)</option>
          <option value="reject">reject</option>
        </SelectField>
      </div>
      {input("bimiLogoUrl", "BIMI logo URL (optional, https, SVG)", logo, setLogo)}
      {input("bimiCertificateUrl", "BIMI certificate URL (optional, https)", cert, setCert)}
    </ModalForm>
  )
}
