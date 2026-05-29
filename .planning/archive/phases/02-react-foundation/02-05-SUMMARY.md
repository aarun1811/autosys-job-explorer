---
phase: 02-react-foundation
plan: 05
subsystem: documentation
tags: [docs, supersession, roadmap, requirements, state, parity-matrix, readme]
dependency_graph:
  requires: [02-01, 02-02, 02-03, 02-04]
  provides: [clean-planning-docs, developer-readme]
  affects: [.planning/ROADMAP.md, .planning/REQUIREMENTS.md, .planning/STATE.md, .planning/parity-matrix.md, frontend-react/README.md]
tech_stack:
  added: []
  patterns: [doc-supersession]
key_files:
  created:
    - frontend-react/README.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/parity-matrix.md
decisions:
  - D-2.5 supersession applied: SEARCH-07 now says /rectrace/ (no /v6/ prefix); ROADMAP Phase 3 SC#1 was already correct
  - D-2.17 supersession applied: REACT-08 now says "no angular component (decommissioned at React go-live)"
  - D-2.7 auto-surface mechanism confirmed: chart/series/ramp tokens row already in STATE.md from planning phase
  - D-2.18 gate relaxation note added to parity-matrix.md
metrics:
  duration: "~3 min"
  completed: "2026-05-13"
  tasks_completed: 2
  files_changed: 4
---

# Phase 2 Plan 5: Doc Supersessions Summary

**One-liner:** Applied D-2.5 (SEARCH-07/ROADMAP SC#1 /v6/ removal) and D-2.17 (REACT-08 angular removal) supersessions; added D-2.18 gate note to parity-matrix; wrote frontend-react/README with pnpm-first quickstart.

## Files Modified

| File | Change Summary |
|------|---------------|
| `.planning/REQUIREMENTS.md` | REACT-08: "angular components registered" → "no angular component (decommissioned at React go-live per D-2.15 / D-2.17)"; SEARCH-07: "/v6/ prefix" → "/rectrace/ (no /v6/ prefix — D-2.4)" |
| `.planning/STATE.md` | `stopped_at` updated to "Phase 2 React Foundation plan complete"; `last_updated` refreshed; "Docs hygiene" deferred item closed (resolved by this plan); chart/series/ramp tokens row confirmed present (D-2.7 satisfied) |
| `.planning/parity-matrix.md` | D-2.18 Foundation Gate relaxation note added above Target vocabulary block |
| `frontend-react/README.md` | Created: pnpm-first quickstart (Corepack), npm fallback, scripts table, backend connection, ops/rectrace-ops.sh reference, ops/build.sh react, design tokens note |

## Supersession Confirmations

### D-2.5 (SEARCH-07 + ROADMAP Phase 3 SC#1 — /v6/ removed)
- **REQUIREMENTS.md SEARCH-07**: Old: "distinct URL prefix (e.g. `/v6/`)" → New: "served at `/rectrace/` (no `/v6/` prefix — D-2.4)"
- **ROADMAP.md Phase 3 SC#1**: Was already correct from prior work — reads "/rectrace/ (the production base path; no `/v6/` prefix — see Phase 2 D-2.4)"

### D-2.17 (REACT-08 + ROADMAP Phase 2 SC#5 — angular removed)
- **REQUIREMENTS.md REACT-08**: Old: "angular components registered; React added once `npm run dev` boots" → New: "no angular component (decommissioned at React go-live per D-2.15 / D-2.17)"
- **ROADMAP.md Phase 2 SC#5**: Was already correct from prior work — reads "registers backend, tlm-stats, and React components" (no angular)

### D-2.7 (STATE.md deferred row — chart-token auto-surface mechanism)
- Confirmed: STATE.md Deferred Items table contains "Add chart/series/ramp tokens to `frontend-react/src/index.css`" row (was already added during planning phase)
- Deferred item status: Open (surfaces when first chart/data-viz component is planned)

### D-2.18 (parity-matrix.md gate relaxation)
- Added note above Target vocabulary block explaining Foundation phase relaxation
- Gate intent preserved: Targets locked per-port-phase (Phase 3 for search tabs; Phase 4 for modals)

## README Completeness Note

`frontend-react/README.md` covers:
- Corepack-based pnpm install (`corepack enable` + `corepack prepare pnpm@9.15.0 --activate`)
- npm fallback for developers without pnpm
- Available scripts table (dev, build, preview, lint, typecheck, test, test:watch)
- Backend connection and readiness (proxy to localhost:6088)
- `ops/rectrace-ops.sh start all` and per-component start
- `ops/build.sh react` production deployment to `backend/rectrace/src/main/resources/static/`
- AG-Grid license key via `.env.local` (gitignored; copy from Angular environment.ts)
- Design tokens deferred block note (RECTRACE EXTENSIONS empty, STATE.md tracking)

## Deviations from Plan

None — plan executed exactly as written. ROADMAP.md changes were already in place from prior work (the worktree merge commit 5fc5400 included them); only REQUIREMENTS.md required edits.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: ROADMAP/REQUIREMENTS supersessions | ff925f4 | .planning/REQUIREMENTS.md |
| Task 2: STATE.md + parity-matrix + README | 052a0a2 | .planning/STATE.md, .planning/parity-matrix.md, frontend-react/README.md |

## Known Stubs

None — this is a documentation plan; no data-flow stubs exist.

## Threat Flags

None — plain-text documentation edits only. T-2-01 (AG-Grid license key) mitigated: README explicitly instructs developers to set key in `.env.local` (gitignored) and says "Do NOT commit the real value."
