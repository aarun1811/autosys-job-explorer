# Phase 3: React Search Vertical Slice - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 03-react-search-vertical-slice
**Areas discussed:** Search state ownership, SSRM refresh on new search, Column source (config vs hardcoded), Testing scope

---

## Pre-discussion question (raised by user during gray-area selection)

> "just also tell me which all parts in the current angular project would get implemented with this phase"

Answered inline before Area 1. Mapping captured in CONTEXT.md `<domain>` (In scope) and `<canonical_refs>` "Angular reference" section. Summary:

- Angular `search-v5.component.*` → React `SearchPage` + `SearchBar` + `CategoryTabBar`
- Angular `search-v5-grid.component.*` → React `SearchGrid` + `SearchToolbar`
- Angular `services/search-v5.service.ts` → inlined via `apiFetch`
- Angular `services/execution-order.service.ts` → inlined in `ExecutionOrderCellRenderer`
- Angular `execution-order-button.component.ts` → React `ExecutionOrderCellRenderer.tsx` (+ placeholder Dialog, Phase 4 swaps in Cytoscape modal)
- Angular `app-id-cell-renderer.component.ts` → React `AppIDCellRenderer.tsx`
- Angular `app-support-cell-renderer.component.ts` → React `SupportEmailCellRenderer.tsx`
- Angular recent-searches localStorage logic → React `useRecentSearches.ts`
- Angular `/search` route + URL queryParams → TanStack Router `routes/search.tsx`
- Angular `api.exportDataAsExcel()` → React, same call behind a shadcn DropdownMenu

NOT ported in Phase 3 (per UI-SPEC out-of-scope): multi-tab category bar, live `/suggest` autocomplete, Cytoscape execution-order modal, TLM Stats / QuickRec modals, V2 renderers, column-state URL sync, rotating placeholder, `x-citiportal-loginid` on React side. SmokeGrid.tsx is deleted.

---

## Search state ownership

| Option | Description | Selected |
|--------|-------------|----------|
| URL + local component state | TanStack Router `useSearch({ q, cat })` as source of truth; SearchPage holds `initialFilter` in local `useState`. No global store, no `useMutation`. | ✓ |
| Zustand store | `useSearchStore` exposes `{ q, cat, initialFilter, setQuery, setInitialFilter }`. Router only syncs URL ↔ store. | |
| TanStack Query useMutation for /initial | `useMutation` against `/initial`; data is `initialFilter`. Router URL still truth for q/cat. | |

**User's choice:** URL + local component state (Recommended).
**Notes:** Aligned with the visible preview showing `useSearch` + `useState` + `apiFetch`. Locked as D-3.1 / D-3.2 in CONTEXT.md. Rationale: simplest single-rooted state ownership; deep-linking is free; matches Angular's URL-driven pattern; no global store coupling that the rest of the shell doesn't have yet.

---

## SSRM refresh on new search

| Option | Description | Selected |
|--------|-------------|----------|
| Remount via `key={q + cat}` | `<AgGridReact key={...}>`; new search → new key → grid unmounts/remounts → datasource useMemo re-runs with fresh AbortController. Aligns with Phase 2 SmokeGrid useMemo pattern. | ✓ |
| Imperative refresh via gridApi | `gridApi.setGridOption('serverSideDatasource', newDs)` + `refreshServerSide({ purge: true })`. Preserves column-resize state across searches; more code; in-flight `getRows` race risk. | |
| Hybrid: imperative refresh, remount on cat change | `key={cat}` (category change remounts), q change calls imperative refresh. Preserves column state within a category. | |

**User's choice:** Remount via `key={q + cat}` (Recommended).
**Notes:** Preview showed `useMemo([q, cat])` + `key=`${q}-${cat}``. Locked as D-3.5 / D-3.6 in CONTEXT.md. Phase 2 Sonner-mount `setTimeout(0)` workaround carries over.

---

