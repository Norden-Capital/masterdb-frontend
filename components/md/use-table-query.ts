"use client"

import { useCallback, useEffect, useState } from "react"

import { api } from "@/lib/api"
import { clampPage, listParams, nextSort, type Sort } from "@/lib/table"
import type { Page } from "@/lib/types"

export type Filters = Record<string, string>

/** Everything a <DataTable> needs: the server's page plus the paging/sort/filter/selection state behind it. */
export type TableState<T> = {
  data: Page<T> | null
  /** True until the first answer (or after reload()); later fetches keep showing the old rows. */
  loading: boolean
  error: unknown
  reload: () => void
  q: string
  setQ: (q: string) => void
  /** The search actually sent (after the typing pause). */
  query: string
  filters: Filters
  setFilter: (key: string, value: string) => void
  clearFilters: () => void
  /** A search or any filter differs from the start values. */
  filtered: boolean
  page: number
  setPage: (page: number) => void
  size: number
  setSize: (size: number) => void
  sort: Sort | null
  sortBy: (field: string) => void
  selected: Set<string>
  setSelected: (s: Set<string>) => void
}

/**
 * Loads one page of a backend list (`GET path?page&size&sort&q&...filters`,
 * answered as PageResponse). Search waits for a 300 ms pause in typing; any
 * change of search, filter, sort or page size goes back to the first page.
 * The selection is cleared whenever a new page arrives.
 *
 * `toParams` turns the filter values into query parameters when they are not
 * the same thing (e.g. "last 7 days" → from=<date>); keep it stable (module
 * level or useCallback).
 */
export function useTableQuery<T>(options: {
  path: string
  enabled?: boolean
  sort?: Sort
  size?: number
  filters?: Filters
  toParams?: (filters: Filters) => Filters
}): TableState<T> {
  const { path, enabled = true, toParams } = options
  const [initialFilters] = useState<Filters>(() => options.filters ?? {})
  const [q, setQ] = useState("")
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [page, setPage] = useState(0)
  const [size, setSizeState] = useState(options.size ?? 25)
  const [sort, setSort] = useState<Sort | null>(options.sort ?? null)
  const [data, setData] = useState<Page<T> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (q.trim() === query) return
    const t = setTimeout(() => {
      setQuery(q.trim())
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [q, query])

  useEffect(() => {
    if (!enabled) return
    const params = listParams({ page, size, sort, q: query, filters: toParams ? toParams(filters) : filters })
    const ctl = new AbortController()
    api<Page<T>>(`${path}?${params}`, { signal: ctl.signal })
      .then(
        (d) => {
          const last = clampPage(page, d.totalPages)
          if (last !== page) {
            setPage(last)
            return
          }
          setData(d)
          setError(null)
          setSelected(new Set())
        },
        (e) => {
          if ((e as Error)?.name !== "AbortError") setError(e)
        },
      )
      .finally(() => {
        if (!ctl.signal.aborted) setLoading(false)
      })
    return () => ctl.abort()
  }, [path, enabled, page, size, sort, query, filters, toParams, reloadKey])

  const reload = useCallback(() => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }, [])

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(0)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(initialFilters)
    setQ("")
    setQuery("")
    setPage(0)
  }, [initialFilters])

  const setSize = useCallback((n: number) => {
    setSizeState(n)
    setPage(0)
  }, [])

  const sortBy = useCallback((field: string) => {
    setSort((s) => nextSort(s, field))
    setPage(0)
  }, [])

  const filtered = !!query || Object.entries(filters).some(([k, v]) => (initialFilters[k] ?? "") !== v)

  return {
    data, loading, error, reload, q, setQ, query, filters, setFilter, clearFilters, filtered,
    page, setPage, size, setSize, sort, sortBy, selected, setSelected,
  }
}
