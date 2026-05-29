# React Search — Angular Parity Rebuild (shadcn shell)

**Date:** 2026-05-26
**Status:** Design approved, pending spec review
**Scope:** `frontend-react` search experience
**Goal:** Rebuild React's single-category Phase-3 search slice into a multi-category
federated search that mirrors Angular `search-v5`'s **behavior**, while keeping
React's shadcn/Tailwind **design language**. Eliminate hardcoded category state
and the cosmetic URL rewrite. UI modernization (visual polish) is a *separate*
later effort; this spec covers structure + behavior only.

---

## Background: how the two apps differ today

| Concern | Angular `search-v5` (target behavior) | React (current) |
|---|---|---|
| Landing | `/` → redirect → clean `/search` | `/` → redirect → `/search?cat=fileName` (Zod injects default) |
| Category model | Federated: one query hits all categories; tabs render per category with `count>0` | Single category; `cat` selects the one searched |
| Column source | Inline `columns[]` in each `/initial` category result | Separate `GET /config` (cached), looked up by `cat` |
| `/api/v4/search/config` | **Never called** (`getConfiguration()` is dead code) | Fetched once via `useSearchConfig` |
| URL vocabulary | `q` + `tab` (selected category key), set only after search, `replaceUrl` | `q` + `cat` (with hardcoded `fileName` default) |
| User info | `GET /api/user/info` + localStorage + initials chip / "Sign in" | **None** |
| Typeahead | Debounced `GET /api/search/suggest?prefix=` | **None** (recents only) |
| Recent searches | — | `useRecentSearches` (kept), tangled into `SearchBar` |

**Key finding:** the `/initial` response is fully self-sufficient. Each
`categoryResults[key]` carries `key`, `label`, `count`, `hasMore`, `values`, and
its own `columns[]`. The SSRM filter column = the column flagged `rowGroup: true`
(Angular `search-v5-grid.component.ts:330`:
`this.columns.find(col => col.rowGroup)?.field`). Therefore `/config` is not
needed and is dropped.

---

## A. Routing & URL contract

- **`/` (`routes/index.tsx`)** — renders the centered hero (`SearchHero`). **No
  redirect.** Submitting a term → `navigate({ to: '/search', search: { q: term } })`.
- **`/search` (`routes/search.tsx`)** — results view. Zod schema:
  ```ts
  z.object({ q: z.string().optional(), tab: z.string().optional() })
  ```
  No `cat`, no `.default()`. If `q` is absent/empty → redirect to `/`.

  > **Accepted exception to "no rerouting":** this guard redirects only the
  > invalid state of landing on `/search` with no query. It is not the cosmetic
  > param-injection rewrite (`?cat=fileName`) that motivated this work; that is
  > removed entirely. This is the only redirect in the app.
- Pre-search URLs carry no params. `tab` is written (with `replace: true`) only
  after results resolve, and on tab clicks.

## B. Data flow

1. On `/search` with a `q` (mount or `q` change): single
   `GET /api/v4/search/initial?keyword=<encodeURIComponent(q)>`.
2. Parse via existing `InitialSearchResponseV4Schema` (already models inline
   `columns[]`, `count`, `hasMore`, `values`).
3. Derive:
   ```ts
   searchResults = Object.values(resp.categoryResults)
     .filter(c => c.count > 0)
     .sort((a, b) => b.count - a.count)   // count descending — Angular parity
   ```
4. No `/config` call. `hooks/useSearchConfig.ts` and its test are deleted.

## C. Tab selection logic

- Active tab key = URL `tab` if it matches a `searchResults` entry; otherwise the
  first (highest-count) result.
- After results resolve, if `tab` is missing/invalid → `navigate({ replace: true })`
  to set `tab=<firstKey>` so the URL reflects the active tab (Angular parity).
- Tab click → `setTab(key)` (`replace: true`).
- Deep-link restore: a `q` in the URL on mount triggers the search; a valid `tab`
  selects the matching category.

## D. Tab grid mounting (active-tab only) — **correctness requirement**

Only the active tab's `SearchGrid` is mounted (Angular mounts all and hides
inactive — we diverge for performance: no 13 parallel SSRM bursts). The trade-off
(losing scroll/expand state on switch) is accepted. **Switching tabs MUST:**

1. **Cleanly remount** the grid for the newly-selected category. Achieved with
   `key={`${q}-${activeKey}`}` on `AgGridReact` — React tears down the old grid
   and builds a fresh one, so AG-Grid's SSRM cache cannot leak rows across
   categories.
2. **Rebuild the datasource** for the active category. The datasource `useMemo`
   depends on `[q, activeKey, activeCategoryResult]`, so it POSTs to
   `/api/v4/search/ssrm/{activeKey}` with:
   - `initialFilter = { column: <rowGroup column field>, values: activeCategoryResult.values }`
     (or `null` when `values` is empty),
   - `rowGroupCols` / `groupKeys` / `sortModel` / `filterModel` from the grid request,
   - column defs from `columnsToColDefs(activeCategoryResult.columns)`.
3. **Abort in-flight fetches** from the previous grid: each datasource owns an
   `AbortController`; `destroy()` aborts it on teardown.

A test asserts that selecting a different tab issues an SSRM POST to the new
category's endpoint with that category's filter values.

## E. User info (new)

Backend contract: `GET /rectrace/api/user/info` reads `x-citiportal-loginid`,
returns `{ loginId: "<id>" }` or `{ loginId: null }` (header absent → local dev).

- `hooks/useUserInfo.ts`: read `localStorage['userLoginId']` first; else
  `GET /api/user/info`; cache non-null result. On `null`/error → unidentified.
