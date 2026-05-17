---
phase: 05-config-driven-select
plan: 06
subsystem: api
tags: [smoke-test, sql-search, ag-grid-ssrm, oracle, parity-matrix, angular-deferred]

# Dependency graph
requires:
  - phase: 05-config-driven-select
    provides: SqlSearchControllerV4 endpoints + sql-search-config-v4.json + rectrace_readonly user (Plans 01–05)
provides:
  - 6-assertion end-to-end smoke for /api/v4/sql-search/{config,ssrm/{tabKey}}
  - ANGULAR-WIRING.md (file:line citation for the future one-line URL constant swap)
  - parity-matrix.md row for reconSummary SQL tab flipped to target verb `port`
affects: [phase-06-search-bug-fixes, phase-07-observability, phase-09-citi-security, future-react-sql-tab-port]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Smoke contract: structured negative probes (UNKNOWN_TAB, INVALID_REQUEST) alongside positive shape + seed-value assertions — gates loosening via grep count"
    - "Schema-qualified table reference in configured SELECT (rectrace.rectrace_core) — avoids per-deploy synonym/grant choreography in the readonly schema"

key-files:
  created:
    - .planning/phases/05-config-driven-select/ANGULAR-WIRING.md
    - .planning/phases/05-config-driven-select/05-06-SUMMARY.md
  modified:
    - scripts/smoke-sql-search.sh
    - backend/rectrace/src/main/resources/sql-search-config-v4.json
    - .planning/parity-matrix.md

key-decisions:
  - "D-5.06.1: Schema-qualify the configured SELECT (rectrace.rectrace_core) rather than create a synonym in the readonly user's schema — keeps the seed init.sql untouched and resolves Plan 05's deferred ORA-00942 without sibling-repo coupling."
  - "D-5.06.2: Keep one ANGULAR-WIRING.md doc rather than ship Angular code edits — strangler-fig + D-5.18 (frontend deferred) + SQL-07 evidence satisfied by green smoke."
  - "D-5.06.3: Two-option write-up for performInitialSearch absence on SQL surface — preferred (split service for React port) + quick (inline path override for Angular validation) — leaves the trade-off explicit for the future port plan."

patterns-established:
  - "Smoke FAIL-message-count gate (`grep -c 'FAIL:' >= 5`) — defends against future smoke-loosening regressions (threat T-05-19)."
  - "Per-statement negative probe pair (unknown route + malicious column ID) as the canonical SSRM controller hardening check."

requirements-completed: [SQL-07]

# Metrics
duration: ~25min
completed: 2026-05-17
---

# Phase 5 Plan 06: Config-driven SELECT smoke + Angular wiring doc + parity-matrix close Summary

**6-assertion smoke against the live `/api/v4/sql-search/*` surface (green end-to-end), ANGULAR-WIRING.md with the one-line URL-constant swap citation, and a `reconSummary` parity-matrix row flipped to `port` — Phase 5 closed without touching Angular or runtime code beyond a one-token JSON config qualification.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-17T16:34:00Z
- **Completed:** 2026-05-17T17:14:00Z
- **Tasks:** 2
- **Files modified:** 3 (smoke script + JSON config + parity matrix)
- **Files created:** 2 (ANGULAR-WIRING.md + this SUMMARY)

## Accomplishments

- `scripts/smoke-sql-search.sh` extended from 4 to 6 distinct FAIL-able assertions (10 FAIL messages total — exceeds the `>=5` acceptance gate). Green end-to-end against backend on `http://localhost:6088`. `mvn -q test` green (21 tests, 0 failures).
- `sql-search-config-v4.json` query schema-qualified (`rectrace_core` → `rectrace.rectrace_core`) to fix the Plan 05 deferred ORA-00942 (`RECTRACE_READONLY.RECTRACE_CORE does not exist`) without modifying the sibling seed repo.
- `ANGULAR-WIRING.md` shipped with concrete file:line citation: `frontend/rectrace/src/app/services/search-v5.service.ts:98` (apiUrl base — the single edit re-targets all three V4 method calls). Caveat documented for `performInitialSearch` (no SQL counterpart) with two future-plan options.
- `parity-matrix.md`: new `reconSummary (Phase 5 SQL example)` row in the Search Tabs section with target verb `port`; "Last updated" line bumped to Phase 5 closeout; new footer "Update log" section initialised.

