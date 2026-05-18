# Phase 3: React Search Vertical Slice - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Port the V4 search vertical slice end-to-end to React for the **`fileName`** category. The slice consists of a search input + AG-Grid Enterprise SSRM grid + three cell renderers (`executionOrderButtonRenderer` is the SC#2 anchor; `appIDCellRenderer` and `supportEmailCellRenderer` ship with it because they live in the same `fileName` config row) + URL-synced search state (`?q=&cat=`) + Excel export + recent-searches typeahead + correlation-ID error surfaces. The grid is **driven entirely from `/api/v4/search/config`** — columns, renderer string keys, `cellStyle`, `cellRendererParams`, `pinned`, `hide`, `sortable`, `filter`, and `width` come from JSON; React owns only the renderer registry (string → component). A new column on an existing category is a JSON edit + restart, not a React change. The app continues to be served at `/rectrace/` per D-2.4. Backend code is untouched in this phase; the existing `/api/v4/search/config`, `/api/v4/search/initial`, `/api/v4/search/ssrm/{category}`, and `/api/execution-order/{jobName}` endpoints are consumed as-is.

**In scope:**
- New route `/search` (TanStack Router); root `/` redirects to `/search`.
- `SearchPage.tsx` orchestrates: reads `q`, `cat` from URL via `useSearch({ from: '/search' })`; holds `initialFilter` response in local `useState`; renders `SearchBar`, `CategoryTabBar`, `SearchToolbar`, `SearchGrid`.
- `SearchBar.tsx` — shadcn `Input` + clear `X` button + lucide `SearchIcon` "Search" button + recent-searches `Popover` anchored to the input. 300ms debounce on type. Submit on Enter or click. No live `/suggest` call in Phase 3.
- `CategoryTabBar.tsx` — renders one tab ("File Name") in Phase 3; the pattern is the seed for Phase 4+ multi-tab.
- `SearchToolbar.tsx` — result count `Badge` (locale-formatted, hidden pre-search and during loading) + `DropdownMenu` "Export → Download Excel (.xlsx)".
- `SearchGrid.tsx` — `<AgGridReact key={`${q}-${cat}`} rowModelType="serverSide" ... />`. Datasource is `useMemo`-built per `(q, cat, initialFilter)`. Columns are built from `useSearchConfig().data` for the active `cat` (config-driven, see D-3.3). Renderer registry passed via `components={{ executionOrderButtonRenderer, appIDCellRenderer, supportEmailCellRenderer }}`. Side bar `{ toolPanels: ['columns', 'filters'] }`. AG-Grid modules registered: `ServerSideRowModelModule`, `ColumnsToolPanelModule`, `FiltersToolPanelModule`.
- `renderers/ExecutionOrderCellRenderer.tsx` — button (lucide `GitBranchIcon` + "View"), reads `colDef.cellRendererParams.jobNameField` (default `load_job`), absent when value is empty/null, loading state with `Loader2Icon`, fetches `/rectrace/api/execution-order/{jobName}` via `apiFetch`, on success opens a shadcn `Dialog` with `<pre>JSON</pre>` placeholder (Phase 4 swaps in the Cytoscape modal — `// TODO(Phase 4)` comment required), on error calls `reportRequestFailure(err)` for the Sonner toast.
- `renderers/AppIDCellRenderer.tsx` — `<a href="https://lnkd.in/gpAtSBRj" target="_blank" rel="noopener noreferrer" title="View details of {app_name}">{value}</a>`; `text-primary underline hover:no-underline`; falsy value → plain span.
- `renderers/SupportEmailCellRenderer.tsx` — `<a href="mailto:{value}">{value}</a>`; falsy → plain span. Verify exact Angular behavior in `app-support-cell-renderer.component.ts` before implementing.
- `hooks/useSearchConfig.ts` — TanStack Query against `/rectrace/api/v4/search/config`, `staleTime: Infinity`, Zod-validated response. Single fetch per session; backend reloads only on app restart (`SearchConfigServiceV4` `@PostConstruct`).
- `hooks/useSearchState.ts` — thin wrapper around TanStack Router `useSearch` + `useNavigate` for `q`/`cat`; URL is the source of truth.
- `hooks/useRecentSearches.ts` — localStorage key `rectrace-recent-searches`, max 10, dedupe (case-sensitive), prepend on submit.
- `types.ts` — Zod schemas for the config response, `InitialSearchResponseV4`, and `SSRMRequestV4` (mirror the backend DTO names).
- Two-step search flow: `apiFetch('/rectrace/api/v4/search/initial', ...)` on submit → response held in `SearchPage` local state → passed as `initialFilter` prop to `SearchGrid` → embedded in the SSRM `getRows` POST body to `/rectrace/api/v4/search/ssrm/fileName`.
- Excel export: `gridApi.exportDataAsExcel({ fileName: ... })` from the toolbar dropdown. File-name pattern `rectrace-fileName-{sanitizedSearchTerm}-{YYYYMMDD}.xlsx`. Exclude `execution_order` column; include all other columns including hidden ones.
- Error surfaces: every fetch path (`/initial`, SSRM `getRows`, execution-order, export) routes failures through `reportRequestFailure(err)` (Phase 2's helper) for the Sonner toast carrying the 32-hex correlation ID. The Phase 2 `setTimeout(() => reportRequestFailure(err), 0)` Sonner-mount workaround in the SSRM `getRows` `catch` block carries over to `SearchGrid`.
- Pre-search / post-search empty states, error state card with retry, and loading skeleton (3 × 36px rows) per UI-SPEC Copywriting Contract.
- Delete `frontend-react/src/grid/SmokeGrid.tsx` and its `*.test.tsx` (subsumed by SearchGrid).
- Vitest unit tests on hooks, renderers (mocked `apiFetch`), and the config→ColDef adapter. Extend `scripts/smoke-ssrm.sh` to also exercise `/search?q=...` end-to-end (config fetched, /initial called, SSRM populated, renderers fire).
- Parity-matrix updates locking `File Name search tab`, `appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer` (with note that the modal half is Phase 4), Excel export, and Recent searches as `port` in this phase.

**Out of scope for Phase 3 (explicit, mostly mirrored from UI-SPEC):**
- Multiple search categories beyond `fileName` (Phase 4+). The renderer registry and config-driven grid mean Phase 4 adds tabs without re-touching `SearchGrid.tsx`.
- Live `/api/search/suggest` autocomplete (Phase 4+).
- Cytoscape.js execution-order modal — Phase 3 ships the JSON-`<pre>` placeholder; Phase 4 owns the real modal.
- TLM Stats modal (V2), QuickRec Stats modal (Phase 4).
- `setIdV2Renderer`, `reconV2Renderer`, `tlmInstanceV2Renderer`, `reconIdRenderer`, `recPortalIdRenderer` (Phase 4+ — registry entries added when their tabs/modals land).
- Column-state / filter-state / expanded-group URL sync (Phase 4+ polish).
- Rotating search-input placeholder animation (Phase 8 polish).
- `x-citiportal-loginid` auth filter on the React side (Phase 9 SEC-01).
- ES SSL truststore, CORS lockdown, Citi CA, Nexus/Verdaccio routing, external-CDN audit (Phase 9 SEC-03..06).
- Backend changes — no new endpoints, no DTO shape changes, no `search-config-v4.json` edits. If the live `/api/v4/search/initial` contract (GET `?keyword=` per `search-v5.service.ts:103`) diverges from UI-SPEC's POST text, treat the backend as authoritative and adapt the React side; do not change the backend.
- Server-side `/api/v4/search/export/{category}` endpoint usage — Phase 3 uses AG-Grid's client-side `exportDataAsExcel()` per UI-SPEC. Server-side export remains available for a future phase if client-side export hits an SSRM-cached-rows-only limitation in real-world use.
- Visual regression testing (Phase 8 DESIGN-02).
- RTL integration tests + Playwright E2E (deferred — Phase 8 owns full E2E / visual regression).
- Chart/series/ramp design tokens (still deferred per D-2.7; STATE.md row remains).

</domain>

<decisions>
## Implementation Decisions

### Search state ownership

- **D-3.1:** URL is the source of truth for `q` and `cat`. `SearchPage.tsx` reads them via TanStack Router `useSearch({ from: '/search' })` (Zod-validated schema `{ q: z.string().optional(), cat: z.string().optional().default('fileName') }`). `initialFilter` (the `/api/v4/search/initial` response) is held in `SearchPage` local `useState`. **No Zustand store** for search state in Phase 3; **no `useMutation`** wrapping `/initial`. This keeps state ownership single-rooted (URL → component) and free of global-store coupling that the rest of the React shell doesn't have yet. Phase 4+ can introduce a store if cross-route state surfaces a real need.
- **D-3.2:** On search submit (`Enter` or click): (a) `navigate({ search: { q: term, cat } })` first — URL update is synchronous and the source of truth, (b) `await apiFetch('/rectrace/api/v4/search/initial', ...)` to get the pre-filter response, (c) `setInitialFilter(response)`, (d) the grid remounts via `key={`${q}-${cat}`}` (D-3.4) which causes its datasource `useMemo` to run with the fresh `q` + `initialFilter`. On URL-paste with a non-empty `q` and no current `initialFilter`, the same effect fires in a `useEffect([q, cat])` so deep-link restore works without manual button click. The Angular `initializeQueryParamsSubscription` pattern translates directly.

### Config-driven columns (HARD principle — see memory `feedback-config-driven-principle`)

- **D-3.3:** Column definitions for the grid are **fetched from `/api/v4/search/config`** — never hardcoded in TSX. `useSearchConfig()` is a TanStack Query hook (`queryKey: ['search-config']`, `staleTime: Infinity`, Zod-validated response). The hook is called once per session (config only changes on backend restart via `SearchConfigServiceV4` `@PostConstruct`). A small adapter (`configCategoryToColDefs(category)`) maps the JSON shape to AG-Grid `ColDef[]`, preserving `field`, `headerName`, `width`, `hide`, `sortable`, `filter`, `pinned`, `rowGroup`, `cellRenderer` (string key resolved against the renderer registry), `cellRendererParams`, and `cellStyle`. The renderer **registry** is the only React-side code that ever needs editing when adding a column that reuses an existing renderer:

  ```ts
  // frontend-react/src/search/renderers/registry.ts
  export const cellRenderers = {
    executionOrderButtonRenderer: ExecutionOrderCellRenderer,
    appIDCellRenderer: AppIDCellRenderer,
    supportEmailCellRenderer: SupportEmailCellRenderer,
  } as const
  ```

  Adding a column = JSON edit + restart. New ES index for `fileName` = JSON edit + restart. Enabling filter/sort on a column = JSON edit + restart. **No React/backend rebuild.** This is the established rectrace pattern (`search-v5-grid.component.ts:83 this.columns.map(...)` + `SearchV5Component` fetching via `SearchServiceV5.getConfiguration()`) and Phase 3 preserves it.

- **D-3.4:** Phase 3 fetches **all categories** in the single `/api/v4/search/config` call (matches Angular). The fact that only the `fileName` category is rendered is a render-time decision (`config.categories.find(c => c.key === cat)`), not a fetch-time filter. Phase 4 lights up the others by JSON-only changes to the parity matrix + adding renderer-registry entries for any new `cellRenderer` string keys it introduces.

### SSRM refresh on new search

- **D-3.5:** New search (or URL paste with a different `q`/`cat`) refreshes the grid by **remounting via `key={`${q}-${cat}`}`** on `<AgGridReact>`. The datasource `useMemo([q, cat, initialFilter])` rebuilds with a fresh `AbortController` + closure over the current `q` and `initialFilter`. This aligns 1:1 with Phase 2 `SmokeGrid`'s pattern and avoids the imperative `gridApi.setGridOption('serverSideDatasource', ...) + refreshServerSide({ purge: true })` dance with its in-flight `getRows` race risk. The cost — losing column-resize state across searches — is acceptable for Phase 3; Phase 4 can revisit if user feedback flags it.
- **D-3.6:** The Phase 2 `setTimeout(() => reportRequestFailure(err), 0)` workaround in the SSRM `getRows` `catch` block (Sonner-mount race) carries over to `SearchGrid`. Do not remove it.

### Two-step search wiring

- **D-3.7:** The `/api/v4/search/initial` call is plain `apiFetch` (not `useMutation`), invoked from a `useCallback` in `SearchPage` triggered by submit + by the URL-restore `useEffect`. Loading state is a local `isInitialLoading` bool. Errors route through `reportRequestFailure(err)`. The grid is unmounted (pre-search empty state) while `q` is empty; the grid mounts after `initialFilter` is set. The skeleton (3 × 36px) shows in the grid slot while `isInitialLoading` is true. **Open: backend `/initial` is currently `GET ?keyword=...` per `frontend/rectrace/src/app/services/search-v5.service.ts:103`, but UI-SPEC says POST.** Researcher/planner verifies the live contract before implementation and adapts the React side; backend is not changed.
- **D-3.8:** The SSRM `getRows` POST body includes `category`, `initialFilter` (closure-captured), `rowGroupCols`, `groupKeys`, `sortModel`, `filterModel`, `startRow`, `endRow`, and `visibleColumns` — mirroring Phase 2 `SmokeGrid` and the live Angular `SearchServiceV5.fetchSSRMData` shape. The exact `initialFilter` value type comes from the backend response and is captured in `types.ts` (Zod schema mirrors backend DTO).

### Testing scope

- **D-3.9:** Phase 3 ships **Vitest unit tests + extends `scripts/smoke-ssrm.sh`**. Unit-test targets: `useRecentSearches` (prepend / dedupe / 10-cap / case-sensitivity), `useSearchState` (URL ↔ state sync), `configCategoryToColDefs` adapter (Zod parse + ColDef mapping for `fileName`), `AppIDCellRenderer` (rendering + falsy guard), `SupportEmailCellRenderer` (rendering + falsy guard), `ExecutionOrderCellRenderer` (button rendering + absent-when-empty + loading state + `apiFetch` mock + placeholder Dialog open). `scripts/smoke-ssrm.sh` is extended to also: assert `/api/v4/search/config` returns a `fileName` entry with the expected renderer keys, hit the React app's `/search` route in the dev server (or a curl against the deployed `/rectrace/`), and verify the two-step search response shape. **No RTL integration tests, no Playwright E2E in this phase** — Phase 8 DESIGN-02 + future E2E phase own that surface. Live UAT closes Phase 3 (mirrors Phase 2's UAT close).

