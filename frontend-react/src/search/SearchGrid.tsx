import { useMemo, type ReactElement } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { IServerSideDatasource, ColDef, GridReadyEvent, IServerSideGetRowsParams } from 'ag-grid-community'

import { apiFetch, reportRequestFailure } from '@/lib/queryClient'
import { useSearchConfig } from '@/search/hooks/useSearchConfig'
import { configCategoryToColDefs } from '@/search/lib/configToColDefs'
import { cellRenderers } from '@/search/renderers/registry'
import type { InitialSearchResponseV4, SSRMRequestV4, InitialFilter } from '@/search/types'

/**
 * SearchGrid — the load-bearing component of Phase 3.
 *
 * Renders an AG-Grid SSRM grid for a single search category. Everything that
 * could be hardcoded (columnDefs, renderer references) is instead derived from
 * the V4 search configuration JSON (Plan 04 adapter + Plan 03 registry). This
 * enforces the config-driven principle (D-3.3) at the seam where the user
 * actually sees data.
 *
 * Remount-by-key (D-3.5): the `key={`${q}-${cat}`}` on AgGridReact tears down
 * the entire grid on a new search term or category. Combined with the
 * datasource `useMemo([q, cat, initialFilter])`, this guarantees that:
 *   1. AG-Grid's SSRM cache cannot leak rows from a previous search.
 *   2. Each datasource instance owns a fresh AbortController, so navigations
 *      between searches cancel any in-flight fetch via `destroy()`.
 *
 * SSRM body shape mirrors SSRMRequestV4 (D-3.8 + backend
 * SSRMRequestV4.java) — the Java DTO is the contract, this is the React side.
 *
 * Error path: SSRM bypasses React Query, so the QueryCache.onError handler
 * in queryClient.ts never fires for grid failures. We route through
 * reportRequestFailure() directly, wrapped in setTimeout(0) per D-3.6.
 *
 * SmokeGrid lives on at frontend-react/src/grid/SmokeGrid.tsx — Plan 07
 * deletes it once SearchGrid is wired into SearchPage (Pitfall 8).
 */

export interface SearchGridProps {
  q: string
  cat: string
  initialFilter: InitialSearchResponseV4
  onGridReady?: (e: GridReadyEvent) => void
  onModelUpdated?: (rowCount: number) => void
}

/**
 * Builds the SSRM datasource for the given (q, cat, initialFilter) tuple.
 * Exported for direct unit testing — the React component wraps this in
 * useMemo with the same dep array (D-3.5).
 *
 * Each call instantiates a fresh AbortController; the returned `destroy()`
 * aborts in-flight fetches when AG-Grid tears down the datasource (which
 * happens on remount or unmount).
 */
