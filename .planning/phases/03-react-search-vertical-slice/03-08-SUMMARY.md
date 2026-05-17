---
phase: 03-react-search-vertical-slice
plan: 08
subsystem: ops
tags: [smoke-test, parity-matrix, config-driven, docs, phase-closeout]

# Dependency graph
requires:
  - phase: 03-react-search-vertical-slice
    provides: "Plan 07 — /search route + SearchPage + UAT pass (renderer registry wired to fileName category)"
  - phase: 02-react-foundation
    provides: "scripts/smoke-ssrm.sh (Phase 2 two-step keyword → SSRM flow); single-ops-surface convention (D-2.16)"
provides:
  - "Step 0 in scripts/smoke-ssrm.sh — asserts /api/v4/search/config exposes appIDCellRenderer, supportEmailCellRenderer, executionOrderButtonRenderer on the fileName category"
  - "Parity-matrix flip: File Name tab + 3 renderers + Excel export + Recent searches → port (Phase 3 reference) — closes SEARCH-01..SEARCH-07 phase-3 deliverables"
  - "Regression net for the config-driven principle: future search-config-v4.json edits that drop renderer keys fail the ops gate, not at runtime in the React app"
affects: [04-react-modals, BOOT-UPGRADE, ci-pipeline-future]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-close hygiene loop: extend ops smoke + flip parity-matrix targets (Phase 2 close pattern, now applied at Phase 3)"
    - "Config-shape assertion at the ops gate (not test gate) — same surface DevOps runs in deployment smoke"

key-files:
  created:
    - ".planning/phases/03-react-search-vertical-slice/03-08-SUMMARY.md"
  modified:
    - "scripts/smoke-ssrm.sh — added Step 0 (config endpoint shape assertion)"
    - ".planning/parity-matrix.md — 6 rows flipped to `port` with Phase 3 references; last-updated bumped to 2026-05-17"

key-decisions:
  - "Smoke-script Step 0 uses grep-based assertions (no jq) on the raw JSON body — same portability constraint as Phase 2 (macOS bash 3.2; only python3 dep allowed, kept for Steps 1-2)"
  - "Asserted exact `\"cellRenderer\": \"<key>\"` triplet (not bare key presence) to avoid false positives from header values or category labels that happen to include the renderer name"
  - "Bumped 'Last updated' on parity-matrix.md to 2026-05-17 + revised Status line — explicit signal that this is Phase 3's close, not Day-0"
  - "Did NOT flip the 6 other tabs sharing `executionOrderButtonRenderer` (jobName, reconName, boxName, setId, subAcc, loadFileName) — those are Phase 4+ targets; renderer-inventory note now reads 'fileName tab ported; jobName remains tbd for Phase 4+'"

patterns-established:
  - "Ops-gate config-shape regression net: a 6-line grep block in the smoke script protects every config-driven renderer wiring decision. Pattern is generalizable — Phase 4 modal work can extend Step 0 with additional cellRenderer keys"
  - "Parity-matrix close protocol: edit Target column + Notes column with explicit Phase reference; preserve table column counts; leave non-phase targets at `tbd`"

requirements-completed: [SEARCH-01, SEARCH-02, SEARCH-04, SEARCH-05]

# Metrics
duration: ~15min
completed: 2026-05-17
---

# Phase 3 Plan 08: Smoke-script config-shape assertion + parity-matrix flip Summary

**Phase 3 closeout — `scripts/smoke-ssrm.sh` now asserts the React renderer registry's config contract (`/api/v4/search/config` exposes the 3 Phase 3 renderer string keys on the `fileName` category), and `.planning/parity-matrix.md` flips 6 deliverables to `port` with Phase 3 references.**

## Performance

- **Duration:** ~15 minutes
- **Started:** 2026-05-17 (executor session)
- **Completed:** 2026-05-17
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- **Smoke-script Step 0 added:** `bash scripts/smoke-ssrm.sh` now GETs `/api/v4/search/config`, asserts the `fileName` category exists, and asserts `appIDCellRenderer`, `supportEmailCellRenderer`, and `executionOrderButtonRenderer` are present as `cellRenderer` string keys. A regression in `search-config-v4.json` that drops any of these keys now fails the ops gate.
- **Parity-matrix flipped:** 6 Phase 3 deliverables moved from `tbd` to `port` with explicit Phase 3 references (file paths to the React components/hooks/scripts that satisfy each row).
- **Phase 3 hygiene loop closed:** Same pattern Phase 2 used to close (smoke extension + parity update) is now applied. Phase 4 planner can `grep tbd .planning/parity-matrix.md` to find remaining work.

## Task Commits

1. **Task 1: Extend `scripts/smoke-ssrm.sh` with Step 0 config-endpoint shape assertion** — `0059737` (feat)
2. **Task 2: Flip 6 Phase 3 rows in `.planning/parity-matrix.md` to `port`** — `0e4c48e` (docs)

Plan metadata commit will follow this SUMMARY.

## Smoke-script exit-0 evidence (final run)

```
=== SSRM Smoke Test ===
Backend: http://localhost:6088
Keyword: csv
X-Correlation-Id: 0000000000000000000000000002cafe

Step 0: GET http://localhost:6088/rectrace/api/v4/search/config
Step 0 PASS — /config exposes fileName with the 3 Phase 3 renderer keys
Step 1 OK: fileName.values = ["commod_*.csv", "fx_spot_*.csv", "trade_recon_*.csv"]
PASS: SSRM returned 3 row(s) from /rectrace/api/v4/search/ssrm/fileName
Exit: 0
```

## Parity-matrix flip — 6-row mirror

