"use client"

import { KeyRound, LoaderCircle, Plug, ShieldAlert, ShieldCheck } from "lucide-react"
import { useState } from "react"

import { ConfirmDialog } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { useToast } from "@/components/md/toast"
import { Banner, PasswordField } from "@/components/md/ui"
import { api, describe } from "@/lib/api"
import { when } from "@/lib/format"
import type { ConnectResult, ServerItem } from "@/lib/types"
import { ConnectionPill } from "../../server-pills"

/**
 * SSH connection with trust-on-first-use: the first Connect shows the host
 * key's fingerprint once; after "Trust", connections are strict and silent.
 * A changed key blocks the server; only the Owner can accept the new one.
 */
export function ConnectionCard({ server, onChange }: { server: ServerItem; onChange: (s: ServerItem) => void }) {
  const { can, me } = useSession()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [last, setLast] = useState<ConnectResult | null>(null)
  const [replacing, setReplacing] = useState(false)
  // The SSH user's password, only to let MasterDB add its own key once. Never stored; cleared after use.
  const [password, setPassword] = useState("")
  const base = `/api/v1/servers/${server.publicId}`

  async function call(path: string, body?: unknown) {
    setBusy(true)
    setError(null)
    try {
      const r = await api<ConnectResult>(`${base}${path}`, { method: "POST", body })
      setLast(r)
      onChange(r.server)
      if (r.outcome === "CONNECTED") toast("Connected")
      return r
    } catch (e) {
      setError(e)
      throw e
    } finally {
      setBusy(false)
    }
  }

  const s = server
  const pending = s.connectionStatus === "KEY_PENDING" && s.presentedKey
  const changed = s.connectionStatus === "KEY_CHANGED"
  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap" }}><h2>SSH connection</h2>
        <span className="right" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <ConnectionPill status={s.connectionStatus} />
          {can("SERVERS:RUN") && (
            <button className="btn" onClick={() => call("/connect").catch(() => undefined)} disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <Plug />}{s.hostKey ? "Test connection" : "Connect"}
            </button>
          )}
        </span>
      </div>
      <div className="card-pad">
        {error ? <Banner tone="red" title="That didn't work">{describe(error)}</Banner> : null}

        {pending && (
          <Banner tone="blue" icon={<KeyRound />} title="Check this server's host key, once">
            <p>The server answered with this {s.presentedKey!.type} key:</p>
            <p className="mono" style={{ wordBreak: "break-all", fontWeight: 600 }}>{s.presentedKey!.fingerprint}</p>
            <p>To be sure it is your VPS, compare it on the VPS console with
              <span className="mono"> for f in /etc/ssh/ssh_host_*_key.pub; do ssh-keygen -lf $f; done</span> (the
              line ending in ({keyLabel(s.presentedKey!.type)}). Once trusted, MasterDB
              only ever talks to this key and never asks again.</p>
            {can("SERVERS:CREATE") ? (
              <form noValidate onSubmit={(e) => {
                e.preventDefault()
                call("/host-key/trust", { fingerprint: s.presentedKey!.fingerprint, password: password || null })
                  .catch(() => undefined).finally(() => setPassword(""))
              }}>
                <PasswordField id="ssh-pass" label={`Password of ${s.sshUser} (optional)`} value={password} onChange={setPassword}
                  autoComplete="off" />
                <p className="help" style={{ marginTop: -8 }}>If MasterDB&apos;s key isn&apos;t on the server yet, type the password once:
                  MasterDB logs in with it one time, adds its key, and forgets it. It is never saved.</p>
                <button type="submit" className="btn primary" disabled={busy}><ShieldCheck />Trust this key</button>
              </form>
            ) : <p className="muted">Trusting a key needs the Servers create permission.</p>}
          </Banner>
        )}

        {changed && (
          <Banner tone="red" icon={<ShieldAlert />} title="Blocked: the host key changed">
            <p>{s.connectionMessage ?? "The server presented a different SSH host key."} This happens after a reinstall,
              or if someone is pretending to be this server. Nothing is sent to it while it is blocked.</p>
            <dl className="kv" style={{ margin: "8px 0" }}>
              <div><dt>Trusted key</dt><dd className="mono" style={{ wordBreak: "break-all" }}>{s.hostKey?.fingerprint ?? "—"}</dd></div>
              <div><dt>Key presented {s.presentedKey?.at ? `(${when(s.presentedKey.at)})` : ""}</dt>
                <dd className="mono" style={{ wordBreak: "break-all" }}>{s.presentedKey?.fingerprint ?? "—"}</dd></div>
            </dl>
            {me.isOwner && s.presentedKey ? (
              <button className="btn danger" onClick={() => setReplacing(true)} disabled={busy}><KeyRound />Accept new key…</button>
            ) : <p className="muted">Only the Owner can accept the new key.</p>}
          </Banner>
        )}

        {!pending && !changed && s.connectionMessage && (
          <Banner tone={s.connectionStatus === "CONNECTED" ? "amber" : "red"} title={s.connectionStatus === "CONNECTED" ? "Connected, with a warning" : "Not connected"}>
            <p>{s.connectionMessage}</p>
          </Banner>
        )}
        {s.connectionStatus === "AUTH_FAILED" && s.hostKey && can("SERVERS:CREATE") && (
          <form noValidate style={{ marginTop: 12 }} onSubmit={(e) => {
            e.preventDefault()
            if (password) call("/install-key", { password }).catch(() => undefined).finally(() => setPassword(""))
          }}>
            <PasswordField id="ssh-pass-add" label={`Password of ${s.sshUser}`} value={password} onChange={setPassword} autoComplete="off" />
            <p className="help" style={{ marginTop: -8 }}>MasterDB logs in with it once, adds its own key, and forgets the
              password. It is never saved. After that, no password is needed.</p>
            <button type="submit" className="btn primary" disabled={busy || !password}>
              {busy ? <LoaderCircle className="spin" /> : <KeyRound />}Add MasterDB&apos;s key
            </button>
          </form>
        )}
        {last && last.outcome === "CONNECTED" && !s.connectionMessage && (
          <Banner tone="green" title="MasterDB's key logs in">{last.message ? <p>{last.message}</p> : null}</Banner>
        )}

        <dl className="kv" style={{ marginTop: 12 }}>
          <div><dt>Trusted host key</dt><dd className="mono" style={{ wordBreak: "break-all" }}>
            {s.hostKey ? `${s.hostKey.type} ${s.hostKey.fingerprint}` : <span className="muted">None yet</span>}</dd></div>
          {s.hostKey?.at && <div><dt>Trusted since</dt><dd>{when(s.hostKey.at)}</dd></div>}
          <div><dt>Last check</dt><dd>{when(s.connectionCheckedAt)}</dd></div>
          <div><dt>Operating system</dt><dd>{s.os ?? <span className="muted">Not read yet</span>}</dd></div>
          <div><dt>Root or sudo</dt><dd>{s.privileged == null ? <span className="muted">Not checked</span> : s.privileged ? "Yes" : "No (MTA can't be installed)"}</dd></div>
        </dl>
      </div>
      <ConfirmDialog open={replacing} onClose={() => setReplacing(false)} danger icon={<KeyRound />}
        title={`Accept the new host key for ${s.name}?`}
        text="Only if you know why it changed (you reinstalled the VPS). From now on MasterDB trusts only the new key."
        typed={s.name} confirmLabel="Accept new key"
        onConfirm={() => call("/host-key/replace", { fingerprint: s.presentedKey?.fingerprint })}>
        <p className="mono" style={{ wordBreak: "break-all" }}>{s.presentedKey?.fingerprint}</p>
      </ConfirmDialog>
    </div>
  )
}

/** The type as ssh-keygen -l prints it at the end of the line: ECDSA, ED25519 or RSA. */
function keyLabel(type: string): string {
  return type.includes("ecdsa") ? "ECDSA" : type.includes("ed25519") ? "ED25519" : type.includes("rsa") ? "RSA" : type
}
