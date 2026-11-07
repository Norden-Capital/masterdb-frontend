import { Suspense } from "react"

import { AppFrame } from "@/components/md/app-frame"
import { SessionProvider } from "@/components/md/session"

/**
 * Every page behind the login: loads /me, then the app frame. In <Suspense>
 * because the frame reads the URL (active menu item), which is only known at
 * request time; the static shell shows the loading line meanwhile.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="full-center" aria-busy="true"><span className="muted">Loading MasterDB…</span></div>}>
      <SessionProvider>
        <AppFrame>{children}</AppFrame>
      </SessionProvider>
    </Suspense>
  )
}
