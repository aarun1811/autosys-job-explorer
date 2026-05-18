---
phase: 06-es-loader-subsystem
plan: 01
subsystem: infra
tags: [shedlock, elasticsearch, alias, oracle-ddl, local-dev-seed]

requires:
  - phase: 00.1-local-dev-stack
    provides: rectrace-local-dev sibling repo with apply.py + schema/01-rectrace.sql + ES rectrace_core_index mapping
  - phase: 05-config-driven-select
    provides: rectrace_readonly GRANT pattern in schema/01-rectrace.sql (left untouched here)
provides:
  - shedlock table DDL in the rectrace Oracle schema (LOADER-02 prerequisite)
  - loader_run_history table DDL with (job_key, started_at) PK + loader_run_history_recent_ix (LOADER-06)
  - rectrace_core_alias ES alias bootstrap inside apply.py:apply_elasticsearch() (LOADER-03)
  - Extended apply.py EXPECTED map gates shedlock:0 + loader_run_history:0 on every --verify
affects: [06-02, 06-03, 06-04, 06-05]

tech-stack:
  added: []
  patterns:
    - "Idempotent Oracle DDL via DROP CASCADE CONSTRAINTS + EXCEPTION WHEN OTHERS / SQLCODE != -942"
    - "Idempotent Oracle index drop via SQLCODE != -1418 swallow"
    - "ES alias bootstrap via put_alias post bulk-load (idempotent: ES no-ops re-add)"

key-files:
  created: []
  modified:
    - "../rectrace-local-dev/schema/01-rectrace.sql (sibling: 7d0a8a3)"
    - "../rectrace-local-dev/apply.py (sibling: 4ae0497)"

key-decisions:
  - "Used VARCHAR2 (Oracle native) for shedlock columns, not the portable VARCHAR from ShedLock docs — consistent with rectrace_core DDL in the same file."
  - "Declared RECTRACE_CORE_ALIAS as a module constant adjacent to ES_INDEX (apply.py:78) for readability, not inline inside apply_elasticsearch()."
  - "No GRANT on shedlock/loader_run_history to rectrace_readonly — per D-6.16 the loader uses the primary RECTRACE datasource, and the readonly account is for Phase 5 SQL-tab evaluator only."
  - "Did not add a redundant alias probe to apply.py:verify() — alias presence is implicitly verified by Plan 03's boot-time existsAlias check; belt-and-suspenders is the Task 3 step 5 curl probe."

patterns-established:
  - "Local-dev seed DDL evolution: append idempotent BEGIN-DROP / CREATE pairs to schema/01-rectrace.sql; never modify existing blocks."
  - "ES alias lifecycle: drop+recreate ES_INDEX in apply_elasticsearch() removes any prior alias; put_alias on the freshly-created index is the correct sequence."

requirements-completed: [LOADER-02, LOADER-03, LOADER-06]

duration: 16min
completed: 2026-05-17
---

# Phase 6 Plan 01: Local-Dev Seed Bootstrap for Loader Subsystem Summary

**ShedLock + loader_run_history Oracle DDL and rectrace_core_alias ES alias added to the local-dev seed; apply.py --reset is idempotent across two cycles and --verify gates all 16 checks (including the two new tables) green.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-05-17T12:00:00Z (approx, plan execution)
- **Completed:** 2026-05-17T12:16:00Z
- **Tasks:** 3 (2 file-modifying + 1 live-validation)
- **Files modified:** 2 (both in sibling repo `../rectrace-local-dev/`)

## Accomplishments

- **shedlock table** present in the rectrace schema with the ShedLock 7.7.0 Oracle DDL (name VARCHAR2(64) PK, lock_until/locked_at TIMESTAMP(3), locked_by VARCHAR2(255)) — Phase 6 LOADER-02 prerequisite satisfied.
- **loader_run_history table** present with composite PK (job_key, started_at) + DESC index `loader_run_history_recent_ix` on (job_key, started_at) for last-20-runs retrieval — Phase 6 LOADER-06 satisfied.
- **rectrace_core_alias** bootstrapped on `rectrace_core_index` inside `apply.py:apply_elasticsearch()`. Idempotent under `--reset` (ES treats re-add as no-op; drop+recreate of ES_INDEX clears the prior alias along with the index).
- **EXPECTED map extended** so `--verify` now gates shedlock:0 and loader_run_history:0 alongside the existing 14 Oracle/ES checks. All 16/16 pass.

## Task Commits

Sibling repo `/Users/aarun/Workspace/Projects/rectrace-local-dev` (separate `main` branch):

1. **Task 1: Append shedlock + loader_run_history DDL to 01-rectrace.sql** — sibling `7d0a8a3` (feat)
2. **Task 2: Wire rectrace_core_alias bootstrap into apply.py + extend EXPECTED** — sibling `4ae0497` (feat)
3. **Task 3: Live-validate the seed against the running Docker stack** — no commit (validation-only; no file edits)

This repo (worktree branch `worktree-agent-af759909d44db9221` → `milestone/modernization`):

- **Plan metadata commit:** see final `docs(06-01): plan summary` below — captures SUMMARY.md + state/roadmap/requirements updates.

## Files Created/Modified

