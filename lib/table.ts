/**
 * Data table logic shared by every list page, free of React so it can be
 * tested on its own. Paging matches the backend's PageResponse
 * ({items, page, size, totalItems, totalPages}, page counted from 0) and its
 * `sort=field,asc|desc` parameter.
 */
import type { Page } from "./types.ts"

export type Sort = { field: string; dir: "asc" | "desc" }

/** Clicking a column: a new column starts ascending, the same column flips. */
export function nextSort(current: Sort | null, field: string): Sort {
  return { field, dir: current?.field === field && current.dir === "asc" ? "desc" : "asc" }
}

export function sortArrow(current: Sort | null, field: string): "unsorted" | "asc" | "desc" {
  if (current?.field !== field) return "unsorted"
  return current.dir
}

/**
 * Column order for a table: the user's saved order, with columns the table
 * no longer has dropped and new columns added at the end, so a saved order
 * never hides or loses a column.
 */
export function applyOrder(keys: readonly string[], saved: readonly string[] | null): string[] {
  if (!saved) return [...keys]
  const known = saved.filter((k) => keys.includes(k))
  return [...known, ...keys.filter((k) => !known.includes(k))]
}

/** Move column `from` to where column `to` is (drag and drop). */
export function moveColumn(order: readonly string[], from: string, to: string): string[] {
  const i = order.indexOf(from)
  const j = order.indexOf(to)
  if (i < 0 || j < 0 || i === j) return [...order]
  const next = [...order]
  next.splice(i, 1)
  next.splice(j, 0, from)
  return next
}

/** aria-sort for a column header. */
export function ariaSort(current: Sort | null, field: string): "ascending" | "descending" | "none" {
  if (current?.field !== field) return "none"
  return current.dir === "asc" ? "ascending" : "descending"
}

/** The query string for a list call; empty filters and an empty search are left out. */
export function listParams(state: {
  page: number
  size: number
  sort: Sort | null
  q?: string
  filters?: Record<string, string | undefined>
}): URLSearchParams {
  const p = new URLSearchParams({ page: String(state.page), size: String(state.size) })
  if (state.sort) p.set("sort", `${state.sort.field},${state.sort.dir}`)
  if (state.q?.trim()) p.set("q", state.q.trim())
  for (const [k, v] of Object.entries(state.filters ?? {})) if (v) p.set(k, v)
  return p
}

/** Header checkbox: nothing, some or every selectable row on this page is ticked. */
export function selectionState(selectable: readonly string[], selected: ReadonlySet<string>): "none" | "some" | "all" {
  const n = selectable.filter((id) => selected.has(id)).length
  if (n === 0) return "none"
  return n === selectable.length ? "all" : "some"
}

/** Header checkbox clicked: select every selectable row, or none when all were. */
export function toggleAll(selectable: readonly string[], selected: ReadonlySet<string>): Set<string> {
  return selectionState(selectable, selected) === "all" ? new Set() : new Set(selectable)
}

export function toggleOne(selected: ReadonlySet<string>, id: string, on: boolean): Set<string> {
  const next = new Set(selected)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

/** "26–50 of 1,234" numbers for the pager; null when the page is empty. */
export function pageRange(page: Pick<Page<unknown>, "page" | "size" | "totalItems" | "items">):
  { from: number; to: number; total: number } | null {
  if (page.items.length === 0) return null
  const from = page.page * page.size + 1
  return { from, to: from + page.items.length - 1, total: page.totalItems }
}

/** The last page that exists, e.g. after rows on the last page were deleted. */
export function clampPage(page: number, totalPages: number): number {
  return totalPages === 0 ? 0 : Math.min(page, totalPages - 1)
}

export function count(n: number): string {
  return n.toLocaleString("en-CA")
}
