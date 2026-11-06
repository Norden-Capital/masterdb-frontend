import { connection } from "next/server"
import { Suspense } from "react"

import { Badge } from "@/components/ui/badge"
import { backendFetch } from "@/lib/backend"

type Status = { service: string; status: string; version: string; time: string }

// Asks the backend directly from the server, with the proxy secret (see
// lib/backend.ts). Nothing is sent to the browser but the result.
async function fetchStatus(): Promise<Status | null> {
  try {
    const res = await backendFetch("/api/v1/status", {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as Status
    return body.status === "ok" ? body : null
  } catch {
    return null
  }
}

async function BackendStatusBadge() {
  // Live data: render per request, never at build time.
  await connection()
  const status = await fetchStatus()
  return status ? (
    <Badge variant="secondary">Backend connected · v{status.version}</Badge>
  ) : (
    <Badge variant="destructive">Backend unreachable</Badge>
  )
}

export function BackendStatus() {
  return (
    <Suspense fallback={<Badge variant="outline">Backend checking…</Badge>}>
      <BackendStatusBadge />
    </Suspense>
  )
}
