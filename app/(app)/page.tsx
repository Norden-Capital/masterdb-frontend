import type { Metadata } from "next"

import { BackendStatus } from "@/components/backend-status"
import { Dashboard } from "./dashboard"

export const metadata: Metadata = { title: "Dashboard" }

/** Start page: real counts from GET /api/v1/dashboard/summary (DASHBOARD:VIEW), else a welcome card. */
export default function Home() {
  return (
    <div className="page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <span className="meta"><BackendStatus /></span>
      </div>
      <Dashboard />
    </div>
  )
}
