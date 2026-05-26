// src/search/SearchGridPanel.tsx
import { useCallback, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { FirstDataRenderedEvent, GridApi, GridReadyEvent } from 'ag-grid-community'
import { toast } from 'sonner'

import { GridToolbar } from '@/search/GridToolbar'
import { SearchGrid } from '@/search/SearchGrid'
import { RowDetailSheet } from '@/search/RowDetailSheet'
import { buildExportFilename } from '@/search/lib/buildExportFilename'
import { decodeViewState, encodeViewState, type GridViewState } from '@/search/lib/gridViewState'
import type { GridDensity } from '@/search/lib/gridConfig'
import type { CategoryResultV4 } from '@/search/types'
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
  const navigate = useNavigate({ from: '/search' })

  const apiRef = useRef<GridApi | null>(null)
  const [density, setDensity] = useState<GridDensity>('normal')
  const [isDeduplicated, setIsDeduplicated] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [detailRow, setDetailRow] = useState<Record<string, unknown> | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const onGridReady = useCallback((e: GridReadyEvent) => {
    apiRef.current = e.api
  }, [])

  // Restore a shared view once the grid has data (column/filter state needs a
  // ready grid + first block). Density/dedup are local state.
  const onFirstDataRendered = useCallback(
    (e: FirstDataRenderedEvent) => {
      if (!view) return
      const state = decodeViewState(view)
      if (!state) return
      e.api.applyColumnState({ state: state.columnState, applyOrder: true })
      e.api.setFilterModel(state.filterModel)
      setDensity(state.density)
      setIsDeduplicated(state.dedup)
    },
    [view],
  )

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
    try {
      const cols = api.getColumns()
      const columnKeys = cols ? cols.filter((c) => c.getColId() !== 'execution_order').map((c) => c.getColId()) : undefined
      api.exportDataAsExcel({ fileName: buildExportFilename(category.key, q), columnKeys })
    } catch (err) {
      reportRequestFailure(err)
    } finally {
      setIsExporting(false)
    }
  }, [category.key, q, isExporting])

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
    const state: GridViewState = {
      columnState: api.getColumnState(),
      filterModel: api.getFilterModel(),
      dedup: isDeduplicated,
      density,
    }
    const encoded = encodeViewState(state)
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, view: encoded }), replace: true }).then(() => {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => toast.success('Link copied'))
        .catch(() => toast.error('Copy failed'))
    })
  }, [density, isDeduplicated, navigate])

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
            onGridReady={onGridReady}
            onFirstDataRendered={onFirstDataRendered}
            onRowDoubleClicked={openDetail}
          />
        </div>
      </main>
      <RowDetailSheet open={sheetOpen} onOpenChange={setSheetOpen} row={detailRow} columns={category.columns} />
    </div>
  )
}
