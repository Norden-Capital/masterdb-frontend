import type { Metadata } from "next"

import { BackendStatus } from "@/components/backend-status"
import { Welcome } from "./welcome"

export const metadata: Metadata = { title: "Dashboard" }

/** Placeholder until the dashboard (M2.4): who you are and whether the backend answers. */
export default function Home() {
  return (
    <div className="page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <span className="meta"><BackendStatus /></span>
      </div>
      <Welcome />
    </div>
  )
}
