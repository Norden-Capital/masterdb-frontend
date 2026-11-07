"use client"

import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useState } from "react"

import { api, ApiError, SESSION_LOST_EVENT } from "@/lib/api"
import type { Me } from "@/lib/types"

type Session = {
  me: Me
  /** True when the user holds MODULE:ACTION (always for the Owner). Only hides UI: the API checks again. */
  can: (permission: string) => boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const s = useContext(SessionContext)
  if (!s) throw new Error("useSession outside SessionProvider")
  return s
}

/** Remembers where to go back after signing in again. */
export function rememberReturn(path: string) {
  try {
    sessionStorage.setItem("md-return", path)
  } catch {
    // private mode: start page instead
  }
}

export function takeReturn(): string {
  try {
    const v = sessionStorage.getItem("md-return")
    sessionStorage.removeItem("md-return")
    // Only our own paths, never an absolute URL.
    if (v && v.startsWith("/") && !v.startsWith("//")) return v
  } catch {
    // ignore
  }
  return "/"
}

/**
 * Loads /api/v1/auth/me for every page behind the login. No session → /login;
 * a session that ends while the page is open (idle, revoked) → /session-expired.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/v1/auth/me"))
      setFailed(null)
    } catch (e) {
      if (e instanceof ApiError && e.code === "UNAUTHENTICATED") return // handled by the event below
      setFailed(e instanceof ApiError ? e.detail : "The server cannot be reached.")
    }
  }, [])

  useEffect(() => {
    api<Me>("/api/v1/auth/me").then(setMe, (e) => {
      if (!(e instanceof ApiError && e.code === "UNAUTHENTICATED")) {
        setFailed(e instanceof ApiError ? e.detail : "The server cannot be reached.")
      }
    })
  }, [])

  useEffect(() => {
    const lost = () => {
      rememberReturn(window.location.pathname + window.location.search)
      router.replace(me ? "/session-expired" : "/login")
    }
    window.addEventListener(SESSION_LOST_EVENT, lost)
    return () => window.removeEventListener(SESSION_LOST_EVENT, lost)
  }, [router, me])

  const can = useCallback(
    (permission: string) => !!me && (me.isOwner || me.permissions.includes(permission)),
    [me],
  )

  const logout = useCallback(async () => {
    try {
      await api("/api/v1/auth/logout", { method: "POST" })
    } catch {
      // the session may already be gone; go to login either way
    }
    router.replace("/login")
  }, [router])

  if (failed) {
    return (
      <div className="full-center">
        <div className="card" style={{ width: "min(460px, 100%)" }}>
          <div className="empty">
            <h3>MasterDB can&apos;t load right now</h3>
            <p>{failed}</p>
            <button className="btn primary" onClick={load}>Try again</button>
          </div>
        </div>
      </div>
    )
  }
  if (!me) {
    return (
      <div className="full-center" aria-busy="true">
        <span className="muted">Loading MasterDB…</span>
      </div>
    )
  }
  return <SessionContext.Provider value={{ me, can, refresh: load, logout }}>{children}</SessionContext.Provider>
}