- Initials: split loginId on `.` — ≥2 parts → first char of each (`john.doe`→`JD`);
  else first 2 chars uppercased.
- UI: navbar chip (tooltip = full loginId) when identified; **"Sign in"** button
  when not. Rendered in both the hero and the results navbar.
- `apiFetch` unchanged — the portal proxy injects the header in prod; locally the
  endpoint returns `null` → "Sign in" (matches Angular).

## F. Typeahead suggestions (new)

- `hooks/useSuggestions.ts`: debounced 300 ms, min 2 chars →
  `GET /api/search/suggest?prefix=<q>` → `string[]`. Errors swallow to `[]`.

## G. Recent searches — cleanup

`useRecentSearches` (LRU, cross-tab sync, quota-safe) is **kept as-is**. The
cleanup targets `SearchBar`, where blur-timers + popover open-state + suggestions
would otherwise tangle:

- **`SearchSuggestDropdown.tsx` (new):** one component owning a single open-state.
  Shows **recent searches when the input is empty**, **live suggestions when
  typing ≥2 chars**. Selecting an item submits the term.
- **`SearchBar.tsx`:** reduced to a thin controlled input + clear-X + Search
  button, delegating the dropdown to `SearchSuggestDropdown`.

This replaces the current "recents popover with a TODO for suggestions" with a
single coherent dropdown, instead of bolting on a second mechanism.

## H. Hero extras (modernized)

- **Animated placeholder:** replace Angular's 2 s hard text-swap with a smooth
  cross-fade/slide rotation. Honors `prefers-reduced-motion` (no motion → static
  placeholder). Phrases are a small declared constant (cosmetic *copy*, distinct
  from the category/behavior hardcoding being removed).
- **"Try" button:** ports Angular's example values (declared constant) — picks a
  random example, sets it as the term, and searches.
- **Logo:** port `Rectrace.png` / `rectrace-dark.png` into `frontend-react`
  assets; swap by active theme. Shown in hero and results navbar.

## I. Component map

| File | Change |
|---|---|
| `routes/index.tsx` | Renders `SearchHero`; redirect removed |
| `routes/search.tsx` | Zod `{ q?, tab? }`; no-`q` guard → `/` |
| `search/SearchHero.tsx` | **NEW** centered: logo + animated-placeholder input + Search + Try + suggest/recents dropdown + user chip |
| `search/SearchPage.tsx` | Results view: navbar (logo + SearchBar + user chip + theme) → `CategoryTabBar` → `SearchToolbar` → active `SearchGrid` → Footer; owns fetch/parse/derive/tab-selection |
| `search/CategoryTabBar.tsx` | **Rewrite:** multi-tab from `searchResults`, label `"Label (N[+])"`, active from `tab`, click → set `tab`; hardcoded `CATEGORY_LABELS` + `'fileName'` fallback removed |
| `search/SearchGrid.tsx` | Drop `useSearchConfig`; take a `CategoryResultV4`; columns from inline `columns[]`; searchColumn from rowGroup column; key/datasource keyed on active category |
| `search/SearchBar.tsx` | Thin controlled input |
| `search/SearchSuggestDropdown.tsx` | **NEW** recents + live suggestions, single open-state |
| `search/lib/configToColDefs.ts` | Extract `columnsToColDefs(columns: ColumnDefinitionV4[])` reused by the grid |
| `search/hooks/useSearchState.ts` | `{ q, tab, setQ, setTab, clear }` |
| `search/hooks/useUserInfo.ts` | **NEW** |
| `search/hooks/useSuggestions.ts` | **NEW** |
| `search/hooks/useSearchConfig.ts` (+ test) | **DELETE** |

## J. States retained

- Loading `/initial`: skeleton.
- `/initial` error: error card with correlation ID + "Try again".
- **No results** (all `count === 0`): "No results found for *q*", no tabs.
- Per-grid SSRM error: existing Sonner toast path (`reportRequestFailure`).

## K. Testing (TDD, red → green)

- **Rewrite:** `CategoryTabBar` (multi-tab, count labels, selection → URL),
  `SearchPage`/results (fetch → derive → tabs, no-results, deep-link `tab`
  restore, **tab switch → correct SSRM endpoint/filter**), `SearchGrid` (inline
  columns, searchColumn from rowGroup), `useSearchState` (`q`+`tab`).
- **New:** `SearchHero` (submit → `/search?q=`), `useUserInfo` (localStorage →
  endpoint → initials / Sign-in), `useSuggestions` (debounce, min-chars, error→[]),
  `SearchSuggestDropdown` (recents-when-empty / suggestions-when-typing),
  `columnsToColDefs`.
- **Delete:** `useSearchConfig` test.

## L. Out of scope (deferred to a separate polish/modernization pass)

- Hero → navbar *collapse animation* (we render the two states; no motion tween
  between them yet).
- Broader visual modernization of the shell.

---

## Accepted exceptions to "no hardcoding"

The no-hardcoding rule targets **search/category behavior** — grid columns,
category metadata, renderer maps, and the `cat` default must be data-driven (from
`/initial`), never literals. Two items are *cosmetic copy*, not behavior, and are
deliberately kept as small declared constants:

- Hero **placeholder phrases** (§H) — display copy for the rotating placeholder.
- **"Try" button** example values (§H) — demo seed values.

Neither drives what is searched or how results render. If desired later, both
could be sourced from a lightweight endpoint, but that is explicitly not required
here.

## Open questions

_None at design-approval time. The active-tab-only mounting decision (§D) is
accepted with the clean-remount + correct-SSRM requirement made explicit._
