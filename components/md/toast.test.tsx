import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EmptyState, ErrorState, LoadingState } from "./states"
import { ToastProvider, useToast } from "./toast"
import { ApiError } from "@/lib/api"

function Buttons() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast("Saved")}>ok</button>
      <button onClick={() => toast("Failed", "bad")}>bad</button>
    </>
  )
}

describe("toasts", () => {
  afterEach(() => vi.useRealTimers())

  it("shows a message and removes it after 5 seconds", () => {
    vi.useFakeTimers()
    render(<ToastProvider><Buttons /></ToastProvider>)
    fireEvent.click(screen.getByText("ok"))
    expect(screen.getByRole("status").textContent).toContain("Saved")
    act(() => vi.advanceTimersByTime(4900))
    expect(screen.getByRole("status").textContent).toContain("Saved")
    act(() => vi.advanceTimersByTime(200))
    expect(screen.getByRole("status").textContent).not.toContain("Saved")
  })

  it("stacks messages and closes one with its button", () => {
    render(<ToastProvider><Buttons /></ToastProvider>)
    fireEvent.click(screen.getByText("ok"))
    fireEvent.click(screen.getByText("bad"))
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0])
    expect(screen.getByRole("status").textContent).toBe("Failed")
  })
})

describe("states", () => {
  it("empty state shows title, text and action", () => {
    render(<EmptyState icon={<span />} title="No lists yet" text="Upload a file to start." action={<button>Upload</button>} />)
    expect(screen.getByRole("heading", { name: "No lists yet" })).toBeTruthy()
    expect(screen.getByText("Upload a file to start.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy()
  })

  it("error state explains the error and retries", () => {
    const retry = vi.fn()
    render(<ErrorState title="Couldn't load" error={new ApiError(503, "SERVICE_UNAVAILABLE", "x")} onRetry={retry} />)
    expect(screen.getByRole("alert").textContent).toContain("cannot be reached right now")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalled()
  })

  it("loading state is announced as busy", () => {
    render(<LoadingState label="Loading numbers" />)
    expect(screen.getByRole("status", { name: "Loading numbers" }).getAttribute("aria-busy")).toBe("true")
  })
})
