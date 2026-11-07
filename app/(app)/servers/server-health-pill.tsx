import { Check, CircleAlert, CircleDashed, CircleHelp, TriangleAlert, X } from "lucide-react"

import type { ServerHealthStatus } from "@/lib/types"

/** A server's overall health, or one check's result: green / red with amber for "couldn't tell" and warnings. */
export function ServerHealthPill({ status }: { status?: ServerHealthStatus | "NOT_CHECKED" | null }) {
  switch (status) {
    case "OK":
      return <span className="pill green"><Check />All good</span>
    case "PROBLEM":
      return <span className="pill red"><X />Problem</span>
    case "WARNING":
      return <span className="pill amber"><TriangleAlert />Warning</span>
    case "ERROR":
      return <span className="pill amber"><CircleAlert />Couldn&apos;t check</span>
    case "NOT_CHECKED":
      return <span className="pill grey"><CircleDashed />Not checked</span>
    default:
      return <span className="pill grey"><CircleHelp />Never checked</span>
  }
}