## Task Commits

1. **Task 1: smoke-sql-search.sh + JSON schema-qualify** — `3e6265e` (`feat(05-06)`)
2. **Task 2: ANGULAR-WIRING.md + parity-matrix row** — `bd0acd7` (`docs(05-06)`)

(This SUMMARY commit will land as the plan-metadata commit alongside STATE.md / ROADMAP.md updates per execute-plan protocol.)

## Smoke transcript

Final live run against backend on `http://localhost:6088` (Oracle + ES via `docker compose`, seed applied via `apply.py`):

```
$ bash scripts/smoke-sql-search.sh
OK: SQL search smoke green
EXIT=0
```

Assertion inventory (all 6 green; 10 `FAIL:` messages in the script — gates loosening per threat T-05-19):

| # | Assertion | Probe |
|---|-----------|-------|
| 1 | `/config` exposes reconSummary tab | `GET /api/v4/sql-search/config` |
| 2 | SSRM shape has `rows` + `lastRow` | `POST /api/v4/sql-search/ssrm/reconSummary` |
| 3 | Body contains `RECON-XYZ-42` | (same response — seed scenario 4 `job_name`) |
| 4 | `rows[0]` keys all lowercase | (same response — python3 -c assertion) |
| 5 | Unknown tabKey → 400 + `error_type=UNKNOWN_TAB` | `POST /api/v4/sql-search/ssrm/nope-not-a-tab` |
| 6 | Malicious sortModel colId → 400 + `error_type=INVALID_REQUEST` | `POST /api/v4/sql-search/ssrm/reconSummary` with `"colId":"DROP TABLE x"` |

