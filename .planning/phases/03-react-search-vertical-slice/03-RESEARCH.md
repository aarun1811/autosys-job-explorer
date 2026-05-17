# Phase 3: React Search Vertical Slice — Research

**Researched:** 2026-05-17
**Domain:** React 19 + Vite 7 + AG-Grid Enterprise 35 SSRM + TanStack Router/Query + shadcn (Tailwind v4) — porting one Angular search-vertical-slice end-to-end
**Confidence:** HIGH overall (most facts come from Phase 2's already-shipping code + the live backend + Phase 2 CONTEXT.md/UI-SPEC.md/CONTEXT.md decisions; AG-Grid v35 module facts verified via Context7)

## Phase Overview

**What we're building:** An end-to-end React search experience for the `fileName` category that proves four vertical-slice integrations work together:

1. **Config-driven grid** — `/api/v4/search/config` returns the `fileName` category definition (columns, renderer string keys, `cellStyle`, `cellRendererParams`, `hide`, `pinned`, `sortable`, `filter`, `width`); React resolves the string keys against a renderer registry and builds AG-Grid `ColDef[]` at runtime. **No column metadata is hardcoded in TSX.** This is the load-bearing principle locked in memory (`feedback_config_driven_principle.md`) and in CONTEXT.md D-3.3 / D-3.4.
2. **Two-step SSRM flow** — `GET /api/v4/search/initial?keyword=...` returns the ES pre-filter; the response is held in `SearchPage` state and embedded in every `POST /api/v4/search/ssrm/fileName` body.
3. **URL is the source of truth** for `q` and `cat` — TanStack Router `validateSearch` + Zod; deep-link paste recreates the search.
4. **Three cell renderers ported** — `appIDCellRenderer` (external link), `supportEmailCellRenderer` (mailto), and `executionOrderButtonRenderer` (button with async fetch + placeholder Dialog).

**Why this phase:** Phase 2 proved AG-Grid Enterprise SSRM + the backend wire format (`SmokeGrid.tsx` rendering 5 seed rows from `fileName`). Phase 3 turns that smoke harness into the real search vertical slice with all the SEARCH-01..07 deliverables: a real search input, config-driven columns, custom renderers, URL state, Excel export, recent-searches typeahead, and correlation-ID error surfaces.

**Success looks like:**

- A user opens `/rectrace/` (no `/v6/` prefix — D-2.4 / D-3.x inherited), navigates to `/search`, types `LOAD-ABC-123`, presses Enter; URL becomes `/search?q=LOAD-ABC-123&cat=fileName`; SSRM grid renders the 5 seed rows with the correct columns; the `executionOrderButtonRenderer` button is visible only on rows with `load_job`; clicking it opens a placeholder Dialog with the JSON response; pasting the same URL into a new tab restores the exact view; Excel export downloads `rectrace-fileName-load_abc_123-{YYYYMMDD}.xlsx`; if the backend returns 500, a Sonner toast shows `Error reference: <32-hex-id>` matching the backend's `traceId` MDC value.
- `SmokeGrid.tsx` and its test are deleted; `SearchGrid.tsx` is the replacement.
- Parity matrix rows for `File Name search tab`, `appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer`, Excel export, and Recent searches all flip to `port`.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `03-CONTEXT.md` <decisions> block. Planner MUST honor these.

- **D-3.1** — URL is the source of truth for `q` and `cat`. `SearchPage.tsx` reads them via TanStack Router `useSearch({ from: '/search' })` (Zod-validated schema `{ q: z.string().optional(), cat: z.string().optional().default('fileName') }`). `initialFilter` (the `/api/v4/search/initial` response) is held in `SearchPage` local `useState`. **No Zustand store** for search state in Phase 3; **no `useMutation`** wrapping `/initial`.
- **D-3.2** — On search submit (Enter or click): (a) `navigate({ search: { q: term, cat } })` first, (b) `await apiFetch('/rectrace/api/v4/search/initial', ...)`, (c) `setInitialFilter(response)`, (d) the grid remounts via `key={` `${q}-${cat}` `}` causing its datasource `useMemo` to run with fresh `q` + `initialFilter`. On URL-paste with non-empty `q` and no `initialFilter`, the same effect fires in a `useEffect([q, cat])`.
- **D-3.3** — Column definitions are **fetched from `/api/v4/search/config`** — never hardcoded. `useSearchConfig()` is a TanStack Query hook (`queryKey: ['search-config']`, `staleTime: Infinity`, Zod-validated). The renderer registry is the only React-side code that needs editing when adding a column reusing an existing renderer.
- **D-3.4** — Phase 3 fetches **all categories** in the single `/api/v4/search/config` call (matches Angular). Only `fileName` is rendered (render-time, not fetch-time, filter).
- **D-3.5** — New search refreshes the grid by **remounting via `key={` `${q}-${cat}` `}`** on `<AgGridReact>`. Datasource `useMemo([q, cat, initialFilter])` rebuilds with a fresh `AbortController`.
- **D-3.6** — The Phase 2 `setTimeout(() => reportRequestFailure(err), 0)` workaround in the SSRM `getRows` `catch` block (Sonner-mount race) carries over to `SearchGrid`. Do not remove.
- **D-3.7** — `/api/v4/search/initial` is plain `apiFetch` (not `useMutation`), called from a `useCallback` in `SearchPage` on submit + by the URL-restore `useEffect`. Loading state is a local `isInitialLoading` bool. Errors route through `reportRequestFailure(err)`. **Note: live backend is GET `?keyword=` — verified by reading `SearchControllerV4.java` (see "Existing Patterns" below). UI-SPEC's POST mention is superseded.**
- **D-3.8** — SSRM `getRows` POST body includes `category`, `initialFilter` (closure-captured), `rowGroupCols`, `groupKeys`, `sortModel`, `filterModel`, `startRow`, `endRow`, `visibleColumns`.
- **D-3.9** — Phase 3 ships Vitest unit tests + extends `scripts/smoke-ssrm.sh`. Targets: `useRecentSearches`, `useSearchState`, `configCategoryToColDefs` adapter, three renderer components. **No RTL integration tests, no Playwright E2E.** Phase 8 owns that surface. Live UAT closes Phase 3.
- **D-3.10** — AG-Grid Enterprise's **client-side `exportDataAsExcel()`** is the export path. Acknowledged limitation: SSRM exports only cached rows. Excluded column: `execution_order`. Included: all others including hidden (`app_name`, `set_id`, `sub_acc`). **This diverges from Angular's `SearchV5GridComponent.exportToExcel()`, which calls the backend `/api/v4/search/export/{category}` endpoint via `searchServiceV5.exportData()` — see "Excel Export" in Technical Approach for the implications.**
- **D-3.11** — localStorage key `rectrace-recent-searches`, single global bucket in Phase 3, max 10, prepend on submit, dedupe (case-sensitive). Per-category namespacing (`rectrace-recent-searches:{cat}`) deferred.

### Claude's Discretion (planner decides)

- Exact `useEffect` shape for URL-restore in `SearchPage` (debounce vs immediate, single vs split hooks).
- Zod schema location — colocate per-route in `search/types.ts` (preferred) vs central `src/lib/schemas.ts`.
- AG-Grid module registration site — once in `main.tsx` (preferred — matches Phase 2 license pattern) vs lazily in `SearchGrid.tsx`.
- Renderer registry export shape — `as const` object vs typed `Record<string, ComponentType<ICellRendererParams>>`.
- `useSearchConfig` location — `search/hooks/` vs `src/lib/`.
- Adapter handling of `cellStyle` — pass through directly; planner verifies that kebab-case CSS keys in JSON (`align-items`, `justify-content`) work as AG-Grid `cellStyle` keys. (See "Pitfalls" — verified below: AG-Grid `cellStyle` is a JS object, NOT a CSS declaration block, so kebab-case keys are technically invalid React style but AG-Grid passes them to the DOM via `style.setProperty` paths. Adapter must convert kebab-case → camelCase OR planner accepts the current JSON form and tests visually.)
- `scripts/smoke-ssrm.sh` extension shape — additive vs new `smoke-search.sh` (preferred: additive per Phase 2 D-2.16 "one ops surface").
- `/api/v4/search/initial` GET-vs-POST verification — **resolved here: GET `?keyword=`** (see Existing Patterns below; backend source line confirms).

### Deferred Ideas (OUT OF SCOPE)

- Per-category recent searches (`rectrace-recent-searches:{cat}`) — Phase 4.
- Imperative SSRM refresh instead of remount-by-key — Phase 4+.
- Server-side Excel export via `/api/v4/search/export/{category}` — Phase 4+ if SSRM client-side hits ceiling.
- Live `/api/search/suggest` autocomplete in SearchBar — Phase 4+.
- RTL integration tests on SearchPage flow — Phase 8 DESIGN-02.
- Playwright E2E — Phase 8 DESIGN-02.
- Cytoscape execution-order modal — Phase 4 replaces the `<pre>JSON</pre>` placeholder.
- TLM Stats modal V2, QuickRec Stats modal, additional renderers (`setIdV2`, `reconV2`, `tlmInstanceV2`, `reconIdRenderer`, `recPortalIdRenderer`) — Phase 4+.
- Column-state / filter-state / expanded-group URL sync — Phase 4+ design polish.
- Rotating search-input placeholder animation — Phase 8 polish.
- Chart/series/ramp design tokens — auto-surface mechanism (D-2.7) still active.
- `x-citiportal-loginid` auth filter on the React side — Phase 9 SEC-01.
- ES SSL truststore, CORS lockdown, Citi CA, Nexus/Verdaccio routing — Phase 9 SEC-03..06.
- Visual regression testing — Phase 8 DESIGN-02.
- Backend changes — no new endpoints, no DTO shape changes, no `search-config-v4.json` edits.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEARCH-01 | Port the latest search flow (v3/v4) to React end-to-end for one category | "Technical Approach §1 (config-driven grid)", "§2 (two-step SSRM)", "Existing Patterns: backend endpoints" |
| SEARCH-02 | Port ≥1 custom cell renderer preserving behavior | "Technical Approach §3 (cell renderer port)", "Existing Patterns: Angular renderer source files" |
| SEARCH-03 | URL-synced search state — deep-linkable | "Technical Approach §4 (TanStack Router validateSearch + Zod)" |
| SEARCH-04 | Excel export at feature parity with Angular | "Technical Approach §5 (Excel export)" — see divergence note in D-3.10 |
| SEARCH-05 | Recent searches in localStorage, last 10 typeahead | "Technical Approach §6 (recent searches)" |
| SEARCH-06 | All error states display correlation ID | "Technical Approach §7 (correlation ID surfacing)", "Existing Patterns: `queryClient.ts` already attaches X-Correlation-Id" |
| SEARCH-07 | React app at `/rectrace/` (no `/v6/`); React + Angular dev-side-by-side only | "Technical Approach §8 (base path)" — already verified in Phase 2 `vite.config.ts` |

---

## Project Constraints (from CLAUDE.md)

- **Config-driven principle is non-negotiable.** `search-config-v4.json` + `/api/v4/search/config` drives column behavior; renderer registry maps string keys to React components. No hardcoded `columnDefs` arrays. This is memory-locked at `~/.claude/projects/.../memory/feedback_config_driven_principle.md` and CLAUDE.md project memory.
- **GSD workflow enforcement** — all edits go through GSD phase commands; planner/executor stay inside the wave-based atomic commit pattern Phase 2 established.
- **No new docs (*.md) unless explicitly requested.** Planner creates `03-NN-PLAN.md` and the executor follows.
- **Production base path `/rectrace/`** — Vite `base: '/rectrace/'` for prod, `/` for dev (already wired in Phase 2 `vite.config.ts`). Spring serves `static/` at `/rectrace/`. Angular continues to coexist in dev (`cd frontend/rectrace && npm start` manual) but is decommissioned at React go-live (D-2.4 / SEARCH-07).

---

## Validation Architecture (Nyquist Dimension 8)

> Phase 3 ships **Vitest unit tests + extends `scripts/smoke-ssrm.sh`** (per D-3.9). No RTL integration tests, no Playwright E2E. Live UAT closes the phase.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 (already in `frontend-react/package.json`) + jsdom 29 + @testing-library/react 16 + @testing-library/jest-dom 6 |
| Config file | `frontend-react/vitest.config.ts` (or inline in `vite.config.ts`; planner verifies) |
| Quick run command | `pnpm --filter rectrace-frontend test` (or `cd frontend-react && pnpm test`) |
| Full suite command | `cd frontend-react && pnpm test` (single `vitest run` is the full suite for a frontend at this size) |
| Smoke script | `bash scripts/smoke-ssrm.sh` — extended in Phase 3 to also exercise `/api/v4/search/config` and the two-step search response shape |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEARCH-01 | Config-driven `ColDef[]` built from `/api/v4/search/config` `fileName` entry | unit (adapter test) | `pnpm test -- configToColDefs` | ❌ Wave 0 — new file `search/__tests__/configToColDefs.test.ts` |
| SEARCH-01 | Two-step search flow: `/initial` then SSRM `getRows` carries `initialFilter` | smoke (curl-driven) | `bash scripts/smoke-ssrm.sh` | ✅ exists; extend per D-3.9 |
| SEARCH-02 | `ExecutionOrderCellRenderer`: button absent when `load_job` empty | unit | `pnpm test -- ExecutionOrderCellRenderer` | ❌ Wave 0 |
| SEARCH-02 | `ExecutionOrderCellRenderer`: loading state on click; placeholder Dialog opens on success | unit (mocked `apiFetch`) | `pnpm test -- ExecutionOrderCellRenderer` | ❌ Wave 0 |
| SEARCH-02 | `AppIDCellRenderer`: external link with `app_name` tooltip; falsy value → plain span | unit | `pnpm test -- AppIDCellRenderer` | ❌ Wave 0 |
| SEARCH-02 | `SupportEmailCellRenderer`: mailto link; falsy value → plain span | unit | `pnpm test -- SupportEmailCellRenderer` | ❌ Wave 0 |
| SEARCH-03 | URL-paste with `?q=LOAD-ABC-123&cat=fileName` restores the view (deep-linkable) | unit (URL ↔ state sync hook) + smoke (curl + check route) | `pnpm test -- useSearchState` + `bash scripts/smoke-ssrm.sh` | ❌ Wave 0 (test); ✅ (script) |
| SEARCH-04 | Excel export downloads file with the documented filename pattern | manual UAT (no headless download test in Phase 3) | n/a — UAT step | n/a |
| SEARCH-05 | `useRecentSearches`: prepend, dedupe, 10-cap, case-sensitive | unit | `pnpm test -- useRecentSearches` | ❌ Wave 0 |
| SEARCH-06 | SSRM `getRows` 500 surfaces Sonner toast with 32-hex correlation ID | smoke + manual UAT | inject backend fault, observe toast | n/a (UAT) |
| SEARCH-07 | App reachable at `/rectrace/` (prod) / `/` (dev); `/search` route renders | smoke | `bash scripts/smoke-ssrm.sh` (extend to GET `/search`) | ✅ extend |

### Sampling Rate

- **Per task commit:** `cd frontend-react && pnpm test -- <touched-file-glob>` — sub-30s.
- **Per wave merge:** `cd frontend-react && pnpm test && pnpm typecheck && pnpm lint` — full Vitest + tsc + ESLint.
- **Phase gate:** Full suite green + `bash scripts/smoke-ssrm.sh` against the local Phase 0.1 stack (Oracle on `localhost:1521/FREEPDB1`, ES on `localhost:9200`, backend on `:6088`, React dev on `:5173`) + live UAT (matches Phase 2 close pattern).

### Wave 0 Gaps

- [ ] `frontend-react/src/search/__tests__/configToColDefs.test.ts` — adapter unit tests (covers SEARCH-01 config-driven mapping).
- [ ] `frontend-react/src/search/__tests__/useRecentSearches.test.ts` — localStorage hook (SEARCH-05).
- [ ] `frontend-react/src/search/__tests__/useSearchState.test.ts` — URL ↔ state sync (SEARCH-03).
- [ ] `frontend-react/src/search/__tests__/ExecutionOrderCellRenderer.test.tsx` — renderer behavior (SEARCH-02).
- [ ] `frontend-react/src/search/__tests__/AppIDCellRenderer.test.tsx` — renderer behavior (SEARCH-02).
- [ ] `frontend-react/src/search/__tests__/SupportEmailCellRenderer.test.tsx` — renderer behavior (SEARCH-02).
- [ ] `frontend-react/src/search/__tests__/useSearchConfig.test.ts` — Zod parse + happy/sad paths (optional, low-cost).
- [ ] `scripts/smoke-ssrm.sh` extension — adds `/api/v4/search/config` shape assertion + GET `/rectrace/search` route + verifies two-step `/initial` → SSRM body shape.

> Framework already installed (Phase 2). No `pnpm add` for test deps needed.

### Validation against ASVS (security_enforcement assumed enabled — no explicit `false` in config)

Phase 3 surface is read-only search against an internal app with no auth in this phase (Phase 9 SEC-01 owns auth). ASVS categories:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Deferred to Phase 9 SEC-01 |
| V3 Session Management | no | Deferred to Phase 9 |
| V4 Access Control | no | Deferred to Phase 9 |
| V5 Input Validation | yes | Zod on `useSearch` schema (URL params); Zod on `useSearchConfig` response shape; AG-Grid filter input is type-safe via SSRM model |
| V6 Cryptography | no | No new crypto surface |
| V7 Error Handling | yes | `reportRequestFailure` surfaces a Sonner toast with correlation ID — no stack trace or PII leak in UI |
| V14 Configuration | yes | Vite `base: '/rectrace/'`; no secret values in client bundle other than the AG-Grid license (Phase 2 D-2.14 contract — license is build-time env, not in repo) |

| Threat Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via cell renderer (app_id, support_email values from Oracle) | Tampering | React's default escaping — never use `dangerouslySetInnerHTML`. Links built via `<a href={...}>` with the value as inner text only |
| Open redirect via `AppIDCellRenderer` href | Spoofing | Href is hardcoded to `https://lnkd.in/gpAtSBRj` (Angular parity) — value is rendered as visible text only, not used in URL construction |
| Reflected XSS via search term in error state body | Tampering | React escapes `{searchTerm}` interpolation by default; no `dangerouslySetInnerHTML` |
| localStorage tampering injecting malicious values | Tampering | `useRecentSearches` parses with `JSON.parse` in a try/catch; treats parse failure / non-array as empty; renders values as text only |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| URL state ownership | Browser (TanStack Router) | — | URL is the source of truth (D-3.1); browser owns history + paste-deep-link |
| Search submission orchestration | Browser (SearchPage) | API (backend `/initial`, SSRM endpoints) | Local React state holds `initialFilter`; backend computes ES pre-filter + paginates Oracle |
| Column definition assembly | Browser (configToColDefs adapter) | API (`/api/v4/search/config`) | Config lives on backend (canonical), React reshapes to AG-Grid `ColDef[]` at runtime |
| Renderer registry | Browser only | — | String key → React component is purely client-side concern; backend ships strings |
| SSRM pagination + sorting + filtering | API (backend SearchServiceV4 + Oracle) | Browser (AG-Grid SSRM request envelope) | Oracle does the heavy lifting; AG-Grid sends startRow/endRow + sortModel + filterModel |
| Excel export | Browser (AG-Grid `exportDataAsExcel`) | — | D-3.10 chose client-side; cached SSRM rows only (acknowledged limitation) |
| Recent searches storage | Browser (localStorage) | — | Per-device convenience; no backend persistence (v2 VIEWS-01 covers cross-device saved state) |
| Correlation ID generation | Browser (`apiFetch`) | API (Micrometer Tracing honors inbound header) | Phase 2 D-2.10/D-2.11 wiring: client originates, backend uses as `traceId` |
| Error surfacing | Browser (Sonner via `reportRequestFailure`) | — | UI concern; correlation ID is included from the error object Phase 2 attaches |

---

## Technical Approach

### 1. Config-Driven Grid (SEARCH-01, D-3.3 / D-3.4)

**Hook:** `useSearchConfig()` — TanStack Query.

```ts
// frontend-react/src/search/hooks/useSearchConfig.ts (illustrative)
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/queryClient'
import { SearchConfigurationV4Schema, type SearchConfigurationV4 } from '../types'

export function useSearchConfig() {
  return useQuery<SearchConfigurationV4>({
    queryKey: ['search-config'],
    queryFn: async () => {
      const res = await apiFetch('/rectrace/api/v4/search/config')
      const json = await res.json()
      return SearchConfigurationV4Schema.parse(json)  // Zod-validated
    },
    staleTime: Infinity,  // config only changes on backend restart (SearchConfigServiceV4 @PostConstruct)
    gcTime: Infinity,
  })
}
```

**Adapter:** `configCategoryToColDefs(category)`.

```ts
// frontend-react/src/search/lib/configToColDefs.ts (illustrative)
import type { ColDef } from 'ag-grid-community'
import type { CategoryConfigV4, ColumnDefinitionV4 } from '../types'
import { cellRenderers } from '../renderers/registry'

export function configCategoryToColDefs(cat: CategoryConfigV4): ColDef[] {
  return cat.columns.map((c: ColumnDefinitionV4): ColDef => ({
    field: c.field,
    headerName: c.headerName,
    width: c.width,
    hide: c.hide ?? false,
    sortable: c.sortable ?? true,
    filter: c.filter !== false ? 'agTextColumnFilter' : false,
    resizable: c.resizable ?? true,
    rowGroup: c.rowGroup ?? false,
    pinned: c.pinned as ColDef['pinned'],
    cellRenderer: c.cellRenderer ? cellRenderers[c.cellRenderer] : undefined,
    cellRendererParams: c.cellRendererParams,
    cellStyle: c.cellStyle,  // see Pitfalls — kebab-case key compatibility
  }))
}
```

**Renderer registry** (the ONLY React-side code edited when adding new columns reusing existing renderers):

```ts
// frontend-react/src/search/renderers/registry.ts
import type { ComponentType } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'
import { AppIDCellRenderer } from './AppIDCellRenderer'
import { SupportEmailCellRenderer } from './SupportEmailCellRenderer'
import { ExecutionOrderCellRenderer } from './ExecutionOrderCellRenderer'

export const cellRenderers: Record<string, ComponentType<ICellRendererParams>> = {
  appIDCellRenderer: AppIDCellRenderer,
  supportEmailCellRenderer: SupportEmailCellRenderer,
  executionOrderButtonRenderer: ExecutionOrderCellRenderer,
}
```

**Why a registry pattern?** AG-Grid accepts either a string key (resolved against the `components` map you pass to `<AgGridReact components={...}>`) or a direct component reference on `colDef.cellRenderer`. Both work in v35. The CONTEXT.md UI-SPEC shows the string-key path (`components={{ executionOrderButtonRenderer, appIDCellRenderer, supportEmailCellRenderer }}`); the adapter shown above resolves the string at adapter time. Either is fine — the planner picks. The string-key path is closer to Angular's pattern and is recommended.

**Zod schema** for the config response (illustrative, planner refines exact shape from live response):

```ts
// frontend-react/src/search/types.ts
import { z } from 'zod'

export const ColumnDefinitionV4Schema = z.object({
  field: z.string(),
  headerName: z.string(),
  rowGroup: z.boolean().optional(),
  hide: z.boolean().optional(),
  sortable: z.boolean().optional(),
  filter: z.boolean().optional(),
  resizable: z.boolean().optional(),
  width: z.number().optional(),
  cellRenderer: z.string().optional(),
  cellRendererParams: z.record(z.unknown()).optional(),
  cellStyle: z.record(z.string()).optional(),
  pinned: z.enum(['left', 'right']).nullable().optional(),
})

export const CategoryConfigV4Schema = z.object({
  key: z.string(),
  label: z.string(),
  searchColumn: z.string(),
  elasticsearch: z.record(z.unknown()),
  oracle: z.record(z.unknown()),
  columns: z.array(ColumnDefinitionV4Schema),
})

export const SearchConfigurationV4Schema = z.object({
  categories: z.array(CategoryConfigV4Schema),
})

export type SearchConfigurationV4 = z.infer<typeof SearchConfigurationV4Schema>
export type CategoryConfigV4 = z.infer<typeof CategoryConfigV4Schema>
export type ColumnDefinitionV4 = z.infer<typeof ColumnDefinitionV4Schema>
```

### 2. Two-Step SSRM Flow (SEARCH-01, D-3.2 / D-3.7 / D-3.8)

**Step 1 — Initial search (GET).** Verified by reading `SearchControllerV4.java:27-47`: `@GetMapping("/initial")` with `@RequestParam String keyword`. UI-SPEC's "POST" wording is superseded.

```ts
// In SearchPage.tsx (illustrative)
const handleSubmit = useCallback(async (term: string) => {
  if (!term.trim()) return
  await navigate({ search: { q: term, cat: 'fileName' } })   // URL first
  setIsInitialLoading(true)
  try {
    const res = await apiFetch(`/rectrace/api/v4/search/initial?keyword=${encodeURIComponent(term)}`)
    const data = await res.json() as InitialSearchResponseV4
    setInitialFilter(data)
    // recent-searches handled inside useRecentSearches.prepend(term)
    pushRecent(term)
  } catch (err) {
    reportRequestFailure(err)
  } finally {
    setIsInitialLoading(false)
  }
}, [navigate, pushRecent])
```

**Step 2 — SSRM `getRows` (POST).** Same as Phase 2 `SmokeGrid.tsx` but with:
- `initialFilter` from `SearchPage` state embedded in the body (closure-captured by `useMemo`).
- Column-key dependent on `q` and `cat` so the grid remounts (D-3.5).

```ts
// In SearchGrid.tsx (illustrative)
const datasource = useMemo<IServerSideDatasource>(() => {
  const controller = new AbortController()
  return {
    getRows: async (params) => {
      try {
        const body: SSRMRequestV4 = {
          category: cat,
          initialFilter: initialFilter?.categoryResults?.[cat]
            ? { column: initialFilter.categoryResults[cat].searchColumn, values: initialFilter.categoryResults[cat].values }
            : null,  // planner verifies exact shape — see "Open Questions"
          rowGroupCols: params.request.rowGroupCols.map(c => c.field) ?? [],
          groupKeys: params.request.groupKeys ?? [],
          sortModel: params.request.sortModel ?? [],
          filterModel: params.request.filterModel ?? {},
          startRow: params.request.startRow,
          endRow: params.request.endRow,
          visibleColumns: visibleColumnsRef.current,
        }
        const res = await apiFetch(`/rectrace/api/v4/search/ssrm/${cat}`, {
          method: 'POST',
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const data = await res.json() as { rows: Record<string, unknown>[]; lastRow: number }
        params.success({ rowData: data.rows, rowCount: data.lastRow })
      } catch (err) {
        if ((err as { name?: string }).name !== 'AbortError') {
          setTimeout(() => reportRequestFailure(err), 0)  // D-3.6 — Sonner-mount race fix
          params.fail()
        }
      }
    },
    destroy: () => controller.abort(),
  }
}, [q, cat, initialFilter])

// AG-Grid mount:
return (
  <div className="ag-theme-quartz h-[var(--grid-height)]">
    <AgGridReact
      key={`${q}-${cat}`}  // D-3.5 — remount on new search
      rowModelType="serverSide"
      serverSideDatasource={datasource}
      columnDefs={colDefs}
      components={cellRenderers}
      sideBar={{ toolPanels: ['columns', 'filters'] }}
    />
  </div>
)
```

### 3. Cell Renderer Port Pattern (SEARCH-02)

**AG-Grid React renderer API:** Renderers are plain React function components receiving `ICellRendererParams`. No interface to implement, no `agInit` method (that's Angular's `ICellRendererAngularComp`). The component receives `params.value`, `params.data`, and `params.colDef` (which carries `cellRendererParams`). Rerender on prop change happens automatically — no `refresh()` boilerplate.

**Angular vs React renderer cheat-sheet:**

| Concern | Angular (`ICellRendererAngularComp`) | React (function component) |
|---------|-------------------------------------|---------------------------|
| Lifecycle hook | `agInit(params)` + `refresh(params)` | Component body re-runs on prop change |
| Click handler | `(click)="showExecutionOrder()"` in template | `onClick={handleClick}` |
| Internal state | Class fields (`isLoading: boolean`) | `useState` |
| Service injection | DI via constructor | Import the function (or use a hook) |
| Open modal | `MatDialog.open()` | Local `useState` toggling a shadcn `<Dialog open={...}>` |
| Tooltip | `[matTooltip]="..."` | `<Tooltip><TooltipTrigger>...</TooltipTrigger><TooltipContent>...</TooltipContent></Tooltip>` (shadcn) or `title` attribute (UI-SPEC uses `title` for the simpler AppID case) |

**`ExecutionOrderCellRenderer.tsx` — sketch** (mirrors Angular `ExecutionOrderButtonComponent`):

```tsx
import { useState } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GitBranchIcon, Loader2Icon } from 'lucide-react'
import { apiFetch, reportRequestFailure } from '@/lib/queryClient'

interface ExecutionOrderParams extends ICellRendererParams {
  colDef?: { cellRendererParams?: { jobNameField?: string } }
}

export function ExecutionOrderCellRenderer(params: ExecutionOrderParams) {
  const jobNameField = params.colDef?.cellRendererParams?.jobNameField ?? 'load_job'
  const jobName = params.data?.[jobNameField] as string | undefined
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<unknown>(null)
  const [open, setOpen] = useState(false)

  if (!jobName || jobName.trim().length === 0) return null

  const handleClick = async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch(`/rectrace/api/execution-order/${encodeURIComponent(jobName)}`)
      const json = await res.json()
      setData(json)
      setOpen(true)
    } catch (err) {
      reportRequestFailure(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={handleClick} disabled={isLoading}
              className="h-6 min-w-[80px] px-2 text-primary text-[12px] font-normal hover:bg-accent">
        {isLoading
          ? <Loader2Icon className="size-3.5 animate-spin" />
          : <span className="inline-flex items-center gap-1"><GitBranchIcon className="size-3.5 opacity-70" />View</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Execution Order — {jobName}</DialogTitle></DialogHeader>
          {/* TODO(Phase 4): replace with ExecutionOrderModal (Cytoscape) */}
          <pre className="text-xs font-mono overflow-auto max-h-[60vh]">{JSON.stringify(data, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**`AppIDCellRenderer.tsx` — sketch:**

```tsx
import type { ICellRendererParams } from 'ag-grid-community'

export function AppIDCellRenderer(params: ICellRendererParams) {
  const value = params.value as string | undefined
  const appName = (params.data?.app_name as string | undefined) ?? ''
  if (!value) return <span>{value}</span>
  return (
    <a href="https://lnkd.in/gpAtSBRj" target="_blank" rel="noopener noreferrer"
       title={`View details of ${appName}`}
       className="text-primary underline hover:no-underline">
      {value}
    </a>
  )
}
```

**`SupportEmailCellRenderer.tsx` — sketch** (mirrors Angular `AppSupportCellRendererComponent`):

```tsx
import type { ICellRendererParams } from 'ag-grid-community'

export function SupportEmailCellRenderer(params: ICellRendererParams) {
  const value = params.value as string | undefined
  if (!value) return <span>{value}</span>
  return (
    <a href={`mailto:${value}`}
       title={`Send email to ${(params.data?.app_name as string | undefined) ?? ''}`}
       className="text-primary underline hover:no-underline">
      {value}
    </a>
  )
}
```

### 4. Deep-Linkable URL State (SEARCH-03, D-3.1)

**Mechanism:** TanStack Router `validateSearch` on the route + `useSearch()` to read + `useNavigate()` to write.

```ts
// frontend-react/src/routes/search.tsx (illustrative)
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SearchPage } from '@/search/SearchPage'