### Excel export specifics

- **D-3.10:** AG-Grid Enterprise's client-side `exportDataAsExcel()` is the export path (UI-SPEC). Acknowledged limitation: SSRM exports only the rows AG-Grid has cached client-side, not the full server-side result set. Phase 3 accepts this for parity with Angular (which uses the same client-side call in `SearchV5GridComponent`). If real-world feedback hits the cached-rows-only ceiling, Phase 4+ can swap in the backend's existing `/api/v4/search/export/{category}` endpoint. Excluded column on export: `execution_order`. Included columns: all others, **including hidden ones** (`app_name`, `set_id`, `sub_acc` per `search-config-v4.json#fileName`) so the export is richer than the on-screen view.

### Recent searches

- **D-3.11:** localStorage key `rectrace-recent-searches`. Single global bucket in Phase 3 (one category, so the question is moot). If Phase 4 multi-tab surfaces a "per-category recent" need, the key becomes `rectrace-recent-searches:{cat}` — additive, no migration of existing data needed. Capture as a deferred consideration.

### Claude's Discretion (planner decides)

- **Exact `useEffect` shape for URL-restore in `SearchPage`** — debouncing the restore fetch vs firing immediately, single `useEffect([q, cat])` vs separate hooks. Planner picks; the visible behavior is the same.
- **Zod schema location** — colocate per-route in `search/types.ts` (preferred) vs central `src/lib/schemas.ts`. Planner picks.
- **AG-Grid module registration site** — once in `main.tsx` (alongside `LicenseManager.setLicenseKey` from Phase 2) vs lazily in `SearchGrid.tsx`. Planner picks; once-at-bootstrap is simpler and matches the license pattern.
- **Renderer registry export shape** — `as const` object (D-3.3 example) vs a typed `Record<string, ComponentType<ICellRendererParams>>`. Planner picks based on what TypeScript happiest with for the adapter.
- **Whether `useSearchConfig` lives under `search/hooks/` or `src/lib/`** — planner picks. The config is used by SearchGrid only in Phase 3, so colocating under `search/` is reasonable; moving to `lib/` in Phase 4 is a one-file move if other features need it.
- **Adapter handling of `cellStyle`** — passing through as `ColDef.cellStyle` directly works for the static object in `search-config-v4.json#fileName.execution_order`. Planner verifies no JSON keys collide with React-incompatible CSS prop names (e.g., `align-items` vs `alignItems`). The current JSON uses kebab-case CSS keys (per `search-config-v4.json:33`), which AG-Grid accepts in `cellStyle` only as JS object keys via `'align-items'` string keys (works). Planner confirms during research.
- **`scripts/smoke-ssrm.sh` extension shape** — additive lines vs a new dedicated `scripts/smoke-search.sh`. Planner picks; additive keeps the smoke surface single-file per Phase 2 D-2.16's "one ops surface" preference.
- **Wave shape for the plan** — likely (1) types + Zod schemas + `useSearchConfig`, (2) `useSearchState` + `useRecentSearches`, (3) renderer registry + three renderer components + unit tests, (4) `SearchGrid` (config-driven columns, remount-by-key, SSRM datasource) + delete SmokeGrid, (5) `SearchBar` + recent-searches Popover, (6) `SearchToolbar` (count badge + Excel export dropdown), (7) `SearchPage` + route + URL restore + error-state card, (8) parity-matrix + smoke-script extensions. Planner refines.
- **`/api/v4/search/initial` GET-vs-POST verification** — researcher confirms the live contract by reading `SearchControllerV4.java` + a curl against the local stack. If GET, React uses `apiFetch(\`/rectrace/api/v4/search/initial?keyword=\${encodeURIComponent(q)}\`)`; if POST, body is `{ keyword: q }`. Either way, the React-side change is local to `SearchPage`'s submit handler.

