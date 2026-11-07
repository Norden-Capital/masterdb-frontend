/** Validation helpers, free of React so `npm test` can check them. */

import type { Category, JobStatus, ValidationJob } from "./types.ts"

export type CategoryTone = "green" | "red" | "amber" | "purple" | "teal" | "grey"

/** Fixed display order everywhere (legend, ring, bars, filters). */
export const CATEGORIES: readonly Category[] = ["VALID", "BOUNCE", "SOFT_BOUNCE", "REJECT", "CATCH_ALL", "UNKNOWN"]

const META: Record<Category, { label: string; tone: CategoryTone; meaning: string }> = {
  VALID: { label: "Valid", tone: "green", meaning: "The mail server accepted the address and refused made-up ones." },
  BOUNCE: { label: "Bounce", tone: "red", meaning: "The mailbox doesn't exist." },
  SOFT_BOUNCE: { label: "Soft bounce", tone: "amber", meaning: "The mailbox exists but is full." },
  REJECT: { label: "Reject", tone: "purple", meaning: "The email provider refused by policy." },
  CATCH_ALL: { label: "Catch-all", tone: "teal", meaning: "The domain accepts any address, so this one can't be proven." },
  UNKNOWN: { label: "Unknown", tone: "grey", meaning: "Not proven either way. Can be retried; never counted as a bounce." },
}

export function categoryMeta(c: Category): { label: string; tone: CategoryTone; meaning: string } {
  return META[c] ?? { label: c, tone: "grey", meaning: "" }
}

/** Light check before sending (the backend decides): something@domain.tld, no spaces. */
export function looksLikeEmail(v: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,63}$/.test(v.trim())
}

/** "1.2 s" / "850 ms". */
export function duration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`
}


const JOB_STATUS: Record<JobStatus, { label: string; tone: "blue" | "amber" | "green" }> = {
  RUNNING: { label: "Running", tone: "blue" },
  STOPPED: { label: "Stopped", tone: "amber" },
  COMPLETED: { label: "Done", tone: "green" },
}

export function jobStatus(s: JobStatus): { label: string; tone: "blue" | "amber" | "green" | "grey" } {
  return JOB_STATUS[s] ?? { label: s, tone: "grey" }
}

/** The job's six counters, keyed by category. */
export function jobCounts(j: Pick<ValidationJob, "valid" | "bounce" | "softBounce" | "reject" | "catchAll" | "unknown">): Record<Category, number> {
  return { VALID: j.valid, BOUNCE: j.bounce, SOFT_BOUNCE: j.softBounce, REJECT: j.reject, CATCH_ALL: j.catchAll, UNKNOWN: j.unknown }
}

/**
 * Ring segments in the fixed order: each category's share of the total, as
 * start and length in [0, 1]. What is still to check is the empty rest.
 */
export function ringSegments(counts: Record<Category, number>, total: number): { category: Category; start: number; length: number }[] {
  if (!(total > 0)) return []
  const out: { category: Category; start: number; length: number }[] = []
  let at = 0
  for (const c of CATEGORIES) {
    const n = Math.max(0, counts[c] ?? 0)
    if (n === 0) continue
    const length = Math.min(n / total, 1 - at)
    out.push({ category: c, start: at, length })
    at += length
  }
  return out
}

/** Non-blank lines of a paste (what the backend will look at; it also drops duplicates and bad lines). */
export function lineCount(text: string): number {
  let n = 0
  for (const line of text.split(/\r?\n|\r/)) if (line.trim()) n++
  return n
}

const SERVER_STATE: Record<string, { label: string; tone: "blue" | "amber" | "red" | "grey" }> = {
  STARTING: { label: "Connecting", tone: "grey" },
  CHECKING: { label: "Checking", tone: "blue" },
  WAITING: { label: "Waiting", tone: "amber" },
  ERROR: { label: "Can't connect", tone: "red" },
}

export function serverState(s?: string): { label: string; tone: "blue" | "amber" | "red" | "grey" } | null {
  if (!s) return null
  return SERVER_STATE[s] ?? { label: s, tone: "grey" }
}
