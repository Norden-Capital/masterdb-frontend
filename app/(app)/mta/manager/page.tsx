import { Suspense } from "react"

import { ManagerView } from "./manager-view"

export default function MtaManagerPage() {
  return (
    <Suspense fallback={<div className="page muted">Loading…</div>}>
      <ManagerView />
    </Suspense>
  )
}
