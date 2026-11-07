/**
 * Server management helpers, free of React so `npm test` can check them.
 * The backend decides every rule; these only shape what is shown.
 */

import type { ConnectionStatus } from "./types.ts"

export type Tone = "red" | "amber" | "grey" | "green" | "blue"

/** Expiry of a VPS plan: expired, within 14 days (the warning), or the date. */
export function serverExpiry(s: { expiresOn: string; daysLeft: number }): { label: string; tone: Tone; warn: boolean } {
  if (s.daysLeft < 0) return { label: `Expired ${s.expiresOn}`, tone: "red", warn: true }
  if (s.daysLeft === 0) return { label: `${s.expiresOn} · today`, tone: "red", warn: true }
  if (s.daysLeft <= 14) return { label: `${s.expiresOn} · in ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"}`, tone: "amber", warn: true }
  return { label: s.expiresOn, tone: "green", warn: false }
}

const CONNECTION: Record<ConnectionStatus, { label: string; tone: Tone }> = {
  NEW: { label: "Not connected", tone: "grey" },
  KEY_PENDING: { label: "Key to check", tone: "blue" },
  CONNECTED: { label: "Connected", tone: "green" },
  AUTH_FAILED: { label: "Key refused", tone: "red" },
  UNREACHABLE: { label: "Unreachable", tone: "red" },
  KEY_CHANGED: { label: "Blocked: key changed", tone: "red" },
}

export function connectionInfo(status: ConnectionStatus): { label: string; tone: Tone } {
  return CONNECTION[status] ?? { label: status, tone: "grey" }
}

/** Linux user names the backend accepts (root, deploy, ...). */
export function validUser(v: string): boolean {
  return /^[a-z_][a-z0-9_.-]{0,31}$/.test(v)
}

/** Dotted IPv4 (format only; the backend also refuses private ranges). */
export function validIpv4(v: string): boolean {
  return /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(v.trim())
}