// react-refresh/only-export-components: this helper is intentionally exported
// for direct unit testing — it is not a component, and consumers (Vitest only)
// won't trigger Fast Refresh on it.
// eslint-disable-next-line react-refresh/only-export-components
export function _test_buildDatasource(
  q: string,
  cat: string,
  initialFilter: InitialSearchResponseV4,
  searchColumn: string,
): IServerSideDatasource {
  // Silence the no-unused-vars lint hint — `q` is part of the dep tuple
  // (D-3.5) even though the body shape doesn't echo it; the keyword reaches
  // the backend via the `initialFilter.values` (ES pre-filter), not directly.
  void q
  const controller = new AbortController()
  return {
    // AG-Grid's IServerSideDatasource.getRows is declared as `(params) => void`
    // but the canonical pattern (per AG-Grid docs + SmokeGrid.tsx) is an async
    // function that awaits the fetch. The grid never reads the Promise — it
    // is purely a TypeScript-vs-async-semantics mismatch.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    getRows: async (params: IServerSideGetRowsParams) => {
      try {
        const body: SSRMRequestV4 = {
          category: cat,
          initialFilter: extractInitialFilterForCategory(initialFilter, cat, searchColumn),
          // params.request.rowGroupCols carries ColumnVO objects; the DTO
          // (and Angular parity, see search-v5-grid.component.ts:354) only
          // needs the field name.
          rowGroupCols: (params.request.rowGroupCols ?? []).map((c) => c.field ?? ''),
          groupKeys: params.request.groupKeys ?? [],
          sortModel: params.request.sortModel ?? [],
          filterModel: (params.request.filterModel ?? {}) as Record<string, unknown>,
          startRow: params.request.startRow ?? 0,
          endRow: params.request.endRow ?? 100,
          // Phase 3 ships with empty visibleColumns (parity with SmokeGrid).
          // Angular's getVisibleColumns() in search-v5-grid.component.ts
          // derives this from gridApi.getAllDisplayedColumns(); a later
          // phase may port that for SELECT DISTINCT optimization. The
          // backend tolerates an empty array — it selects all columns.
          visibleColumns: getVisibleColumns(params),
        }
        const res = await apiFetch(`/rectrace/api/v4/search/ssrm/${cat}`, {
          method: 'POST',
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const data = (await res.json()) as { rows: Record<string, unknown>[]; lastRow: number }
        params.success({ rowData: data.rows, rowCount: data.lastRow })
      } catch (err) {
        if ((err as { name?: string }).name !== 'AbortError') {
          console.error('SSRM fail', err)
          // The AG-Grid SSRM datasource bypasses React Query, so the QueryClient
          // queryCache onError handler does not fire. Surface the failure (and
          // the corr-id, when present on the error) via the same Sonner toast
          // path so users can quote the reference in a bug report.
          //
          // The deferral via setTimeout(0) prevents a Sonner 2.x race: AG-Grid's
          // initial getRows fires inside the same commit/effect cascade as the
          // Toaster's own mount, and Sonner silently drops toasts dispatched
          // before its subscriber attaches. Pushing this to the next macrotask
          // guarantees the Toaster is live when toast.error() runs.
          setTimeout(() => reportRequestFailure(err), 0)
          params.fail()
        }
      }
    },
    destroy: () => controller.abort(),
  }
}

// Builds the SSRM body's `initialFilter` from the `/initial` response and
// the category's `searchColumn` (from `/config`). The `/initial` endpoint
// only emits per-category `values`; the `column` must be derived from config
// (Resolution to RESEARCH.md Open Question #1).
function extractInitialFilterForCategory(
  resp: InitialSearchResponseV4,
  cat: string,
  searchColumn: string,
): InitialFilter | null {
  const result = resp.categoryResults[cat]
  if (!result || result.values.length === 0 || !searchColumn) return null
  return { column: searchColumn, values: result.values }
}

/**
 * Returns the list of currently displayed column IDs for the SELECT DISTINCT
 * optimization on the backend. For Phase 3 we return [] (parity with
 * SmokeGrid); a future phase can derive from
 * `params.api.getAllDisplayedColumns().map(c => c.getColId())` — Angular
 * reference: search-v5-grid.component.ts `getVisibleColumns()`.
 */
function getVisibleColumns(params: IServerSideGetRowsParams): string[] {
  void params
  return []
}

export function SearchGrid(props: SearchGridProps): ReactElement | null {
  const { q, cat, initialFilter, onGridReady, onModelUpdated } = props
  const { data: config, isLoading: configLoading } = useSearchConfig()

  const category = useMemo(
    () => config?.categories.find((c) => c.key === cat),
    [config, cat],
  )

  const columnDefs = useMemo<ColDef[]>(
    () => (category ? configCategoryToColDefs(category) : []),
    [category],
  )

  // The datasource MUST be rebuilt when (q, cat, initialFilter) changes —
  // D-3.5. Combined with the `key={`${q}-${cat}`}` below, this guarantees
  // a clean SSRM cache + a fresh AbortController on every new search.
  const datasource = useMemo<IServerSideDatasource>(
    () => _test_buildDatasource(q, cat, initialFilter, category?.searchColumn ?? ''),
    [q, cat, initialFilter, category],
  )

  // Fallback: while the config is loading or the requested category isn't
  // in the config, render nothing. UI-SPEC defers loading UX to AG-Grid's
  // built-in overlay for SSRM rows; the config load itself is so fast
  // (cached, staleTime: Infinity) that a Skeleton would flash. Returning
  // null is the simplest defensive path.
  if (configLoading || !category) {
    return null
  }

  return (
    <div className="ag-theme-quartz h-[calc(100vh-var(--header-height,2.5rem)-40px-40px-2.5rem)]">
      <AgGridReact
        key={`${q}-${cat}`}
        rowModelType="serverSide"
        serverSideDatasource={datasource}
        columnDefs={columnDefs}
        components={cellRenderers}
        sideBar={{ toolPanels: ['columns', 'filters'] }}
        cacheBlockSize={100}
        maxBlocksInCache={10}
        autoSizeStrategy={{ type: 'fitCellContents' }}
        onGridReady={onGridReady}
        onModelUpdated={(e) => onModelUpdated?.(e.api.getDisplayedRowCount())}
      />
    </div>
  )
}
