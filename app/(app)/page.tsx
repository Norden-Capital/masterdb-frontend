import type { Metadata } from "next"

import { Dashboard } from "./dashboard"

export const metadata: Metadata = { title: "Dashboard" }

/** Start page: real counts from GET /api/v1/dashboard/summary (DASHBOARD:VIEW), else a welcome card. */
export default function Home() {
  return (
    <div className="page">
      <Dashboard />
    </div>
  )
}
