"use client"

import { Copy, KeyRound } from "lucide-react"
import { useEffect, useState } from "react"

import { ErrorState, LoadingState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { api } from "@/lib/api"
import type { SshPublicKey } from "@/lib/types"

/** MasterDB's public SSH key and the one-line command that adds it on a VPS. */
export function SshKeyCard({ title = "1. Let MasterDB log in" }: { title?: string }) {
  const toast = useToast()
  const [key, setKey] = useState<SshPublicKey | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = () => { api<SshPublicKey>("/api/v1/servers/ssh-key").then((k) => { setError(null); setKey(k) }, setError) }
  useEffect(load, [])

  const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => toast(`${what} copied`), () => toast("Couldn't copy: select the text instead", "bad"))

  return (
    <div className="card">
      <div className="card-head"><h2><KeyRound size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{title}</h2></div>
      <div className="card-pad">
        {error ? <ErrorState title="Couldn't load MasterDB's SSH key" error={error} onRetry={load} /> : null}
        {!key && !error && <LoadingState lines={2} />}
        {key && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>MasterDB logs in with its own SSH key. The easy way: skip this,
              and type the server&apos;s root password once when you trust the server (step 3 on its page); MasterDB then adds
              its key itself and never saves the password. Or run this command once on the VPS, as the login user (root by default).</p>
            <div className="field">
              <span className="label">Command for the VPS</span>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, margin: 0, fontSize: 12 }}>{key.installCommand}</pre>
              <button className="btn" style={{ marginTop: 8 }} onClick={() => copy(key.installCommand, "Command")}><Copy />Copy command</button>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <span className="label">Public key only</span>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, margin: 0, fontSize: 12 }}>{key.publicKey}</pre>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => copy(key.publicKey, "Public key")}><Copy />Copy key</button>
                <span className="muted small mono" style={{ wordBreak: "break-all", minWidth: 0 }}>{key.fingerprint}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