const searchSchema = z.object({
  q: z.string().optional(),
  cat: z.string().optional().default('fileName'),
})

export const Route = createFileRoute('/search')({
  validateSearch: searchSchema,    // Zod validates incoming URL params
  component: SearchPage,
})
```

Inside the route component:

```ts
const { q, cat } = Route.useSearch()         // typed, validated
const navigate = Route.useNavigate()

// On submit:
await navigate({ search: { q: term, cat } })

// On URL paste / direct navigation:
useEffect(() => {
  if (q && q.length > 0) {
    void handleSubmit(q)  // re-fires the /initial fetch
  }
}, [q, cat])
```

**Restoration order** (matches Angular `initializeQueryParamsSubscription`):
1. Page loads → TanStack Router parses + Zod-validates the URL.
2. `useSearchConfig` fires (TanStack Query) — config is cached `staleTime: Infinity` after first load.
3. `useEffect([q, cat])` sees a non-empty `q` and fires `handleSubmit(q)` → `GET /api/v4/search/initial?keyword=...` → `setInitialFilter`.
4. Grid mounts (after `initialFilter` is non-null) with `key={` `${q}-${cat}` `}` and the SSRM datasource fetches rows.
5. User sees rows.

**What's URL-worthy in Phase 3:** `q`, `cat`. Nothing else.

**What's intentionally NOT URL-worthy in Phase 3** (Phase 4+ polish per CONTEXT.md deferred):
- Column sort order
- Column filter state
- Expanded group keys
- Column widths / column-state
- Grid scroll position

**Why URL-encoded query string vs base64 or hash:** debuggability. Engineers paste URLs into support tickets; base64 obscures the state and slows triage.

**Choice: standard `?q=&cat=` (no library beyond `URLSearchParams`/TanStack Router).** No need for `nuqs` or `qs` — TanStack Router's `validateSearch` + Zod is the idiomatic Phase 2 pattern and already in the dependency tree. Adding another URL-state library would be drift.

### 5. Excel Export (SEARCH-04, D-3.10)

**Decision:** AG-Grid Enterprise's **client-side `gridApi.exportDataAsExcel()`**. NOT the backend `/api/v4/search/export/{category}` endpoint (which is what the Angular app calls per `SearchV5GridComponent.exportToExcel()` line 526 → `searchServiceV5.exportData()` → POST to `/api/v4/search/export/{category}`).

**Module registration required** (currently `main.tsx` only registers `ServerSideRowModelModule`; Phase 3 adds Excel + tool panels):

```ts
// frontend-react/src/main.tsx (Phase 3 additions)
import { ModuleRegistry } from 'ag-grid-community'
import {
  ServerSideRowModelModule,
  ExcelExportModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
} from 'ag-grid-enterprise'

