"use client"

import { CircleAlert, CircleCheck, CirclePause, LoaderCircle } from "lucide-react"
import { useId } from "react"

import type { PollStatus } from "@/components/md/use-poll"
import { timeWithSeconds } from "@/lib/format"
import { percent } from "@/lib/poll"
import { count } from "@/lib/table"

type Tone = "primary" | "green" | "red" | "amber" | "purple" | "teal" | "grey" | "blue"

const STROKE: Record<Tone, string> = {
  primary: "var(--primary)", green: "var(--success)", red: "var(--destructive)", amber: "var(--amber-fg)",
  purple: "var(--purple-fg)", teal: "var(--teal-fg)", grey: "var(--grey-fg)", blue: "var(--info)",
}

/**
 * Job progress ring. It draws exactly done / total as the server reported
 * them: no easing, no estimate, no movement between two answers. Without a
 * real total it shows "—" (and the progressbar has no value, which screen
 * readers announce as "busy, amount unknown").
 */
export function ProgressRing(props: {
  done: number | null | undefined
  total: number | null | undefined
  label: string
  size?: number
  tone?: Tone
}) {
  const size = props.size ?? 140
  const stroke = Math.max(8, Math.round(size / 12))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = percent(props.done, props.total)
  const known = pct !== null
  return (
    <div className="pring" style={{ width: size, height: size }} role="progressbar" aria-label={props.label}
      aria-valuemin={0} aria-valuemax={known ? props.total! : undefined} aria-valuenow={known ? props.done! : undefined}
      aria-valuetext={known ? `${count(props.done!)} of ${count(props.total!)} (${pct}%)` : "Not known yet"}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {known && pct > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={STROKE[props.tone ?? "primary"]} strokeWidth={stroke}
            strokeLinecap={pct >= 100 ? "butt" : "round"} strokeDasharray={`${(c * pct) / 100} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )}
      </svg>
      <div className="pring-center">
        <b className="num">{known ? `${pct}%` : "—"}</b>
        <span className="num">{known ? `${count(props.done!)} of ${count(props.total!)}` : props.label}</span>
      </div>
    </div>
  )
}

/** One live number with its label (mock stat tile). `null` shows "—", never 0. */
export function Counter(props: { label: string; value: number | null | undefined; tone?: Tone; hint?: React.ReactNode }) {
  const id = useId()
  return (
    <div className={`counter ${props.tone ? `tone-${props.tone}` : ""}`} role="group" aria-labelledby={id}>
      <span className="counter-l" id={id}>{props.label}</span>
      <b className="counter-v num">{props.value == null ? "—" : count(props.value)}</b>
      {props.hint && <span className="counter-h">{props.hint}</span>}
    </div>
  )
}

/** One line saying how fresh the numbers are (from usePoll). */
export function LiveStatus({ status, updatedAt, failures }: { status: PollStatus; updatedAt: number | null; failures: number }) {
  const at = updatedAt ? ` · updated ${timeWithSeconds(new Date(updatedAt).toISOString())}` : ""
  switch (status) {
    case "loading":
      return <span className="live"><LoaderCircle className="spin" />Getting the numbers…</span>
    case "live":
      return <span className="live"><span className="dot" />Live{at}</span>
    case "paused":
      return <span className="live"><CirclePause />Paused while this tab is hidden{at}</span>
    case "done":
      return <span className="live"><CircleCheck />Finished{at}</span>
    case "error":
      return (
        <span className="live bad" role="status">
          <CircleAlert />Can&apos;t reach the server ({failures} {failures === 1 ? "try" : "tries"}), retrying{at ? `. Last numbers${at.replace(" · ", " ")}` : ""}
        </span>
      )
    default:
      return null
  }
}
