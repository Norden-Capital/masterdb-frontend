"use client"

import { LockKeyhole, MapPinOff } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

/** 403 page body (mock 14). */
export function Forbidden({ module }: { module: string }) {
  return (
    <div className="page" style={{ display: "grid", placeItems: "center", minHeight: "calc(100vh - 60px)", paddingBottom: 60 }}>
      <div className="card" style={{ width: "min(520px,100%)" }}>
        <div className="empty">
          <div className="ic" style={{ background: "var(--amber-bg)", color: "var(--amber-fg)" }}><LockKeyhole /></div>
          <p className="small muted" style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>Error 403</p>
          <h3 style={{ fontSize: 20 }}>You don&apos;t have access to {module}</h3>
          <p>Your permissions don&apos;t include this module. If you need it, ask an Owner to update your permissions.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link className="btn" href="/account">See my permissions</Link>
            <Link className="btn primary" href="/">Go to dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 404 page body (mock 14). */
export function NotFoundBody() {
  const router = useRouter()
  return (
    <div className="card" style={{ width: "min(520px,100%)" }}>
      <div className="empty">
        <div className="ic"><MapPinOff /></div>
        <p className="small muted" style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>Error 404</p>
        <h3 style={{ fontSize: 20 }}>Page not found</h3>
        <p>This page doesn&apos;t exist or was moved. If you followed a link, it may be out of date.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="btn" onClick={() => router.back()}>Go back</button>
          <Link className="btn primary" href="/">Go to dashboard</Link>
        </div>
      </div>
    </div>
  )
}

/** Skeleton rows for a loading table (mock 07/12). */
export function SkeletonRows({ cols, rows = 3 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}><span className="skel" style={{ width: c === 0 ? 16 : 80 + ((r * 37 + c * 23) % 90) }} /></td>
          ))}
        </tr>
      ))}
    </>
  )
}