ModuleRegistry.registerModules([
  ServerSideRowModelModule,
  ExcelExportModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
])
```

Verified via Context7 (`/websites/ag-grid_archive_35_0_0_javascript-data-grid` snippet "AG Grid Initialization with Excel Export Module") — `ExcelExportModule` lives in `ag-grid-enterprise` and is the prerequisite for `exportDataAsExcel()`. [VERIFIED: Context7]

**Filename pattern** (UI-SPEC):

```ts
function buildExportFilename(category: string, term: string): string {
  const safeTerm = term.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const ymd = new Date().toISOString().slice(0,10).replace(/-/g,'')
  return `rectrace-${category}-${safeTerm}-${ymd}.xlsx`
}

// Trigger:
gridApi.exportDataAsExcel({
  fileName: buildExportFilename('fileName', q),
  columnKeys: visibleAndHiddenFields.filter(f => f !== 'execution_order'),
})
```

**Columns in export** (D-3.10): all from config EXCEPT `execution_order` (button is not meaningful in a spreadsheet); INCLUDE hidden columns (`app_name`, `set_id`, `sub_acc`). AG-Grid's `columnKeys` param lets you specify an explicit list so hidden columns are included even though they're not on screen.

**Acknowledged limitation (D-3.10):** SSRM client-side export only includes rows AG-Grid has cached client-side, not the full server-side result set. The Angular path (server-side export endpoint) doesn't have this limitation. The CONTEXT.md decision accepts this for Phase 3 parity with the AG-Grid native capability and defers the backend-export swap-in to Phase 4+ if the limitation bites in practice.

**Divergence from Angular flagged for planner:** The user-facing parity matrix row says "Excel export → port"; the implementation diverges. If a stakeholder expects bit-for-bit parity (same XLSX file via the same backend codepath), the planner should surface this in the plan or escalate during plan-review. CONTEXT.md D-3.10 explicitly addresses this and locks the decision, but it's worth re-reading at plan time.

### 6. Recent Searches (SEARCH-05, D-3.11)

**Hook** (`useRecentSearches`):

```ts
// frontend-react/src/search/hooks/useRecentSearches.ts (illustrative)
import { useState, useCallback } from 'react'

