// src/search/lib/gridViewState.ts
import type { ColumnState, GridState, SortModelItem } from 'ag-grid-community'
import type { GridDensity } from '@/search/lib/gridConfig'

/** The synthetic auto-group column AG-Grid manages itself; never restore it. */
const AUTO_GROUP_COL = 'ag-Grid-AutoColumn'

/** Everything needed to reconstruct a grid view from a URL. */
export interface GridViewState {
  /** AG-Grid column state (order, width, visibility, sort, grouping). */
  columnState: ColumnState[]
  /** AG-Grid filter model. */
  filterModel: Record<string, unknown>
  /** Remove-duplicates toggle state. */
  dedup: boolean
  /** Row-density toggle state. */
  density: GridDensity
  /** Routes (SEP-joined group keys) of expanded group rows; best-effort restore. */
  expandedGroups: string[]
  /** Recviz dashboard collapse state (header variant); undefined for old links. */
  dashboardOpen?: boolean
}

/** JSON → UTF-8 → base64url (URL-safe, no padding). */
export function encodeViewState(state: GridViewState): string {
  const json = JSON.stringify(state)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** base64url → JSON → GridViewState, or null on any malformation / wrong shape. */
export function decodeViewState(param: string): GridViewState | null {
  if (!param) return null
  try {
    const b64 = param.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(escape(atob(b64)))
    const obj = JSON.parse(json) as unknown
    if (!isGridViewState(obj)) return null
    const v = obj as unknown as Record<string, unknown>
    // expandedGroups is normalised/defaulted so older links (without it) still decode.
    return {
      columnState: v.columnState as ColumnState[],
      filterModel: v.filterModel as Record<string, unknown>,
      dedup: v.dedup as boolean,
      density: v.density as GridDensity,
      expandedGroups: Array.isArray(v.expandedGroups) ? (v.expandedGroups as string[]) : [],
      dashboardOpen: typeof v.dashboardOpen === 'boolean' ? v.dashboardOpen : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Convert a saved view into an AG-Grid `initialState`, applied at grid
 * construction. This is required (rather than an imperative applyColumnState on
 * first render) because the AgGridReact wrapper re-applies `columnDefs` during
 * initial mount and would wipe any runtime grouping NOT present in the column
 * definitions — e.g. a shared view's nested 2nd group level. `initialState` is
 * the grid's birth config and is not clobbered by that reconciliation. The
 * synthetic auto-group column is skipped (the grid manages it); empty sections
 * are omitted so the grid keeps its defaults for them.
 */
export function viewStateToGridState(view: GridViewState): GridState {
  const cols = view.columnState.filter((c) => c.colId !== AUTO_GROUP_COL)

  const groupColIds = cols
    .filter((c) => c.rowGroup)
    .sort((a, b) => (a.rowGroupIndex ?? 0) - (b.rowGroupIndex ?? 0))
    .map((c) => c.colId)
  const hiddenColIds = cols.filter((c) => c.hide).map((c) => c.colId)
  const orderedColIds = cols.map((c) => c.colId)
  const columnSizingModel = cols
    .filter((c) => c.width != null || c.flex != null)
    .map((c) => ({ colId: c.colId, width: c.width ?? undefined, flex: c.flex ?? undefined }))
  const leftColIds = cols.filter((c) => c.pinned === 'left' || c.pinned === true).map((c) => c.colId)
  const rightColIds = cols.filter((c) => c.pinned === 'right').map((c) => c.colId)
  const sortModel: SortModelItem[] = cols
    .filter((c) => c.sort === 'asc' || c.sort === 'desc')
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
    .map((c) => ({ colId: c.colId, sort: c.sort as 'asc' | 'desc' }))

  // partialColumnState: we set some (not all) column-state sections — AG-Grid
  // fills the rest from the column defs.
  const state: GridState = { partialColumnState: true }
  if (groupColIds.length) state.rowGroup = { groupColIds }
  if (hiddenColIds.length) state.columnVisibility = { hiddenColIds }
  if (orderedColIds.length) state.columnOrder = { orderedColIds }
  if (columnSizingModel.length) state.columnSizing = { columnSizingModel }
  if (leftColIds.length || rightColIds.length) state.columnPinning = { leftColIds, rightColIds }
  if (sortModel.length) state.sort = { sortModel }
  if (view.filterModel && Object.keys(view.filterModel).length > 0) {
    state.filter = { filterModel: view.filterModel }
  }
  return state
}

function isGridViewState(o: unknown): o is GridViewState {
  if (typeof o !== 'object' || o === null) return false
  const v = o as Record<string, unknown>
  return (
    Array.isArray(v.columnState) &&
    typeof v.filterModel === 'object' &&
    v.filterModel !== null &&
    typeof v.dedup === 'boolean' &&
    (v.density === 'normal' || v.density === 'compact')
  )
}
