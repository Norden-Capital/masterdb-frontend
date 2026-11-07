"use client"

import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { useSession } from "@/components/md/session"
import { Forbidden } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { Banner } from "@/components/md/ui"
import { api, describe } from "@/lib/api"
import type { ServerItem } from "@/lib/types"
import { bodyOf, EMPTY_SERVER, localErrors, ServerFields, serverErrors, type ServerFormValue } from "../server-form"
import { SshKeyCard } from "../ssh-key-card"

/** Server management job 1: MasterDB's key for the VPS, then the server's details. Connecting happens on its page. */
export default function AddServerPage() {
  const { can } = useSession()
  const toast = useToast()
  const router = useRouter()
  const [value, setValue] = useState<ServerFormValue>(EMPTY_SERVER)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { document.title = "Add VPS server · MasterDB" }, [])

  if (!can("SERVERS:CREATE")) return <Forbidden module="Server management" />

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
    <div className="page">
      <div className="page-head">
        <h1>Add VPS server</h1>
        <div className="actions">{can("SERVERS:VIEW") && <Link className="btn" href="/servers/list">Server list</Link>}</div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <SshKeyCard />
        <div className="card">
          <div className="card-head"><h2>2. Server details</h2></div>
          <form className="card-pad" onSubmit={submit} noValidate>
            {error ? <Banner tone="red" title="Couldn't add the server">{describe(error)}</Banner> : null}
            <ServerFields value={value} onChange={setValue} errors={errors} />
            <button className="btn primary" type="submit" disabled={busy} style={{ marginTop: 16 }}><Plus />Add server</button>
            <p className="help">Next, on the server&apos;s page: Connect, check the host key fingerprint once, and MasterDB tests its login.</p>
          </form>
        </div>
      </div>
    </div>
  )
}