const KEY = 'rectrace-recent-searches'
const MAX = 10

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export function useRecentSearches() {
  const [recents, setRecents] = useState<string[]>(read)

  const push = useCallback((term: string) => {
    if (!term.trim()) return
    setRecents(prev => {
      const filtered = prev.filter(t => t !== term)  // case-sensitive dedupe (D-3.11)
      const next = [term, ...filtered].slice(0, MAX)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* swallow quota */ }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    try { localStorage.removeItem(KEY) } catch { /* swallow */ }
    setRecents([])
  }, [])

  return { recents, push, clear }
}
```

**No third-party lib needed.** `usehooks-ts`'s `useLocalStorage` is a 200-byte wrapper that adds an `addEventListener('storage')` cross-tab sync — not worth the dep for this use case (single-tab UX). Roll the hook.

**UI:** shadcn `Popover` + `Command` (per UI-SPEC + CONTEXT.md `<canonical_refs>`). The shadcn `Command` component wraps `cmdk` (verified — that's how shadcn ships it) and gives a keyboard-navigable list out of the box.

### 7. Correlation ID Surfacing (SEARCH-06)

**No new code needed for the wiring.** Phase 2 already shipped:

- `apiFetch` (`frontend-react/src/lib/queryClient.ts:6`) generates a UUID v4 (dashes stripped — 32 hex) per request, sends `X-Correlation-Id`, attaches it to thrown errors as `err.correlationId`. [VERIFIED: source file]
- `reportRequestFailure(err)` (`frontend-react/src/lib/queryClient.ts:40`) extracts `err.correlationId` and surfaces `toast.error('Request failed', { description: 'Error reference: <id>' })`. [VERIFIED: source file]
- Sonner `<Toaster richColors position="bottom-right" />` mounted in `__root.tsx` BEFORE the `<Outlet />` so the Toaster is live before children dispatch — this is the load-bearing ordering the comment in `__root.tsx` calls out. [VERIFIED: source file]
- Backend Brave-bridge propagator (Phase 2 D-2.10) accepts the inbound `X-Correlation-Id`, populates `traceId` MDC, log lines include `%X{traceId}`. The toast ID == the log `traceId` for the failing request — that's the value of the design.

**Phase 3 just routes every fetch path through `apiFetch` + `reportRequestFailure`:**
- `/api/v4/search/config` → `useSearchConfig` calls `apiFetch`; TanStack Query's `queryCache.onError = reportRequestFailure` (set in `queryClient.ts:53`) fires on error.
- `/api/v4/search/initial` → `SearchPage.handleSubmit`'s catch block calls `reportRequestFailure(err)` directly.
- `/api/v4/search/ssrm/fileName` → SSRM `getRows` catch block uses the `setTimeout(0)` wrapper (D-3.6).
- `/api/execution-order/{jobName}` → `ExecutionOrderCellRenderer.handleClick` catch block calls `reportRequestFailure(err)` directly.
- Excel export → if `exportDataAsExcel()` throws (synchronous), wrap in try/catch and call `reportRequestFailure`. AG-Grid's client-side export is sync and doesn't normally throw; failures are rare (browser blob limits) but still routed.

**Where the ID is displayed:**
- Sonner toast (bottom-right) — always.
- Inline error-state card in the grid area on `/initial` failure — UI-SPEC's "Error state body" shows the ID inline too: `"Failed to load results. Error reference: {correlationId} — quote this when reporting an issue."`

**Where the ID is NOT displayed:** other inline form errors (none in Phase 3) or modals (no Phase 3 modal beyond the placeholder Dialog).

### 8. Base Path `/rectrace/` (SEARCH-07)

**Already wired in Phase 2.** Verified by reading `frontend-react/vite.config.ts`:
- `base: mode === 'production' ? '/rectrace/' : '/'` — line 18. [VERIFIED: source]
- Vite dev proxy `/rectrace/api` → `http://localhost:6088` — lines 33-37. [VERIFIED: source]
- `ops/build.sh react` copies `frontend-react/dist/*` into `backend/rectrace/src/main/resources/static/`, Spring serves at `/rectrace/`. [VERIFIED: Phase 2 D-2.16]

**Phase 3 implication:** Every `apiFetch` URL is prefixed with `/rectrace/api/...`. In dev (`vite dev`) the Vite proxy strips/forwards; in prod, the bundle runs at `/rectrace/` so the URLs are same-origin. No CORS ceremony.

**Routes:** `/` (Phase 2 hello-world index page) redirects to `/search` in Phase 3. The redirect target should be `/search` (not `/rectrace/search` — the React app's internal routes don't include the base prefix; TanStack Router handles the base offset automatically when Vite's `base` is set). UI-SPEC says: *"The root `/` redirects to `/search` (already established in Phase 2's `routes/index.tsx` pattern — executor verifies and adjusts the redirect)."* Verified: Phase 2 `routes/index.tsx` does NOT currently redirect; it renders the SmokeGrid. Phase 3 must change it to redirect. TanStack Router file-based route redirect pattern:

```ts
// frontend-react/src/routes/index.tsx (Phase 3 replacement)
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => { throw redirect({ to: '/search' }) },
})
```

**Angular coexistence:** Per D-2.4 and SEARCH-07, Angular is decommissioned at React go-live. During Phases 2-9 dev, a developer who wants to compare side-by-side runs `cd frontend/rectrace && npm start` manually (not in `ops/rectrace-ops.sh`). Phase 3 inherits this with no changes.

---

## Existing Patterns

### Phase 2 React shell (reuse as-is)

| Asset | Path | Use |
|-------|------|-----|
| `apiFetch` | `frontend-react/src/lib/queryClient.ts` | Universal fetch wrapper. Attaches `X-Correlation-Id`, throws errors with `err.correlationId`. **Do not modify.** |
| `reportRequestFailure` | `frontend-react/src/lib/queryClient.ts` | Sonner toast surface with corr-id. **Do not modify.** |
| `queryClient` | `frontend-react/src/lib/queryClient.ts` | TanStack QueryClient with `queryCache.onError = reportRequestFailure`. Reuse via `useQuery`/`useMutation`. |
| SSRM datasource pattern | `frontend-react/src/grid/SmokeGrid.tsx` | `useMemo` + AbortController + `destroy()` + `setTimeout(0)` Sonner workaround. **Carries over verbatim** to `SearchGrid.tsx`, then delete SmokeGrid. |
| AG-Grid bootstrap | `frontend-react/src/main.tsx` | `LicenseManager.setLicenseKey` + `ModuleRegistry.registerModules`. Phase 3 adds `ExcelExportModule`, `ColumnsToolPanelModule`, `FiltersToolPanelModule`. |
| TanStack Router root | `frontend-react/src/routes/__root.tsx` | `<ThemeProvider><QueryClientProvider><Toaster /><Outlet /></QueryClientProvider></ThemeProvider>`. Mount order load-bearing per the comment. Reuse as-is. |
| Theme | `frontend-react/src/components/layout/theme-provider.tsx`, `theme-switch.tsx` | `next-themes`-backed light/dark toggle. Phase 3 grid theme should follow (Phase 2 ships `ag-theme-quartz`; the dark variant `ag-theme-quartz-dark` toggles via the `class="dark"` on `<html>`). |
| Footer | `frontend-react/src/components/app-shell/footer.tsx` | `Rectrace · Build: {__BUILD_SHA__} · v0.1.0`. Reuse as-is. |

### Backend endpoints (consume as-is, no changes)

| Endpoint | Verb | Path | DTO | Notes |
|----------|------|------|-----|-------|
| Search config | GET | `/rectrace/api/v4/search/config` | `SearchConfigurationV4` | `staleTime: Infinity` safe — `SearchConfigServiceV4` `@PostConstruct` loads at boot |
| Initial search | **GET** | `/rectrace/api/v4/search/initial?keyword=...` | `InitialSearchResponseV4` | CONFIRMED: `SearchControllerV4.java:27-47` is `@GetMapping`. UI-SPEC's POST mention is wrong. |
| SSRM rows | POST | `/rectrace/api/v4/search/ssrm/{category}` | `SSRMRequestV4` → `SSRMResponseV4 { rows[], lastRow }` | SmokeGrid already uses this; reuse body shape verbatim |
| Execution order | GET | `/rectrace/api/execution-order/{jobName}` | `ExecutionOrderResponse { loadJob, executionSequence[], jobDetails }` | Placeholder Dialog renders the JSON in `<pre>` — Phase 4 swaps in the real modal |
| Excel export (NOT used in Phase 3) | POST | `/rectrace/api/v4/search/export/{category}` | `ExportRequestV4` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` blob | Available but not wired; Phase 4+ fallback if AG-Grid client-side export proves insufficient |
| Search suggest (NOT used in Phase 3) | GET | `/rectrace/api/search/suggest?prefix=...` | `string[]` | Phase 4+ |

**`SSRMRequestV4` DTO shape** (from `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SSRMRequestV4.java`):

```java
private String category;
private InitialFilter initialFilter;  // ES results as filter — { column: string, values: string[] }
private List<String> rowGroupCols;
private List<String> groupKeys;
private List<SortModel> sortModel;    // SortModel = { colId, sort }
private Map<String, Object> filterModel;  // AG-Grid filter model
private int startRow;
private int endRow;
private List<String> visibleColumns;
```

### Angular reference (mirror behavior, not code)

| File | What to mirror |
|------|----------------|
| `frontend/rectrace/src/app/services/search-v5.service.ts` | Endpoint surface (lines 102-141). `performInitialSearch` is GET (confirms backend), `fetchSSRMData` is POST, `getConfiguration` is GET, `exportData` is POST to backend (we diverge — D-3.10 chooses client-side AG-Grid export). |
| `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts:83` | `this.columns.map(col => ({ ... }))` — the canonical config-driven `ColDef[]` adapter. Mirror in `configToColDefs.ts`. |
| `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts:181-190` | `components: { appIDCellRenderer, supportEmailCellRenderer, executionOrderButtonRenderer, ... }` — the renderer map. Mirror as the React `cellRenderers` registry. |
| `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts:196-222` | **Anti-pattern reference** — Angular's `getRowId` uses `timestamp + random` for "uniqueness". CLAUDE.md flags this. React port must NOT replicate this — use a stable composite (see Pitfalls below). |
| `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts:141-180` | `sideBar.toolPanels = ['columns', 'filters']` config — Phase 3 mirrors with `sideBar={{ toolPanels: ['columns', 'filters'] }}`. |
| `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts:471-552` | `exportToExcel` — Angular calls backend; React diverges (D-3.10). Read for column-list construction logic (which fields to include/exclude) — that's portable. |
| `frontend/rectrace/src/app/custom-interactions/components/renderers/execution-order-button.component.ts` | Behavior parity target for `ExecutionOrderCellRenderer.tsx`. Angular opens `MatDialog`; React opens shadcn `Dialog`. |
| `frontend/rectrace/src/app/custom-interactions/components/renderers/app-id-cell-renderer.component.ts` | Behavior parity target for `AppIDCellRenderer.tsx`. External link with tooltip. |
| `frontend/rectrace/src/app/custom-interactions/components/renderers/app-support-cell-renderer.component.ts` | Behavior parity target for `SupportEmailCellRenderer.tsx`. `mailto:` link with tooltip. |
| `frontend/rectrace/src/app/search-v5/components/search-v5/search-v5.component.ts` | Search submission + URL queryParams + recent-searches localStorage. The React `SearchPage` mirrors. |

### Config file (canonical contract — read before implementing)

`backend/rectrace/src/main/resources/search-config-v4.json` lines 3-37 (the `fileName` category). The exact `cellRenderer` string keys (`appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer`), `cellRendererParams.jobNameField = "load_job"`, and `cellStyle` on `execution_order` come from this file. Renderer registry keys must match exactly. [VERIFIED: file]

---

## Dependencies & Library Choices

| Dependency | Required Version | Already Installed (Phase 2) | Rationale |
|-----------|------------------|-----------------------------|-----------|
| `react` | `^19.2.0` | yes | Phase 2 D-2.x React 19 |
| `ag-grid-community` | `^35.0.1` (latest: 35.3.0) | yes | SSRM + ColDef types |
| `ag-grid-enterprise` | `^35.0.1` (latest: 35.3.0) | yes | LicenseManager, ServerSideRowModelModule, **ExcelExportModule (new in Phase 3)**, ColumnsToolPanelModule, FiltersToolPanelModule |
| `ag-grid-react` | `^35.0.1` | yes | `<AgGridReact>` wrapper |
| `@tanstack/react-router` | `^1.159.5` (latest: 1.170.3) | yes | `validateSearch` + `useSearch` + Zod |
| `@tanstack/react-query` | `^5.90.20` | yes | `useSearchConfig` hook |
| `zod` | `^3.24.2` (latest: 4.4.3) | yes (stay on 3.x; 4 is a major bump, defer) | URL search schema + config response validation |
| `sonner` | `^2.0.7` | yes | Toast surface (already mounted) |
| `lucide-react` | `^0.563.0` | yes | `GitBranchIcon`, `Loader2Icon`, `SearchIcon`, `XIcon`, `ClockIcon`, `DownloadIcon` |
| `next-themes` | `^0.4.6` | yes | Dark/light toggle; React's grid theme bridges via `class="dark"` on `<html>` |
| `class-variance-authority` | `^0.7.1` | yes | shadcn primitive deps |
| `tailwind-merge` | `^3.4.0` | yes | shadcn `cn()` |

**New shadcn components to vendor in Phase 3** (per UI-SPEC + D-2.6 — `pnpm dlx shadcn@3.8.5 add <name>`):

| Component | Why |
|-----------|-----|
| `input` | SearchBar text input |
| `badge` | Result count chip + category tab indicator |
| `separator` | Visual divider in popover and toolbar |
| `command` | cmdk-backed recent-searches list |
| `popover` | Anchor for the recent-searches dropdown |
| `tooltip` | Optional tooltip on the execution-order button (UI-SPEC uses `title` attribute for AppID; can use shadcn `Tooltip` if desired) |
| `dropdown-menu` | Export menu trigger |
| `skeleton` | Loading state in grid area (3 × 36px rows) |
| `dialog` | Execution-order placeholder modal (Phase 4 swaps in Cytoscape) |

Already vendored from Phase 2 (do NOT re-add): `button`, `sonner`, `card`.

**Version verification (run by planner at plan time per the research protocol):**

```bash
npm view ag-grid-enterprise version          # 35.3.0 as of 2026-05-17 [VERIFIED]
npm view @tanstack/react-router version      # 1.170.3 [VERIFIED]
npm view zod version                         # 4.4.3 [VERIFIED]  (stay on 3.x in this phase)
npm view sonner version                      # 2.0.7 [VERIFIED]
```

**No new top-level deps needed** beyond shadcn-added vendored components (those land in `frontend-react/src/components/ui/` as source, not as dep entries).

---

## Pitfalls & Landmines

### 1. AG-Grid SSRM + React StrictMode double-mount

**What goes wrong:** React 19 StrictMode (already enabled in Phase 2 `main.tsx`) mounts components twice in development. AG-Grid's SSRM datasource `getRows` fires once per mount. Without an AbortController, the first mount's in-flight fetch can call `params.success()` on a detached SSRM context, causing console errors or stale rows.

**Why it happens:** SSRM datasources are persistent objects with side-effects (open fetches). React's StrictMode double-mount surfaces this in dev (it's harmless in prod).

**How to avoid:** Use the Phase 2 `SmokeGrid.tsx` pattern verbatim — `useMemo` builds the datasource with a fresh `AbortController`, `destroy: () => controller.abort()` aborts in-flight requests on unmount, and the catch block ignores `AbortError`. The `key={` `${q}-${cat}` `}` on `<AgGridReact>` (D-3.5) forces a full remount which triggers `destroy()` cleanly.

**Warning sign:** "AbortError: The user aborted a request" in console (benign — the catch block filters this), or "params.success called on a destroyed context" (bug — the abort isn't catching the right requests).

### 2. `getRowId` anti-pattern (CLAUDE.md flagged)

**What goes wrong:** Angular's `getRowId` (search-v5-grid.component.ts line 218) returns `row_${hash}_${Date.now()}_${random}`. The `Date.now()` + `Math.random()` make IDs non-stable across re-fetches, which breaks AG-Grid's row identity tracking — selected rows lose selection across refreshes, expanded groups collapse, and `refreshServerSide` thrashes the cache.

**Why it happens:** Authors reach for `Date.now()` + random "for uniqueness" when the actual problem is constructing a stable composite from the row's natural keys.

**How to avoid:** For `fileName` rows, build a stable composite from natural fields:

```ts
getRowId: (params) => {
  const d = params.data
  if (!d) return params.parentKeys?.join('|') ?? 'group'
  // Composite of fields guaranteed unique per row in fileName category
  return `${d.file_name_pattern}|${d.ok_file_name}|${d.job_name}|${d.recon}|${d.load_job}|${d.box_name}`
}
```

Verify against the seed data that this composite is unique. If it's not (duplicate physical rows from Oracle would be a separate bug), fall back to `params.data.id` if the backend ever adds it (no change needed in this phase).

**Warning sign:** Selecting a row, scrolling, scrolling back → selection lost. Or filter change → expanded groups all collapse.

### 3. AG-Grid Enterprise license — must be set before `ModuleRegistry.registerModules`

**What goes wrong:** Module registration before license set produces an "AG Grid Enterprise license needed" watermark even when the license env var is correct.

**Why it happens:** AG-Grid v35 checks license state at module-registration time for Enterprise modules.

**How to avoid:** Phase 2 already does the right thing in `main.tsx`:

```ts
LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? '')
ModuleRegistry.registerModules([...])  // license set FIRST
```

Phase 3 must preserve this ordering when adding `ExcelExportModule`, `ColumnsToolPanelModule`, `FiltersToolPanelModule` to the registration list. [VERIFIED: source comment "License MUST be set before any ModuleRegistry.registerModules() call (AG-Grid requirement)" — `main.tsx:9`]

**Warning sign:** Watermark "AG Grid Enterprise license needed" in the grid corner.

### 4. SSRM datasource closure capture (stale `q` / `initialFilter`)

**What goes wrong:** The SSRM `getRows` callback closes over `q` and `initialFilter` at datasource-creation time. If the closure is created once at mount and reused, subsequent searches send the OLD `q` and OLD `initialFilter` to the backend.

**Why it happens:** Classic React closure trap — `useMemo` without the right dep array, or a `useRef` mismanaged.

**How to avoid:** D-3.5's `key={` `${q}-${cat}` `}` strategy sidesteps this entirely: the grid remounts on every new search, the `useMemo` reruns, and the new closure captures fresh values. The `useMemo` dep array MUST include `[q, cat, initialFilter]`.

**Alternative (rejected for Phase 3):** Use a `useRef` to point at the current values and read them inside `getRows`. Works but requires careful ref management. Phase 4+ may revisit if remount-by-key proves too disruptive (loses column-resize state across searches).

**Warning sign:** New search returns old results, or the SSRM POST body shows `category: "wrongOne"` in Network tab.

### 5. shadcn theme provider vs AG-Grid theme

**What goes wrong:** shadcn ships CSS vars on `:root` (light) and `.dark` (dark). AG-Grid Quartz/Alpine themes use their own `--ag-*` CSS vars. Without a bridge, the grid stays light when the app goes dark.

**Why it happens:** AG-Grid v33+ themes are CSS-only (no JS init). The class on `<html>` from `next-themes` toggles shadcn vars but not the AG-Grid theme class on the grid container.

**How to avoid:** Two options:
- (A) Use AG-Grid's auto dark-mode by adding the `ag-theme-quartz-dark` class conditionally on the grid container based on `useTheme()`.
- (B) Bridge AG-Grid `--ag-*` vars to shadcn tokens in `index.css` so the grid follows shadcn's theme implicitly.

Phase 2 already set option (B) per the UI-SPEC inheritance note "Phase 2 inherited AG-Grid token bridge" — the bridge is in `index.css` (verify exact CSS at plan time). Phase 3 doesn't need to revisit unless a new grid surface (e.g., a renderer's button) reads from a token not yet bridged.

**Warning sign:** Grid stays white in dark mode, or row hover color is wrong.

### 6. `cellStyle` kebab-case JSON keys

**What goes wrong:** The `fileName` config has `"cellStyle": {"display": "flex", "align-items": "center", "justify-content": "center", "padding": "0", "height": "100%"}` — kebab-case keys. React's style prop is camelCase (`alignItems`, `justifyContent`). AG-Grid's `cellStyle` is technically a React style object, so kebab-case keys would be silently ignored.

**Why it happens:** Angular's `ngStyle` accepts kebab-case; React doesn't.

**How to avoid:** The `configToColDefs` adapter must convert kebab-case keys to camelCase:

```ts
function kebabToCamelCellStyle(style: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(style).map(([k, v]) => [k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v])
  )
}
```

Apply inside the adapter. Verify in unit test: `configToColDefs.test.ts` should assert that `cellStyle.alignItems === 'center'` after adapting the JSON's `'align-items': 'center'`.

**Alternative:** Edit `search-config-v4.json` to use camelCase. Rejected — that's a backend file change and CONTEXT.md says "no backend changes." Adapter conversion is the right home.

**Warning sign:** Execution-order button visually misaligned in the cell (no centering); manual style inspection in devtools shows the kebab-case key absent from `getComputedStyle`.

### 7. `initialFilter` shape from `/initial` response — Zod schema must match

**What goes wrong:** The frontend's `SSRMRequestV4.initialFilter` is `InitialFilter { column: string, values: string[] }` (per Angular `search-v5.service.ts:49-52`). The `/initial` response (`InitialSearchResponseV4`) returns a `categoryResults` map keyed by category, with each value being `CategoryResultV4 { key, label, values, count, hasMore, columns }`. The React code must reshape `categoryResults[cat]` into `{ column: cat.searchColumn, values: cat.values }` for the SSRM body.

**How to avoid:** Document the reshape in `useSearchConfig` consumer or in `SearchPage`'s submit handler. Zod schema for `InitialSearchResponseV4` confirms the input shape; the reshape is mechanical. Capture in a unit test against a fixture response.

**Warning sign:** SSRM returns 400 or zero rows; backend log shows `initialFilter: null` or malformed `column`/`values`.

### 8. Sonner mount race on initial SSRM fetch (D-3.6)

**What goes wrong:** AG-Grid's first `getRows` call fires in the same commit/effect cascade as Sonner's `<Toaster />` subscriber mount. If `getRows` fails synchronously (e.g., backend down), `toast.error()` is called BEFORE the Toaster subscribes, and Sonner silently drops it.

**Why it happens:** Sonner 2.x subscribes on mount; toasts dispatched before the subscriber arrive in the void.

**How to avoid:** The Phase 2 `setTimeout(() => reportRequestFailure(err), 0)` in the catch block defers the toast to the next macrotask, giving the Toaster a chance to mount. D-3.6 explicitly says "do not remove."

**Warning sign:** First SSRM error never produces a toast; subsequent errors do. The fix: keep the `setTimeout(0)`.

### 9. CORS / `x-citiportal-loginid` header — NOT required in Phase 3

**What goes wrong:** A planner might assume the React app needs to send `x-citiportal-loginid` to match Angular's `getHeaders()` (search-v5.service.ts:143-148).

**Why it doesn't apply yet:** Phase 1 D-1.8 set `SecurityFilterChain` to permit-all. The `x-citiportal-loginid` header is NOT validated by the backend in Phase 1-8. Phase 9 SEC-01 is when this flips to required.

**How to handle:** Phase 3 does NOT send the header. The React app and backend both ignore it until SEC-01. No code change needed in `apiFetch`. CORS is similarly wide-open via `@CrossOrigin(origins = "*")` on `SearchControllerV4`.

**Warning sign:** Adding the header now would couple Phase 3 to an auth contract that hasn't been chosen yet. Don't.

### 10. AG-Grid `ExcelExportModule` not registered — silent no-op

**What goes wrong:** Calling `gridApi.exportDataAsExcel()` without `ExcelExportModule` registered logs a console warning and does nothing (no file downloads). Users click "Export" and nothing happens.

**Why it happens:** AG-Grid v33+ enforced module gating — Enterprise features require explicit `ModuleRegistry.registerModules` for the relevant module.

**How to avoid:** Register `ExcelExportModule` in `main.tsx` alongside `ServerSideRowModelModule` (per Technical Approach §5).

**Warning sign:** "AG Grid: missing module ExcelExportModule" in browser console; export click downloads nothing. [VERIFIED via Context7 docs section "AG Grid Initialization with Excel Export Module"]

### 11. Vite dev proxy vs production base path

**What goes wrong:** In dev, `apiFetch('/rectrace/api/v4/search/config')` resolves against `http://localhost:5173/rectrace/api/...` and Vite's proxy forwards `/rectrace/api` to `http://localhost:6088`. In prod, the bundle runs at `/rectrace/` and same-origin fetches `/rectrace/api/...` directly. **This already works** — verified in Phase 2.