### Folded Todos

None — no pending todos matched this phase at discuss time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 3 design contract (locked)

- `.planning/phases/03-react-search-vertical-slice/03-UI-SPEC.md` — UI design contract (visual + interaction + copywriting + file structure + out-of-scope). Approved on revision 1. **MUST read before planning.** All decisions in this CONTEXT.md sit on top of UI-SPEC; if a decision here narrows UI-SPEC, this file wins; if it conflicts (e.g., D-3.7 acknowledges the `/initial` GET-vs-POST discrepancy), researcher resolves with the live backend.

### Project context

- `.planning/PROJECT.md` — Rectrace modernization scope; the config-driven design pattern is part of the system's *Validated Requirements* (Dynamic JSON-driven search categories).
- `.planning/REQUIREMENTS.md` §"React Vertical Slice — Search" — SEARCH-01..SEARCH-07. SEARCH-07's `/v6/` example is superseded by D-2.4 (Phase 2).
- `.planning/ROADMAP.md` §"Phase 3: React Search Vertical Slice" — phase goal + 5 success criteria. SC#1's `/v6/` mention is superseded by D-2.4.
- `.planning/STATE.md` — Phase 02 closed PASS on 2026-05-13; Phase 03 is the next active phase.
- `.planning/parity-matrix.md` — to be updated during Phase 3 implementation (D-2.18) locking the `port` targets listed in the In-Scope domain above.

