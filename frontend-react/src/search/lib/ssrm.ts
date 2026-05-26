// src/search/lib/ssrm.ts
import type { ColumnState, GetRowIdParams } from 'ag-grid-community'
import type { CategoryResultV4, InitialFilter } from '@/search/types'

/** Columns that exist only in the grid UI — never sent to the backend SELECT. */
export const FRONTEND_ONLY_COLUMNS = new Set(['execution_order', 'actions', 'ag-Grid-AutoColumn'])

const SEP = '\u0001' // low-collision separator for composite row ids

/**
 * Stable SSRM row id: route (parent group keys) + this row's own values.
 * Group-level rows carry only the group value (independent of which columns are
 * visible) → group ids stay stable across column show/hide, so AG-Grid preserves
 * group expansion across refreshes. Leaf ids change with the visible set (fine).
 */
export function buildSsrmRowId(params: Pick<GetRowIdParams, 'parentKeys' | 'data'>): string {
  const parents = params.parentKeys ?? []
  const data = (params.data ?? {}) as Record<string, unknown>
  const own = Object.values(data)
    .map((v) => {
      if (v == null) return ''
      if (typeof v === 'string') return v
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v)
      return JSON.stringify(v) ?? '' // objects/other → safe, never '[object Object]'
    })
    .join(SEP)
  return [...parents, own].join(SEP)
}

/** Visible (non-hidden, non-frontend-only) column ids, always including row-group cols. */
export function getVisibleColumnIds(columnState: ColumnState[], rowGroupColIds: string[]): string[] {
  const ids: string[] = []
  for (const c of columnState) {
    if (c.hide) continue
    if (FRONTEND_ONLY_COLUMNS.has(c.colId)) continue
    ids.push(c.colId)
  }
  for (const id of rowGroupColIds) {
    if (!FRONTEND_ONLY_COLUMNS.has(id) && !ids.includes(id)) ids.push(id)
  }
  return ids
}

interface RawFilterEntry { filterType?: string; type?: string; filter?: unknown }

/** AG-Grid filter model → backend shape: keep entries with a real `.filter`; default filterType/type. */
export function convertFilterModel(raw: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!raw) return out
  for (const [field, value] of Object.entries(raw)) {
    const e = value as RawFilterEntry | null
    if (e == null || e.filter == null || e.filter === '') continue
    out[field] = { filterType: e.filterType ?? 'text', type: e.type ?? 'contains', filter: e.filter }
  }
  return out
}

/** The ES search column = the column flagged rowGroup in the category config. */
export function searchColumnFor(category: CategoryResultV4): string {
  return category.columns.find((c) => c.rowGroup)?.field ?? ''
}

export function buildInitialFilter(category: CategoryResultV4): InitialFilter | null {
  const column = searchColumnFor(category)
  if (category.values.length === 0 || !column) return null
  return { column, values: category.values }
}
