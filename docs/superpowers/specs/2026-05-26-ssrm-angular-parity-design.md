# SSRM Angular-Parity — Design Spec

**Date:** 2026-05-26
**Status:** Design → for review
**Module:** `frontend-react` (React 19 + AG-Grid v35 SSRM); one small `types.ts` addition; no backend changes (the `/export` endpoint already exists).

## Goal

Bring the React search grid's Server-Side Row Model (SSRM) behavior to **functional + performance parity with the Angular `search-v5` grid**, so no existing feature or optimization is lost — while doing the few things AG-Grid v35 lets us do *better* than Angular (notably a real `getRowId` instead of Angular's broken one).

## Context & findings (verified)

A full inventory of Angular's `search-v5-grid` SSRM implementation vs the current React grid surfaced these gaps. Key verifications:
- **Expand/Collapse All throw AG-Grid error #200** — `expandAll`/`collapseAll` need the `CsrmSsrmSharedApi` module (bundled by `ServerSideRowModelApiModule`), which isn't registered.
- React sends **`visibleColumns: []`** (hardcoded) → backend always `SELECT *` over **all** columns; Angular sends the displayed columns → `SELECT DISTINCT <visible>` (smaller payload; makes Remove-Duplicates meaningful).
- React wires **no** column/group event listeners; Angular refetches on column show/hide and regroup.
- **Group-expansion preservation:** AG-Grid docs confirm `refreshServerSide({purge:true})` resets all row state *except selection* **unless a stable `getRowId` is provided** ("Row IDs allow the grid to retain … expanded state"). Group-level row data is just the group value (independent of visible columns), so a route-based `getRowId` keeps **group ids stable across column changes** → AG-Grid preserves expansion natively. Angular instead uses a *broken* `getRowId` + a hand-rolled restore loop; **we do it the correct way and drop the manual machinery.**
- The backend export endpoint **exists**: `POST /api/v4/search/export/{category}` with `ExportRequestV4 { category, initialFilter, columns, rowGroupCols, sortModel, filterModel }` → xlsx bytes. React currently uses client-side `exportDataAsExcel()` (loaded rows only).

## Deliberate divergences from Angular (no real feature lost)

1. **No `rowSelection`.** Angular's `rowSelection:'multiple'` is vestigial — no checkbox column, `suppressRowClickSelection:true`, nothing consumes selected rows. We keep selection out (dropped earlier for SSRM reasons). We still add `enableCellTextSelection` so mouse text-copy works.
2. **`getRowId` is a *stable* business-key id**, not Angular's `Date.now()+Math.random()` (the exact anti-pattern CLAUDE.md bans). This is strictly better.

## Scope — what changes

### 1. Stable `getRowId` (replaces Angular's manual restore machinery)
Add to `SearchGrid`'s `AgGridReact`:
```ts
getRowId={(p) => [...(p.parentKeys ?? []), Object.values(p.data ?? {}).map((v) => String(v ?? '')).join('')].join('')}
```
- Group rows: route + group value (stable across column add/remove → expansion preserved).
- Leaf rows: route + the row's DISTINCT value-combo (unique).
Extract as a tested helper `buildSsrmRowId(params)` in `lib/ssrm.ts`. **No** `expandedGroupIds` / `shouldRestoreState` / `restoreExpandedState` (not ported).

