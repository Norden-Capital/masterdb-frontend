import { Suspense } from "react"

import { ServerDetailView } from "./server-detail"

export default function ServerDetailPage() {
  return (
    <Suspense fallback={<div className="page muted">Loading…</div>}>
      <ServerDetailView />
    </Suspense>
  )
}
