import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ListItem } from "@/lib/lists"
import { ImportReport } from "./import-flow"
import { ValidationSummary } from "./validation-summary"

function list(over: Partial<ListItem>): ListItem {
  return {
    publicId: "l1", name: "Leads", esp: "", country: "", vertical: "", removeDuplicates: true, splitSize: 0, source: "FILE",
    sourceName: "leads.csv", status: "READY", records: 4, parts: 1, upload: { size: 100, received: 100 }, createdAt: "2026-11-08T09:00:00Z",
    ...over,
  }
}

const value = (label: string) => within(screen.getByRole("group", { name: label })).getByText(/^[\d,—]+$/).textContent

describe("ImportReport", () => {
  it("shows every count of the report", () => {
    render(<ImportReport list={list({ report: { totalLines: 1200, imported: 1000, invalid: 50, duplicates: 150, duplicatesRemoved: true, inOtherLists: 7 } })} />)
    expect(value("Lines in the file")).toBe("1,200")
    expect(value("Imported")).toBe("1,000")
    expect(value("Invalid syntax")).toBe("50")
    expect(value("Duplicates removed")).toBe("150")
    expect(value("Already in other lists")).toBe("7")
  })

  it("says repeats were kept when remove duplicates was No", () => {
    render(<ImportReport list={list({ report: { totalLines: 3, imported: 3, invalid: 0, duplicates: 1, duplicatesRemoved: false, inOtherLists: 0 } })} />)
    expect(value("Repeated (kept)")).toBe("1")
    expect(screen.queryByRole("group", { name: "Duplicates removed" })).toBeNull()
  })
})

describe("ValidationSummary", () => {
  it("shows the job running now with its real progress", () => {
    render(<ValidationSummary list={list({ validation: { running: { publicId: "j1", status: "RUNNING", total: 400, checked: 100 } } })} />)
    expect(screen.getByRole("link").textContent).toBe("Validating 25% · 100 of 400")
  })

  it("shows the latest counts in category order, or that nothing was validated", () => {
    const { rerender } = render(<ValidationSummary list={list({ validation: { counts: { UNKNOWN: 2, VALID: 9, BOUNCE: 0 } } })} />)
    expect(screen.getByText("Valid 9")).toBeTruthy()
    expect(screen.getByText("Unknown 2")).toBeTruthy()
    expect(screen.queryByText(/Bounce/)).toBeNull()
    rerender(<ValidationSummary list={list({})} />)
    expect(screen.getByText("Not validated")).toBeTruthy()
  })
})