**Pitfall:** If a planner reads UI-SPEC's "Dev server URL: http://localhost:5173" and "Production base path: /rectrace/" and concludes the React app fetches from `http://localhost:6088/rectrace/api/...` in dev, that's wrong. It fetches from `/rectrace/api/...` (relative) and the dev proxy handles the cross-origin hop. **Always use relative URLs in `apiFetch`.** [VERIFIED: `vite.config.ts` server.proxy block]

### 12. TanStack Router file-based route generation

**What goes wrong:** Adding a new file `frontend-react/src/routes/search.tsx` requires `routeTree.gen.ts` to be regenerated. The `TanStackRouterVite` plugin (already configured in `vite.config.ts:21-24`) regenerates on `vite dev` start AND on file save.

**How to handle:** Just `pnpm dev` and the file is picked up. The `routeTree.gen.ts` file is in `.gitignore` typically — check Phase 2's `.gitignore` (planner verifies). If it's checked in, regenerate locally and commit.

**Warning sign:** "No route found for /search" — usually means the plugin hasn't regenerated or the dev server needs a restart.

---

## Runtime State Inventory

> Phase 3 is a feature-add phase, not a rename/refactor. The inventory is short.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB schema changes, no ChromaDB/Mem0/Redis state | None |
| Live service config | Backend `search-config-v4.json` is touched **READ-ONLY** by Phase 3 (no edits per CONTEXT.md "no backend changes"); React app reads it via `/api/v4/search/config` | None |
| OS-registered state | None — no OS services, no `pm2`, no Windows Task Scheduler, no systemd units | None |
| Secrets/env vars | `VITE_AG_GRID_LICENSE_KEY` (Phase 2 D-2.14) is already in `frontend-react/.env.local`; Phase 3 reuses unchanged | None |
| Build artifacts / installed packages | Phase 3 adds 8 shadcn components to `frontend-react/src/components/ui/`; deletes `frontend-react/src/grid/SmokeGrid.{tsx,test.tsx}` | After delete, run `pnpm test` to confirm no stale imports; `pnpm typecheck` to confirm no dangling references |

