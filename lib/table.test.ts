import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ariaSort, clampPage, listParams, nextSort, pageRange, selectionState, sortArrow, toggleAll, toggleOne,
} from "./table.ts"

describe("sorting", () => {
  it("starts a new column ascending and flips the same column", () => {
    assert.deepEqual(nextSort(null, "name"), { field: "name", dir: "asc" })
    assert.deepEqual(nextSort({ field: "name", dir: "asc" }, "name"), { field: "name", dir: "desc" })
    assert.deepEqual(nextSort({ field: "name", dir: "desc" }, "name"), { field: "name", dir: "asc" })
    assert.deepEqual(nextSort({ field: "name", dir: "desc" }, "status"), { field: "status", dir: "asc" })
  })

  it("shows the direction only on the sorted column", () => {
    const s = { field: "name", dir: "desc" } as const
    assert.equal(sortArrow(s, "name"), "↓")
    assert.equal(sortArrow(s, "status"), "⇅")
    assert.equal(ariaSort(s, "name"), "descending")
    assert.equal(ariaSort(null, "name"), "none")
  })
})

describe("listParams", () => {
  it("speaks the backend's paging format", () => {
    const p = listParams({ page: 2, size: 50, sort: { field: "createdAt", dir: "desc" }, q: "  ann ",
      filters: { status: "ACTIVE", action: "", user: undefined } })
    assert.equal(p.toString(), "page=2&size=50&sort=createdAt%2Cdesc&q=ann&status=ACTIVE")
  })

  it("leaves out sort and an empty search", () => {
    assert.equal(listParams({ page: 0, size: 25, sort: null, q: "   " }).toString(), "page=0&size=25")
  })
})

describe("selection", () => {
  const ids = ["a", "b", "c"]
  it("knows none, some and all", () => {
    assert.equal(selectionState(ids, new Set()), "none")
    assert.equal(selectionState(ids, new Set(["a"])), "some")
    assert.equal(selectionState(ids, new Set(ids)), "all")
    assert.equal(selectionState([], new Set()), "none")
  })

  it("select-all picks only selectable rows and clears when all were picked", () => {
    assert.deepEqual([...toggleAll(ids, new Set(["a"]))], ids)
    assert.deepEqual([...toggleAll(ids, new Set(ids))], [])
  })

  it("toggles one row without touching the input", () => {
    const before = new Set(["a"])
    assert.deepEqual([...toggleOne(before, "b", true)], ["a", "b"])
    assert.deepEqual([...toggleOne(before, "a", false)], [])
    assert.deepEqual([...before], ["a"])
  })
})

describe("paging", () => {
  it("numbers the rows shown", () => {
    assert.deepEqual(pageRange({ page: 1, size: 25, totalItems: 30, items: new Array(5) }), { from: 26, to: 30, total: 30 })
    assert.equal(pageRange({ page: 0, size: 25, totalItems: 0, items: [] }), null)
  })

  it("never asks for a page past the end", () => {
    assert.equal(clampPage(4, 3), 2)
    assert.equal(clampPage(1, 3), 1)
    assert.equal(clampPage(5, 0), 0)
  })
})
