import { Suspense } from "react"

import { UserDetailView } from "./user-detail"

export default function UserDetailPage() {
  return (
    <Suspense fallback={<div className="page muted">Loading…</div>}>
      <UserDetailView />
    </Suspense>
  )
}
