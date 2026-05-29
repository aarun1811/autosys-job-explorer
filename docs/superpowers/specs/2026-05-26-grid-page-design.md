# Search Results / Grid Page — Design Spec

**Date:** 2026-05-26
**Status:** Implemented (branch `milestone/modernization`)
**Module:** `frontend-react` (React 19 + Vite 7 + AG-Grid v35 + shadcn + TanStack Router/Query)

> **Post-implementation change (2026-05-26):** the **status bar** and **checkbox row selection** described below were **dropped** during live verification. AG-Grid's Server-Side Row Model does not support the Total/Filtered row-count status components (warnings #225/#222), and SSRM selection requires a `getRowId` we can't derive cleanly for these column-config-driven rows (#188). Row counts already appear in the category tabs. Everything else shipped as specced. The deep grid-body styling pass remains a follow-up.

## Goal

Bring the React search-results grid to Angular `search-v5` parity for grid controls, and add a small set of high-value modern enhancements — while keeping the grid clean and shadcn-idiomatic. **Frontend-only**: no backend changes.

## Context

The React results page today (`SearchPage.tsx`) renders `CategoryTabBar` + a thin `SearchToolbar` (count badge + Export dropdown) + a per-category SSRM `SearchGrid`. Investigation (2026-05-26) established two facts that shaped this design:

1. **Server-side row grouping already works** in the React grid. The search column is flagged `rowGroup: true` in the config; the grid sends `rowGroupCols`/`groupKeys` to `/api/v4/search/ssrm/{category}` and renders an auto "Group" column with lazy per-group child fetches. This works because server-side grouping ships inside `ServerSideRowModelModule` (already registered) — `RowGroupingModule` is only needed for the *drag-to-group panel* and interactive/client-side grouping.
2. **Remove Duplicates needs no backend change.** Angular's `removeDuplicates()` only toggles a visual `isDeduplicated` flag and calls `refreshServerSide({ purge: true })`; it sends no flag, and the backend (`OracleServiceV4.buildSelectClause`) dedups unconditionally anyway. We mirror Angular exactly.

## Scope

**In scope (all frontend):**

- **Angular-parity toolbar buttons:** toggle tools panel, toggle density, auto-size columns, expand all, collapse all, clear filters, refresh, Remove Duplicates (Angular-faithful), Export (Excel), Copy to clipboard.
- **Drag-to-group bar** (`rowGroupPanelShow: 'always'`) via `RowGroupingModule`.
- **Status bar** (Total / Filtered / Selected counts) via `StatusBarModule`; multi-row selection with a checkbox column (makes "Selected" meaningful).
- **Reset view** button (one-click restore of columns/sort/filters/grouping/density).
- **Row-detail drawer** — double-click a leaf row opens a shadcn `Sheet` showing every field.
- **Shareable view URL** — an explicit "Share view" button serializes grid state into the URL and copies the link.

**Out of scope (follow-ups):**

- **Deep grid-body styling** (the dedicated next milestone): header/row/group-row theming, density refinement, quartz-token palette, status-bar / drag-bar visual cohesion. *This spec styles only the new `GridToolbar` and `RowDetailSheet` components.*
- Tier-2/3 ideas not selected: CSV export, per-category localStorage layout persistence, cell/row context menu.
- Any backend change (e.g., a real `distinct` toggle) — explicitly excluded.

## Architecture & Components

Data flow is unchanged: config-driven columns from `/initial`, per-category SSRM, clean remount on tab switch (`key={`${q}-${category.key}`}`). New surfaces operate through the grid API; only refresh/regroup re-hit the existing `/ssrm` endpoint.

| File | Change | Responsibility |
|---|---|---|
| `src/search/SearchGridPanel.tsx` | **new** | Orchestrator for one active category. Owns the `GridApi` ref and view state (`density`, `isDeduplicated`, `detailRow`, sidebar visibility). Renders `GridToolbar` + `SearchGrid` + `RowDetailSheet`. Wires every toolbar action to the API. Hosts `useGridViewUrl`. Owns Export + Copy logic. |
| `src/search/GridToolbar.tsx` | **new** | Presentational shadcn toolbar: ghost icon-buttons with `Tooltip`s, grouped (View / Grouping / Data / Export-Share) with `Separator`s, an Export `DropdownMenu`, and a Share button. Props = action callbacks + toggle states (`density`, `isDeduplicated`, `isSidebarVisible`, `isExporting`). No grid knowledge. |
| `src/search/RowDetailSheet.tsx` | **new** | shadcn `Sheet` (right side). Given a row's `data` + the category `columns`, lists label/value pairs (headers from columns; hidden/frontend-only columns still shown). Open/close controlled by parent. |
| `src/search/hooks/useGridViewUrl.ts` | **new** | Pure-ish serialize/restore of `GridViewState = { columnState, filterModel, rowGroupCols, dedup, density }` ↔ a compact URL `view` param. Exposes `shareView(api)` (serialize → navigate(replace) → copy link → toast) and `restoreView(api, view)` (apply once grid-ready). Pure encode/decode helpers exported for unit tests. |
| `src/search/SearchGrid.tsx` | modify | Add `rowGroupPanelShow: 'always'`, `statusBar`, multi-row selection with a leading checkbox column, density-driven `rowHeight`, `onRowDoubleClicked`. Surface `gridApi` to the parent (already via `onGridReady`). Accept `density` + `onRowDoubleClicked` props. |
| `src/main.tsx` | modify | Register `RowGroupingModule`, the row-group-panel module, `StatusBarModule`, `RowSelectionModule`. *(Exact v35 export names verified against `ag-grid-enterprise@35` at implementation; `RowGroupingModule` + `RowGroupingPanelModule` confirmed exported.)* |
| `src/routes/search.tsx` | modify | Extend the Zod search schema with optional `view: z.string().optional()`. |
| `src/search/SearchPage.tsx` | modify | Replace the `SearchToolbar` + `SearchGrid` block with `<SearchGridPanel q category />`. Retire `SearchToolbar` (its count badge is superseded by the status bar). `handleExport`/`isExporting`/`resultCount` move into `SearchGridPanel`. |

`SearchToolbar.tsx` and its test are removed (folded into `GridToolbar`).

## Layout

```
navbar (logo · search · theme · user)
CategoryTabBar (Job Name (4) | Recon Name (2) | …)
GridToolbar  — left: (reserved);  right: [View] | [Grouping] | [Data] | [Export ▾  Copy  Share ↗]   (counts live in the status bar, not here)
drag-to-group bar (AG-Grid rowGroupPanel)
GRID (groups / rows; double-click leaf row ⇒ RowDetailSheet)
status bar (AG-Grid) — Total · Filtered · Selected
```

## Toolbar Buttons — Behavior

All AG-Grid client API; refresh/regroup reuse the existing SSRM endpoint.

| Group | Button | Behavior |
|---|---|---|
| View | Columns/Filters panel | `api.setSideBarVisible(!api.isSideBarVisible())`; active when visible |
| View | Density | toggle state → `api.setGridOption('rowHeight', compact ? 28 : 36)` + `api.resetRowHeights()`; active when compact |
| View | Auto-size | `api.autoSizeAllColumns()` |
| View | Reset view | `api.resetColumnState()` + `api.setFilterModel(null)` + `api.collapseAll()` + density→normal |
| Grouping | Expand all | `api.expandAll()` (expands loaded groups; SSRM lazy-loads the rest) |
| Grouping | Collapse all | `api.collapseAll()` |
| Data | Clear filters | `api.setFilterModel(null)` |
| Data | Refresh | `api.refreshServerSide({ purge: true })` |
| Data | Remove duplicates | toggle `isDeduplicated` (active styling) + `api.refreshServerSide({ purge: true })` — **no backend, Angular-faithful** |
| Export/Share | Export ▾ | Excel via `api.exportDataAsExcel({ fileName, columnKeys })` (excludes `execution_order`), kept as a dropdown |
| Export/Share | Copy | `api.forEachNode` skip group nodes → TSV (headers + values) → `navigator.clipboard.writeText`; toast "Copied N rows" |
| Export/Share | Share view ↗ | `useGridViewUrl.shareView(api)` |

**shadcn treatment:** `Button variant="ghost" size="icon"` + `Tooltip` per button; groups separated by vertical `Separator`s; right-aligned; toggle buttons carry an `active` style (e.g., `bg-accent text-foreground`). Icons from lucide (e.g., `PanelRight`, `Rows3`, `Maximize2`, `RotateCcw`, `ChevronsDownUp`/`ChevronsUpDown`, `FilterX`, `RefreshCw`, `CopyMinus`, `Download`, `Copy`, `Share2`).

## New Features — Detail

### Drag-to-group bar
`rowGroupPanelShow: 'always'` + `RowGroupingModule`. The search-column group appears as a chip; dragging another column changes `rowGroupCols` and SSRM re-fetches. Themed by the existing quartz CSS vars.

### Status bar
`StatusBarModule`, panels: `agTotalRowCountComponent`, `agFilteredRowCountComponent`, `agSelectedRowCountComponent`. The standalone count badge is removed. To make **Selected** meaningful (single-click stays free for text selection; double-click opens the detail drawer), the grid uses a **leading checkbox selection column** (header + row checkboxes) with multi-row selection. Uses the AG-Grid v35 selection API (object form, e.g. `rowSelection={{ mode:'multiRow' }}` + a selection column) — exact shape verified at implementation; `RowSelectionModule` registered.

### Row-detail drawer
`onRowDoubleClicked` on a **leaf** row (ignore group nodes) sets `detailRow` → opens `RowDetailSheet`. The Sheet lists each category column as `headerName → data[field]`, scrollable, with a copy-row affordance. Double-click keeps single-click free for cell text selection.

### Shareable view URL (explicit button)
`GridViewState = { columnState, filterModel, rowGroupCols, dedup, density }`. `shareView` serializes to JSON → URL-safe base64 → `view` search param (replace), then copies `window.location.href` and toasts "Link copied." On mount, if a `view` param exists, `restoreView` applies it **after** the grid is ready and the first datasource block has loaded (`onFirstDataRendered`): `applyColumnState({ state, applyOrder:true })`, `setFilterModel`, set density/dedup. The `view` param is scoped to the current `q` + `tab`; switching tabs clears it (a view's columnState is category-specific).

### Remove Duplicates
State-only toggle + refresh (see table). Default `isDeduplicated = false`, matching Angular's initializer exactly. The toggle is purely a visual indicator + a grid refresh — the backend dedups regardless — so this is faithful to "implement it like Angular today."

## Modules to Register (main.tsx)

Add to the existing `registerModules([...])`: `RowGroupingModule`, `RowGroupingPanelModule`, `StatusBarModule`, `RowSelectionModule`. License-set still precedes registration (Pitfall 9). Exact names confirmed against the installed `ag-grid-enterprise@^35.0.1` at implementation.

## Testing Strategy (TDD)

- **`useGridViewUrl`** — encode/decode round-trip of `GridViewState`; malformed `view` param decodes to `null` (never throws).
- **`GridToolbar`** — every button invokes its callback; density/dedup/sidebar toggles reflect `active` state; Export dropdown lists Excel.
- **`RowDetailSheet`** — renders one row per column with `headerName` + value; closed state renders nothing.
- **`SearchGridPanel`** — double-clicking a leaf row opens the drawer (group nodes ignored); each toolbar action calls the corresponding method on a mocked `GridApi`; Share calls `shareView`.
- **`SearchGrid`** — asserts grid options present: `rowGroupPanelShow:'always'`, `statusBar`, multi-row selection + checkbox column, `rowHeight` from density, `onRowDoubleClicked` wired.
- **`SearchPage`** — update mocks (`SearchGridPanel` replaces `SearchGrid`/`SearchToolbar`); existing tab/no-results/logo tests stay green.
- **Live verification** — Playwright on real seed data (`?q=recon` → `jobName` groups), light + dark.

## Risks / Notes

- **AG-Grid v35 module names**: verify `StatusBarModule` / `RowSelectionModule` / row-group-panel module export names against the installed package before wiring; adjust registration accordingly.
- **Share-URL restore timing**: applying column/filter/sort state before the grid + first block are ready silently no-ops; gate restore on `onFirstDataRendered`.
- **Enterprise license**: dev shows the AG-Grid trial watermark (no key) — cosmetic, expected.
- **Seed data**: local ES has 5 demo docs; use real seed terms (e.g., `recon`, `SUBACC`, `SETID`) for manual/Playwright checks. (Separately: the empty-state "Browse examples" chips are stale demo terms that don't match the seed — a small follow-up, not part of this milestone.)
