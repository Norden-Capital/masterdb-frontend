import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InstallJob } from "./install-job"

const STEPS = [
  { key: "preflight", label: "Check the operating system", state: "DONE" },
  { key: "packages", label: "Install Postfix, Dovecot and OpenDKIM", state: "DONE" },
  { key: "hostname", label: "Set the host name", state: "RUNNING" },
  { key: "postfix", label: "Configure Postfix", state: "PENDING" },
]

function job(over: object) {
  return {
    publicId: "j1", serverId: "s1", serverName: "mx1", domain: "example.com", heloHost: "mail.example.com", webmail: false,
    status: "RUNNING", stepsDone: 2, stepsTotal: 4, currentStep: "hostname", steps: STEPS, log: "", logLength: 0, logFrom: 0,
    dkimSelector: "mail", createdAt: "2026-11-07T09:00:00Z", ...over,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("InstallJob", () => {
  it("shows exactly the steps the server reported, and only new log text is asked for", async () => {
    const urls: string[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url)
      return new Response(JSON.stringify(job({ log: "▶ Step 1 of 4\nSupported.\n", logLength: 26 })), { status: 200 })
    }))
    render(<InstallJob id="j1" />)
    await waitFor(() => expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("2 of 4 (50%)"))
    expect(screen.getByLabelText("Set the host name: running")).toBeTruthy()
    expect(screen.getByLabelText("Configure Postfix: pending")).toBeTruthy()
    expect(screen.getByLabelText("Install output").textContent).toContain("Supported.")
    expect(screen.getByText("Running")).toBeTruthy()
    expect(urls[0]).toBe("/api/v1/mta/installs/j1?logFrom=0")
  })

  it("stops polling and shows the reason when the install failed", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(job({
      status: "FAILED", error: "Step \"Set the host name\" failed (exit code 1).",
      steps: STEPS.map((s) => s.key === "hostname" ? { ...s, state: "FAILED" } : s),
    })), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const onFinished = vi.fn()
    render(<InstallJob id="j1" onFinished={onFinished} />)
    await waitFor(() => expect(screen.getByText("The install stopped")).toBeTruthy())
    expect(screen.getByText("Step \"Set the host name\" failed (exit code 1).")).toBeTruthy()
    expect(onFinished).toHaveBeenCalledTimes(1)
    await new Promise((r) => setTimeout(r, 1700))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
