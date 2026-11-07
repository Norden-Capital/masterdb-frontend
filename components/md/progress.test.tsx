import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Counter, LiveStatus, ProgressRing } from "./progress"
import { usePoll } from "./use-poll"

type Job = { done: number; total: number; state: "RUNNING" | "FINISHED" }

/** Mirrors the job page: ring + status line fed only by usePoll. */
function Live(props: { fetcher: () => Promise<Job>; interval?: number }) {
  const p = usePoll<Job>(props.fetcher, { interval: props.interval ?? 1000, isDone: (j) => j.state === "FINISHED" })
  return (
    <>
      <ProgressRing done={p.data?.done} total={p.data?.total} label="Checked" />
      <LiveStatus status={p.status} updatedAt={p.updatedAt} failures={p.failures} />
      <span data-testid="status">{p.status}</span>
    </>
  )
}

const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

let hidden = false

describe("usePoll", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    hidden = false
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden })
  })
  afterEach(() => vi.useRealTimers())

  it("calls at once, then every interval, and shows only what the server said", async () => {
    let done = 0
    const fetcher = vi.fn(async () => ({ done: (done += 10), total: 40, state: "RUNNING" as const }))
    render(<Live fetcher={fetcher} />)
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("10")
    await flush(999)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await flush(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(screen.getByText("50%")).toBeTruthy()
    expect(screen.getByText("20 of 40")).toBeTruthy()
  })

  it("stops for good when the job is finished", async () => {
    const answers: Job[] = [{ done: 5, total: 10, state: "RUNNING" }, { done: 10, total: 10, state: "FINISHED" }]
    const fetcher = vi.fn(async () => answers.shift() ?? { done: 99, total: 10, state: "RUNNING" as const })
    render(<Live fetcher={fetcher} />)
    await flush()
    await flush(1000)
    expect(screen.getByTestId("status").textContent).toBe("done")
    expect(screen.getByText("100%")).toBeTruthy()
    await flush(60_000)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("makes no calls while the tab is hidden and calls at once when it is back", async () => {
    const fetcher = vi.fn(async () => ({ done: 1, total: 10, state: "RUNNING" as const }))
    render(<Live fetcher={fetcher} />)
    await flush()
    hidden = true
    await flush(1000) // this tick sees the hidden tab and pauses
    expect(screen.getByTestId("status").textContent).toBe("paused")
    const calls = fetcher.mock.calls.length
    await flush(30_000)
    expect(fetcher).toHaveBeenCalledTimes(calls)
    hidden = false
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(calls + 1)
    expect(screen.getByTestId("status").textContent).toBe("live")
  })

  it("backs off on errors (2 s, 4 s, 8 s…) and returns to the interval after a success", async () => {
    const times: number[] = []
    let fail = 3
    const fetcher = vi.fn(async () => {
      times.push(Date.now())
      if (fail-- > 0) throw new Error("down")
      return { done: 1, total: 2, state: "RUNNING" as const }
    })
    render(<Live fetcher={fetcher} />)
    await flush()
    expect(screen.getByTestId("status").textContent).toBe("error")
    expect(screen.getByText(/Can.t reach the server \(1 try\)/)).toBeTruthy()
    await flush(2000) // 2nd call
    await flush(4000) // 3rd call
    await flush(8000) // 4th call succeeds
    await flush(1000) // back to the 1 s interval
    const gaps = times.slice(1).map((t, i) => t - times[i])
    expect(gaps).toEqual([2000, 4000, 8000, 1000])
    expect(screen.getByTestId("status").textContent).toBe("live")
  })

  it("keeps the last real numbers while the server is unreachable", async () => {
    let n = 0
    const fetcher = vi.fn(async () => {
      if (n++ > 0) throw new Error("down")
      return { done: 3, total: 4, state: "RUNNING" as const }
    })
    render(<Live fetcher={fetcher} />)
    await flush()
    await flush(1000)
    expect(screen.getByTestId("status").textContent).toBe("error")
    expect(screen.getByText("75%")).toBeTruthy()
  })

  it("does nothing when disabled", async () => {
    const fetcher = vi.fn(async () => 1)
    function Off() {
      const p = usePoll(fetcher, { interval: 1000, enabled: false })
      return <span>{p.status}</span>
    }
    render(<Off />)
    await flush(10_000)
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.getByText("off")).toBeTruthy()
  })
})

describe("ProgressRing", () => {
  it("shows unknown, not zero, before the server gave a total", () => {
    render(<ProgressRing done={null} total={null} label="Checked" />)
    const bar = screen.getByRole("progressbar", { name: "Checked" })
    expect(bar.getAttribute("aria-valuenow")).toBeNull()
    expect(bar.textContent).toContain("—")
    expect(bar.querySelectorAll("circle")).toHaveLength(1) // track only
  })

  it("rounds down and draws the arc in proportion", () => {
    render(<ProgressRing done={1999} total={2000} label="Checked" size={100} />)
    const bar = screen.getByRole("progressbar")
    expect(bar.textContent).toContain("99%")
    expect(bar.getAttribute("aria-valuetext")).toBe("1,999 of 2,000 (99%)")
    const arc = bar.querySelectorAll("circle")[1]
    const [len, full] = arc.getAttribute("stroke-dasharray")!.split(" ").map(Number)
    expect(len / full).toBeCloseTo(0.99, 5)
  })

  it("has no animation of its own", () => {
    render(<ProgressRing done={1} total={2} label="Checked" />)
    const arc = screen.getByRole("progressbar").querySelectorAll("circle")[1]
    expect(arc.getAttribute("style")).toBeNull()
    expect(arc.getAttribute("class")).toBeNull()
  })
})

describe("Counter", () => {
  it("shows a dash for an unknown value and formats real ones", () => {
    render(<><Counter label="Valid" value={null} /><Counter label="Bounced" value={12345} tone="red" /></>)
    expect(screen.getByRole("group", { name: "Valid" }).textContent).toContain("—")
    expect(screen.getByRole("group", { name: "Bounced" }).textContent).toContain("12,345")
  })
})
