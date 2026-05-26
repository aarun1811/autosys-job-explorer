// src/search/lib/gridViewState.ts
import type { ColumnState } from 'ag-grid-community'
import type { GridDensity } from '@/search/lib/gridConfig'

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
    return obj
  } catch {
    return null
  }
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