### Prior phase decisions (carry-forward)

- `.planning/phases/02-react-foundation/02-CONTEXT.md` — Phase 2 decisions. Specifically:
  - **D-2.4** — `/rectrace/` base path, no `/v6/` prefix. Phase 3 inherits.
  - **D-2.6 / D-2.7 / D-2.8** — shadcn config, tokens, ESLint hex-rejection. Phase 3 adds shadcn components (Input, Badge, Separator, Command, Popover, Tooltip, DropdownMenu, Skeleton) via the same `pnpm dlx shadcn@3.8.5 add` flow.
  - **D-2.9 / D-2.10 / D-2.11 / D-2.12** — correlation-ID propagation. `apiFetch` already attaches `X-Correlation-Id`; `reportRequestFailure(err)` already surfaces the 32-hex ID via Sonner. Phase 3 uses both as-is.
  - **D-2.13** — SSRM endpoint and the Phase 0.1 local seed (5 rows in `fileName`, 2 hyphenated). Phase 3's UAT verification runs against the same stack.
  - **D-2.14** — AG-Grid Enterprise license plumbing via `VITE_AG_GRID_LICENSE_KEY`. Phase 3 inherits.
  - **D-2.15** — `ops/rectrace-ops.sh` v1 has the `react` component; `pnpm dev` launches the React shell that hosts Phase 3.