| Row | Prior Target | New Target | Reference |
|-----|-------------|-----------|-----------|
| File Name search tab | tbd | port | `frontend-react/src/search/SearchPage.tsx` (config-driven via `/api/v4/search/config`) |
| `appIDCellRenderer` | tbd | port | `frontend-react/src/search/renderers/AppIDCellRenderer.tsx` (fileName tab ported; jobName remains tbd for Phase 4+) |
| `supportEmailCellRenderer` | tbd | port | `frontend-react/src/search/renderers/SupportEmailCellRenderer.tsx` (fileName tab ported; jobName remains tbd for Phase 4+) |
| `executionOrderButtonRenderer` | tbd | port | `frontend-react/src/search/renderers/ExecutionOrderCellRenderer.tsx` (placeholder Dialog; Phase 4 swaps in Cytoscape modal) |
| Excel export | port (tbd notes) | port (Phase 3 ref) | `frontend-react/src/search/SearchToolbar.tsx` — client-side `gridApi.exportDataAsExcel()` (D-3.10 — diverges from Angular backend export) |
| Recent searches / typeahead | port (tbd notes) | port (Phase 3 ref) | `frontend-react/src/search/hooks/useRecentSearches.ts` + SearchBar Popover (built natively in React, no Angular analog) |

## Phase 3 Closeout — SEARCH-01..SEARCH-07 status

| Requirement | Satisfied By | Phase 3 Status |
|------------|--------------|---------------|
| SEARCH-01 (config-driven search UI) | Plans 03-04, 03-05, 03-07; smoke Step 0 protects the contract (Plan 03-08) | complete |
| SEARCH-02 (Excel export from React) | Plan 03-06 (SearchToolbar) + Plan 03-07 (gridApi wiring + post-UAT fix) | complete |
| SEARCH-03 (`/search` route with URL state) | Plan 03-07 | complete |
| SEARCH-04 (3 cell renderers — AppID, SupportEmail, ExecutionOrder) | Plans 03-02, 03-03; smoke Step 0 protects the keys (Plan 03-08) | complete |
| SEARCH-05 (parity-matrix reflects Phase 3 port targets) | Plan 03-08 | complete |
| SEARCH-06 (recent searches with cross-instance sync) | Plan 03-06 + Plan 03-07 post-UAT fix | complete |
| SEARCH-07 (error state + correlation ID + Try-again) | Plan 03-07 | complete |

## Files Created/Modified

- `scripts/smoke-ssrm.sh` — Added 45-line Step 0 block: GET `/api/v4/search/config`, assert HTTP 200, assert `"key": "fileName"`, assert all three `"cellRenderer": "<key>"` triplets. Additive only — existing Steps 1-2 unchanged. macOS bash 3.2 compatible (parameter-expansion split, grep -q, printf '%s').
- `.planning/parity-matrix.md` — Flipped 6 rows to `port` with Phase 3 references; bumped Last-updated to 2026-05-17; updated Status header to reflect Phase 3 closeout. All table column counts preserved (8 pipes for the main 7-column tables; 5 pipes for the 4-column renderer-inventory table).
- `.planning/phases/03-react-search-vertical-slice/03-08-SUMMARY.md` — This file.

## Decisions Made

See `key-decisions` in frontmatter. Highlights:
- Smoke uses `grep` not `jq` (no new dependency; matches Phase 2 portability constraint).
- Asserted exact `"cellRenderer": "<key>"` triplet, not bare key name, to avoid false positives.
- Renderer-inventory rows kept 4-column structure: folded Phase 3 note into the `Target` column ("port — Phase 3: ..."). Initial attempt added a 5th column, which broke table integrity; corrected before commit.

## Deviations from Plan

None — plan executed exactly as written. Two minor execution-time corrections were caught before commit:

1. **Cwd drift (#3099) during Task 1:** The first `Edit` call for `scripts/smoke-ssrm.sh` used the path `/Users/aarun/Workspace/Projects/autosys-job-explorer/scripts/smoke-ssrm.sh` (main repo) instead of the worktree path. Caught by `git status --short` returning empty when run from the worktree; reverted main-repo modification and re-applied to the worktree path. No data lost; not committed to either branch incorrectly.
2. **Parity-matrix renderer-inventory column count:** Initial edit added a 5th column to 3 rows of the renderer-inventory table (which has 4 columns: Renderer Key | Angular Component | Used By | Target). Detected via `awk` pipe count before commit; collapsed the note into the Target column to preserve the 4-column structure as required by the plan ("Do NOT introduce new columns"). Final committed diff has no structural changes.

Both corrections were caught in-flight by the execution-flow self-checks (git status + table integrity awk) before commit, so the commits themselves are clean.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Smoke runs against the existing local backend on `:6088`.

## Self-Check: PASSED

- `scripts/smoke-ssrm.sh` — exists, syntax-clean, exits 0 with PASS for Step 0/1/2
- `.planning/parity-matrix.md` — exists, all 6 flip gates grep-match
- Task 1 commit `0059737` — present in `git log`
- Task 2 commit `0e4c48e` — present in `git log`

## Next Phase Readiness

- Phase 3 vertical slice + closeout complete. Every SEARCH-01..SEARCH-07 requirement satisfied.
- Phase 4 planner can:
  - `grep -E 'tbd\\s*\\|' .planning/parity-matrix.md` to enumerate remaining work (modals; non-fileName tabs).
  - Extend `scripts/smoke-ssrm.sh` Step 0 with additional cellRenderer key assertions as Phase 4 ports more tabs (e.g., `tlmInstanceV2Renderer`, `reconIdRenderer`).
- No blockers.

---
*Phase: 03-react-search-vertical-slice*
*Completed: 2026-05-17*