Backend test suite (run while backend was hot-reloaded with the qualified JSON):
```
Tests run: 21, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## Angular wiring citation (recorded for the future port plan)

- **Single touchpoint:** `frontend/rectrace/src/app/services/search-v5.service.ts`
- **Line 98** — base URL constant `apiUrl` — swap `/v4/search` → `/v4/sql-search`
- **Line 103** — `performInitialSearch` (caveat: no SQL counterpart; see doc for split-service vs. quick-override options)
- **Line 112** — `fetchSSRMData` — SSRM POST URL composed from `apiUrl`
- **Line 119** — `getConfiguration` — config GET URL composed from `apiUrl`
- **Line 363** of `search-v5-grid.component.ts` — grid component delegates to `searchServiceV5.fetchSSRMData(...)`; no component-side edit required.

## Parity-matrix row diff

```
+ | reconSummary (Phase 5 SQL example) | sql-tab | sql-search-config-v4.json#reconSummary | plain text (no custom cellRenderer) | port | tbd | Phase 5 — configured SELECT via `sql-search-config-v4.json`, served by `/api/v4/sql-search/{config,ssrm/{tabKey}}`. Backend ready and smoke-tested (`scripts/smoke-sql-search.sh` — 6 assertions green); frontend deferred per D-5.18. Angular wiring documented in `.planning/phases/05-config-driven-select/ANGULAR-WIRING.md`. Future React plan mirrors the Angular consumption against `/api/v4/sql-search/...`. |
```

Plus a new "Update log" footer entry: `2026-05-17 — Phase 5: reconSummary SQL tab added; backend ready, frontend deferred per D-5.18.`

## Decisions Made

See key-decisions in frontmatter (D-5.06.1, D-5.06.2, D-5.06.3). The most consequential is **D-5.06.1**: schema-qualify the configured query rather than coordinate a sibling-repo seed change. This keeps the resolution path inside Phase 5's editor scope and avoids a fan-out across the local-dev image. SQL-02 (SELECT only) and SQL-05 (must have WHERE + FETCH FIRST) remain satisfied — `mvn test` (which exercises SqlSearchConfigServiceV4Test and SqlValidationBootFailureTest) is green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Schema-qualify `rectrace_core` to fix Plan 05's deferred ORA-00942**

- **Found during:** Task 1 (initial smoke run against live backend).
- **Issue:** First smoke run returned HTTP 500 from `/ssrm/reconSummary`. Backend log:
  `ORA-00942: table or view "RECTRACE_READONLY"."RECTRACE_CORE" does not exist`. Same blocker documented in `.planning/phases/05-config-driven-select/deferred-items.md` (Plan 05 follow-up). The sibling seed grants SELECT on `rectrace.rectrace_core` to `rectrace_readonly` but does not create a synonym, so the unqualified table reference in the configured query resolves against the wrong schema.
- **Fix:** Schema-qualified the configured query in `backend/rectrace/src/main/resources/sql-search-config-v4.json` (`FROM rectrace_core` → `FROM rectrace.rectrace_core`). This is option 2 of the two paths recorded in `deferred-items.md` and aligns with Plan 06 Task 1 §action explicit guidance: "fix only the smoke script or the configured query JSON if needed (must still satisfy SQL-02/SQL-05 — re-run boot after any JSON edit)".
- **Files modified:** `backend/rectrace/src/main/resources/sql-search-config-v4.json` (one-token change).
- **Verification:** Backend cleanly restarted with new config (no boot-fail — SqlSearchConfigServiceV4 boot validation still passes). SSRM endpoint now returns 5 rows including `RECON-XYZ-42`. Full smoke green. `mvn -q test` green (21/21).
- **Committed in:** `3e6265e` (Task 1 commit).

**Rule 2 — Missing critical / Rule 3 — Blocking note:** None — this was a Rule 1 fix for a known deferred bug.

---

**Total deviations:** 1 auto-fixed (1 bug fix anticipated by Plan 05 deferred-items + Plan 06 task guidance).
**Impact on plan:** None — fix lies inside Plan 06's permitted edit surface (configured query JSON) and resolves the Plan 05 deferred item in one step, leaving the sibling seed repo untouched.

## Issues Encountered

- **Plan 05 deferred ORA-00942 surfaced as expected on first smoke run.** Resolved via the schema-qualified configured query (see Deviations §1). No other run-time issues.
- **`mvn -q test` produces no output by default;** had to run with `mvn test 2>&1 | tee` and grep for the summary line to confirm green. (Cosmetic — would be a future "polish surefire reporting" item, not a Phase 5 blocker.)

## User Setup Required

None — Phase 5 is fully autonomous against the local docker stack + `apply.py` seed + `./ops/rectrace-ops.sh start backend`. The smoke script's header documents the three prerequisites in plain English for future operators.

## Next Phase Readiness

- **Phase 5 deliverables complete; SQL-01..SQL-07 all green; ready for `/gsd-verify-work 5`.**
- Backend SQL search surface (`/api/v4/sql-search/{config,ssrm/{tabKey}}`) is production-shape-equivalent to `/api/v4/search/*`: same request body (`SSRMRequestV4`), same response body (`SSRMResponseV4`), same `x-citiportal-loginid` header, same standardized error response. Any Phase 9 (Citi security) auth work applied to `SearchControllerV4` will apply uniformly here.
- **Deferred for the future port plan:** Wiring the Angular V5 grid (or, preferred, the React port) to consume `/api/v4/sql-search/*`. ANGULAR-WIRING.md is the one-page instruction set. Estimated effort: <1 hr including a `npm start` + manual click-through verification.
- **Deferred-items.md from Plan 05 is now resolved** — the ORA-00942 path is closed. The follow-up note inside that file remains for historical context but no longer represents an open blocker.

## Self-Check: PASSED

- All 5 claimed files present (smoke script, qualified JSON config, parity matrix, ANGULAR-WIRING.md, this SUMMARY).
- Both task commits present in `git log --oneline --all`: `3e6265e` (Task 1) + `bd0acd7` (Task 2).
- `scripts/smoke-sql-search.sh`: 10 `FAIL:` messages (gate: `>=5`), `bash -n` clean, executable bit set, smoke green end-to-end against live backend.

---
*Phase: 05-config-driven-select*
*Completed: 2026-05-17*
