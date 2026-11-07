"use client"

import { ChevronLeft, ChevronRight, Search } from "lucide-react"

import { ErrorState, SkeletonRows } from "@/components/md/states"
import type { TableState } from "@/components/md/use-table-query"
import { ariaSort, count, pageRange, selectionState, sortArrow, toggleAll, toggleOne } from "@/lib/table"
import type { Page } from "@/lib/types"

export type Column<T> = {
  key: string
  header: React.ReactNode
  /** Backend sort field; the header becomes a sort button. */
  sortField?: string
  render: (row: T) => React.ReactNode
  className?: string
  width?: number | string
}

/**
 * The list table of every module (mock 07/12 look): search, sortable columns,
 * select-all + bulk bar, page size and pager, all driven by useTableQuery
 * against a backend PageResponse. Loading shows skeleton rows, errors a red
 * banner with "Try again", and `empty` decides what an empty answer says.
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
}) {
  const { table: t, columns, rowKey, selectable } = props
  const items = t.data?.items ?? []
  const selectableIds = selectable ? items.filter(selectable).map(rowKey) : []
  const all = selectionState(selectableIds, t.selected)
  const chosen = items.filter((r) => t.selected.has(rowKey(r)))
  const range = t.data ? pageRange(t.data) : null
  const emptyNode = !t.error && t.data ? props.empty(t.data) : null
  const showTable = !t.error && !emptyNode && ((t.loading && !t.data) || items.length > 0)
  const colCount = columns.length + (selectable ? 1 : 0)

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
        {t.error ? <ErrorState title={props.errorTitle} error={t.error} onRetry={t.reload} style={{ margin: 16 }} /> : null}
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
                  {columns.map((c) => (
                    <th key={c.key} style={c.width ? { width: c.width } : undefined}
                      aria-sort={c.sortField ? ariaSort(t.sort, c.sortField) : undefined}>
                      {c.sortField ? (
                        <button className="sorter" onClick={() => t.sortBy(c.sortField!)}>
                          {c.header} <span className="sort" aria-hidden="true">{sortArrow(t.sort, c.sortField)}</span>
                        </button>
                      ) : c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.loading && !t.data ? <SkeletonRows cols={colCount} /> : items.map((row) => {
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
                      {columns.map((c) => <td key={c.key} className={c.className}>{c.render(row)}</td>)}
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
