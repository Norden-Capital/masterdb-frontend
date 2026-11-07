import { Suspense } from "react"

import { DomainDetailView } from "./domain-detail"

export default function DomainDetailPage() {
  return (
    <Suspense fallback={<div className="page muted">Loading…</div>}>
      <DomainDetailView />
    </Suspense>
  )
}