- `../rectrace-local-dev/schema/01-rectrace.sql` — appended 50 lines: shedlock DDL block, loader_run_history DDL block, loader_run_history_recent_ix index. Existing rectrace_core DDL and Phase 5 GRANT untouched.
- `../rectrace-local-dev/apply.py` — added RECTRACE_CORE_ALIAS module constant; appended put_alias call + log line inside apply_elasticsearch(); extended EXPECTED["rectrace"] dict with shedlock:0 and loader_run_history:0.

## Decisions Made

- **VARCHAR2 over VARCHAR** for shedlock columns: Oracle aliases VARCHAR→VARCHAR2 under the hood, but the rest of the file uses VARCHAR2 explicitly — kept consistent.
- **RECTRACE_CORE_ALIAS placed at module top alongside ES_INDEX** (apply.py:78) rather than inside the function — improves grep-ability and mirrors how ES_INDEX is exposed.
- **No verify() ES alias probe added** — Plan 03's boot-time existsAlias check is the authoritative gate; Task 3 step 5 curl probe is sufficient post-seed verification.
- **No new GRANT on shedlock/loader_run_history to rectrace_readonly** — per D-6.16 the loader runs on the primary RECTRACE datasource, not the read-only Phase 5 account.

## Deviations from Plan

None — plan executed exactly as written.

## Live Validation Output (Task 3)

### `apply.py --reset` first cycle (excerpt)

```
[rectrace] applying DDL: 01-rectrace.sql
  rectrace.rectrace_core: 5 rows
  rectrace.shedlock: 0 rows
  rectrace.loader_run_history: 0 rows
...
[es] dropping existing index: rectrace_core_index
[es] creating index from rectrace_core_index.mapping.json
[es] indexed 5 docs into rectrace_core_index
[es] alias rectrace_core_alias -> rectrace_core_index
Done. Stack ready in 1.4s.
```

### `apply.py --reset` second cycle (idempotency gate)

```
[rectrace] applying DDL: 01-rectrace.sql
  rectrace.rectrace_core: 5 rows
  rectrace.shedlock: 0 rows
  rectrace.loader_run_history: 0 rows
[es] alias rectrace_core_alias -> rectrace_core_index
Done. Stack ready in 1.4s.
```

Identical row counts and identical alias log line across both cycles — idempotency contract holds.

### `apply.py --verify` (exit 0)

```
Check                                               Expected      Actual  Result
------------------------------------------------------------------------------------------
rectrace.rectrace_core                                     5           5  ok
rectrace.shedlock                                          0           0  ok
rectrace.loader_run_history                                0           0  ok
autosys.ujo_job                                            5           5  ok
autosys.ujo_job_status                                     5           5  ok
autosys.autosys_tlm_recon_sequences                       15          15  ok
autosys.autosys_all_jobs_data                             20          20  ok
reconmgmt.recon_bank                                       5           5  ok
reconmgmt.mr_csum_man_match_stats_hist                    50          50  ok
reconmgmt.mr_csum_man_match_details                       50          50  ok
reconmgmt.mr_csum_netting_hist                            50          50  ok
recportal.quickrec_stats_table                            10          10  ok
recportal.recportal_manual_match_table                     5           5  ok
es.rectrace_core_index._count                              5           5  ok
es.term set_id.keyword=SET-ABC-123                         1           1  ok
es.term job_name.keyword=LOAD-ABC-123                      1           1  ok
------------------------------------------------------------------------------------------
16/16 checks passed
```

### ES alias probe (curl)

```
$ curl -fsS http://localhost:9200/_alias/rectrace_core_alias
{"rectrace_core_index":{"aliases":{"rectrace_core_alias":{}}}}
```

### Oracle user_tables probe

```
$ python -c "...SELECT COUNT(*) FROM user_tables WHERE table_name IN ('SHEDLOCK', 'LOADER_RUN_HISTORY')..."
2
```

Both tables present in the RECTRACE schema.

## Issues Encountered

None.

## Next Phase Readiness

The local-dev seed now satisfies all three runtime prerequisites for Plan 02 (ShedLock + scheduling) and Plan 03 (LoaderConfigService + LoaderRunHistoryService):

- ShedLock will find its `shedlock` table at boot — no AOP failure (Pitfall L1 closed).
- `LoaderConfigService.existsAlias("rectrace_core_alias")` will return true — no boot failure (Pitfall L2 closed).
- `LoaderRunHistoryService` INSERT statements will succeed on the first scheduled tick.

No blockers. Phase 6 backend work (Plans 02+) can proceed.

## Self-Check: PASSED

Verified all artifacts:
- `../rectrace-local-dev/schema/01-rectrace.sql`: contains `CREATE TABLE shedlock` (1), `CREATE TABLE loader_run_history` (1), `CREATE INDEX loader_run_history_recent_ix` (1) — confirmed via grep -c.
- `../rectrace-local-dev/apply.py`: contains `RECTRACE_CORE_ALIAS = "rectrace_core_alias"` (1), `put_alias(index=ES_INDEX` (1), `"shedlock": 0` (1), `"loader_run_history": 0` (1) — confirmed via grep -c.
- Sibling commits: `7d0a8a3` and `4ae0497` on `main` (confirmed via `git -C ../rectrace-local-dev log`).
- Runtime state: `apply.py --verify` exit 0 with 16/16 checks; curl `/_alias/rectrace_core_alias` returned `rectrace_core_index`; Oracle user_tables probe returned 2.

---
*Phase: 06-es-loader-subsystem*
*Completed: 2026-05-17*
