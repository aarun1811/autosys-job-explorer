// src/search/SearchGridPanel.tsx
import { useCallback, useMemo, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import type { GridApi, GridReadyEvent, GridState, IsServerSideGroupOpenByDefaultParams } from 'ag-grid-community'
import { toast } from 'sonner'

import { GridToolbar } from '@/search/GridToolbar'
import { SearchGrid } from '@/search/SearchGrid'
import { RowDetailSheet } from '@/search/RowDetailSheet'
import { exportSearchToExcel } from '@/search/lib/exportSearch'
import { getVisibleColumnIds, convertFilterModel, buildInitialFilter, groupNodeRoute, makeIsGroupOpen } from '@/search/lib/ssrm'
import { decodeViewState, encodeViewState, viewStateToGridState, type GridViewState } from '@/search/lib/gridViewState'
import type { GridDensity } from '@/search/lib/gridConfig'
import type { CategoryResultV4, ExportRequestV4, SortModelItem } from '@/search/types'
import { reportRequestFailure } from '@/lib/queryClient'

/**
 * SearchGridPanel — orchestrates one active category: owns the GridApi ref and
 * the view state (density, dedup, sidebar visibility, detail row), wires every
 * toolbar action to the API, and handles the explicit Share-view URL + restore.
 * The grid itself and column derivation stay in SearchGrid (unchanged data flow).
 */
export interface SearchGridPanelProps {
  q: string
  category: CategoryResultV4
}

export function SearchGridPanel({ q, category }: SearchGridPanelProps): React.ReactElement {
  const { view } = useSearch({ from: '/search' })

  // Decode the shared view once. Drives the grid's initialState (columns/filter/
  // grouping/sort), the declarative group-expansion predicate, and the seeded
  // density/dedup below.
  const restored = useMemo(() => (view ? decodeViewState(view) : null), [view])

  const apiRef = useRef<GridApi | null>(null)
  const [density, setDensity] = useState<GridDensity>(() => restored?.density ?? 'normal')
  const [isDeduplicated, setIsDeduplicated] = useState(() => restored?.dedup ?? false)
  const [isExporting, setIsExporting] = useState(false)
  const [activeFilterCount, setActiveFilterCount] = useState(0)
  const [detailRow, setDetailRow] = useState<Record<string, unknown> | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Restore columns/grouping/sort/filter via the grid's initialState — applied at
  // construction, so the initial SSRM fetch already reflects the shared grouping
  // and the AgGridReact columnDefs reconciliation can't revert a nested group
  // level (the bug the old onFirstDataRendered applyColumnState hit).
  const initialState = useMemo<GridState | undefined>(
    () => (restored ? viewStateToGridState(restored) : undefined),
    [restored],
  )

  // Group expansion is restored declaratively: AG-Grid calls this for every group
  // node as it loads (each nesting level, and again after any purge), so it
  // survives the regroup/filter purges that an imperative setExpanded could not.
  const isGroupOpenByDefault = useMemo(() => {
    const isOpen = makeIsGroupOpen(restored?.expandedGroups ?? [])
    return (p: IsServerSideGroupOpenByDefaultParams) => isOpen(p.rowNode)
  }, [restored])

  const onGridReady = useCallback((e: GridReadyEvent) => {
    apiRef.current = e.api
    // Keep the toolbar's active-filter badge in sync with the grid filter model.
    e.api.addEventListener('filterChanged', () => {
      setActiveFilterCount(Object.keys(e.api.getFilterModel() ?? {}).length)
    })
  }, [])

  const onToggleSidebar = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    const visible = api.isSideBarVisible()
    api.setSideBarVisible(!visible)
    // Angular parity (toggleSidePanel): on open, expand the Columns panel —
    // not just the tab strip — so the column list is immediately usable.
    if (!visible) api.openToolPanel('columns')
  }, [])

  const onToggleDensity = useCallback(() => {
    setDensity((d) => (d === 'compact' ? 'normal' : 'compact'))
  }, [])

  const onAutoSize = useCallback(() => apiRef.current?.autoSizeAllColumns(), [])

  const onResetView = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    api.resetColumnState()
    api.setFilterModel(null)
    api.collapseAll()
    setDensity('normal')
  }, [])

  const onExpandAll = useCallback(() => apiRef.current?.expandAll(), [])
  const onCollapseAll = useCallback(() => apiRef.current?.collapseAll(), [])
  const onClearFilters = useCallback(() => apiRef.current?.setFilterModel(null), [])
  const onRefresh = useCallback(() => apiRef.current?.refreshServerSide({ purge: true }), [])

  const onToggleDedup = useCallback(() => {
    // Angular-faithful: toggle the visual flag + refresh; no backend flag.
    setIsDeduplicated((v) => !v)
    apiRef.current?.refreshServerSide({ purge: true })
  }, [])

  const onExportExcel = useCallback(() => {
    const api = apiRef.current
    if (!api || isExporting) return
    setIsExporting(true)
    const colState = api.getColumnState()
    const body: ExportRequestV4 = {
      category: category.key,
      initialFilter: buildInitialFilter(category),
      columns: getVisibleColumnIds(colState, api.getRowGroupColumns().map((c) => c.getColId())),
      rowGroupCols: api.getRowGroupColumns().map((c) => c.getColId()),
      sortModel: colState
        .filter((c) => c.sort)
        .map((c): SortModelItem => ({ colId: c.colId, sort: c.sort as 'asc' | 'desc' })),
      filterModel: convertFilterModel(api.getFilterModel()),
    }
    exportSearchToExcel(category.key, body)
      .catch((err) => reportRequestFailure(err))
      .finally(() => setIsExporting(false))
  }, [category, isExporting])

  const onCopy = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    const rows: Record<string, unknown>[] = []
    api.forEachNode((node) => {
      if (!node.group && node.data) rows.push(node.data as Record<string, unknown>)
    })
    if (rows.length === 0) {
      toast('Nothing to copy')
      return
    }
    const headers = category.columns.map((c) => c.headerName).join('\t')
    const body = rows.map((r) => category.columns.map((c) => {
      const v = r[c.field]
      if (v === undefined || v === null) return ''
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
      return JSON.stringify(v)
    }).join('\t')).join('\n')
    navigator.clipboard
      .writeText(`${headers}\n${body}`)
      .then(() => toast.success(`Copied ${rows.length} rows`))
      .catch(() => toast.error('Copy failed'))
  }, [category.columns])

  const onShare = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    const expandedGroups: string[] = []
    api.forEachNode((node) => {
      if (node.group && node.expanded) expandedGroups.push(groupNodeRoute(node))
    })
    const state: GridViewState = {
      columnState: api.getColumnState(),
      filterModel: api.getFilterModel(),
      dedup: isDeduplicated,
      density,
      expandedGroups,
    }
    const encoded = encodeViewState(state)
    // Build the shareable link and copy it WITHOUT navigating the current
    // session: navigating re-renders the grid, which re-applies the column defs
    // and resets runtime column visibility + collapses expanded groups. The
    // recipient's grid restores everything from `view` on load.
    const url = new URL(window.location.href)
    url.searchParams.set('view', encoded)
    navigator.clipboard
      .writeText(url.toString())
      .then(() => toast.success('Link copied'))
      .catch(() => toast.error('Copy failed'))
  }, [density, isDeduplicated])

  const openDetail = useCallback((data: Record<string, unknown>) => {
    setDetailRow(data)
    setSheetOpen(true)
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <GridToolbar
        density={density}
        isDeduplicated={isDeduplicated}
        isExporting={isExporting}
        categoryLabel={category.label}
        resultCount={category.count}
        activeFilterCount={activeFilterCount}
        onToggleSidebar={onToggleSidebar}
        onToggleDensity={onToggleDensity}
        onAutoSize={onAutoSize}
        onResetView={onResetView}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
        onClearFilters={onClearFilters}
        onRefresh={onRefresh}
        onToggleDedup={onToggleDedup}
        onExportExcel={onExportExcel}
        onCopy={onCopy}
        onShare={onShare}
      />
      <main className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
        <div className="h-full overflow-hidden rounded-xl border bg-card shadow-sm">
          <SearchGrid
            q={q}
            category={category}
            density={density}
            initialState={initialState}
            isGroupOpenByDefault={isGroupOpenByDefault}
            onGridReady={onGridReady}
            onRowDoubleClicked={openDetail}
          />
        </div>
      </main>
      <RowDetailSheet open={sheetOpen} onOpenChange={setSheetOpen} row={detailRow} columns={category.columns} />
    </div>
  )
}
