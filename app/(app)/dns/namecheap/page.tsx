"use client"

import { Globe, KeyRound, LoaderCircle, Pencil, PlugZap, Plus, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { ConfirmDialog, ModalForm } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { EmptyState, ErrorState, Forbidden, LoadingState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Banner, FieldError } from "@/components/md/ui"
import { api, ApiError, describe } from "@/lib/api"
import { NAMECHEAP_ERRORS } from "@/lib/activity"
import { when } from "@/lib/format"
import type { NamecheapAccount, NamecheapTestResult } from "@/lib/types"

const PATH = "/api/v1/dns/namecheap/account"

/**
 * DNS job 1: the one Namecheap account. The API key is write-only: the page
 * can set or replace it, never see it.
 */
export default function NamecheapAccountPage() {
  const { can } = useSession()
  const toast = useToast()
  const [account, setAccount] = useState<NamecheapAccount | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<NamecheapTestResult | null>(null)

  const load = useCallback(() => {
    api<NamecheapAccount>(PATH).then((a) => { setError(null); setAccount(a) }, setError)
  }, [])

  useEffect(() => {
    document.title = "Namecheap account · MasterDB"
    if (can("DNS:VIEW")) load()
  }, [can, load])

  if (!can("DNS:VIEW")) return <Forbidden module="DNS management" />

  async function runTest() {
    setTesting(true)
    setTest(null)
    try {
      setTest(await api<NamecheapTestResult>(`${PATH}/test`, { method: "POST" }))
      load()
    } catch (e) {
      toast(describe(e), "bad")
    } finally {
      setTesting(false)
    }
  }

  async function remove() {
    await api(PATH, { method: "DELETE" })
    toast("Namecheap account removed")
    setTest(null)
    load()
  }

  const last = test ?? (account?.lastTest ? { ok: account.lastTest.ok, message: account.lastTest.message } : null)
  return (
    <div className="page">
      <div className="page-head">
        <h1>Namecheap account</h1>
        <span className="meta">One account. MasterDB reads your domains and DNS records through it.</span>
        <div className="actions">
          {account?.configured && can("DNS:RUN") && (
            <button className="btn" onClick={runTest} disabled={testing}>
              {testing ? <LoaderCircle className="spin" /> : <PlugZap />}Test connection
            </button>
          )}
          {account?.configured && can("DNS:EDIT") && (
            <button className="btn" onClick={() => setEditing(true)}><Pencil />Edit or replace key</button>
          )}
          {account && !account.configured && can("DNS:EDIT") && (
            <button className="btn primary" onClick={() => setEditing(true)}><Plus />Add account</button>
          )}
        </div>
      </div>

      {error ? <ErrorState title="Couldn't load the Namecheap account" error={error} onRetry={load} /> : null}
      {!account && !error && <LoadingState />}

      {account && !account.configured && (
        <div className="card">
          <EmptyState icon={<Globe />} title="No Namecheap account yet"
            text={<>Add the API user and API key from Namecheap (Profile → Tools → Namecheap API Access). Turn API access
              on there and whitelist this server&apos;s IP <b className="mono">{account.clientIp}</b>.</>}
            action={can("DNS:EDIT") && <button className="btn primary" onClick={() => setEditing(true)}><Plus />Add account</button>} />
        </div>
      )}

      {account?.configured && (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="card">
            <div className="card-head"><h2>Account</h2></div>
            <div className="card-pad">
              <dl className="kv">
                <div><dt>API user</dt><dd className="mono">{account.apiUser}</dd></div>
                <div><dt>Username</dt><dd className="mono">{account.username}</dd></div>
                <div><dt>API key</dt><dd><KeyRound size={14} /> Saved, encrypted. It can be replaced, never shown.</dd></div>
                <div><dt>Client IP sent</dt><dd className="mono">{account.clientIp}</dd></div>
                <div><dt>Last changed</dt><dd>{when(account.updatedAt)}</dd></div>
              </dl>
              {can("DNS:DELETE") && (
                <button className="btn text-danger" style={{ marginTop: 16 }} onClick={() => setRemoving(true)}>
                  <Trash2 />Remove account
                </button>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2>Connection</h2></div>
            <div className="card-pad">
              {last ? (
                <Banner tone={last.ok ? "green" : "red"}
                  title={last.ok ? "Connected" : NAMECHEAP_ERRORS[test?.code ?? ""] ?? "Connection failed"}>
                  <p>{last.message}</p>
                  {account.lastTest && !test && <p className="small muted">Tested {when(account.lastTest.at)}</p>}
                </Banner>
              ) : (
                <p className="muted">Not tested yet. Test connection calls Namecheap&apos;s domain list once.</p>
              )}
              <p className="help" style={{ marginTop: 12 }}>
                Namecheap only answers calls from whitelisted IPs. The live server ({account.clientIp}) can be tested
                after deploy; from a PC the test fails with &quot;IP not whitelisted&quot;.
              </p>
            </div>
          </div>
        </div>
      )}

      {account && editing && (
        <AccountForm open={editing} onClose={() => setEditing(false)} account={account}
          onSaved={(a) => { setAccount(a); setTest(null); toast(account.configured ? "Namecheap account saved" : "Namecheap account added") }} />
      )}
      <ConfirmDialog open={removing} onClose={() => setRemoving(false)} danger icon={<Trash2 />}
        title="Remove the Namecheap account?"
        text="The saved API key is deleted. Domains stay in MasterDB, but nothing can be fetched or written at Namecheap until an account is added again."
        confirmLabel="Remove account" onConfirm={remove} />
    </div>
  )
}

/** Mounted only while open, so every opening starts fresh with an empty key field. */
function AccountForm(props: { open: boolean; onClose: () => void; account: NamecheapAccount;
  onSaved: (a: NamecheapAccount) => void }) {
  const { account } = props
  const [apiUser, setApiUser] = useState(account.apiUser ?? "")
  const [username, setUsername] = useState(account.username ?? "")
  const [apiKey, setApiKey] = useState("")
  const [fieldErr, setFieldErr] = useState<ApiError | null>(null)

  async function submit() {
    setFieldErr(null)
    try {
      const saved = await api<NamecheapAccount>(PATH, { method: "PUT", body: { apiUser, username, apiKey } })
      setApiKey("")
      props.onSaved(saved)
    } catch (e) {
      if (e instanceof ApiError && e.fields.length) {
        setFieldErr(e)
        return false
      }
      throw e
    }
  }

  const adding = !account.configured
  return (
    <ModalForm open={props.open} onClose={props.onClose} onSubmit={submit} icon={<KeyRound />}
      title={adding ? "Add Namecheap account" : "Edit Namecheap account"}
      text={adding ? "From Namecheap: Profile → Tools → Namecheap API Access." : "Leave the key empty to keep the saved one."}
      submitLabel={adding ? "Add account" : "Save"} canSubmit={apiUser.trim() !== "" && (!adding || apiKey.trim() !== "")}>
      <div className="field">
        <label className="label" htmlFor="nc-user">API user</label>
        <input id="nc-user" className={`input ${fieldErr?.field("apiUser") ? "invalid" : ""}`} value={apiUser}
          autoComplete="off" spellCheck={false} onChange={(e) => setApiUser(e.target.value)} />
        {fieldErr?.field("apiUser") && <FieldError text={fieldErr.field("apiUser")!} />}
      </div>
      <div className="field">
        <label className="label" htmlFor="nc-username">Username <span className="muted">(optional, usually the API user)</span></label>
        <input id="nc-username" className={`input ${fieldErr?.field("username") ? "invalid" : ""}`} value={username}
          autoComplete="off" spellCheck={false} onChange={(e) => setUsername(e.target.value)} />
        {fieldErr?.field("username") && <FieldError text={fieldErr.field("username")!} />}
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label className="label" htmlFor="nc-key">{adding ? "API key" : "New API key (optional)"}</label>
        <input id="nc-key" className={`input mono ${fieldErr?.field("apiKey") ? "invalid" : ""}`} type="password"
          value={apiKey} autoComplete="new-password" spellCheck={false}
          placeholder={adding ? "" : "Saved key kept unless you paste a new one"} onChange={(e) => setApiKey(e.target.value)} />
        {fieldErr?.field("apiKey") && <FieldError text={fieldErr.field("apiKey")!} />}
        <span className="help">Stored encrypted. Nobody can read it back, not even here.</span>
      </div>
    </ModalForm>
  )
}
