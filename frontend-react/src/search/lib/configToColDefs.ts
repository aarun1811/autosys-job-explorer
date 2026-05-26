import type { ColDef } from 'ag-grid-community'

import type { CategoryConfigV4, ColumnDefinitionV4 } from '@/search/types'
import { cellRenderers } from '@/search/renderers/registry'

/**
 * configCategoryToColDefs — the JSON-vs-AG-Grid impedance adapter.
 *
 * Translates a single `CategoryConfigV4` (parsed from
 * `/rectrace/api/v4/search/config`) into an array of AG-Grid `ColDef`s.
 *
 * This is the ONLY place that touches the impedance — keeping it isolated
 * preserves the config-driven principle (D-3.3): adding/changing a column
 * means editing `search-config-v4.json` and restarting the backend, not
 * touching React code.
 *
 * Responsibilities (and only these):
 *   1. Map declarative column attributes (field, headerName, width, hide…)
 *      with sensible defaults — sortable defaults to true, filter defaults
 *      to AG-Grid's text filter, resizable defaults to true.
 *   2. Resolve `cellRenderer` string keys through the renderer registry
 *      (Plan 03). Unknown keys fall back to `undefined`, letting AG-Grid
 *      use its default text renderer (Pitfall 6 — never crash on a config
 *      typo or a renderer key the React app hasn't caught up to yet).
 *   3. Convert `cellStyle` keys from kebab-case (JSON-friendly, what the
 *      Angular code wrote) to camelCase (what React's CSSProperties type
 *      expects) — see Pitfall 2 in 03-PATTERNS.md.
 *
 * Consumed two ways, both routing through {@link columnsToColDefs}:
 *   - Angular-parity inline source (SearchGrid): `columnsToColDefs(category.columns)`
 *     where `category` is a `CategoryResultV4` from `/api/v4/search/initial`.
 *   - Legacy config source: `configCategoryToColDefs(categoryConfig)`.
 */

/**
 * Translates a raw `ColumnDefinitionV4[]` (the inline `columns[]` carried by
 * each `/initial` category result, or a `/config` category's columns) into
 * AG-Grid `ColDef`s. This is the single seam that owns the JSON↔AG-Grid
 * impedance — see the responsibilities documented above.
 */
export function columnsToColDefs(columns: ColumnDefinitionV4[]): ColDef[] {
  return columns.map((c: ColumnDefinitionV4): ColDef => ({
    field: c.field,
    headerName: c.headerName,
    width: c.width ?? undefined,
    hide: c.hide ?? false,
    sortable: c.sortable ?? true,
    // filter: true → AG-Grid's built-in text filter; false → no filter at all.
    // Omitted → default to text filter (preserves backward-compatible behavior
    // with categories that don't enumerate every flag).
    filter: c.filter === false ? false : 'agTextColumnFilter',
    resizable: c.resizable ?? true,
    enableRowGroup: true,
    menuTabs: ['generalMenuTab', 'columnsMenuTab'],
    filterParams:
      c.filter === false
        ? undefined
        : { buttons: ['reset', 'apply'], closeOnApply: true, maxNumConditions: 1, debounceMs: 0 },
    rowGroup: c.rowGroup ?? false,
    pinned: c.pinned ?? undefined,
    // Registry lookup; `?? undefined` makes the fallback explicit for the
    // unknown-key case even though the bare bracket access already yields
    // undefined — the explicit form documents the Pitfall 6 contract.
    cellRenderer: c.cellRenderer ? cellRenderers[c.cellRenderer] ?? undefined : undefined,
    cellRendererParams: c.cellRendererParams,
    cellStyle: c.cellStyle ? toCamelCaseStyle(c.cellStyle) : undefined,
  }))
}

/**
 * Overlays a restored row-grouping onto colDefs, by `field`, with rowGroupIndex
 * taken from the order of `groupColIds`. Necessary because the AgGridReact
 * wrapper re-applies `columnDefs` on mount: a shared view's extra grouping level
 * lives only in saved state (not the config), so unless it's baked into the
 * colDefs the reconciliation un-groups it. Non-grouped columns are explicitly
 * cleared so a stale config rowGroup can't linger. Returns the input untouched
 * (same reference) when there's no restored grouping. Pure — never mutates.
 */
export function applyRowGroupsToColDefs(defs: ColDef[], groupColIds: string[]): ColDef[] {
  if (groupColIds.length === 0) return defs
  return defs.map((d) => {
    const idx = d.field ? groupColIds.indexOf(d.field) : -1
    return idx >= 0
      ? { ...d, rowGroup: true, rowGroupIndex: idx }
      : { ...d, rowGroup: false, rowGroupIndex: undefined }
  })
}

/**
 * Thin wrapper: adapts a `CategoryConfigV4` by delegating its `columns` to
 * {@link columnsToColDefs}. Retained for callers/tests that hold a full
 * category-config object.
 */
export function configCategoryToColDefs(cat: Pick<CategoryConfigV4, 'columns'>): ColDef[] {
  // `columns` is `.nullish()` since the schema was widened for dashboard-only
  // categories (which carry no column wiring) — coalesce to an empty list.
  return columnsToColDefs(cat.columns ?? [])
}

/**
 * Converts CSS property names from kebab-case to camelCase so AG-Grid
 * (which forwards `cellStyle` straight into React's `style` prop) sees
 * keys that match `React.CSSProperties`. Without this, `align-items: center`
 * silently disappears because React drops unknown style keys.
 *
 * Exported for direct unit testing — also called inline by the adapter.
 */
export function toCamelCaseStyle(style: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(style)) {
    const camel = key.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase())
    out[camel] = value
  }
  return out
}
