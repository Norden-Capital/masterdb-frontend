import { Suspense } from "react"

import { ListDetailView } from "./list-detail"

export default function ListDetailPage() {
  return (
    <Suspense fallback={<div className="page muted">Loading…</div>}>
      <ListDetailView />
    </Suspense>
  )
}
