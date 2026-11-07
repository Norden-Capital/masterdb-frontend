import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServerHealthPill } from "./server-health-pill"
import { ConnectionPill, ExpiryPill } from "./server-pills"

describe("server pills", () => {
  it("names each health result, green only when all good", () => {
    const cases: [Parameters<typeof ServerHealthPill>[0]["status"], string, string][] = [
      ["OK", "All good", "green"], ["PROBLEM", "Problem", "red"], ["WARNING", "Warning", "amber"],
      ["ERROR", "Couldn't check", "amber"], ["NOT_CHECKED", "Not checked", "grey"], [undefined, "Never checked", "grey"],
    ]
    for (const [status, text, tone] of cases) {
      const { unmount, container } = render(<ServerHealthPill status={status} />)
      expect(screen.getByText(text)).toBeTruthy()
      expect(container.querySelector(".pill")?.className).toContain(tone)
      unmount()
    }
  })

  it("shows a changed host key as blocked, in red", () => {
    const { container } = render(<ConnectionPill status="KEY_CHANGED" />)
    expect(screen.getByText("Blocked: key changed")).toBeTruthy()
    expect(container.querySelector(".pill")?.className).toContain("red")
  })

  it("warns about a plan ending within 14 days", () => {
    const { container, rerender } = render(<ExpiryPill server={{ expiresOn: "2026-11-17", daysLeft: 10 }} />)
    expect(screen.getByText("2026-11-17 · in 10 days")).toBeTruthy()
    expect(container.querySelector(".pill")?.className).toContain("amber")
    rerender(<ExpiryPill server={{ expiresOn: "2027-03-01", daysLeft: 114 }} />)
    expect(container.querySelector(".pill")?.className).toContain("green")
  })
})
