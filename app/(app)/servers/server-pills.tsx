import { CircleAlert, CircleCheck, CircleDashed, KeyRound, ShieldAlert } from "lucide-react"

import { connectionInfo, serverExpiry } from "@/lib/servers"
import type { ConnectionStatus, ServerItem } from "@/lib/types"

export function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const c = connectionInfo(status)
  const icon = status === "CONNECTED" ? <CircleCheck /> : status === "KEY_CHANGED" ? <ShieldAlert />
    : status === "KEY_PENDING" ? <KeyRound /> : status === "NEW" ? <CircleDashed /> : <CircleAlert />
  return <span className={`pill ${c.tone}`}>{icon}{c.label}</span>
}

export function ExpiryPill({ server }: { server: Pick<ServerItem, "expiresOn" | "daysLeft"> }) {
  const e = serverExpiry(server)
  return <span className={`pill ${e.tone}`}>{e.warn && <CircleAlert />}{e.label}</span>
}
