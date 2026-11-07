"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { nextDelay } from "@/lib/poll"

export type PollStatus =
  /** First answer not there yet. */
  | "loading"
  /** Polling on schedule. */
  | "live"
  /** The tab is hidden: no calls until it is shown again. */
  | "paused"
  /** isDone said so: no more calls. */
  | "done"
  /** The last call failed; retrying with a growing wait. */
  | "error"
  /** enabled is false. */
  | "off"

export type Poll<T> = {
  /** The last answer from the server (kept while a later call fails). */
  data: T | null
  error: unknown
  status: PollStatus
  /** When `data` arrived (ms since epoch). */
  updatedAt: number | null
  /** Failed calls in a row. */
  failures: number
  /** Call now and start the schedule again. */
  refresh: () => void
}

/**
 * Asks the server for live numbers every `interval` ms. Only server answers
 * are ever shown: nothing is guessed or animated between two answers.
 *
 * - waits for each answer before planning the next call (never overlaps);
 * - stops for good once `isDone(data)` is true (job finished, cancelled…);
 * - makes no calls while the browser tab is hidden and calls at once when it
 *   is shown again;
 * - after a failure waits twice as long each time (capped at `maxBackoff`),
 *   back to the normal interval after the next success.
 */
export function usePoll<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: { interval: number; enabled?: boolean; isDone?: (data: T) => boolean; maxBackoff?: number },
): Poll<T> {
  const { interval, enabled = true, maxBackoff = 60_000 } = options
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [status, setStatus] = useState<PollStatus>(enabled ? "loading" : "off")
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [failures, setFailures] = useState(0)
  const [kick, setKick] = useState(0)

  // Latest callbacks without restarting the schedule on every render.
  const fetcherRef = useRef(fetcher)
  const isDoneRef = useRef(options.isDone)
  useEffect(() => {
    fetcherRef.current = fetcher
    isDoneRef.current = options.isDone
  })

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let paused = false
    let failed = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let ctl: AbortController | undefined

    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(tick, ms)
    }

    async function tick() {
      if (stopped) return
      if (document.hidden) {
        paused = true
        setStatus("paused")
        return
      }
      ctl = new AbortController()
      try {
        const d = await fetcherRef.current(ctl.signal)
        if (stopped) return
        failed = 0
        setData(d)
        setError(null)
        setFailures(0)
        setUpdatedAt(Date.now())
        if (isDoneRef.current?.(d)) {
          stopped = true
          setStatus("done")
          return
        }
        setStatus("live")
        schedule(interval)
      } catch (e) {
        if (stopped) return
        failed++
        setError(e)
        setFailures(failed)
        setStatus("error")
        schedule(nextDelay(interval, failed, maxBackoff))
      }
    }

    const onVisibility = () => {
      if (!document.hidden && paused && !stopped) {
        paused = false
        schedule(0)
      }
    }

    document.addEventListener("visibilitychange", onVisibility)
    schedule(0)
    return () => {
      stopped = true
      clearTimeout(timer)
      ctl?.abort()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [enabled, interval, maxBackoff, kick])

  const refresh = useCallback(() => setKick((k) => k + 1), [])

  return { data, error, status: enabled ? status : "off", updatedAt, failures, refresh }
}
