import { Suspense } from "react"

import { InstallView } from "./install-view"

export default function InstallMtaPage() {
  return (
    <Suspense fallback={<div className="page muted">Loading…</div>}>
      <InstallView />
    </Suspense>
  )
}
