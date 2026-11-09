"use client"

import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, GripVertical, Search } from "lucide-react"
import { useEffect, useState } from "react"

import { ErrorBlock, SkeletonRows } from "@/components/md/states"
import type { TableState } from "@/components/md/use-table-query"
import { applyOrder, ariaSort, count, moveColumn, pageRange, selectionState, sortArrow, toggleAll, toggleOne } from "@/lib/table"
import type { Page } from "@/lib/types"

export type Column<T> = {
  key: string
  header: React.ReactNode
  /** Backend sort field; the header becomes a sort button. */
  sortField?: string
  render: (row: T) => React.ReactNode
  className?: string
  width?: number | string
  /** Stays where it is (no drag handle); an "actions" column always does. */
  fixed?: boolean
}

/**
 * The list table of every module (mock 07/12 look): search, sortable columns,
 * select-all + bulk bar, page size and pager, all driven by useTableQuery
 * against a backend PageResponse. Loading shows skeleton rows, errors a centred
 * block with "Try again", and `empty` decides what an empty answer says.
 * Columns can be moved by dragging their header (six-dot handle); the order
 * is kept per table in this browser. Sorting shows chevrons.
 */
export function DataTable<T>(props: {
  table: TableState<T>
  columns: Column<T>[]
  rowKey: (row: T) => string
  /** Accessible name of the table, e.g. "Users". */
  label: string
  /** Name of a row for its checkbox ("Select Ann Lee"). */
  rowLabel?: (row: T) => string
  /** Rows that may be ticked; without it there is no checkbox column. */
  selectable?: (row: T) => boolean
  /** Buttons in the bulk bar for the ticked rows of this page. */
  bulkActions?: (chosen: T[]) => React.ReactNode
  search?: { placeholder: string; label: string }
  sizes?: number[]
  /** What to show instead of the table, or null to show the table (e.g. no rows). */
  empty: (data: Page<T>) => React.ReactNode | null
  errorTitle: string
  rowClassName?: (row: T) => string | undefined
  /** Rows to leave out of the table (e.g. yourself in the users list). */
  hideRow?: (row: T) => boolean
}) {
  const { table: t, columns, rowKey, selectable } = props
  const items = (t.data?.items ?? []).filter((r) => !props.hideRow?.(r))
  const selectableIds = selectable ? items.filter(selectable).map(rowKey) : []
  const all = selectionState(selectableIds, t.selected)
  const chosen = items.filter((r) => t.selected.has(rowKey(r)))
  const range = t.data ? pageRange(t.data) : null
  const emptyNode = !t.error && t.data ? props.empty(t.data) : null
  const showTable = !t.error && !emptyNode && ((t.loading && !t.data) || items.length > 0)
  const colCount = columns.length + (selectable ? 1 : 0)
  const order = useColumnOrder(props.label, columns.map((c) => c.key))
  const shown = order.keys.map((k) => columns.find((c) => c.key === k)!).filter(Boolean)
  const [drag, setDrag] = useState<{ from: string; over?: string } | null>(null)

  return (
    <>
      <div className="table-card">
        {(props.search || (t.data && t.data.totalItems > 0)) && (
          <div className="table-top">
            {props.search && (
              <div className="input-wrap"><Search />
                <input className="input" type="search" placeholder={props.search.placeholder} value={t.q}
                  onChange={(e) => t.setQ(e.target.value)} aria-label={props.search.label} />
              </div>
            )}
            {t.data && t.data.totalItems > 0 && (
              <div className="right">Showing
                <select className="filter" style={{ height: 32 }} aria-label="Rows per page" value={t.size}
                  onChange={(e) => t.setSize(Number(e.target.value))}>
                  {(props.sizes ?? [10, 25, 50, 100]).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                of <b className="num" style={{ color: "var(--fg)" }}>{count(t.data.totalItems)}</b>
              </div>
            )}
          </div>
        )}
        {t.error ? <ErrorBlock title={props.errorTitle} error={t.error} onRetry={t.reload} /> : null}
        {emptyNode}
        {showTable && (
          <div className="tbl-scroll">
            <table className="t" aria-label={props.label} aria-busy={t.loading}>
              <thead>
                <tr>
                  {selectable && (
                    <th className="w-cb">
                      {selectableIds.length > 0 && (
                        <input type="checkbox" className="cb" aria-label="Select all on this page"
                          checked={all === "all"}
                          ref={(el) => {
                            if (el) el.indeterminate = all === "some"
                          }}
                          onChange={() => t.setSelected(toggleAll(selectableIds, t.selected))} />
                      )}
                    </th>
                  )}
                  {shown.map((c) => {
                    const fixed = c.fixed || c.key === "actions"
                    const dir = c.sortField ? sortArrow(t.sort, c.sortField) : null
                    const Sort = dir === "asc" ? ChevronUp : dir === "desc" ? ChevronDown : ChevronsUpDown
                    const cls = [fixed ? "" : "movable", drag?.from === c.key ? "dragging" : "",
                      drag?.over === c.key && drag.from !== c.key
                        ? (order.keys.indexOf(c.key) < order.keys.indexOf(drag.from) ? "drop-before" : "drop-after") : ""]
                    return (
                      <th key={c.key} style={c.width ? { width: c.width } : undefined} className={cls.join(" ").trim()}
                        aria-sort={c.sortField ? ariaSort(t.sort, c.sortField) : undefined} draggable={!fixed}
                        title={fixed ? undefined : "Drag to move this column"}
                        onDragStart={(e) => { if (fixed) return; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.key); setDrag({ from: c.key }) }}
                        onDragOver={(e) => { if (!drag || fixed) return; e.preventDefault(); if (drag.over !== c.key) setDrag({ ...drag, over: c.key }) }}
                        onDrop={(e) => { e.preventDefault(); if (drag) order.move(drag.from, c.key); setDrag(null) }}
                        onDragEnd={() => setDrag(null)}>
                        {!fixed && <GripVertical className="grip" aria-hidden="true" />}
                        {c.sortField ? (
                          <button className="sorter" onClick={() => t.sortBy(c.sortField!)}>
                            {c.header}<Sort className="sort-ic" aria-hidden="true" />
                          </button>
                        ) : c.header}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {t.loading && !t.data ? <SkeletonRows cols={colCount} rows={Math.min(t.size, 12)} /> : items.map((row) => {
                  const id = rowKey(row)
                  const on = t.selected.has(id)
                  return (
                    <tr key={id} className={[on ? "sel" : "", props.rowClassName?.(row) ?? ""].join(" ").trim() || undefined}>
                      {selectable && (
                        <td>
                          {selectable(row) && (
                            <input type="checkbox" className="cb" checked={on}
                              aria-label={props.rowLabel ? `Select ${props.rowLabel(row)}` : "Select row"}
                              onChange={(e) => t.setSelected(toggleOne(t.selected, id, e.target.checked))} />
                          )}
                        </td>
                      )}
                      {shown.map((c) => <td key={c.key} className={c.className}>{c.render(row)}</td>)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {t.data && t.data.totalPages > 1 && range && (
          <nav className="pager" aria-label="Pages">
            <span>{count(range.from)}–{count(range.to)} of {count(range.total)}</span>
            <span className="hide-sm">· Page {count(t.data.page + 1)} of {count(t.data.totalPages)}</span>
            <button className="round" style={{ width: 32, height: 32 }} aria-label="Previous page"
              disabled={t.page === 0} onClick={() => t.setPage(t.page - 1)}><ChevronLeft /></button>
            <button className="round" style={{ width: 32, height: 32 }} aria-label="Next page"
              disabled={t.page + 1 >= t.data.totalPages} onClick={() => t.setPage(t.page + 1)}><ChevronRight /></button>
          </nav>
        )}
      </div>
      {chosen.length > 0 && props.bulkActions && (
        <div className="bulkbar" role="toolbar" aria-label="Bulk actions">
          <b>{count(chosen.length)} selected</b>
          <button className="link-btn" onClick={() => t.setSelected(new Set())}>Unselect all</button>
          <span className="vr" />
          {props.bulkActions(chosen)}
        </div>
      )}
    </>
  )
}

/** The user's column order for one table, kept in this browser (localStorage). */
function useColumnOrder(table: string, keys: string[]) {
  const storageKey = `mdb-cols:${table}`
  const [saved, setSaved] = useState<string[] | null>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount (no storage on the server)
      setSaved(raw ? (JSON.parse(raw) as string[]) : null)
    } catch {
      setSaved(null)
    }
  }, [storageKey])
  const current = applyOrder(keys, saved)
  return {
    keys: current,
    move(from: string, to: string) {
      const next = moveColumn(current, from, to)
      setSaved(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // not remembered, still moved
      }
    },
  }
}