**The canonical question:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?* — Answer: **none**. Phase 3 is additive UI work; no string renames or schema migrations.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite dev + build, Vitest | ✓ | v24.13.0 (laptop) | — (Phase 2 README documents minimum `^20.19.0 \|\| >=22.12.0`) |
| pnpm | `pnpm dev`, `pnpm test`, `pnpm dlx shadcn add` | ✓ | 11.1.2 (Corepack) | Phase 2 D-2.2 documents `npm` fallback in README |
| curl | `scripts/smoke-ssrm.sh` smoke probes | ✓ | system | — |
| Java 21 + Maven | Backend `mvn spring-boot:run` for UAT | ✓ | per Phase 1 D-1.2 | — |
| Oracle XE | Phase 0.1 local seed | (assumed running for UAT) | per Phase 0.1 | — |
| Elasticsearch | Phase 0.1 local seed | (assumed running for UAT) | per Phase 0.1 | — |
| AG-Grid Enterprise license string | Build + runtime | ✓ in `.env.local` | Phase 2 D-2.14 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL search-param parsing/serialization | Custom `URLSearchParams` wrapper | TanStack Router `validateSearch` + Zod | Already in deps; type inference flows from Zod schema to `useSearch` consumers |
| Toast / notification UI | Custom toast component | Sonner (already mounted) | Phase 2 wired; corr-id surface flows through `reportRequestFailure` |
| LocalStorage hook | `usehooks-ts` `useLocalStorage` | Roll the 20-line hook | The cross-tab `storage` event sync that `usehooks-ts` adds isn't needed here; one less dep |
| Excel generation | Hand-built XLSX writer (SheetJS, ExcelJS) | AG-Grid `exportDataAsExcel()` (D-3.10) | Already paid for via Enterprise license; SSRM-aware |
| Cmdk-style autocomplete UI | Custom Command/Combobox | shadcn `Command` (vendors cmdk) | UI-SPEC + CONTEXT.md canonical |
| Correlation ID generation / propagation | New filter or interceptor | `apiFetch` already does it | Phase 2 wired; `X-Correlation-Id` → backend Brave bridge `traceId` |
| AG-Grid theme dark-mode CSS | Manual `--ag-*` overrides | The Phase 2 token-bridge in `index.css` | Already inherited; AG-Grid follows shadcn tokens |
| SSRM datasource closure refresh | `gridApi.setGridOption('serverSideDatasource', new)` + `refreshServerSide({ purge: true })` | `key={` `${q}-${cat}` `}` remount (D-3.5) | Simpler; no in-flight `getRows` race |
| Validation of `/api/v4/search/config` response | Hand-rolled type guards | Zod schema | Catches drift between backend and frontend; gives TypeScript types for free |

