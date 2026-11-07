/** MTA helpers, free of React so `npm test` can check them. */

import type { InstallStatus } from "./types.ts"

export function isFinished(status: InstallStatus): boolean {
  return status === "SUCCEEDED" || status === "FAILED" || status === "INTERRUPTED"
}

/**
 * Adds the newest part of the install log to what is shown. The server sends
 * the log from `logFrom`; if it starts where we are, append; otherwise (first
 * call, or the stored log was trimmed at the front) take what came as a whole.
 */
export function mergeLog(shown: { text: string; length: number }, part: { log: string; logFrom: number; logLength: number }) {
  if (part.logFrom === shown.length && part.logFrom > 0) return { text: shown.text + part.log, length: part.logLength }
  if (part.logFrom === 0) return { text: part.log, length: part.logLength }
  // Out of step (the stored log was trimmed at the front): keep what is shown, ask for all of it next time.
  return { text: shown.text, length: 0 }
}

const STATUS: Record<InstallStatus, { label: string; tone: "grey" | "blue" | "green" | "red" | "amber" }> = {
  QUEUED: { label: "Queued", tone: "grey" },
  RUNNING: { label: "Running", tone: "blue" },
  SUCCEEDED: { label: "Installed", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  INTERRUPTED: { label: "Interrupted", tone: "amber" },
}

export function installStatus(s: InstallStatus) {
  return STATUS[s] ?? { label: s, tone: "grey" as const }
}

/** The DKIM TXT record as it goes into DNS. */
export function dkimRecord(publicKey: string): string {
  return `v=DKIM1; k=rsa; p=${publicKey}`
}