## Column source: hardcoded vs config-fetched

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode in TSX | Column array + cellRenderer string keys in `SearchGrid.tsx`. Faster; "Phase 4 swaps in config later". | (REJECTED — user pushback) |
| Fetch `/api/v4/search/config` at mount | TanStack Query against `/api/v4/search/config`, Zod-validated; adapter maps JSON → ColDef[]; renderer registry keyed by string. Matches Angular's `SearchV5GridComponent.@Input() columns`. | ✓ |
| Hardcode now, TODO swap in Phase 4 | Same as option 1 with a `// TODO(Phase 4)` comment. | (REJECTED) |

**User's choice:** Fetch from `/api/v4/search/config`. The hardcode options were rejected with strong feedback:

> "dude lot of thought process and work has gone to develop the angular the way it is currently to ensure whatever is needed is mostly config change. a new column needs adding or a diff index to be searched or a new column search needs enabling, none of these needs a frontend or a backend code change. i just need to change the configuration and if configuation is present as a file separately, i can just change that and restart the application to have it picked. so please don't laze around or make the effort gone into developing till now rollback by trying to reinvent. we need to move forward in the right direction. not go back in any manner. hope it is understood"

**Notes:** This is a hard project-wide principle, not just a Phase 3 decision. Saved as a feedback memory at `~/.claude/projects/-Users-aarun-Workspace-Projects-autosys-job-explorer/memory/feedback_config_driven_principle.md` so it applies to every future phase that touches grid/search behavior. CONTEXT.md captures it as D-3.3 / D-3.4 with the explicit principle: adding a column = JSON edit + restart; new ES index = JSON edit + restart; enabling filter/sort = JSON edit + restart. React owns only the renderer registry (string → component). The original "Recommended" framing of the hardcoded option was a misjudgement on my part and was retracted in the discussion.

---

## Testing scope for Phase 3

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest unit tests + extend smoke scripts | Unit tests on hooks (`useRecentSearches`, `useSearchState`, config adapter), renderers (mocked `apiFetch`); extend `scripts/smoke-ssrm.sh` to cover `/search?q=...`. Live UAT closes the phase. | ✓ |
| Add RTL integration tests on SearchPage flow | Above + RTL tests on full search → grid populates → URL reflects state. msw or apiFetch spy for mocking. | |
| Add Playwright E2E happy-path | Above + Playwright spec booting live stack; recall Phase 8 owns visual regression / full E2E. | |
| Vitest only, no smoke-script changes | Just unit tests; rely on Phase 2 smoke as-is. | |

**User's choice:** Vitest unit tests + extend smoke scripts (Recommended).
**Notes:** Locked as D-3.9 in CONTEXT.md. Mirrors Phase 2 testing posture; live UAT closes Phase 3. RTL integration and Playwright E2E deferred to a future testing phase / Phase 8 DESIGN-02.

---

## Claude's Discretion

Captured in CONTEXT.md `<decisions>` "Claude's Discretion (planner decides)" subsection. Headlines:

- Exact `useEffect` shape for URL-restore fetch in `SearchPage`.
- Zod schema location (`search/types.ts` vs central `src/lib/schemas.ts`).
- AG-Grid SSRM module registration site (`main.tsx` vs lazy in `SearchGrid`).
- Renderer registry export shape (`as const` object vs typed `Record`).
- `useSearchConfig` location (`search/hooks/` vs `src/lib/`).
- Adapter handling of `cellStyle` kebab-case CSS keys.
- `scripts/smoke-ssrm.sh` extension shape (additive vs new `smoke-search.sh`).
- Wave shape for the plan (~7–8 waves expected).
- `/api/v4/search/initial` GET-vs-POST live-contract verification (Angular `search-v5.service.ts:103` says GET `?keyword=`; UI-SPEC says POST — researcher resolves).

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`. Headlines: per-category recent-searches namespacing; imperative SSRM refresh path; server-side Excel export; live `/suggest` autocomplete; RTL integration / Playwright E2E; Cytoscape execution-order modal; TLM/QuickRec modals; column-state URL sync; rotating placeholder; chart tokens (D-2.7 auto-surface remains); auth filter (Phase 9 SEC-01).