- `.planning/phases/02-react-foundation/02-VERIFICATION.md` — Phase 2 exit state (live UAT 4/4 PASS on 2026-05-13).
- `.planning/phases/01-backend-platform-upgrade/01-CONTEXT.md` — Phase 1 D-1.18 (V4 nomenclature) and D-1.8 (`SecurityFilterChain` permit-all) — Phase 3 hits unauthenticated endpoints.
- `.planning/phases/00.1-local-dev-seed-bootstrap/00.1-CONTEXT.md` — `fileName` seed rows (including 2 hyphenated values for Phase 8) that Phase 3's UAT and smoke script will see.

### Backend integration surface (read before implementing)

- `backend/rectrace/src/main/resources/search-config-v4.json` — `fileName` entry (lines 3–40 approx.): columns, renderer string keys (`appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer`), `cellRendererParams.jobNameField = "load_job"`, `cellStyle` on `execution_order`. **The source of truth for the grid contract.**
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java` — `/api/v4/search/config`, `/api/v4/search/initial`, `/api/v4/search/ssrm/{category}`, `/api/v4/search/export/{category}`. Verify the `/initial` HTTP verb + payload shape (GET-vs-POST per D-3.7).
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SearchConfigServiceV4.java` — `@PostConstruct` parser; explains why `staleTime: Infinity` is safe (config doesn't change at runtime).
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SSRMRequestV4.java` — DTO shape the React SSRM `getRows` POST body must satisfy.
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/ExecutionOrderController.java` — `/api/execution-order/{jobName}` shape the placeholder Dialog renders.

### Angular reference (read structurally to mirror behavior)

- `frontend/rectrace/src/app/services/search-v5.service.ts` — `performInitialSearch` (line 102, GET `?keyword=`), `fetchSSRMData` (line 109, POST), `getConfiguration` (line 118, GET), `getSuggestions` (line 131 — NOT used in Phase 3). Translate verbs + payloads 1:1.
- `frontend/rectrace/src/app/search-v5/components/search-v5/search-v5.component.ts` — search submission + URL queryParams + recent-searches localStorage + category selection. The React `SearchPage` mirrors this.
- `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts` — `@Input() columns` driven from config (line 83 `this.columns.map(...)`), SSRM `createSSRMDatasource` (~line 324 per ARCHITECTURE.md), Excel export, side bar. **The reference implementation for D-3.3 / D-3.4 / D-3.5 / D-3.8.**
- `frontend/rectrace/src/app/custom-interactions/components/renderers/execution-order-button.component.ts` — the Angular renderer the React port must behaviorally match (button, loading, modal-open hook, error path).
- `frontend/rectrace/src/app/custom-interactions/components/renderers/app-id-cell-renderer.component.ts` — link + tooltip behavior.
- `frontend/rectrace/src/app/custom-interactions/components/renderers/app-support-cell-renderer.component.ts` — mailto behavior.

### React shell (Phase 2 deliverables to reuse)

- `frontend-react/src/lib/queryClient.ts` — `apiFetch`, `reportRequestFailure`, `QueryClient` setup. **Do not modify in Phase 3.**
- `frontend-react/src/grid/SmokeGrid.tsx` — Phase 2 SSRM reference. **Deleted in Phase 3** after `SearchGrid` replaces it. The `useMemo` + AbortController + Sonner setTimeout pattern carries over verbatim.
- `frontend-react/src/components/ui/{button,card,sonner}.tsx` — already vendored.
- `frontend-react/src/routes/__root.tsx`, `routes/index.tsx` — TanStack Router setup. Phase 3 adds `routes/search.tsx`.
- `frontend-react/src/main.tsx` — `LicenseManager.setLicenseKey`; planner decides whether to also register AG-Grid SSRM modules here (Claude's Discretion).
- `frontend-react/eslint.config.js` — hex-rejection rule (Phase 2 D-2.8). Renderers must use `text-primary` / `bg-accent` / etc.; no raw hex (verified in `ExecutionOrderCellRenderer` spec mapping the Angular `#1a73e8` → `var(--primary)`).
- `frontend-react/src/components/app-shell/` — header + footer. SearchBar slots into the header's `flex-1` center per UI-SPEC layout.

### shadcn add list (Phase 3)

All vendored via `pnpm dlx shadcn@3.8.5 add {component}` — no third-party registries. Components: `input`, `badge`, `separator`, `command`, `popover`, `tooltip`, `dropdown-menu`, `skeleton`. Already vendored from Phase 2 (do not re-add): `button`, `sonner`, `card`.

### Files to touch in Phase 3 (illustrative — planner finalizes)

**New: `frontend-react/src/`**
- `routes/search.tsx` — TanStack Router file-based route definition; Zod-validated search params.
- `search/SearchPage.tsx`, `search/SearchBar.tsx`, `search/SearchGrid.tsx`, `search/SearchToolbar.tsx`, `search/CategoryTabBar.tsx`.
- `search/renderers/registry.ts`, `search/renderers/ExecutionOrderCellRenderer.tsx`, `search/renderers/AppIDCellRenderer.tsx`, `search/renderers/SupportEmailCellRenderer.tsx`.
- `search/hooks/useSearchConfig.ts`, `search/hooks/useSearchState.ts`, `search/hooks/useRecentSearches.ts`.
- `search/lib/configToColDefs.ts` — JSON → AG-Grid `ColDef[]` adapter.
- `search/types.ts` — Zod schemas and inferred types.
- `search/__tests__/*.test.{ts,tsx}` — Vitest unit tests per D-3.9.
- `components/ui/{input,badge,separator,command,popover,tooltip,dropdown-menu,skeleton}.tsx` — shadcn add results.

**Modified:**
- `frontend-react/src/routes/index.tsx` — redirect `/` → `/search`.
- `frontend-react/src/components/app-shell/header.tsx` — replace the `{/* future search slot — Phase 3 */}` comment with `<SearchBar />`.
- `frontend-react/src/main.tsx` — register AG-Grid SSRM modules (planner's discretion vs. lazy in SearchGrid).
- `frontend-react/src/routeTree.gen.ts` — regenerated by TanStack Router plugin after the new route lands.
- `scripts/smoke-ssrm.sh` — extend per D-3.9.
- `.planning/parity-matrix.md` — update rows for File Name tab + three renderers + Excel + Recent searches → `port` + the executor's Phase 3 reference.

**Deleted:**
- `frontend-react/src/grid/SmokeGrid.tsx` + `frontend-react/src/grid/SmokeGrid.test.tsx`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`apiFetch` + `reportRequestFailure`** (`frontend-react/src/lib/queryClient.ts`) — already attach `X-Correlation-Id` and route errors through Sonner. Phase 3 uses them on every fetch path. No changes needed.
- **`SmokeGrid.tsx`'s SSRM pattern** — `useMemo` + AbortController + `destroy()` + the `setTimeout(0)` Sonner-mount workaround all transfer to `SearchGrid` verbatim. The only differences are: (a) columns built from `useSearchConfig`, not hardcoded; (b) `initialFilter` embedded in the POST body; (c) `<AgGridReact key={`${q}-${cat}`}>` remount.
- **Angular's `SearchV5GridComponent`** — the canonical reference for config-driven columns (line 83 `this.columns.map(...)`), SSRM datasource construction, and the `setupGridOptions` pattern. The React port follows the same shape with React hooks.
- **`SearchConfigServiceV4.java` parses the JSON at `@PostConstruct`** — the config is immutable at runtime, which is why `staleTime: Infinity` in `useSearchConfig` is correct.
- **Phase 0.1 local seed (`../rectrace-local-dev/`)** — same Oracle + ES stack Phase 2's smoke ran against. Phase 3 UAT runs against this; the 5 `fileName` rows give end-to-end visible evidence and the 2 hyphenated values seed Phase 8's regression target.
- **`environment.ts`'s AG-Grid Enterprise license** — already copied to `frontend-react/.env.local` per Phase 2 D-2.14.

### Established Patterns

- **Config-driven everything for grid behavior** — non-negotiable per the project's memory-locked principle. Columns, renderer string keys, `cellStyle`, `cellRendererParams`, `pinned`, `hide`, `sortable`, `filter`, `width` all come from `search-config-v4.json` / `/api/v4/search/config`. React owns only the renderer registry.
- **Wave-based atomic commits** — Phase 0.1 (7 waves), Phase 1 (8 waves), Phase 2 (5 plans). Phase 3 will likely run 7–8 waves per Claude's Discretion list.
- **`apiFetch` + `reportRequestFailure` + Sonner** — universal error path. Every fetch in Phase 3 routes through it.
- **TanStack Router + Zod for URL state** — Phase 2 set up `routes/__root.tsx` and `routes/index.tsx`. Phase 3 extends with `routes/search.tsx` + a typed `useSearch` call.
- **shadcn add at pin 3.8.5** — Phase 2 D-2.6. Phase 3 uses the same `pnpm dlx shadcn@3.8.5 add` command.
- **Live UAT closes the phase** — Phase 0.1 and Phase 2 both closed via UAT after automation. Phase 3 follows.

### Integration Points

- **React → backend HTTP:** `apiFetch` hits `/rectrace/api/v4/search/config` (config), `/rectrace/api/v4/search/initial` (initial search), `/rectrace/api/v4/search/ssrm/fileName` (SSRM rows), `/rectrace/api/execution-order/{jobName}` (execution-order placeholder). All four endpoints exist post-Phase 1; no backend changes.
- **React → AG-Grid Enterprise:** license loaded at app bootstrap (Phase 2); SSRM modules registered (Phase 3); datasource constructed per `(q, cat, initialFilter)` and replaced via remount; renderer registry passed via `components={{ ... }}`.
- **React state → URL:** TanStack Router `navigate({ search: { q, cat } })` on submit and clear. URL is the source of truth; `useSearch` is the read API.
- **localStorage → React:** `useRecentSearches` reads/writes `rectrace-recent-searches` (Phase 3); Phase 2 already wrote `rectrace-theme` for `ThemeProvider`. No collision.

</code_context>

<specifics>
## Specific Ideas

- **Config-driven everything is non-negotiable.** Quote (from this discussion): *"a new column needs adding or a diff index to be searched or a new column search needs enabling, none of these needs a frontend or a backend code change. i just need to change the configuration and if configuation is present as a file separately, i can just change that and restart the application to have it picked. so please don't laze around or make the effort gone into developing till now rollback by trying to reinvent."* This is memory-locked at `~/.claude/projects/-Users-aarun-Workspace-Projects-autosys-job-explorer/memory/feedback_config_driven_principle.md` and applies to every future phase that touches grid/search behavior. Any "hardcode for simplicity" proposal is a regression and must be flagged.
- **The user wants to MOVE FORWARD, not re-litigate solved patterns.** When the existing Angular app has solved a problem (config-driven columns, two-step search flow, URL-synced state, localStorage recent searches), the React port mirrors it. The discussion should focus on *implementation-level adaptations* (TanStack Router vs `Router`, Vitest vs Karma) not on revisiting whether the underlying pattern is right.
- **UI-SPEC is the visual + interaction contract; CONTEXT.md is the implementation contract.** Where they conflict (e.g., `/initial` GET-vs-POST, D-3.7), the live backend wins and CONTEXT.md notes the discrepancy for the researcher.
- **Carry the Phase 2 Sonner-mount workaround.** Quote isn't direct from this session, but the `setTimeout(0)` in `SmokeGrid.tsx` was load-bearing (mount-order race fix) and was preserved through the Phase 2 fix-cycle. Phase 3 keeps it.

</specifics>

<deferred>
## Deferred Ideas

- **Per-category recent searches** — `rectrace-recent-searches:{cat}` localStorage namespacing. Surfaces only when Phase 4 lights up multiple tabs; additive to the current single-bucket key. No migration needed.
- **Imperative SSRM refresh** instead of remount-by-key (D-3.5) — Phase 4+ can revisit if losing column-resize state across searches becomes a real complaint.
- **Server-side Excel export** via `/api/v4/search/export/{category}` — Phase 4+ if SSRM cached-rows-only ceiling is hit in practice.
- **Live `/api/search/suggest` autocomplete** in the SearchBar — Phase 4+.
- **RTL integration tests on SearchPage flow** — Phase 8 DESIGN-02 or a dedicated future testing phase. Phase 3 ships only Vitest unit tests + smoke script.
- **Playwright E2E happy-path** — Phase 8 DESIGN-02 area.
- **Cytoscape execution-order modal** — Phase 4 swaps in for the `<pre>JSON</pre>` placeholder.
- **TLM Stats modal V2, QuickRec Stats modal, additional renderers** — Phase 4+.
- **Column-state / filter-state / expanded-group URL sync** — Phase 4+ design polish.
- **Rotating search-input placeholder animation** — Phase 8 polish.
- **Chart/series/ramp design tokens** — auto-surface mechanism per Phase 2 D-2.7 still active; STATE.md row remains.
- **`x-citiportal-loginid` auth filter on the React side** — Phase 9 SEC-01.

### Reviewed Todos (not folded)

None — no pending todos were reviewed at discuss time.

</deferred>

---

*Phase: 03-react-search-vertical-slice*
*Context gathered: 2026-05-17*
