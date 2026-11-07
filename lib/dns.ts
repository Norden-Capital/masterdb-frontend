/**
 * DNS module helpers, free of React so `npm test` can check them. The backend
 * is the authority on every rule; these only give quick feedback.
 */

const NAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/

/** "  Example.COM. " → "example.com"; null when it can't be a domain (non-ASCII is left to the backend). */
export function normalizeDomain(input: string): string | null {
  let v = input.trim().toLowerCase()
  if (v.endsWith(".")) v = v.slice(0, -1)
  if (!v || /[/:@\s]/.test(v)) return null
  if (/[^\x00-\x7f]/.test(v)) return v // IDN: the backend converts it to punycode
  return v.length <= 253 && NAME.test(v) ? v : null
}

/** Days from `today` to a YYYY-MM-DD date (negative when past). */
export function daysUntil(isoDate: string, today: Date): number {
  const [y, m, d] = isoDate.split("-").map(Number)
  const end = Date.UTC(y, m - 1, d)
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.round((end - start) / 86_400_000)
}

export type ExpiryInfo = { label: string; tone: "red" | "amber" | "grey" | "green" }

/** How the expiry column reads: expired, soon (≤ 30 days), or the date. */
export function expiryInfo(d: { expiresAt?: string; expired?: boolean }, today: Date): ExpiryInfo {
  if (!d.expiresAt) return { label: "Unknown", tone: "grey" }
  const days = daysUntil(d.expiresAt, today)
  if (d.expired || days < 0) return { label: `Expired ${d.expiresAt}`, tone: "red" }
  if (days <= 30) return { label: `${d.expiresAt} · in ${days} day${days === 1 ? "" : "s"}`, tone: "amber" }
  return { label: d.expiresAt, tone: "green" }
}

/** Import modal: only names not in MasterDB yet can be ticked. */
export function importable<T extends { name: string; alreadyAdded: boolean }>(list: readonly T[]): string[] {
  return list.filter((d) => !d.alreadyAdded).map((d) => d.name)
}

/** "@ MX 10 mail.example.com." — one line for a record. */
export function recordLine(r: { name: string; type: string; address: string; mxPref?: string }): string {
  return [r.name, r.type, r.type === "MX" && r.mxPref ? r.mxPref : null, r.address].filter(Boolean).join(" ")
}

/** Counts for the diff summary. */
export function changeCounts(changes: readonly { change: "ADD" | "REMOVE" | "KEEP" }[]) {
  return {
    add: changes.filter((c) => c.change === "ADD").length,
    remove: changes.filter((c) => c.change === "REMOVE").length,
    keep: changes.filter((c) => c.change === "KEEP").length,
  }
}

/** A pasted DKIM key: the bare base64, from either the key itself or a whole "v=DKIM1; k=rsa; p=..." record. */
export function dkimKey(input: string): string {
  const m = /(?:^|;)\s*p=([^;]*)/i.exec(input)
  return (m ? m[1] : input).replace(/["\s]/g, "")
}
