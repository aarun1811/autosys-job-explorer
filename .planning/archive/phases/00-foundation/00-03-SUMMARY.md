---
phase: 00-foundation
plan: 03
subsystem: planning
tags: [parity-matrix, angular, react, migration, rectrace]

# Dependency graph
requires: []
provides:
  - ".planning/parity-matrix.md — Day-0 React↔Angular parity snapshot with 13 search tabs, 4 modals, 2 grid features, 3 toolbar/app-shell features"
  - "Gating rule: React Foundation phase (Phase 2) can begin once every row has a non-tbd Target"
  - "Five-valued target vocabulary: port / replace-content-with-recviz / replace-fully-with-recviz / drop / tbd"
affects:
  - "Phase 2 (React Foundation) — gated by this matrix; cannot start until all Target values are non-tbd"
  - "All React-phase plans — must reference parity-matrix.md to confirm which Angular capabilities to port"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Living document pattern: parity-matrix.md updated as React phases land"
    - "Five-valued target vocabulary for Angular→React migration decisions"
    - "Gate-based phase progression: Phase 2 blocked until all rows have non-tbd targets"

key-files:
  created:
    - ".planning/parity-matrix.md"
  modified: []

key-decisions:
  - "D-09: Matrix lives at .planning/parity-matrix.md (top-level, not under a phase dir)"
  - "D-10: Tab-level granularity — one row per current Angular route or top-level tab"
  - "D-11: Five-valued target vocabulary: port / replace-content-with-recviz / replace-fully-with-recviz / drop / tbd"
  - "D-14: Gating rule: React phase can start once every row has a non-tbd target"
  - "TLM Stats Modal V2 gets target replace-content-with-recviz (canonical example from D-11)"
  - "TLM Stats Modal V1 gets target drop (dead code per CONCERNS.md MEDIUM)"
  - "AG-Grid SSRM, sidebar, Excel export, dark/light mode get target port (obvious native React ports)"
  - "Recent searches / typeahead gets target port with note: not in Angular today, to be built in React"

patterns-established:
  - "Parity matrix: living doc at .planning/parity-matrix.md tracking Angular→React migration status per feature"
  - "Gate blockquote convention: > **Gate:** rule stated at top of matrix document"
  - "Renderer inventory section: separate table for grid-registered renderers not in V4 config"

requirements-completed: [FOUND-04]

# Metrics
duration: 10min
completed: 2026-05-12
---

# Phase 0 Plan 03: Parity Matrix Summary

**Day-0 React↔Angular parity matrix at .planning/parity-matrix.md with 22 feature rows covering all 13 Angular search tabs, 4 modals, and 5 cross-cutting features, plus a renderer inventory section**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-12T10:35:00Z
- **Completed:** 2026-05-12T10:44:55Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created .planning/parity-matrix.md with 22 feature rows: 13 search tabs, 4 modals, 2 grid features, 3 toolbar/app-shell features
- Ran live inventory commands against search-config-v4.json (13 categories confirmed) and SearchV5GridComponent (8 renderer keys confirmed) and modals directory (5 modal dirs confirmed) — all matched pre-verified research data exactly
- TLM Stats Modal V2 assigned target `replace-content-with-recviz` as canonical example (D-11)
- TLM Stats Modal V1 assigned target `drop` (dead code per CONCERNS.md MEDIUM)
- AG-Grid SSRM+expansion, column/filter sidebar, Excel export, dark/light mode, and recent searches/typeahead all assigned target `port`
- Gating rule and five-valued target vocabulary documented at matrix header
- Renderer inventory section documents all 8 grid-registered renderer keys, noting which 5 are not in search-config-v4.json

## Task Commits

Each task was committed atomically:

1. **Task 1: Inventory Angular codebase and create .planning/parity-matrix.md** - `cd48d7b` (feat)

**Plan metadata:** (see below — committed with SUMMARY.md)

## Files Created/Modified

- `.planning/parity-matrix.md` — Day-0 React↔Angular parity snapshot; 22 feature rows + 8-row renderer inventory; gating rule for Phase 2

## Inventory Command Outputs

**search-config-v4.json (13 categories, verified):**
```
fileName - File Name | ['appIDCellRenderer', 'executionOrderButtonRenderer', 'supportEmailCellRenderer']
reconName - Recon Name | ['executionOrderButtonRenderer']
boxName - Box Name | ['executionOrderButtonRenderer']
setId - Set ID | ['executionOrderButtonRenderer']
subAcc - Sub Account | ['executionOrderButtonRenderer']
loadFileName - Load File Name | ['executionOrderButtonRenderer']
jobName - Job Name | ['appIDCellRenderer', 'executionOrderButtonRenderer', 'supportEmailCellRenderer']
machineName - Machine Name | []
runCalendar - Run Calendar | []
excludeCalendar - Exclude Calendar | []
tlmInstance - TLM Instance | []
reconId - Recon ID | []
reconPortalId - Recon Portal ID | []
```

**SearchV5GridComponent registered renderers (8 keys, verified):**
```
appIDCellRenderer, supportEmailCellRenderer, executionOrderButtonRenderer,
setIdV2Renderer, reconV2Renderer, tlmInstanceV2Renderer,
reconIdRenderer, recPortalIdRenderer
```

**Modal directories (5, verified):**
```
tlm-stats-modal
execution-order-modal
execution-order-graph
quickrec-stats-modal
tlm-stats-modal-v2
```

## Row Coverage

| Section | Count | Concrete Targets | tbd |
|---|---|---|---|
| Search Tabs | 13 | 0 | 13 |
| Modals | 4 | 2 (replace-content-with-recviz, drop) | 2 |
| Grid Features | 2 | 2 (port) | 0 |
| Toolbar / App Shell | 3 | 3 (port) | 0 |
| **Total** | **22** | **7** | **15** |

## Decisions Made

- Used tab-level granularity (D-10): one row per Angular search tab, not per individual column
- Left 13 search tab rows as `tbd` — individual tab targets to be decided during React phase planning
- Left Execution Order Modal and QuickRec Stats Modal as `tbd` — targets not obvious from Day-0 research
- Assigned `port` to all cross-cutting grid/toolbar/app-shell features where target is unambiguous
- Renderer inventory section kept separate from feature rows to avoid double-counting

## Deviations from Plan

None - plan executed exactly as written. Live inventory commands confirmed all pre-verified research data; no additional categories, renderers, or modals discovered beyond those in the plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The parity matrix is a planning artifact — all rows exist with at least a `tbd` target value. Two rows have concrete targets (TLM Stats Modal V2: replace-content-with-recviz; TLM Stats Modal V1: drop). The `tbd` values in the remaining rows are intentional Day-0 state, not missing data — they will be resolved during each React phase's planning. The gate ensures Phase 2 cannot start until all `tbd` values are resolved.

## Threat Flags

None. The parity matrix is a planning-only artifact (.planning/ directory) with no runtime surface, no credentials, and no user data.

## Next Phase Readiness

- .planning/parity-matrix.md committed and ready as the living parity document
- Phase 2 (React Foundation) is gated on this matrix — it cannot start until all 15 remaining `tbd` Target values are resolved during planning
- The gating rule is documented in the matrix itself and in D-14 in CONTEXT.md
- Plans 00-01 and 00-02 (backend test gates) are independent of this plan and may complete in parallel

---
*Phase: 00-foundation*
*Completed: 2026-05-12*
