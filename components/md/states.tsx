"use client"

import { ChevronLeft, CircleAlert, LockKeyhole, MapPinOff, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { AuthCard } from "@/components/md/auth-card"
import { Banner } from "@/components/md/ui"
import { describe } from "@/lib/api"

/** 403: a full screen over the app (no frame), in the sign-in look. */
export function Forbidden({ module }: { module: string }) {
  return (
    <div className="full-screen">
      <AuthCard center>
        <div className="icon-badge orange"><LockKeyhole /></div>
        <h1>You don&apos;t have access</h1>
        <p className="lead">Your permissions don&apos;t include {module}.</p>
        <Link className="btn primary block" href="/">Go to dashboard</Link>
        <p className="help" style={{ marginTop: 14 }}>Need it? Ask an Owner to update your permissions.</p>
      </AuthCard>
    </div>
  )
}

/** 404: the same full screen. */
export function NotFoundBody() {
  const router = useRouter()
  return (
    <AuthCard center>
      <div className="icon-badge orange"><MapPinOff /></div>
      <h1>Page not found</h1>
      <p className="lead">This page doesn&apos;t exist or was moved.</p>
      <Link className="btn primary block" href="/">Go to dashboard</Link>
      <p className="help" style={{ marginTop: 14 }}>
        <button className="link-btn go-back" onClick={() => router.back()}><ChevronLeft />Go back</button>
      </p>
    </AuthCard>
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

/** "Nothing here" block (mock .empty): icon, title, one sentence, optional action. */
export function EmptyState(props: { icon: React.ReactNode; title: string; text?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="ic">{props.icon}</div>
      <h3>{props.title}</h3>
      {props.text && <p>{props.text}</p>}
      {props.action}
    </div>
  )
}

/** A failed load: red banner with the backend's reason and "Try again". */
export function ErrorState(props: { title: string; error: unknown; onRetry?: () => void; style?: React.CSSProperties }) {
  return (
    <Banner tone="red" title={props.title} style={props.style}>
      {describe(props.error)}{" "}
      {props.onRetry && <button className="link-btn" onClick={props.onRetry}>Try again</button>}
    </Banner>
  )
}

/** A failed load inside a table card: centred like the empty state, red icon, reason and "Try again". */
export function ErrorBlock(props: { title: string; error: unknown; onRetry?: () => void }) {
  return (
    <div className="empty err-state" role="alert">
      <div className="ic"><CircleAlert /></div>
      <h3>{props.title}</h3>
      <p>{describe(props.error)}</p>
      {props.onRetry && <button className="btn" onClick={props.onRetry}><RefreshCw />Try again</button>}
    </div>
  )
}

/** Placeholder lines while a block (not a table) loads. */
export function LoadingState({ lines = 3, label = "Loading" }: { lines?: number; label?: string }) {
  return (
    <div className="loading-block" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => <span key={i} className="skel" style={{ width: `${90 - i * 17}%` }} />)}
    </div>
  )
}
