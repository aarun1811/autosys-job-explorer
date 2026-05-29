---
phase: 03-react-search-vertical-slice
plan: 05
subsystem: react-search
tags: [react, ag-grid, ssrm, config-driven, sonner, abort-controller]
requirements: [SEARCH-01, SEARCH-06]
dependency_graph:
  requires:
    - "03-01 (types.ts: SSRMRequestV4, InitialSearchResponseV4, CategoryConfigV4)"
    - "03-01 (useSearchConfig hook)"
    - "03-03 (cellRenderers registry — AppID + SupportEmail + ExecutionOrder)"
    - "03-04 (configCategoryToColDefs adapter + 4 AG-Grid modules registered in main.tsx)"
    - "02 (apiFetch + reportRequestFailure + Sonner Toaster from Phase 2)"
  provides:
    - "SearchGrid React component (config-driven SSRM grid)"
    - "_test_buildDatasource helper (exported for unit testing)"
    - "SearchGridProps interface with onGridReady + onModelUpdated for Plan 07"
  affects:
    - "Plan 07 (SearchPage) — imports SearchGrid, supplies q/cat/initialFilter + captures gridApi via onGridReady, wires onModelUpdated to SearchToolbar resultCount Badge"
    - "Plan 06 (SearchToolbar) — Excel export depends on gridApi captured via Plan 07 onGridReady forwarded here"
tech_stack:
  added: []
  patterns:
    - "Remount-by-key (D-3.5): AgGridReact key=`${q}-${cat}` + datasource useMemo[q,cat,initialFilter] guarantees fresh SSRM cache + fresh AbortController on every new search"
    - "Sonner-mount workaround (D-3.6): setTimeout(() => reportRequestFailure(err), 0) on SSRM catch — carries over verbatim from Phase 2 SmokeGrid"
    - "Config-driven principle (D-3.3): zero hardcoded columnDefs literals; zero hardcoded cellRenderer references; columnDefs derived from useSearchConfig() + configCategoryToColDefs(cat)"
    - "AbortController per datasource instance: destroy() aborts in-flight fetches when AG-Grid tears down the datasource (remount or unmount)"
    - "Helper exported for unit testing (_test_buildDatasource) — pragmatic Vitest pattern to test the SSRM body shape without booting the AG-Grid DOM"
key_files:
  created:
    - frontend-react/src/search/SearchGrid.tsx
    - frontend-react/src/search/__tests__/SearchGrid.test.tsx
    - .planning/phases/03-react-search-vertical-slice/03-05-SUMMARY.md
  modified: []
decisions:
  - "Phase 3 visibleColumns = [] (parity with SmokeGrid). Angular's getVisibleColumns() derives from gridApi.getAllDisplayedColumns(); a later phase may port for SELECT DISTINCT optimization. Backend tolerates [] — it selects all columns."
  - "Fallback render is `return null` while config is loading OR category not found. UI-SPEC defers loading UX to AG-Grid's built-in overlay; the config load is cache-cold-only (staleTime: Infinity), so a Skeleton would flash. Null is the simplest defensive path."
  - "_test_buildDatasource is exported (with eslint-disable react-refresh/only-export-components) for direct unit test access to the SSRM body shape. The React component wraps it in useMemo with the same dep tuple."
  - "SmokeGrid.tsx is NOT deleted in this plan. Plan 07 (SearchPage wiring) owns the deletion per Pitfall 8 — premature deletion means losing the working SSRM reference."
metrics:
  duration_minutes: ~12
  completed_at: 2026-05-17
---

# Phase 3 Plan 05: SearchGrid (config-driven SSRM) Summary

**One-liner:** Config-driven AG-Grid SSRM React component with remount-by-key, Sonner-mount workaround, and `onGridReady` / `onModelUpdated` forwarding for Plan 07 — the load-bearing keystone of the Phase 3 vertical slice.

## What Was Built

