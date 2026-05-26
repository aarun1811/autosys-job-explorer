import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type {
  IServerSideDatasource,
  ColDef,
  GridReadyEvent,
  IServerSideGetRowsParams,
  FirstDataRenderedEvent,
  RowDoubleClickedEvent,
  ColumnVisibleEvent,
} from 'ag-grid-community'
import { GRID_SIDEBAR, rowHeightForDensity, headerHeightForDensity, type GridDensity } from '@/search/lib/gridConfig'

import { apiFetch, reportRequestFailure } from '@/lib/queryClient'
import { columnsToColDefs } from '@/search/lib/configToColDefs'
import { cellRenderers } from '@/search/renderers/registry'
import type { CategoryResultV4, SSRMRequestV4 } from '@/search/types'
import {
  buildSsrmRowId, getVisibleColumnIds, convertFilterModel, buildInitialFilter, FRONTEND_ONLY_COLUMNS,
} from '@/search/lib/ssrm'

/**
 * SearchGrid — an AG-Grid SSRM grid for ONE search category.
 *
 * Self-sufficient from the `/api/v4/search/initial` response (Angular parity):
 * column defs come from the category's inline `columns[]`, and the SSRM filter
 * column is the column flagged `rowGroup: true` (Angular
 * search-v5-grid.component.ts:330). No `/config` round-trip.
 *
 * Clean remount on tab switch (spec §D): `key={`${q}-${category.key}`}` tears
 * down the grid and the datasource `useMemo([q, category])` rebuilds — so the
 * SSRM cache cannot leak rows across categories and a fresh AbortController
 * cancels any in-flight fetch from the previous tab via `destroy()`.
 */
export interface SearchGridProps {
  q: string
  category: CategoryResultV4
  density: GridDensity
  onGridReady?: (e: GridReadyEvent) => void
  onFirstDataRendered?: (e: FirstDataRenderedEvent) => void
  /** Fired on double-click of a LEAF row (group rows ignored). */
  onRowDoubleClicked?: (data: Record<string, unknown>) => void
}

/**
 * Builds the SSRM datasource for a (q, category) pair. Exported for direct unit
 * testing; the component wraps it in `useMemo` with the same deps (spec §D).
 */
// react-refresh/only-export-components: intentionally exported for unit tests;
// not a component, and Vitest is the only consumer.
// eslint-disable-next-line react-refresh/only-export-components
export function _test_buildDatasource(q: string, category: CategoryResultV4): IServerSideDatasource {
  // `q` participates in the remount key/dep tuple; the keyword reaches the
  // backend via initialFilter.values (the ES pre-filter), not the body directly.
  void q
  const controller = new AbortController()
  return {
    // AG-Grid types getRows as `(params) => void`; the canonical pattern is an
    // async body the grid never awaits — a TS-vs-async mismatch only.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    getRows: async (params: IServerSideGetRowsParams) => {
      try {
        const body: SSRMRequestV4 = {
          category: category.key,
          initialFilter: buildInitialFilter(category),
          rowGroupCols: (params.request.rowGroupCols ?? []).map((c) => c.field ?? ''),
          groupKeys: params.request.groupKeys ?? [],
          sortModel: params.request.sortModel ?? [],
          filterModel: convertFilterModel(params.request.filterModel as Record<string, unknown>),
          startRow: params.request.startRow ?? 0,
          endRow: params.request.endRow ?? 100,
          visibleColumns: getVisibleColumnIds(
            params.api.getColumnState(),
            params.api.getRowGroupColumns().map((c) => c.getColId()),
          ),
        }
        const res = await apiFetch(`/rectrace/api/v4/search/ssrm/${category.key}`, {
          method: 'POST',
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const data = (await res.json()) as { rows: Record<string, unknown>[]; lastRow: number }
        params.success({ rowData: data.rows, rowCount: data.lastRow })
      } catch (err) {
        if ((err as { name?: string }).name !== 'AbortError') {
          // SSRM bypasses React Query; route failures through the same Sonner
          // path. setTimeout(0) avoids the Sonner-2.x mount race (D-3.6).
          setTimeout(() => reportRequestFailure(err), 0)
          params.fail()
        }
      }
    },
    destroy: () => controller.abort(),
  }
}

export function SearchGrid({
  q,
  category,
  density,
  onGridReady,
  onFirstDataRendered,
  onRowDoubleClicked,
}: SearchGridProps): ReactElement {
  const columnDefs = useMemo<ColDef[]>(() => columnsToColDefs(category.columns), [category])
  const datasource = useMemo<IServerSideDatasource>(() => _test_buildDatasource(q, category), [q, category])
  const colVisTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cancel a pending column-visibility refresh if the grid unmounts (tab switch).
  useEffect(() => () => { if (colVisTimer.current) clearTimeout(colVisTimer.current) }, [])

  return (
    <div className="ag-theme-quartz h-full w-full">
      <AgGridReact
        key={`${q}-${category.key}`}
        rowModelType="serverSide"
        serverSideDatasource={datasource}
        columnDefs={columnDefs}
        components={cellRenderers}
        getRowId={buildSsrmRowId}
        defaultColDef={{ sortable: true, filter: true, resizable: true, minWidth: 100, flex: 1 }}
        autoGroupColumnDef={{
          headerName: category.columns[0]?.headerName,
          minWidth: 250,
          cellRendererParams: { suppressCount: false },
        }}
        sideBar={GRID_SIDEBAR}
        rowGroupPanelShow="always"
        groupDefaultExpanded={0}
        animateRows
        enableCellTextSelection
        suppressCellFocus
        suppressMakeColumnVisibleAfterUnGroup={false}
        tooltipShowDelay={0}
        tooltipHideDelay={2000}
        rowHeight={rowHeightForDensity(density)}
        headerHeight={headerHeightForDensity(density)}
        cacheBlockSize={100}
        maxBlocksInCache={10}
        onGridReady={onGridReady}
        onFirstDataRendered={onFirstDataRendered}
        onRowDoubleClicked={(e: RowDoubleClickedEvent) => {
          if (!e.node.group && e.data) onRowDoubleClicked?.(e.data as Record<string, unknown>)
        }}
        onColumnRowGroupChanged={(e) => e.api.refreshServerSide({ purge: true })}
        onColumnVisible={(e: ColumnVisibleEvent) => {
          if (e.source === 'gridInitializing') return
          const id = e.column?.getColId()
          if (id && FRONTEND_ONLY_COLUMNS.has(id)) return
          if (colVisTimer.current) clearTimeout(colVisTimer.current)
          colVisTimer.current = setTimeout(() => e.api.refreshServerSide({ purge: true }), 500)
        }}
      />
    </div>
  )
}
