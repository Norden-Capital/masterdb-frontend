"use client"

import { LoaderCircle, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { useToast } from "@/components/md/toast"
import { Banner, Sheet } from "@/components/md/ui"
import { api, describe } from "@/lib/api"
import type { ServerItem } from "@/lib/types"
import { bodyOf, EMPTY_SERVER, localErrors, ServerFields, serverErrors, type ServerFormValue } from "./server-form"
import { SshKeyCard } from "./ssh-key-card"

/** Server management job 1, as a side sheet over the server list: MasterDB's key, then the server's details. */
export function AddServerSheet(props: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const router = useRouter()
  const [value, setValue] = useState<ServerFormValue>(EMPTY_SERVER)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  function close() {
    if (busy) return
    setValue(EMPTY_SERVER)
    setErrors({})
    setError(null)
    props.onClose()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const local = localErrors(value)
    setErrors(local)
    setError(null)
    if (Object.keys(local).length) return
    setBusy(true)
    try {
      const s = await api<ServerItem>("/api/v1/servers", { body: bodyOf(value) })
      toast(`${s.name} added`)
      router.push(`/servers/list/${s.publicId}`)
    } catch (err) {
      const fields = serverErrors(err)
      if (fields) setErrors(fields)
      else setError(err)
      setBusy(false)
    }
  }

  return (
    <Sheet open={props.open} onClose={close} title="Add VPS server"
      footer={<>
        <button className="btn" type="button" onClick={close} disabled={busy}>Cancel</button>
        <button className="btn primary" type="submit" form="add-server" disabled={busy}>
          {busy ? <LoaderCircle className="spin" /> : <Plus />}{busy ? "Adding…" : "Add server"}
        </button>
      </>}>
      <SshKeyCard />
      <form id="add-server" className="sheet-section" onSubmit={submit} noValidate>
        <h3>2. Server details</h3>
        {error ? <Banner tone="red" title="Couldn't add the server">{describe(error)}</Banner> : null}
        <ServerFields value={value} onChange={setValue} errors={errors} />
        <p className="help">Next, on the server&apos;s page: Connect, check the fingerprint once, type the root password if MasterDB&apos;s key isn&apos;t on the server yet, and Trust.</p>
      </form>
    </Sheet>
  )
}
