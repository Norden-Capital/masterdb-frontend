import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { type Column, DataTable } from "./data-table"
import { useTableQuery } from "./use-table-query"

type Row = { id: string; name: string; locked: boolean }

const ROWS: Row[] = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, name: `Person ${i}`, locked: i === 1 }))

/** A fake backend list: honours page, size, q and status like a PageResponse endpoint. */
function backend(options: { fail?: boolean } = {}) {
  const calls: URLSearchParams[] = []
  const fetchMock = vi.fn(async (url: string) => {
    const p = new URL(url, "http://x").searchParams
    calls.push(p)
    if (options.fail) {
      return new Response(JSON.stringify({ code: "INTERNAL_ERROR", detail: "boom", requestId: "req-1" }),
        { status: 500, headers: { "Content-Type": "application/problem+json" } })
    }
    const q = p.get("q") ?? ""
    const all = ROWS.filter((r) => r.name.includes(q))
    const page = Number(p.get("page")), size = Number(p.get("size"))
    const body = { items: all.slice(page * size, page * size + size), page, size, totalItems: all.length,
      totalPages: Math.ceil(all.length / size) }
    return new Response(JSON.stringify(body), { status: 200 })
  })
  vi.stubGlobal("fetch", fetchMock)
  return calls
}

const columns: Column<Row>[] = [
  { key: "name", header: "Name", sortField: "name", render: (r) => r.name },
  { key: "state", header: "State", render: (r) => (r.locked ? "Locked" : "Open") },
]

function Harness({ onBulk }: { onBulk?: (rows: Row[]) => void }) {
  const t = useTableQuery<Row>({ path: "/api/v1/things", size: 10 })
  return (
    <DataTable table={t} label="Things" columns={columns} rowKey={(r) => r.id} rowLabel={(r) => r.name}
      selectable={(r) => !r.locked}
      search={{ placeholder: "Search", label: "Search things" }}
      errorTitle="Couldn't load things"
      empty={(d) => (d.totalItems === 0 ? <p>Nothing here</p> : null)}
      bulkActions={(chosen) => <button onClick={() => onBulk?.(chosen)}>Archive</button>} />
  )
}

const bodyRows = () => within(screen.getByRole("table", { name: "Things" })).getAllByRole("row").slice(1)

describe("DataTable", () => {
  beforeEach(() => vi.useRealTimers())
  afterEach(() => vi.unstubAllGlobals())

  it("loads the first page from the backend and shows the totals", async () => {
    const calls = backend()
    render(<Harness />)
    expect(await screen.findByText("Person 0")).toBeTruthy()
    expect(bodyRows()).toHaveLength(10)
    expect(calls[0].toString()).toBe("page=0&size=10")
    expect(screen.getByText("1–10 of 30")).toBeTruthy()
  })

  it("sorts by a column, flips on a second click and goes back to page 1", async () => {
    const calls = backend()
    render(<Harness />)
    await screen.findByText("Person 0")
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await screen.findByText("Person 10")
    fireEvent.click(screen.getByRole("button", { name: /Name/ }))
    await waitFor(() => expect(calls.at(-1)?.get("sort")).toBe("name,asc"))
    expect(calls.at(-1)?.get("page")).toBe("0")
    await waitFor(() => expect(screen.getByRole("columnheader", { name: /Name/ }).getAttribute("aria-sort")).toBe("ascending"))
    fireEvent.click(screen.getByRole("button", { name: /Name/ }))
    await waitFor(() => expect(calls.at(-1)?.get("sort")).toBe("name,desc"))
  })

  it("pages forward and back with the PageResponse numbers", async () => {
    const calls = backend()
    render(<Harness />)
    await screen.findByText("Person 0")
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    fireEvent.click(await screen.findByRole("button", { name: "Next page" }))
    await screen.findByText("Person 20")
    expect(calls.at(-1)?.get("page")).toBe("2")
    expect(screen.getByText("21–30 of 30")).toBeTruthy()
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("changes the page size and starts again at page 1", async () => {
    const calls = backend()
    render(<Harness />)
    await screen.findByText("Person 0")
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), { target: { value: "25" } })
    await waitFor(() => expect(bodyRows()).toHaveLength(25))
    expect(calls.at(-1)?.toString()).toBe("page=0&size=25")
  })

  it("searches after a pause in typing", async () => {
    const calls = backend()
    render(<Harness />)
    await screen.findByText("Person 0")
    fireEvent.change(screen.getByRole("searchbox", { name: "Search things" }), { target: { value: "Person 2" } })
    await waitFor(() => expect(calls.at(-1)?.get("q")).toBe("Person 2"), { timeout: 2000 })
    await waitFor(() => expect(bodyRows()).toHaveLength(10)) // "Person 2", "Person 20".."Person 29"
    expect(screen.getByText("1–10 of 11")).toBeTruthy()
  })

  it("select-all ticks only selectable rows and the bulk bar acts on them", async () => {
    backend()
    const onBulk = vi.fn()
    render(<Harness onBulk={onBulk} />)
    await screen.findByText("Person 0")
    expect(screen.queryByRole("checkbox", { name: "Select Person 1" })).toBeNull() // locked row
    const all = screen.getByRole("checkbox", { name: "Select all on this page" }) as HTMLInputElement
    fireEvent.click(all)
    expect(all.checked).toBe(true)
    const bar = screen.getByRole("toolbar", { name: "Bulk actions" })
    expect(within(bar).getByText("9 selected")).toBeTruthy()
    fireEvent.click(within(bar).getByRole("button", { name: "Archive" }))
    expect(onBulk.mock.calls[0][0].map((r: Row) => r.id)).not.toContain("r1")
    expect(onBulk.mock.calls[0][0]).toHaveLength(9)

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Person 0" }))
    expect(all.checked).toBe(false)
    expect(all.indeterminate).toBe(true)
    fireEvent.click(within(bar).getByRole("button", { name: "Unselect all" }))
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).toBeNull()
  })

  it("clears the selection when another page arrives", async () => {
    backend()
    render(<Harness />)
    await screen.findByText("Person 0")
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Person 0" }))
    expect(screen.getByRole("toolbar", { name: "Bulk actions" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    await screen.findByText("Person 10")
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).toBeNull()
  })

  it("shows the empty state the page chose", async () => {
    backend()
    render(<Harness />)
    await screen.findByText("Person 0")
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nobody" } })
    expect(await screen.findByText("Nothing here", {}, { timeout: 2000 })).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()
  })

  it("shows the backend's error with a working Try again", async () => {
    const calls = backend({ fail: true })
    render(<Harness />)
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Couldn't load things")
    expect(alert.textContent).toContain("Reference: req-1")
    await act(async () => fireEvent.click(within(alert).getByRole("button", { name: "Try again" })))
    await waitFor(() => expect(calls.length).toBe(2))
  })

  it("shows skeleton rows while the first page loads", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))
    render(<Harness />)
    const table = screen.getByRole("table", { name: "Things" })
    expect(table.getAttribute("aria-busy")).toBe("true")
    expect(table.querySelectorAll(".skel").length).toBeGreaterThan(0)
  })
})
