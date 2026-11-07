import { Suspense } from "react"

import { PermissionsEditor } from "./permissions-editor"

export default function PermissionsPage() {
  return (
    <Suspense fallback={<div className="page muted">Loading…</div>}>
      <PermissionsEditor />
    </Suspense>
  )
}
