import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServicePill } from "./service-pill"

describe("ServicePill", () => {
  it("shows the service and its state, green only when active", () => {
    const { container, rerender } = render(<ServicePill name="postfix" state="active" />)
    expect(screen.getByText("postfix: active")).toBeTruthy()
    expect(container.querySelector(".pill")?.className).toContain("green")
    rerender(<ServicePill name="opendkim" state="failed" />)
    expect(container.querySelector(".pill")?.className).toContain("red")
  })
})