`SearchGrid.tsx` — the load-bearing component of Phase 3. It is the seam where every prior plan converges:

- **Plan 01** Zod-validated `SearchConfigurationV4` and `SSRMRequestV4` types
- **Plan 03** cellRenderers registry passed via AgGridReact `components` prop
- **Plan 04** `configCategoryToColDefs` adapter converts the V4 config to ColDef[]
- **Phase 2** `apiFetch` (correlation-ID-emitting HTTP client) + `reportRequestFailure` (Sonner toast surface)

The component renders an AG-Grid SSRM grid for a single search category (default `fileName`). Every grid behavior in scope — config-driven columns, kebab→camel cellStyle, registry-resolved renderers, remount-on-new-search, two-step body shape, correlation-ID error surfaces — converges here.

## SearchGrid Props Interface

```ts
export interface SearchGridProps {
  q: string                                  // search term (URL source of truth — Plan 02)
  cat: string                                // category key (defaults 'fileName' upstream)
  initialFilter: InitialSearchResponseV4     // response of GET /api/v4/search/initial (Plan 07 owns the fetch)
  onGridReady?: (e: GridReadyEvent) => void  // Plan 07 captures gridApi for Excel export (D-3.10, SEARCH-04)
  onModelUpdated?: (rowCount: number) => void // Plan 07 wires resultCount → SearchToolbar Badge (UI-SPEC, SEARCH-01)
}
```

Plan 07 (SearchPage) can now compose the full vertical slice:
```tsx
<SearchGrid
  q={q}
  cat={cat}
  initialFilter={initialFilter}
  onGridReady={(e) => setGridApi(e.api)}
  onModelUpdated={(count) => setResultCount(count)}
/>
```

## SSRM Body Shape (mirrors backend SSRMRequestV4.java + Angular `search-v5-grid.component.ts:348-361`)

```ts
const body: SSRMRequestV4 = {
  category: cat,                                              // path-echoed
  initialFilter: resp.categoryResults[cat]?.initialFilter ?? null,
  rowGroupCols: params.request.rowGroupCols.map(c => c.field ?? ''),
  groupKeys: params.request.groupKeys ?? [],
  sortModel: params.request.sortModel ?? [],
  filterModel: params.request.filterModel ?? {},
  startRow: params.request.startRow ?? 0,
  endRow: params.request.endRow ?? 100,
  visibleColumns: [],                                         // Phase 3 = [] (parity with SmokeGrid)
}
```

POST URL: `/rectrace/api/v4/search/ssrm/${cat}`. The category is echoed in both the URL path and the body so the backend can validate consistency.

## Remount-by-Key Semantics (D-3.5)

Two coordinated mechanisms guarantee a clean SSRM cache on every new search:

1. `<AgGridReact key={`${q}-${cat}`} />` — React tears down the entire grid when key changes. SSRM cache, expanded groups, and column state all reset.
2. `useMemo<IServerSideDatasource>(() => _test_buildDatasource(q, cat, initialFilter), [q, cat, initialFilter])` — even without the key, the datasource itself rebuilds with a fresh AbortController. AG-Grid's previous datasource fires `destroy()` and any in-flight fetch is aborted.

The redundancy is intentional: key remount is the user-visible guarantee (no flash of stale rows), and the datasource useMemo dep tuple is the underlying-state guarantee (no in-flight fetch resolves against a detached SSRM context).

## Sonner-Mount Workaround (D-3.6 — DO NOT REMOVE)

```ts
// The deferral via setTimeout(0) prevents a Sonner 2.x race: AG-Grid's
// initial getRows fires inside the same commit/effect cascade as the
// Toaster's own mount, and Sonner silently drops toasts dispatched
// before its subscriber attaches. Pushing this to the next macrotask
// guarantees the Toaster is live when toast.error() runs.
setTimeout(() => reportRequestFailure(err), 0)
```

