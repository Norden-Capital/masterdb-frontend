/** Validation helpers, free of React so `npm test` can check them. */

import type { Category } from "./types.ts"

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