### 2. Send real `visibleColumns` + convert the filter model (datasource)
In `SearchGrid._test_buildDatasource` `getRows`, use `params.api`:
- `visibleColumns: getVisibleColumnIds(params.api.getColumnState(), params.api.getRowGroupColumns().map(c => c.getColId()))` — visible (`!hide`) col ids, **excluding** `FRONTEND_ONLY_COLUMNS`, **always including** the row-group columns (even if hidden). Helper in `lib/ssrm.ts`.
- `filterModel: convertFilterModel(params.request.filterModel)` — keep only entries with a truthy `.filter`; default `filterType→'text'`, `type→'contains'`. Helper in `lib/ssrm.ts`.
`FRONTEND_ONLY_COLUMNS = new Set(['execution_order', 'actions', 'ag-Grid-AutoColumn'])` in `lib/ssrm.ts` (aligns with the backend's set).

### 3. Register the expand/collapse module
`src/main.tsx`: add **`ServerSideRowModelApiModule`** (enterprise) → enables `expandAll`/`collapseAll`. (Keep "loaded-groups-only" behavior — do **not** set `ssrmExpandAllAffectsAllRows`, matching Angular.)

### 4. Event listeners → backend refetch (`SearchGrid`, internal)
On `AgGridReact`:
- `onColumnVisible` — debounced 500ms (a `useRef` timer), guard `source === 'gridInitializing'`, skip `ag-Grid-AutoColumn` + `FRONTEND_ONLY_COLUMNS` → `e.api.refreshServerSide({ purge: true })`. (With #2, the refetch carries the new `visibleColumns`.)
- `onColumnRowGroupChanged` → `e.api.refreshServerSide({ purge: true })`.
(Filter/sort auto-refetch is built into SSRM — no handler needed; `getRowId` now preserves expansion across those too.)

### 5. ColDef parity (`configToColDefs.columnsToColDefs`)
Add to each mapped `ColDef`:
- `enableRowGroup: true` (drag-to-group).
- `filterParams: { buttons: ['reset', 'apply'], closeOnApply: true, maxNumConditions: 1, debounceMs: 0 }` (v35: `maxNumConditions:1` is the replacement for the deprecated `suppressAndOrCondition` — **verify at impl**).
- `menuTabs: ['generalMenuTab', 'columnsMenuTab']`.

### 6. Grid options (`SearchGrid`)
- `defaultColDef={{ sortable: true, filter: true, resizable: true, minWidth: 100, flex: 1 }}` (explicit per-column widths still win).
- `autoGroupColumnDef={{ headerName: category.columns[0]?.headerName, minWidth: 250, cellRendererParams: { suppressCount: false } }}`.
- `groupDefaultExpanded={0}`, `animateRows`, `enableCellTextSelection`, `tooltipShowDelay={0}`, `tooltipHideDelay={2000}`, `suppressCellFocus`, `suppressMakeColumnVisibleAfterUnGroup={false}`.
- **Remove** `autoSizeStrategy` (Angular auto-sizes only on the toolbar button; removing stops width-jitter on every load — the Auto-size button still works).

### 7. Density: row + header height (`lib/gridConfig` + `SearchGrid`/`SearchGridPanel`)
- `rowHeightForDensity`: **compact 24, normal 32** (was 28/36) — match Angular.
- New `headerHeightForDensity`: **compact 32, normal 36**.
- `SearchGrid` accepts/derives `headerHeight={headerHeightForDensity(density)}` alongside `rowHeight`.

### 8. Export via backend (`SearchGridPanel.onExportExcel`)
Replace client-side `exportDataAsExcel()` with `POST /rectrace/api/v4/search/export/{category}`:
- Body `ExportRequestV4 = { category, initialFilter: { column, values }, columns: getVisibleColumnIds(...), rowGroupCols, sortModel, filterModel: convertFilterModel(api.getFilterModel()) }`.
- Fetch as blob → `URL.createObjectURL` → anchor download → revoke. `isExporting` now genuinely spans the request. On failure → `reportRequestFailure` + toast.
- Add `ExportRequestV4` type to `types.ts`. Add an `exportSearchToExcel(category, body)` helper.

## Modules to register / verify
- `ServerSideRowModelApiModule` (expand/collapse) — confirmed exported by `ag-grid-enterprise`.
- **Verify** a column-menu module is needed for `menuTabs` (likely `ColumnMenuModule`, enterprise) and register if so; otherwise the header column menu won't show.
- **Verify** v35 names/options at impl: `maxNumConditions` vs `suppressAndOrCondition`; `onColumnVisible` event signature (`source`, `column`).

## File map
| File | Change |
|---|---|
| `src/search/lib/ssrm.ts` *(new)* | `FRONTEND_ONLY_COLUMNS`, `getVisibleColumnIds`, `convertFilterModel`, `buildSsrmRowId` (pure, unit-tested). |
| `src/search/lib/gridConfig.ts` | `rowHeightForDensity` 24/32; add `headerHeightForDensity` 32/36. |
| `src/search/lib/configToColDefs.ts` | add `enableRowGroup`, `filterParams`, `menuTabs` per ColDef. |
| `src/search/SearchGrid.tsx` | `getRowId`, `defaultColDef`, `autoGroupColumnDef`, the grid options (§6), `headerHeight` from density, `onColumnVisible`(debounced)/`onColumnRowGroupChanged`; datasource uses `getVisibleColumnIds` + `convertFilterModel`; remove `autoSizeStrategy`. |
| `src/search/SearchGridPanel.tsx` | `onExportExcel` → backend export; pass density through (already does). |
| `src/search/types.ts` | `ExportRequestV4` type. |
| `src/main.tsx` | register `ServerSideRowModelApiModule` (+ column-menu module if needed). |

## Testing (TDD)
- `lib/ssrm.ts`: `getVisibleColumnIds` (drops hidden + frontend-only, always includes group cols), `convertFilterModel` (drops empty, defaults filterType/type), `buildSsrmRowId` (stable group id ignores leaf-only data; route prefix; unique leaves).
- `gridConfig`: density row/header heights.
- `configToColDefs`: each ColDef has `enableRowGroup`, `filterParams` (apply/reset), `menuTabs`.
- `SearchGridPanel`: export POSTs to `/export/{category}` with the right body + triggers a blob download (mock fetch + `URL.createObjectURL`); existing toolbar tests stay green.
- Live (Playwright, `?q=recon`): Expand/Collapse All work (no #200); hide a column → backend refetch fires; expand a group → hide a column → group **stays expanded** (getRowId preservation); export downloads a file; 0 new warnings.

## Out of scope
- Backend changes (export endpoint already exists; dedup stays always-DISTINCT, Angular-faithful).
- `rowSelection` / checkbox selection (deliberate divergence).
- Deep grid-body visual styling (separate follow-up).
