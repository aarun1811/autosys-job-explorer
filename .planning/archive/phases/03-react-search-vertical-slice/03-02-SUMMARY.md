---
phase: 03-react-search-vertical-slice
plan: 02
subsystem: ui
tags: [react, hooks, tanstack-router, localstorage, url-state, vitest]

# Dependency graph
requires:
  - phase: 02-react-foundation
    provides: TanStack Router setup, Vitest harness, jsdom + @testing-library/react, theme-provider localStorage idiom
provides:
  - useSearchState() — URL-bound q/cat state via TanStack Router (replace: true write semantics)
  - useRecentSearches() — localStorage LRU of last 10 search terms with case-sensitive dedupe and resilient read/write
  - RECENT_SEARCHES_KEY ('rectrace-recent-searches') and RECENT_SEARCHES_MAX (10) exports for downstream consumers and tests
  - In-memory TanStack Router test harness pattern (createMemoryHistory + createRouter + RouterProvider, hook mounted as route component) reusable by Plans 06/07
affects: [03-06 (SearchBar consumes useRecentSearches.push + useSearchState.setQ), 03-07 (SearchPage consumes useSearchState read side + the URL-restore effect)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - URL as single source of truth via TanStack Router useSearch + useNavigate({ from }) wrappers
    - localStorage hook with read-time JSON.parse-in-try/catch + non-array/non-string filtering + write-time try/catch for quota errors
    - Loose-cast escape hatch (UseSearchLoose / UseNavigateLoose) for routes not yet declared in routeTree.gen.ts — to be removed by Plan 07
    - TDD RED → GREEN cycle inside an executor (vitest run -> fail -> implement -> pass)

key-files:
  created:
    - frontend-react/src/search/hooks/useSearchState.ts
    - frontend-react/src/search/hooks/useRecentSearches.ts
    - frontend-react/src/search/__tests__/useSearchState.test.tsx
    - frontend-react/src/search/__tests__/useRecentSearches.test.ts
  modified: []

key-decisions:
  - "useSearchState casts useSearch/useNavigate through loose types (UseSearchLoose / UseNavigateLoose) because Plan 07 has not yet declared the /search file route in routeTree.gen.ts. The runtime semantics are correct; Plan 07 will drop the casts."
  - "setQ('') and setQ(undefined) both DROP the q param from the URL (rather than persisting an empty string). This matches the Angular updateUrlWithState semantics (skip falsy values) and avoids round-tripping `?q=` in the URL when the user clears the input."
  - "Recent-searches read() helper caps to MAX even when reading an over-sized pre-existing payload, so a corrupted-into-15-entries localStorage does not balloon back into the in-memory list."

patterns-established:
  - "URL state hook = `useSearch` read + `useNavigate({ replace: true })` write, both wrapped in useCallback so consumer handlers do not change identity per render."
  - "localStorage LRU = lazy-init useState(read) + setRecents(prev => [term, ...prev.filter(t => t !== term)].slice(0, MAX)) + try/catch around setItem/removeItem."
  - "TanStack Router test harness for hooks that consume `useSearch({ from })`: mount the hook AS the route's component, not via renderHook wrapper. A RouterProvider wrapper around a non-route component does NOT satisfy `from`."

requirements-completed: [SEARCH-03, SEARCH-05]

# Metrics
duration: 9min
completed: 2026-05-17
---

# Phase 3 Plan 02: useSearchState + useRecentSearches Summary

**Two React hooks landed: `useSearchState()` reads/writes `q`+`cat` against the `/search` TanStack Router URL (replace: true, no back-stack growth), and `useRecentSearches()` keeps a 10-deep case-sensitive-dedupe LRU of search terms in localStorage — both resilient to malformed payloads, quota errors, and missing URL params.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-17T07:16:37Z
- **Completed:** 2026-05-17T07:25:42Z
- **Tasks:** 2
- **Files created:** 4 (2 hooks + 2 test files)

## Accomplishments

- `useRecentSearches()` ships with 14 Vitest cases covering prepend, case-sensitive dedupe, 10-cap LRU, whitespace no-op, malformed-JSON read resilience, non-array payload resilience, non-string entry filtering, quota-exceeded write resilience, removeItem-throws clear resilience, and over-sized pre-existing payload capping.
- `useSearchState()` ships with 8 Vitest cases covering URL read (q + cat), cat default to `'fileName'`, q-only / cat-only URL variants, `replace: true` history-length invariant on setQ, q drop on undefined / empty-string, cat update preserving q, and clear() emptying the search object.
- TanStack Router in-memory test harness pattern documented and proven: `createMemoryHistory` + `createRouter` + the hook mounted AS the route's component (probe pattern) — reusable by Plan 06 (SearchBar) and Plan 07 (SearchPage).

## Task Commits

1. **Task 1: useRecentSearches hook (localStorage LRU)** — `d9a3935` (feat)
2. **Task 2: useSearchState hook (URL ↔ TanStack Router)** — `d03e7f2` (feat)

_Note: Both tasks executed TDD-style (RED test commit folded into the feat commit because the test + implementation were authored within one wave and committed atomically per the plan's commit guidance)._

## Files Created/Modified

- `frontend-react/src/search/hooks/useRecentSearches.ts` — localStorage LRU hook (75 LOC).
- `frontend-react/src/search/hooks/useSearchState.ts` — URL-bound q/cat hook (76 LOC).
- `frontend-react/src/search/__tests__/useRecentSearches.test.ts` — 14 Vitest cases.
- `frontend-react/src/search/__tests__/useSearchState.test.tsx` — 8 Vitest cases driven by an in-memory TanStack Router harness.

## Decisions Made

- **Loose-cast escape hatch in useSearchState:** Because the `/search` route is not declared in `routeTree.gen.ts` until Plan 07, `useSearch({ from: '/search' })` and `useNavigate({ from: '/search' })` fail TanStack Router's literal-route constraint at the type level. We cast through `UseSearchLoose` and `UseNavigateLoose` (defined inline in the hook file) so the hook compiles today. Plan 07 will remove the casts once the file route exists. The runtime behavior is unaffected.
- **setQ('') drops the q param:** A literal `?q=` would be valid URL syntax but is the wrong UX — the user's clear-input action should yield a clean URL, not a `?q=` trailing artifact. The hook treats `undefined` and `''` identically: both drop the key.
- **read() caps on import:** `useRecentSearches` slices to `RECENT_SEARCHES_MAX` even when reading an existing oversized payload (defensive — guards against a hand-edited or corrupted localStorage value bleeding past the cap).

## Deviations from Plan

None auto-fixed. The plan's `<action>` blocks specified the implementation verbatim; both tasks executed exactly as written.

One minor authoring note that surfaced and was handled inline (not a deviation per the deviation taxonomy):

- The first attempt at `useSearchState` used a strict-typed `useSearch({ from: '/search' })` call, which failed `tsc` because Plan 07's file route doesn't exist yet. The `<action>` block explicitly anticipates this ("for now annotate the destructure with `as { q?: string; cat?: string }` if needed — Plan 07 will tighten when the route is created"), so the loose-cast escape hatch added in the implementation is a sanctioned planning choice, not a deviation.

## Issues Encountered

- **Worktree base lag:** The agent worktree branch (`worktree-agent-a7748741c300a0c8d`) was created off commit `90d22c9`, which predates Phase 2 entirely — the `frontend-react/` directory and `.planning/phases/03-*` artifacts did not exist on disk. Resolved by fast-forwarding the worktree branch to `milestone/modernization` (`git merge --ff-only milestone/modernization`), which advanced from `90d22c9` to `3f143e3`. No commits diverged so the FF was safe.
- **First Write call landed in main repo, not worktree:** The first attempt at writing the test file resolved the absolute path through the main repo's `frontend-react/` directory instead of the worktree's. Corrected by moving the file back into the worktree and verifying with `git rev-parse --show-toplevel`. All subsequent Write calls used the worktree-prefixed absolute path.
- **tsc errors for missing `routeTree.gen.ts`:** First typecheck run reported two pre-existing errors against `App.tsx` and `routes/index.tsx` because `routeTree.gen.ts` is `.gitignore`d and only generated by the Vite plugin during dev/build. Ran `npx vite build` once to generate it; subsequent typechecks were clean. No code change needed — these are pre-existing baseline errors from Phase 2 that resolve as soon as the dev/build pipeline runs.

## User Setup Required

None — both hooks operate purely against the browser URL and localStorage, no external services or env vars.

## Next Phase Readiness

- **Plan 03-03 (useSearchConfig)** can proceed immediately — no shared dependencies with this plan.
- **Plan 03-06 (SearchBar)** unblocked: can import `useRecentSearches` and `useSearchState.setQ` / `clear`.
- **Plan 03-07 (SearchPage + routes/search.tsx)** unblocked: can import `useSearchState`. When Plan 07 declares the file route, it should drop the `UseSearchLoose` / `UseNavigateLoose` casts in `useSearchState.ts` and let the strict types kick in.

## Threat Surface Scan

No new threat surface introduced beyond the plan's `<threat_model>`. The mitigations declared there are implemented:

- **T-03.2-01 (localStorage tampering):** `read()` parses in try/catch, non-array → `[]`, non-string entries filtered with `filter((s): s is string => typeof s === 'string')`. Verified by tests "returns an empty array when localStorage holds malformed JSON" / "filters out non-string entries from localStorage" / "returns an empty array when localStorage holds a non-array payload".
- **T-03.2-02 (quota DoS):** `setItem` wrapped in try/catch; in-memory state still updates. Verified by test "does not throw when localStorage.setItem throws (quota exceeded)".
- **T-03.2-04 (URL param tampering):** `useSearch` returns validated values via the route's `validateSearch` schema (declared by the harness in tests; will be declared by Plan 07 on the real route). The hook itself does an additional `typeof === 'string'` guard before exposing `q` / `cat`.

## Self-Check: PASSED

- `frontend-react/src/search/hooks/useRecentSearches.ts` — FOUND
- `frontend-react/src/search/hooks/useSearchState.ts` — FOUND
- `frontend-react/src/search/__tests__/useRecentSearches.test.ts` — FOUND
- `frontend-react/src/search/__tests__/useSearchState.test.tsx` — FOUND
- Commit `d9a3935` (feat 03-02 useRecentSearches) — FOUND in `git log`
- Commit `d03e7f2` (feat 03-02 useSearchState) — FOUND in `git log`
- Vitest: 27 passed (14 useRecentSearches + 8 useSearchState + 5 pre-existing) — VERIFIED
- `npx tsc --noEmit -p tsconfig.app.json` exits 0 — VERIFIED
- `npx eslint src/search/` clean — VERIFIED

---
*Phase: 03-react-search-vertical-slice*
*Completed: 2026-05-17*
