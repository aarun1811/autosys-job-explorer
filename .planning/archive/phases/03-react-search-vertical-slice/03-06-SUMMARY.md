---
phase: 03-react-search-vertical-slice
plan: 06
subsystem: ui
tags: [react, shadcn, popover, dropdown-menu, command, badge, recent-searches, excel-export]

# Dependency graph
requires:
  - phase: 03-react-search-vertical-slice
    provides: useRecentSearches hook (Plan 02 / D-3.11), useSearchState hook (Plan 02 / SEARCH-03)
  - phase: 03-react-search-vertical-slice
    provides: shadcn primitives (Plan 04 — input, badge, popover, command, dropdown-menu, separator)
provides:
  - SearchBar component (controlled input + clear-X + recent-searches Popover)
  - SearchToolbar component (locale-formatted result Badge + Excel export DropdownMenu)
  - CategoryTabBar component (single non-interactive tab — Phase 4+ pattern seed)
  - jsdom shims for ResizeObserver and Element.scrollIntoView (cmdk/Radix support in tests)
affects: [03-07 (SearchPage composes these three with SearchGrid), Phase 4+ (CategoryTabBar swap to shadcn Tabs)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three composable, prop-driven UI shells with no business logic — SearchPage (Plan 07) owns state + side effects, components only render"
    - "Recent-searches Popover composition: shadcn Popover + cmdk Command, anchored to Input with onOpenAutoFocus prevented so Input keeps focus"
    - "Radix DropdownMenu opens via keyboard Enter in jsdom tests (pointerdown not synthesized by fireEvent)"
    - "Locale-formatted result counts via Intl-aware toLocaleString() with regex tolerating U+0020/U+00A0/U+202F separators"

key-files:
  created:
    - frontend-react/src/search/SearchBar.tsx
    - frontend-react/src/search/SearchToolbar.tsx
    - frontend-react/src/search/CategoryTabBar.tsx
    - frontend-react/src/search/__tests__/SearchBar.test.tsx
    - frontend-react/src/search/__tests__/SearchToolbar.test.tsx
    - frontend-react/src/search/__tests__/CategoryTabBar.test.tsx
  modified:
    - frontend-react/src/test-setup.ts

key-decisions:
  - "SearchBar.onChange and SearchBar.onSubmit are separate callbacks; submission gates on value.trim() being non-empty so empty/whitespace input is a no-op"
  - "Popover open state is derived locally inside SearchBar but constrained to (value === '' AND recents.length > 0) on focus; live typing immediately closes the popover so it never occludes the Input"
  - "Blur uses a 150ms setTimeout so popover item clicks register before the popover unmounts (matches UI-SPEC §Recent Searches Popover)"
  - "CategoryTabBar is a static non-interactive single tab in Phase 3 — no shadcn Tabs primitive used yet; TODO(Phase 4) marker enables grep-based swap"
  - "SearchToolbar Badge is hidden when resultCount is null OR 0 (UI-SPEC: 'For 0: badge hidden; show empty state' — empty state is SearchPage's responsibility)"
  - "Excel-export business logic (gridApi.exportDataAsExcel, buildExportFilename, columnKeys filter) intentionally lives in SearchPage (Plan 07), NOT in SearchToolbar — keeps SearchToolbar unit-testable without an AG-Grid harness"

patterns-established:
  - "jsdom shim pattern: typed casts via `as unknown as { ... }` instead of `any` to keep eslint @typescript-eslint/no-unsafe-member-access happy"
  - "Test pattern for Radix DropdownMenu in jsdom: focus trigger + fireEvent.keyDown(trigger, { key: 'Enter' }) opens the menu; fireEvent.click does not"
  - "Test pattern for cmdk inside Popover: requires ResizeObserver and Element.scrollIntoView shims in test-setup.ts"
  - "Disambiguating exact-text role queries: use `getByRole('button', { name: 'Search' })` (string, exact match) rather than `/Search/i` regex when multiple buttons (e.g., a Clear-search aria-label) would match"

requirements-completed: [SEARCH-03, SEARCH-04, SEARCH-05]

# Metrics
duration: 9min
completed: 2026-05-17
---

# Phase 3 Plan 06: SearchBar + SearchToolbar + CategoryTabBar Summary

**Three composable, prop-driven UI shells that form the search chrome above the grid — controlled-input SearchBar with cmdk-backed recent-searches Popover, locale-formatted result-count Badge with Excel-export DropdownMenu, and a single-tab CategoryTabBar pattern seed for Phase 4+ multi-category support.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-17T07:53:09Z
- **Completed:** 2026-05-17T08:02:07Z
- **Tasks:** 2
- **Files created:** 6
- **Files modified:** 1

## Accomplishments

- SearchBar: controlled `<Input>` + Search Button + clear-X overlay; Enter/click triggers `onSubmit(value.trim())` with empty/whitespace guard; clear (X) appears only when value is non-empty and carries `aria-label="Clear search"`.
- Recent-searches Popover: anchored to Input via shadcn `Popover` + cmdk `Command`. Opens on focus when `value === '' && recents.length > 0`, closes immediately on live typing, closes after a 150ms blur delay so item clicks register first. Top 10 entries from `useRecentSearches` (Plan 02), each `CommandItem` with `ClockIcon`. Popover "Clear" button invokes `useRecentSearches().clear()`.
- SearchToolbar: secondary-variant `Badge` with locale-formatted count (hidden when `resultCount` is `null` or `0`); `DropdownMenu` with one `DropdownMenuItem` "Download Excel (.xlsx)" that invokes `onExport()`; `isExporting` swaps `DownloadIcon` for `Loader2Icon animate-spin` and disables the trigger.
- CategoryTabBar: single non-interactive "File Name" tab with `border-primary` indicator, 40px height, `bg-muted/50 backdrop-blur-sm`, `data-active-cat` attribute for automation, and a grepable `TODO(Phase 4)` marker.
- 31 new unit tests (17 SearchBar + 4 CategoryTabBar + 10 SearchToolbar) — full suite passes at 127/127.
- TypeScript build clean, ESLint clean (including `no-unsafe-member-access` and `no-irregular-whitespace`), hex-free (Phase 2 D-2.8 enforcement).

## Task Commits

Each task was committed atomically with strict TDD RED → GREEN gates:

1. **Task 1 (RED): SearchBar + CategoryTabBar failing tests** — `92c958a` (test)
2. **Task 1 (GREEN): SearchBar + CategoryTabBar implementation** — `48e9bf3` (feat)
3. **Task 2 (RED): SearchToolbar failing tests** — `63cc210` (test)
4. **Task 2 (GREEN): SearchToolbar implementation** — `58bf7e3` (feat)

**Plan summary commit:** *(this commit)* `docs(03-06): plan summary`

## Files Created/Modified

- `frontend-react/src/search/SearchBar.tsx` (created) — Controlled Input + Search Button + clear-X + recent-searches Popover.
- `frontend-react/src/search/CategoryTabBar.tsx` (created) — Single non-interactive "File Name" tab (Phase 4+ pattern seed).
- `frontend-react/src/search/SearchToolbar.tsx` (created) — Result-count Badge + Excel export DropdownMenu (UI shell; export business logic lives in SearchPage).
- `frontend-react/src/search/__tests__/SearchBar.test.tsx` (created) — 17 tests covering input, submit gating, clear, popover lifecycle, recent-item click, popover-Clear.
- `frontend-react/src/search/__tests__/CategoryTabBar.test.tsx` (created) — 4 tests covering label, indicator class, data attribute, tab count.
- `frontend-react/src/search/__tests__/SearchToolbar.test.tsx` (created) — 10 tests covering Badge hide/show, locale formatting, DropdownMenu open via keyboard Enter, onExport invocation, isExporting state.
- `frontend-react/src/test-setup.ts` (modified) — Added `ResizeObserver` polyfill and `Element.scrollIntoView` no-op shim for cmdk/Radix in jsdom.

## Plan 07 Composition Contract

SearchPage (Plan 07) will compose these three components like so:

```tsx
const [term, setTerm] = useState('')
const [resultCount, setResultCount] = useState<number | null>(null)
const [isExporting, setIsExporting] = useState(false)
const gridApiRef = useRef<GridApi | null>(null)

const handleSubmit = (t: string) => { setSearchParams({ q: t }); recents.push(t); /* trigger grid */ }
const handleClear = () => { setTerm(''); setSearchParams({}) }
const handleExport = () => {
  try {
    setIsExporting(true)
    gridApiRef.current?.exportDataAsExcel({
      fileName: buildExportFilename('fileName', term),
      columnKeys: ALL_COLUMNS_EXCEPT_EXECUTION_ORDER,
    })
  } catch (err) {
    reportRequestFailure(err)
  } finally {
    setIsExporting(false)
  }
}

<CategoryTabBar activeCat="fileName" />
<SearchBar value={term} onChange={setTerm} onSubmit={handleSubmit} onClear={handleClear} />
<SearchToolbar resultCount={resultCount} onExport={handleExport} isExporting={isExporting} />
<SearchGrid ... onGridReady={(api) => (gridApiRef.current = api)} />
```

`buildExportFilename(cat, term)` (per 03-PATTERNS.md §SearchToolbar) returns `rectrace-${cat}-${sanitizedTerm}-${YYYYMMDD}.xlsx` — sanitization replaces non-alphanumeric with `_` and lowercases. Lives in Plan 07 alongside the gridApi ref.

## Decisions Made

- **Separation of concerns for export:** The Excel-export business logic (filename construction, gridApi call, columnKeys filter, error reporting via `reportRequestFailure`) is intentionally NOT in SearchToolbar. SearchToolbar takes an `onExport: () => void` prop and Plan 07's SearchPage supplies the closure. Rationale: keeps SearchToolbar a pure UI shell, unit-testable without an AG-Grid harness, and lets future renderers (e.g., CSV) be added as additional `DropdownMenuItem`s with separate handlers.
- **Popover focus retention:** `onOpenAutoFocus={(e) => e.preventDefault()}` on `PopoverContent` so the Input keeps focus when the popover opens. Otherwise Radix steals focus and the Input's controlled-value typing experience is broken.
- **Single tab, no shadcn Tabs primitive yet:** Phase 3 is single-category. Wiring shadcn Tabs now would require introducing radix Tabs without exercising its features. CategoryTabBar renders a static `<div>` with the active-tab styling baked in; `TODO(Phase 4)` marker enables grep-based migration when multi-category support lands.
- **Keyboard-Enter pattern for Radix DropdownMenu tests:** `fireEvent.click` on a Radix `DropdownMenuTrigger` does NOT open the menu in jsdom because Radix wires to `pointerdown` (not synthesized by `fireEvent.click`). Using `trigger.focus()` + `fireEvent.keyDown({ key: 'Enter' })` is the most reliable jsdom path and matches real-user keyboard behavior. Documented as a pattern for Phase 4+ tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added jsdom polyfill for `ResizeObserver`**
- **Found during:** Task 1 GREEN (running SearchBar.test.tsx)
- **Issue:** `cmdk` (the `Command` primitive used inside the recent-searches Popover) calls `new ResizeObserver(...)` on mount. jsdom does not implement `ResizeObserver`, causing `ReferenceError: ResizeObserver is not defined` and failing 7 SearchBar tests that mount the Popover.
- **Fix:** Added a no-op `ResizeObserverPolyfill` class to `frontend-react/src/test-setup.ts` and assigned it to `globalThis.ResizeObserver` when undefined. Uses a typed cast (`globalThis as unknown as { ResizeObserver?: unknown }`) instead of `any` to satisfy ESLint.
- **Files modified:** `frontend-react/src/test-setup.ts`
- **Verification:** All 21 Task 1 tests pass; full regression at 117/117 → 127/127.
- **Committed in:** `48e9bf3` (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] Added jsdom polyfill for `Element.prototype.scrollIntoView`**
- **Found during:** Task 1 GREEN (running SearchBar.test.tsx after the ResizeObserver fix)
- **Issue:** `cmdk`'s `Command` primitive calls `element.scrollIntoView()` on the active `CommandItem` to keep it visible. jsdom does not implement `Element.prototype.scrollIntoView`, causing `TypeError: e.scrollIntoView is not a function` on Popover open. 6 tests still failing.
- **Fix:** Added a no-op shim to `Element.prototype.scrollIntoView` in `frontend-react/src/test-setup.ts` (guarded by a `typeof Element !== 'undefined'` check and a check that the method isn't already implemented). Uses a typed proto cast instead of `any`.
- **Files modified:** `frontend-react/src/test-setup.ts`
- **Verification:** Remaining Popover-dependent tests pass.
- **Committed in:** `48e9bf3` (Task 1 GREEN commit, same file as Rule 3 #1)

**3. [Rule 1 - Test bug] Tightened ambiguous `getByRole` regex matcher in SearchBar tests**
- **Found during:** Task 1 GREEN (2 Search-button-click assertions failing with "Found multiple elements with the role 'button' and name `/Search/i`")
- **Issue:** When `value !== ''`, two buttons coexist in SearchBar: the clear-X (aria-label="Clear **search**") and the main Search button (text "Search"). The regex `/Search/i` matched both, causing `getByRole` to throw.
- **Fix:** Switched to an exact string matcher: `getByRole('button', { name: 'Search' })`. The clear-X button matches "Clear search" exactly, the main button matches "Search" exactly — no ambiguity.
- **Files modified:** `frontend-react/src/search/__tests__/SearchBar.test.tsx`
- **Verification:** Both previously-failing tests pass; 17/17 SearchBar tests green.
- **Committed in:** `48e9bf3` (Task 1 GREEN commit — tests + impl combined in the GREEN pass)

**4. [Rule 1 - Test bug] Switched SearchToolbar DropdownMenu opener from click to keyboard-Enter**
- **Found during:** Task 2 GREEN (2 DropdownMenu-open assertions failing with "Unable to find an element with the text: Download Excel (.xlsx)")
- **Issue:** Radix UI `DropdownMenuTrigger` wires its open behavior to `pointerdown`, which `fireEvent.click` does NOT synthesize in jsdom. So clicking the trigger never opened the menu.
- **Fix:** Updated the two affected tests to `trigger.focus()` followed by `fireEvent.keyDown(trigger, { key: 'Enter' })`. Radix DropdownMenu opens on keyboard Enter natively, matching the actual a11y keyboard behavior. Documented as a project pattern in this Summary.
- **Files modified:** `frontend-react/src/search/__tests__/SearchToolbar.test.tsx`
- **Verification:** Both menu tests pass; 10/10 SearchToolbar tests green.
- **Committed in:** `58bf7e3` (Task 2 GREEN commit)

**5. [Rule 1 - Lint fix] Removed unnecessary `as number` assertion + replaced `any` casts with typed casts**
- **Found during:** Final ESLint pass after Task 2 GREEN
- **Issue:** ESLint flagged `@typescript-eslint/no-unnecessary-type-assertion` on `formatCount(resultCount as number)` (TypeScript already narrows via the `typeof resultCount === 'number'` guard) and `@typescript-eslint/no-unsafe-member-access` on three `(globalThis as any).ResizeObserver` / `(Element.prototype as any).scrollIntoView` usages.
- **Fix:** Removed the redundant `as number` cast; refactored the test-setup shims to use typed casts (`globalThis as unknown as { ResizeObserver?: unknown }` and a `proto as unknown as { scrollIntoView?: () => void }` pattern).
- **Files modified:** `frontend-react/src/search/SearchToolbar.tsx`, `frontend-react/src/test-setup.ts`
- **Verification:** ESLint clean across all touched files; tsc clean.
- **Committed in:** `58bf7e3` (Task 2 GREEN commit)

**6. [Rule 1 - Lint fix] Replaced literal NBSP/NNBSP chars in test regex with `\\u00A0`/`\\u202F` escapes**
- **Found during:** Final ESLint pass after Task 2 GREEN
- **Issue:** ESLint `no-irregular-whitespace` flagged literal U+00A0 and U+202F characters embedded in the regex character class `[,. ...]` for the locale-formatted count test.
- **Fix:** Rebuilt the regex via the `RegExp` constructor with explicit escape sequences: `new RegExp('^1[,.\\u0020\\u00A0\\u202F]?000\\s+results$')`. Same semantics, ESLint clean.
- **Files modified:** `frontend-react/src/search/__tests__/SearchToolbar.test.tsx`
- **Verification:** ESLint clean; test still passes (`1,000 results` with comma matches).
- **Committed in:** `58bf7e3` (Task 2 GREEN commit)

---

**Total deviations:** 6 auto-fixed (2 Rule 3 - blocking infra; 4 Rule 1 - test/lint bugs)
**Impact on plan:** All auto-fixes were essential to land the planned behavior. No scope creep — the deviations were jsdom/test-environment shims and test-author bugs, not changes to the component contracts. The plan's `<interfaces>` shapes and `<behavior>` semantics shipped exactly as written.

## Issues Encountered

- **Worktree desync at start:** The worktree branch was created from an older `milestone/modernization` HEAD (commit `90d22c9`) that predated the Phase 2/3 work (`a762d7f`). Required `git reset --hard milestone/modernization` (sanctioned by the plan's `<worktree_setup>` block) before proceeding. Recovery was clean; no work was lost.
- **Path-routing slip-up:** First Write attempts at the test files used absolute paths beginning with `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/...` which routed into the **main repo**, not the worktree. Caught by post-Write `ls` checks. Removed the stray files from the main repo and re-wrote to the worktree root `/Users/aarun/Workspace/Projects/autosys-job-explorer/.claude/worktrees/agent-a3e92f367f50170ab/frontend-react/...`. No commits were made against the wrong tree. Documented the worktree-absolute-path guard learning here so the next worktree-spawned executor watches for this.

## User Setup Required

None — all dependencies (shadcn primitives + hooks) were vendored in prior plans.

## Next Phase Readiness

- All three search-chrome components are ready for Plan 07's SearchPage composition. Plan 07 must:
  - Wire `useSearchState` (URL `q`) to SearchBar's `value` and `onSubmit` (push to recents via `useRecentSearches().push`).
  - Hold the `gridApiRef` and `isExporting` state; construct `buildExportFilename(cat, term)` and the export `columnKeys` list (exclude `execution_order`; include hidden `app_name`/`set_id`/`sub_acc` per UI-SPEC §"Excel Export").
  - Route export failures through `reportRequestFailure(err)` (SEARCH-06 Sonner toast with correlation ID).
- CategoryTabBar's `TODO(Phase 4)` marker is in place for Phase 4+'s shadcn Tabs migration.
- No blockers.

## Self-Check: PASSED

Files verified:
- `frontend-react/src/search/SearchBar.tsx`: FOUND
- `frontend-react/src/search/SearchToolbar.tsx`: FOUND
- `frontend-react/src/search/CategoryTabBar.tsx`: FOUND
- `frontend-react/src/search/__tests__/SearchBar.test.tsx`: FOUND
- `frontend-react/src/search/__tests__/SearchToolbar.test.tsx`: FOUND
- `frontend-react/src/search/__tests__/CategoryTabBar.test.tsx`: FOUND

Commits verified:
- `92c958a` (RED — SearchBar+CategoryTabBar tests): FOUND
- `48e9bf3` (GREEN — SearchBar+CategoryTabBar impl + shims): FOUND
- `63cc210` (RED — SearchToolbar tests): FOUND
- `58bf7e3` (GREEN — SearchToolbar impl + lint cleanup): FOUND

Verification commands:
- `cd frontend-react && npx vitest run` → 127/127 passing
- `cd frontend-react && npx tsc --noEmit -p tsconfig.json` → clean
- `cd frontend-react && npx eslint src/search/SearchBar.tsx src/search/SearchToolbar.tsx src/search/CategoryTabBar.tsx src/search/__tests__/SearchBar.test.tsx src/search/__tests__/SearchToolbar.test.tsx src/search/__tests__/CategoryTabBar.test.tsx src/test-setup.ts` → clean
- `grep -EHrn '#[0-9a-fA-F]{3,8}' src/search/SearchBar.tsx src/search/SearchToolbar.tsx src/search/CategoryTabBar.tsx` → none (hex-free, Phase 2 D-2.8 enforced)

---
*Phase: 03-react-search-vertical-slice*
*Completed: 2026-05-17*