---

## State of the Art (this phase)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Angular `ngOnInit` + service injection + `subscribe` | React function component + `useState`/`useEffect`/hooks | n/a (port to React idiom) | Renderers go from 50-line classes to ~30-line function components |
| `MatDialog` for modals | shadcn `Dialog` (Radix UI Dialog primitive) | n/a (port) | Same a11y guarantees; no `mat-` CSS leak |
| RxJS `BehaviorSubject` for theme state | `next-themes` `useTheme()` | n/a (Phase 2) | Phase 2 set; Phase 3 inherits |
| `Router.navigate([], { queryParams })` (Angular) | TanStack Router `navigate({ search: ... })` + Zod | n/a (port) | Type-safe URL params; runtime validation |
| Backend Excel export endpoint call | AG-Grid client-side `exportDataAsExcel` | D-3.10 | Implementation diverges; UX-equivalent; SSRM-cached-rows limitation acknowledged |
| `getRowId` with `timestamp + random` | Stable composite from natural fields | This phase | Selection persistence, expanded-group persistence across refreshes |

**Deprecated/outdated:**
- `SmokeGrid.tsx` — subsumed by `SearchGrid.tsx`; deleted in Phase 3.
- AG-Grid Angular `ICellRendererAngularComp` interface — N/A in React; renderers are plain function components.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `/api/v4/search/initial` response's `InitialFilter` shape that the SSRM POST body needs is `{ column: searchColumn, values: categoryResults[cat].values }` (matches Angular service interface) | Technical Approach §2 + Pitfall #7 | If wrong, SSRM POST 400s. Mitigation: planner verifies by hitting the live `/initial` once and inspecting the JSON; Zod schema in `types.ts` then locks it. | 
| A2 | Phase 2's `ag-theme-quartz` token bridge in `index.css` already handles dark/light via shadcn vars | Pitfall #5 | If wrong, grid stays light in dark mode. Mitigation: planner inspects `index.css` for `--ag-*` overrides before deciding to add or skip a Phase 3 bridge wave. |
| A3 | `routeTree.gen.ts` is regenerated automatically by the TanStack Router Vite plugin on file save | Pitfall #12 | If wrong, planner adds an explicit regen step. Mitigation: dev server restart works as a workaround; not a blocker. |
| A4 | AG-Grid Enterprise's client-side `exportDataAsExcel()` works adequately on the Phase 0.1 seed (5 rows fully cached) for UAT | Technical Approach §5 + D-3.10 | If the SSRM cache holds < 5 rows during the UAT scenario, export is incomplete. Mitigation: 5 rows is well under `cacheBlockSize: 100`, so all rows are cached after one fetch — should be fine. |
| A5 | The `cellStyle` kebab-case → camelCase adapter conversion (Pitfall #6) is the right answer; AG-Grid `cellStyle` is treated as a React style object | Pitfall #6 | Possible: AG-Grid might pass `cellStyle` through `setAttribute('style', ...)` which accepts kebab-case. Mitigation: planner writes a 3-line unit test against AG-Grid's actual behavior in a smoke env before coding the adapter. The safe path (camelCase) works either way. |
| A6 | Phase 2 `index.tsx` `routes/index.tsx` does NOT redirect to `/search` today; Phase 3 must add the redirect | Technical Approach §8 | If Phase 2 already added the redirect (research read it as not present), the Phase 3 change is a no-op. Mitigation: verify by reading `routes/index.tsx` at plan time. |
| A7 | `localStorage` is available in all browsers running this internal app (no Private/Incognito edge cases worth covering) | Technical Approach §6 | Citi internal users on standard Edge/Chrome; very low risk. The hook degrades gracefully via try/catch. |
| A8 | The backend's permit-all `SecurityFilterChain` (Phase 1 D-1.8) is still in effect at Phase 3 implementation time | Pitfall #9 | If a parallel Phase 9 work changed it, Phase 3 would hit 401s. Mitigation: STATE.md is the source of truth — Phase 9 has not started. |
| A9 | The 5-seed Phase 0.1 dataset has at least 1 row with non-null `load_job` and at least 1 row with null `load_job`, so the SC#2 "button absent when empty" test surface is visible in UAT | Validation Architecture | Phase 0.1 CONTEXT.md (referenced; not re-read in this research) should confirm. Mitigation: if all 5 rows have `load_job`, planner can prepare a 6th synthetic row or document that the SC#2 absent-case is covered by unit test only. |
| A10 | The 4-task wave shape sketched in CONTEXT.md "Wave shape for the plan" is roughly what the planner adopts (8 waves, types-first) | n/a | None — wave shape is the planner's domain |

---

## Open Questions

1. **`InitialFilter` shape from `/initial` response.**
   - What we know: Backend DTO `SSRMRequestV4.initialFilter` is `InitialFilter { column, values }`; frontend Angular service defines `InitialFilter = { column: string; values: string[] }`.
   - What's unclear: The `/initial` response's `categoryResults[cat]` provides `key`, `label`, `values`, `count`, `hasMore`, `columns` — but no `column` field. The mapping is: `column = category.searchColumn` (e.g., `file_name_pattern` for `fileName`), `values = categoryResults[cat].values`.
   - Recommendation: Planner verifies by hitting the live `/initial` endpoint with curl in plan-phase and capturing the response shape in a fixture. Zod schema in `types.ts` then locks it. If the actual response includes a `column` field per category, simplify the reshape.

2. **`cellStyle` kebab-case handling.**
   - What we know: `search-config-v4.json` uses kebab-case (`align-items`, `justify-content`). React style objects are camelCase. AG-Grid `cellStyle` is passed through to React's `style` prop.
   - What's unclear: Whether AG-Grid v35 happens to coerce kebab-case → camelCase internally.
   - Recommendation: Write the camelCase adapter (safe path). Add a Vitest test asserting the conversion. If a future AG-Grid version drops the coercion (or never had it), the adapter is forward-compatible.

3. **Whether to register AG-Grid modules in `main.tsx` (once) vs `SearchGrid.tsx` (lazily).**
   - What we know: `main.tsx` already registers `ServerSideRowModelModule` once at app bootstrap.
   - What's unclear: Whether ColumnsToolPanel/FiltersToolPanel/ExcelExport should register at the same site or lazily inside `SearchGrid.tsx`.
   - Recommendation: Once in `main.tsx` (consistent with Phase 2). Lazy registration is for code-split routes — Phase 3 doesn't code-split.

4. **`SmokeGrid` deletion timing.**
   - What we know: D-3.x and CONTEXT.md mark `SmokeGrid.tsx` + `SmokeGrid.test.tsx` for deletion.
   - What's unclear: Should the delete happen in the same wave that introduces `SearchGrid`, or in a final cleanup wave?
   - Recommendation: Delete in the wave that introduces `SearchGrid` to keep `routes/index.tsx` clean. The redirect from `/` to `/search` and the SmokeGrid delete should be the same wave to avoid a transient broken state.

5. **TanStack Router `routeTree.gen.ts` regeneration on CI.**
   - What we know: Local `pnpm dev` regenerates via the plugin.
   - What's unclear: Whether CI (which doesn't run `pnpm dev`) needs an explicit `pnpm build` step that the plugin hooks into, or whether `tsc -b && vite build` (the current `build` script) suffices.
   - Recommendation: The current `build` script invokes `vite build`, which loads the plugin, which regenerates `routeTree.gen.ts` before tsc validates. The plugin docs (Context7 source: `/tanstack/router`) confirm `vite build` is sufficient. If CI fails on missing generated file, the fix is adding `--watch=false` or `--write` flag — planner verifies during integration.

