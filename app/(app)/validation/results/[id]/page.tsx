import { Suspense } from "react"

import { JobView } from "./job-view"

export default function ValidationJobPage() {
  return (
    <Suspense fallback={<div className="page muted">Loading…</div>}>
      <JobView />
    </Suspense>
  )
}
