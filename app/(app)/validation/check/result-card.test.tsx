import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { CheckResult } from "@/lib/types"
import { ResultCard } from "./result-card"

const RESULT: CheckResult = {
  publicId: "c1", email: "gone@example.com", serverName: "probe1", serverIp: "203.0.113.5",
  heloHost: "mail.probe.example", mailFrom: "postmaster@probe.example", category: "BOUNCE", smtpCode: 550,
  mxHost: "mx.example.com", reason: "The mailbox doesn't exist.", reply: "550 5.1.1 User unknown",
  transcript: ["-- mx.example.com (198.51.100.7)", "<< 220 mx ESMTP", ">> EHLO mail.probe.example"], durationMs: 1250,
  checkedBy: "owner@example.com", createdAt: "2026-11-07T09:00:03Z",
}

describe("ResultCard", () => {
  it("explains the six categories before the first check", () => {
    render(<ResultCard result={null} onClose={vi.fn()} />)
    for (const label of ["Valid", "Bounce", "Soft bounce", "Reject", "Catch-all", "Unknown"]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it("shows the category, the reason, the provider's words and the conversation", () => {
    const { container } = render(<ResultCard result={RESULT} onClose={vi.fn()} />)
    expect(container.querySelector(".pill.red")?.textContent).toBe("Bounce")
    expect(screen.getByText("The mailbox doesn't exist.")).toBeTruthy()
    expect(screen.getByText("550 5.1.1 User unknown")).toBeTruthy()
    expect(screen.getByText("mx.example.com · 550")).toBeTruthy()
    expect(screen.getByLabelText("SMTP conversation").textContent).toContain(">> EHLO mail.probe.example")
    expect(screen.getByText(/1\.3 s/)).toBeTruthy()
  })
})
