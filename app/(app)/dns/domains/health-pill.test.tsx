import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { HealthPill } from "./health-pill"

describe("HealthPill", () => {
  it("names each health result", () => {
    const cases: [Parameters<typeof HealthPill>[0]["status"], string][] = [
      ["OK", "All good"], ["PROBLEM", "Problem"], ["ERROR", "Lookup failed"], ["NOT_CHECKED", "Not checked"],
      [undefined, "Never checked"],
    ]
    for (const [status, text] of cases) {
      const { unmount } = render(<HealthPill status={status} />)
      expect(screen.getByText(text)).toBeTruthy()
      unmount()
    }
  })

  it("is green only when all good and red for a problem", () => {
    const { container, rerender } = render(<HealthPill status="OK" />)
    expect(container.querySelector(".pill")?.className).toContain("green")
    rerender(<HealthPill status="PROBLEM" />)
    expect(container.querySelector(".pill")?.className).toContain("red")
  })
})
