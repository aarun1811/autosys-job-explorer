---
phase: 03-react-search-vertical-slice
plan: 07
status: complete
requirements: [SEARCH-01, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06, SEARCH-07]
completed: 2026-05-17
---

# Plan 07 — /search route + SearchPage orchestrator + delete SmokeGrid + UAT

## Outcome

Phase 3 vertical slice is wired end-to-end and passed UAT against the running local stack (backend on `:6088` + Oracle/Elasticsearch via docker-compose seed + Vite on `:5173`).

## Deliverables

- `frontend-react/src/routes/search.tsx` — `/search` route with Zod `validateSearch({ q?, cat? })`
- `frontend-react/src/routes/index.tsx` — `/` redirects to `/search` via `beforeLoad + redirect` (no body rendered, no `/v6/` prefix)
- `frontend-react/src/search/SearchPage.tsx` — orchestrator: URL state via `useSearchState`, `useRecentSearches`, GET `/api/v4/search/initial?keyword=...`, Zod-validated response, error-state card with correlation ID + Try-again, Excel-export wiring via `gridApiRef`, `onModelUpdated` → `setResultCount` for the Toolbar Badge
- `frontend-react/src/search/lib/buildExportFilename.ts` — `rectrace-{cat}-{term}-YYYYMMDD.xlsx` filename builder
- `frontend-react/src/search/__tests__/SearchPage.test.tsx` — 7 integration tests covering URL-restore, submit, clear, export, recents-push, error-state
- `frontend-react/src/grid/SmokeGrid.tsx` + `SmokeGrid.test.tsx` — **deleted** (Pitfall 8 satisfied — same wave as route swap)

## Wave-5 commits (worktree, merged via merge(03-07))

- `cd986af` — feat(03-07): /search route + redirect + SearchPage + delete SmokeGrid
- `129dfd0` — test(03-07): SearchPage handler-wiring integration tests
- `66ffc41` — docs(03-07): log pre-existing lint errors to deferred-items.md
- Merged into milestone/modernization as `merge(03-07): /search route + SearchPage + delete SmokeGrid (Wave 5, pre-UAT)`

## UAT execution (Playwright pre-UAT smoke + final fixes)

After merging the worktree, Playwright drove the UAT against a running stack. The smoke surfaced **four real defects** which were fixed orchestrator-side (two commits) before final sign-off:

### Round 1 — `fix(03): /initial response schema + missing AG-Grid v35 modules` (7541e0c)

1. **`/initial` response schema mismatch** (resolution to RESEARCH Open Q1): backend emits per-category `{key, label, values, count, hasMore, columns}`, not a pre-built `{column, values}` filter object. Zod parse failed every search. Replaced `CategoryResultV4Schema` with the real shape, switched `ColumnDefinitionV4Schema` optional fields to `.nullish()` (backend serializes optionals as JSON null, not by omission), updated `extractInitialFilterForCategory` in `SearchGrid` to build `{ column: category.searchColumn, values: response.values }` from config + response.
2. **Missing AG-Grid v35 modules**: `TextFilterModule`, `CellStyleModule`, `ColumnAutoSizeModule`, `RowApiModule`, `SideBarModule` — features used by columns/grid required modular registration in v35; only `ServerSideRowModelModule`, `ExcelExportModule`, `ColumnsToolPanelModule`, `FiltersToolPanelModule` were originally registered.

### Round 2 — `fix(03): Excel export filter + recent-searches cross-instance sync` (896e52d)

3. **Excel export was including `execution_order` and dropping hidden columns** (D-3.10 violation). Root cause: `ColumnApiModule` was missing, so `api.getColumns()` returned null; the SearchPage filter then fell through to `columnKeys: undefined`, which tells AG-Grid "export all displayed columns" — the opposite of the spec. Added `ColumnApiModule`. XLSX now contains 14 columns including hidden `App Name`/`Set ID`/`Sub Account`, excludes `Execution Order`.
4. **`useRecentSearches` had no cross-instance sync**: SearchPage and SearchBar each call the hook → two independent `useState` copies. SearchPage's `pushRecent` only updated SearchPage's state; SearchBar's `recents` stayed stale and the Popover showed wrong data. Fixed via custom `rectrace:recent-searches-changed` event that every hook instance subscribes to (plus native `storage` for cross-tab). Only broadcasts on successful writes so a failing storage mutation doesn't cause peers to revert.

## UAT verification (Playwright)

| § | Step | Result |
|---|------|--------|
| A | `/` → `/search?cat=fileName` redirect | ✓ |
| B1 | Search `csv` → 3 grouped rows, Badge "3 results" | ✓ |
| B2 | Expand `commod_*.csv` → child row from Oracle (8 fields), Badge "4 results" | ✓ |
| C1 | AppID renders as link → `https://lnkd.in/gpAtSBRj` with hover tooltip | ✓ |
| C2 | Support Email renders as `mailto:` link | ✓ |
| C3 | Execution Order View button fires API + Sonner toast on failure | ✓ (Dialog success path blocked by pre-existing seed gap — `AUTOSYS_TLM_RECON_SEQUENCES` missing — out of Phase 3 scope; recorded in deferred-items.md) |
| D | Fresh nav to `?q=LOAD-ABC-123&cat=fileName` → input pre-fills, search auto-fires | ✓ |
| E | Export → Download Excel (.xlsx) → `rectrace-fileName-csv-20260517.xlsx` (5834 bytes, correct MIME, 14 cols including hidden, execution_order excluded) | ✓ |
| F | 3 searches → X clear → focus input → Popover newest-first with dedupe, click-item re-fires search, Popover Clear empties LS, persistence across navigation | ✓ |
| G | Stop backend → search → inline error card with `"Error reference: <32-hex>"` + Sonner toast; restart → Try-again recovers grid | ✓ |
| H | All network calls go to `/rectrace/api/v4/...`; zero `/v6/` anywhere | ✓ |
| Theme | Toggle flips `html.dark` + design-token bg (oklch) | ✓ |

Unit tests: 138/138 green after both fix rounds.

Screenshots captured at repo root for parity-matrix attachment (Plan 08):
- `uat-A-empty-state.png`, `uat-B-csv-results.png`, `uat-F-recents-popover.png`, `uat-G-correlation-id.png`, `uat-theme-light.png`, `uat-theme-dark.png`

## Deferred to Phase 4+

(See `.planning/phases/03-react-search-vertical-slice/deferred-items.md`)

1. Build pipeline: `npm run build` (`tsc -b`) trips on three pre-existing issues (missing `routeTree.gen.ts` regen step, vitest 4 Mock type narrowing in `useSearchConfig.test.ts`). `vite build` passes cleanly. Phase 4 / hardening should restore `npm run build`.
2. ExecutionOrder Dialog success-path verification — blocked by missing `AUTOSYS_TLM_RECON_SEQUENCES` seed table; Phase 4 (Cytoscape modal) will replace the placeholder Dialog and seeds will catch up.
3. UI polish — Phase 3 shipped functional shadcn primitives without applying the recviz design language. Candidate for a dedicated "React UI polish" phase or a `/gsd-ui-review` run.

## Sign-off

- All 7 phase requirement IDs in this plan's frontmatter (`SEARCH-01, 03, 04, 05, 06, 07`) verified live.
- SEARCH-02 (cell renderers) verified in this plan's grid context though plan 03 owns the implementation.
- SmokeGrid deleted in this wave per Pitfall 8.
- No `/v6/` references anywhere in the codebase.
