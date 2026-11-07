/**
 * Timing rules for live numbers (job progress, counters), free of React.
 * See components/md/use-poll.ts for the hook that uses them.
 */

/** Wait before the next call: the normal interval, doubled per failure in a row, capped. */
export function nextDelay(interval: number, failures: number, max = 60_000): number {
  if (failures <= 0) return interval
  return Math.min(max, interval * 2 ** Math.min(failures, 20))
}

/** Whole percent, rounded down so 100 % only shows when everything is done; null when unknown. */
export function percent(done: number | null | undefined, total: number | null | undefined): number | null {
  if (done == null || total == null || !Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return null
  return Math.max(0, Math.min(100, Math.floor((done / total) * 100)))
}