6. **Excel export "include all rows or only cached"?**
   - What we know: D-3.10 acknowledges SSRM-cached-rows-only limitation.
   - What's unclear: Whether for a 5-row seed the entire dataset fits in one cache block (`cacheBlockSize: 100` default) and thus the export is complete.
   - Recommendation: For Phase 0.1 seed (5 rows), one fetch caches everything — export is complete. Document this caveat in the parity matrix row note: "Excel export → port (client-side; SSRM cached rows only — sufficient for current 1k-row ES collapseField ceiling)."

7. **Whether to add a `useSearchConfig` `enabled` flag.**
   - What we know: `useSearchConfig` fires on `SearchPage` mount.
   - What's unclear: Whether to delay until `q` is non-empty to avoid an unnecessary call on the empty-state page.
   - Recommendation: Don't gate — the config is small (~5KB), `staleTime: Infinity` means one call per session, and the columns are needed the moment the user submits, so prefetching is a net win.

---

## Security Domain

> `security_enforcement` is enabled (no explicit `false` in `.planning/config.json`).

### Applicable ASVS Categories

(Already shown in Validation Architecture section above. Phase 3 is a UI-layer phase with read-only data access; the heavyweight auth/crypto categories defer to Phase 9.)

### Known Threat Patterns for React + AG-Grid + Spring Boot

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via cell renderer rendering Oracle data | Tampering | React's default escaping (`{value}` is HTML-escaped); never `dangerouslySetInnerHTML`; links built via `<a href={literal}>` with value as inner text |
| Reflected XSS via `?q=` URL param echoed in error state body | Tampering | React escapes interpolations; no innerHTML; Zod schema rejects non-string `q` |
| LocalStorage poisoning of `rectrace-recent-searches` | Tampering | `JSON.parse` in try/catch; non-array → reset; values rendered as text |
| Open redirect via `AppIDCellRenderer` | Spoofing | Hardcoded `https://lnkd.in/gpAtSBRj` href; value not used in URL construction |
| Mailto injection via `SupportEmailCellRenderer` | Tampering | `mailto:${value}` where `value` is the email field from Oracle; risk is malformed email (broken link, not exploitation); accept since the data source is internal |
| AG-Grid filter input → SQL injection | Tampering | Backend `SearchServiceV4` is responsible (Phase 8 SEC-08 closes column-name SQL injection in `OracleServiceV4.buildOrderByClause`); React just sends the AG-Grid filter model; defer to backend trust boundary |
| `X-Correlation-Id` injection (untrusted header) | Tampering | Backend Phase 2 D-2.10 propagator accepts inbound `X-Correlation-Id` as `traceId` — by design (D-2.11); the worst-case is a colluding client picking its own traceId. Risk: trace-pollution / log-attribution attack. Acceptable for internal app; mitigation = require auth in Phase 9 |
| Direct DOM attribute injection via `cellStyle` | Tampering | `cellStyle` from `search-config-v4.json` is server-controlled config, not user input; trust is at the config-author boundary, not the React app |

### What Phase 3 does NOT have to address

- Authentication (Phase 9 SEC-01).
- CORS lockdown (Phase 9 SEC-05; today `@CrossOrigin(origins = "*")`).
- Citi CA in JVM truststore (Phase 9 SEC-04).
- Internal Nexus/Verdaccio routing (Phase 9 SEC-06).
- ES SSL truststore (Phase 9 SEC-03).
- SQL injection in `OracleServiceV4` (Phase 8 SEC-08).

---

## Sources

### Primary (HIGH confidence)

- `frontend-react/src/lib/queryClient.ts` (lines 1-65) — `apiFetch`, `reportRequestFailure`, `queryClient` setup. [VERIFIED: source]
- `frontend-react/src/grid/SmokeGrid.tsx` (full file) — SSRM datasource pattern, AbortController, `setTimeout(0)` Sonner workaround. [VERIFIED: source]
- `frontend-react/src/main.tsx` (lines 1-21) — License + module registration ordering. [VERIFIED: source]
- `frontend-react/src/routes/__root.tsx` (full file) — Mount order load-bearing comment; Toaster + Outlet positioning. [VERIFIED: source]
- `frontend-react/src/routes/index.tsx` (full file) — Phase 2 placeholder, no redirect — Phase 3 adds the redirect. [VERIFIED: source]
- `frontend-react/vite.config.ts` (full file) — Base path `/rectrace/` (prod) / `/` (dev); proxy `/rectrace/api` → `localhost:6088`. [VERIFIED: source]
- `frontend-react/package.json` — current versions of all deps. [VERIFIED: source]
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java` — `/initial` is GET (lines 27-47), SSRM is POST (49-75), `/config` is GET (77-86), `/export` is POST with `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (89-127). [VERIFIED: source]
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SSRMRequestV4.java` (full) — DTO shape. [VERIFIED: source]
- `backend/rectrace/src/main/resources/search-config-v4.json` (lines 1-37) — `fileName` category contract. [VERIFIED: source]
- `frontend/rectrace/src/app/services/search-v5.service.ts` (lines 1-150) — Angular service endpoint surface confirms GET/POST verbs. [VERIFIED: source]
- `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts` (lines 60-230, 471-552) — Angular column adapter (`this.columns.map`), components map, `getRowId` anti-pattern, exportToExcel calling backend endpoint. [VERIFIED: source]
- `frontend/rectrace/src/app/custom-interactions/components/renderers/{execution-order-button,app-id-cell-renderer,app-support-cell-renderer}.component.ts` — Angular renderer behavior reference. [VERIFIED: source]
- `.planning/phases/03-react-search-vertical-slice/03-CONTEXT.md` — full locked-decisions context. [VERIFIED: source]
- `.planning/phases/03-react-search-vertical-slice/03-UI-SPEC.md` — design contract. [VERIFIED: source]
- `.planning/phases/02-react-foundation/02-CONTEXT.md` — Phase 2 decisions D-2.1..D-2.18 inherited. [VERIFIED: source]
- `.planning/REQUIREMENTS.md` — SEARCH-01..07 definitions. [VERIFIED: source]
- AG-Grid v35 docs via Context7 (`/websites/ag-grid_archive_35_0_0_javascript-data-grid`) — `ExcelExportModule` lives in `ag-grid-enterprise`; registration is via `ModuleRegistry.registerModules([ExcelExportModule, ...])`. [VERIFIED: Context7]
- TanStack Router docs via Context7 (`/tanstack/router`) — `validateSearch` + Zod schema + `useSearch` + `navigate({ search: ... })`. [VERIFIED: Context7]

### Secondary (MEDIUM confidence)

- npm registry version queries (`npm view`) — `ag-grid-enterprise@35.3.0`, `@tanstack/react-router@1.170.3`, `zod@4.4.3`, `sonner@2.0.7`. [VERIFIED: npm 2026-05-17]

### Tertiary (LOW confidence)

- Mapping of `InitialFilter` `column`/`values` from `/initial` response's `categoryResults[cat]` — inferred from Angular type definitions. **Planner verifies at plan time with a live curl.** [ASSUMED — see Assumption A1]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library + version is in `frontend-react/package.json` already.
- Architecture: HIGH — every decision is locked in CONTEXT.md and verified against live code.
- Pitfalls: HIGH — most pitfalls are validated against Phase 2 source code (StrictMode double-mount, Sonner race, license ordering, base path).
- Renderer port behavior: HIGH — Angular sources read and translated to React idioms in this document.
- `/initial` response shape: MEDIUM — Angular service types are the only source; live curl is the planner's verification step.

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — Phase 2 stack is stable; AG-Grid 35.x is not expected to break)

---

## RESEARCH COMPLETE
