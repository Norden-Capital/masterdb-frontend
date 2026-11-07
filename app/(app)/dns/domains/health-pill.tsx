import { Check, CircleAlert, CircleDashed, CircleHelp, X } from "lucide-react"

import type { HealthStatus } from "@/lib/types"

/** A domain's overall DNS health, or one record's result. */
export function HealthPill({ status }: { status?: HealthStatus | "NOT_CHECKED" | null }) {
  switch (status) {
    case "OK":
      return <span className="pill green"><Check />All good</span>
    case "PROBLEM":
      return <span className="pill red"><X />Problem</span>
    case "ERROR":
      return <span className="pill amber"><CircleAlert />Lookup failed</span>
    case "NOT_CHECKED":
      return <span className="pill grey"><CircleDashed />Not checked</span>
    default:
      return <span className="pill grey"><CircleHelp />Never checked</span>
  }
}