The comment block is copied **verbatim** from `SmokeGrid.tsx` lines 50-54 — load-bearing documentation for future maintainers. The 5-line block is the contract: don't "clean up" this `setTimeout(0)` thinking it's a code smell.

AbortError is swallowed (no toast, no `params.fail()`) — a remount-canceled fetch is expected behavior, not a user-facing failure.

## Tests

Five tests in `SearchGrid.test.tsx`:

1. **Renders without crashing** with valid props (jsdom canvas limitations tolerated via try/catch per Phase 2 idiom)
2. **Renders fallback (null, no throw)** while `useSearchConfig` is loading
3. **SSRM body shape** — invokes `_test_buildDatasource` directly with a fixture, asserts the JSON body posted to `apiFetch` has every SSRMRequestV4 field with the expected values (category, initialFilter, rowGroupCols, groupKeys, sortModel, filterModel, startRow, endRow, visibleColumns)
4. **Non-AbortError rejection** → `setTimeout(0)` fires → `reportRequestFailure` called once with the error → `params.fail()` called
5. **AbortError rejection** → neither `reportRequestFailure` nor `params.fail` is called

Test runner: Vitest 4.1.6, jsdom 29.1.1. Full suite: 13 files / 101 tests pass (5 new this plan).

## Source-Grep Acceptance Gates (16/16 pass)

| Gate | Expected | Actual |
|------|----------|--------|
| `configCategoryToColDefs` mentions | >= 1 | 2 |
| `cellRenderers` mentions | >= 1 | 2 |
| `useSearchConfig` mentions | >= 1 | 2 |
| `columnDefs: [` hardcoded literal | 0 | 0 |
| Hardcoded `cellRenderer: (AppID\|SupportEmail\|ExecutionOrder)` | 0 | 0 |
| `key={`${q}-${cat}`}` | >= 1 | 3 |
| `setTimeout(() =>` | >= 1 | 1 |
| `reportRequestFailure` | >= 1 | 3 |
| `AbortError` | >= 1 | 1 |
| `AbortController` | >= 1 | 4 |
| `Date.now()` / `Math.random()` | 0 | 0 |
| `getRowId` | 0 | 0 |
| `useMemo(...[q, cat, initialFilter])` | >= 1 | 1 |
| `toolPanels` | >= 1 | 1 |
| `onGridReady` | >= 1 | 3 |
| `onModelUpdated` | >= 1 | 3 |

## Verification Results

- `npx vitest run src/search/__tests__/SearchGrid.test.tsx` — 5/5 pass
- `npx vitest run` — 101/101 pass (no regressions)
- `npx tsc --noEmit` — exit 0
- `npx eslint src/search/SearchGrid.tsx` — exit 0

## Commits

| Commit | Message |
|--------|---------|
| `defc51c` | test(03-05): add failing tests for SearchGrid (config-driven SSRM) — RED |
| `e6c345c` | feat(03-05): SearchGrid (config-driven SSRM) — GREEN |

## Deviations from Plan

None — the plan executed exactly as written. The only minor adjustment was inline ESLint disables for:

- `react-refresh/only-export-components` on `_test_buildDatasource` (intentional helper export for unit testing; not a component)
- `@typescript-eslint/no-misused-promises` on the `getRows: async` property (canonical AG-Grid SSRM pattern; the grid never reads the returned Promise)

Both disables are documented inline with the rationale.

## TDD Gate Compliance

- RED gate: `defc51c test(03-05): ...` — failing test commit before implementation
- GREEN gate: `e6c345c feat(03-05): ...` — implementation after the failing test
- REFACTOR gate: not needed (the GREEN implementation was already clean)

## Self-Check: PASSED

- `frontend-react/src/search/SearchGrid.tsx` — FOUND
- `frontend-react/src/search/__tests__/SearchGrid.test.tsx` — FOUND
- `frontend-react/src/grid/SmokeGrid.tsx` — STILL PRESENT (Plan 07 deletes)
- Commit `defc51c` — FOUND
- Commit `e6c345c` — FOUND
