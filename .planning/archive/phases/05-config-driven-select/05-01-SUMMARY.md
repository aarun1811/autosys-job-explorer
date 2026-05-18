---
phase: 05-config-driven-select
plan: 01
subsystem: testing
tags: [junit5, mockito, spring-boot-test, jsqlparser, ssrm, smoke-test]

# Dependency graph
requires:
  - phase: 00-foundation
    provides: "application-test.properties + @Profile(\"!test\") gate convention + ContextLoadsTest pattern"
provides:
  - "5 @Disabled JUnit 5 test classes locking the SQL-02/04/05/06/07 contracts at compile time"
  - "scripts/smoke-sql-search.sh — sibling to smoke-ssrm.sh, asserts /config + /ssrm/reconSummary shape and the RECON-XYZ-42 seed value"
  - "Wave 4 grep contract — every method-level assertion is enabled by deleting an @Disabled with literal \"Wave 4: ...\" (or \"Wave 2: ...\" for the readonly DS test)"
affects: [05-02-readonly-datasource, 05-03-config-loader, 05-04-shape-validator-and-executor, 05-05-controller-wireup, 05-06-end-to-end]

# Tech tracking
tech-stack:
  added: []  # spring-boot-starter-test + junit-jupiter-params + Mockito + AssertJ already on classpath transitively
  patterns:
    - "Wave 0 grep-enabled test scaffolding: @Disabled(\"Wave N: ...\") + private stub helpers so files compile against future production classes"
    - "Per-statement caps assertion via ArgumentCaptor<PreparedStatementCreator> + driving the captured lambda against a mocked Connection"
    - "OFFSET/FETCH wrapper regex assertion as the SQL-05 executor-side defense-in-depth contract"
    - "Profile-guard assertion: @SpringBootTest under test profile asserts ctx.containsBean(\"readonlyDataSource\") == false (proves @Profile(\"!test\") wiring)"

key-files:
  created:
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlShapeValidatorTest.java"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlSearchConfigServiceV4Test.java"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlValidationBootFailureTest.java"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlQueryServiceV4Test.java"
    - "backend/rectrace/src/test/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfigTest.java"
    - "scripts/smoke-sql-search.sh"
  modified: []

key-decisions:
  - "All five test classes ship Wave 0 with @Disabled annotations using literal \"Wave 4: ...\" reasons (one uses \"Wave 2: ...\" for the readonly DS contract) so a single grep enables them when the production class lands."
  - "Test files compile standalone via local private stubs (validate() helper, StubTabConfig record, commented stub class) — Wave 4 removes the stubs and swaps to the real imports. Stubs deliberately do NOT leak into src/main/."
  - "Smoke script mirrors scripts/smoke-ssrm.sh structure: set -euo pipefail, BASE_URL env override, curl -fsS, grep-based assertions, single FAIL: line per failure path."

patterns-established:
  - "Wave 0 contract-locking pattern: write the assertions before the production class; @Disabled keeps them inert until Wave N flips them on."
  - "ArgumentCaptor-driven per-statement cap verification: capture the PSC lambda, invoke it against a mocked Connection, verify setQueryTimeout/setFetchSize/setMaxRows on the PreparedStatement and never() on the singleton JdbcTemplate."

requirements-completed: []  # Wave 0 scaffolds the contracts but does not yet implement them; SQL-02/04/05/06/07 close in later waves.

# Metrics
duration: ~10min
completed: 2026-05-17
---

# Phase 5 Plan 01: Wave 0 Test Scaffolding for Config-driven SELECT Summary

**5 @Disabled JUnit 5 test classes + smoke-sql-search.sh skeleton locking SQL-02/04/05/06/07 contracts at compile time before any Phase 5 production code exists.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-17T16:25:00Z (worktree HEAD `3d18345`)
- **Completed:** 2026-05-17T11:01:06Z
- **Tasks:** 2
- **Files created:** 6 (5 Java test files + 1 bash script)

## Accomplishments

- Locked the SQL-02 (JSqlParser shape validation) and SQL-05 (defense-in-depth WHERE / FETCH guard) contracts via `SqlShapeValidatorTest` — `@ParameterizedTest` with `@MethodSource` covering 4 valid SELECT/CTE/UNION/FETCH shapes and 5 invalid shapes (INSERT, UPDATE, DELETE, DDL, unbounded SELECT).
- Locked the SQL-01 (config load) contract via `SqlSearchConfigServiceV4Test#loadsTabs`.
- Locked the SQL-02 boot-failure contract via `SqlValidationBootFailureTest` — 3 `@SpringBootTest` methods (`rejectsInsertStatement` / `rejectsUnboundedSelect` / `acceptsValidCte`) documenting the Wave 4 `@TestPropertySource` fixture-swap pattern.
- Locked the SQL-04 (per-statement caps not on singleton) and SQL-05 (executor-side OFFSET/FETCH wrapper) contracts via `SqlQueryServiceV4Test` — Mockito unit tests with `ArgumentCaptor<PreparedStatementCreator>` proving `setQueryTimeout(30) / setFetchSize(500) / setMaxRows(10_000)` are applied to the `PreparedStatement` while `verify(jdbcTemplate, never()).setQueryTimeout(anyInt())` proves the singleton is untouched.
- Locked the SQL-03 (read-only datasource profile gating) contract via `ReadonlyDataSourceConfigTest` — `@ActiveProfiles("test")` asserts `containsBean("readonlyDataSource") == false`, proving the future `@Profile("!test")` guard is wired correctly.
- Locked the SQL-06 + SQL-07 end-of-phase contracts via `scripts/smoke-sql-search.sh` — `/config` exposes `reconSummary`, `/ssrm/reconSummary` returns `{rows, lastRow}` shape, response body contains `RECON-XYZ-42` from the Phase 0.1 seed. Script is executable, `bash -n`-clean, and exits non-zero with a precise `FAIL:` line when the target backend is offline.

## Task Commits

1. **Task 1: SqlShapeValidatorTest + SqlSearchConfigServiceV4Test + SqlValidationBootFailureTest skeletons** — `9b0cb35` (test)
2. **Task 2: SqlQueryServiceV4Test + ReadonlyDataSourceConfigTest skeletons + scripts/smoke-sql-search.sh** — `cb9bdb3` (test)

## Files Created/Modified

- `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlShapeValidatorTest.java` — `@ParameterizedTest` x 2 (`acceptsValidSelectShapes`, `rejectsInvalidShapes`); 2 method-level `@Disabled("Wave 4: ...")` markers
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlSearchConfigServiceV4Test.java` — 1 `@Test loadsTabs()`; 1 method-level `@Disabled("Wave 4: ...")`
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlValidationBootFailureTest.java` — `@SpringBootTest` + 3 `@Test` methods; 3 method-level `@Disabled("Wave 4: ...")`
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlQueryServiceV4Test.java` — Mockito unit; 2 `@Test` methods (`perStatementCapsAppliedNotSingleton`, `injectsOffsetFetchWrapper`); 2 method-level `@Disabled("Wave 4: ...")`
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfigTest.java` — `@SpringBootTest` + 1 `@Test beanExistsUnderNonTestProfile()`; 1 **class-level** `@Disabled("Wave 2: ...")`
- `scripts/smoke-sql-search.sh` — executable bash; `bash -n`-clean; 4 grep assertions, each with its own `FAIL:` exit-1 branch

### `@Disabled` marker counts (exact)

| File | `@Disabled("Wave 4: …` | `@Disabled("Wave 2: …` |
|------|------------------------|------------------------|
| `SqlShapeValidatorTest.java` | 2 | 0 |
| `SqlSearchConfigServiceV4Test.java` | 1 | 0 |
| `SqlValidationBootFailureTest.java` | 3 | 0 |
| `SqlQueryServiceV4Test.java` | 2 | 0 |
| `ReadonlyDataSourceConfigTest.java` | 0 | 1 (class-level) |
| **Total** | **8** | **1** |

Plan-level Wave 4 grep target was ">= 6"; achieved **8**. Plan-level Wave 2+4 grep target across Task-2 files was ">= 3"; achieved **3** (`SqlQueryServiceV4Test`=2 + `ReadonlyDataSourceConfigTest`=1).

### Verification evidence

```
mvn -q -DskipTests test-compile        → exit 0
mvn test -Dtest='Sql*Test,ReadonlyDataSourceConfigTest' -DfailIfNoTests=false
                                       → Tests run: 9, Failures: 0, Errors: 0, Skipped: 9
                                       → BUILD SUCCESS
bash -n scripts/smoke-sql-search.sh    → exit 0
test -x scripts/smoke-sql-search.sh    → true
BASE_URL=http://localhost:9 bash scripts/smoke-sql-search.sh
                                       → "FAIL: reconSummary not in /config" + exit 1
```

## Decisions Made

- **Used class-level `@Disabled` on `ReadonlyDataSourceConfigTest` instead of method-level** — the class has only one `@Test` method and the entire class is gated on `ReadonlyDataSourceConfig.java` landing in Wave 2; class-level annotation is the minimal grep-enable surface (Wave 2 deletes the class-level `@Disabled` alone). This keeps the Wave-2-flip footprint to a single-line removal.
- **Stub helpers live inside test classes only** (private `validate()` static method in `SqlShapeValidatorTest`, private `StubTabConfig` record + `loadTabs()` in `SqlSearchConfigServiceV4Test`, commented placeholder class declaration in `SqlQueryServiceV4Test`). Per the plan's threat register `T-05-01` mitigation: stubs are scoped to `src/test/` and Wave 4 deletes them.
- **Smoke script grep over JSON without `jq`** — used the same `grep -q` style as `scripts/smoke-ssrm.sh` for portability; no new dependency. The `{rows,lastRow}` shape check is two separate `grep -q` invocations so a missing key reports `FAIL: shape missing rows/lastRow` precisely.
- **`@SpringBootTest` files (`SqlValidationBootFailureTest`, `ReadonlyDataSourceConfigTest`) inherit `@ActiveProfiles("test")`** — keeps `ContextLoadsTest` green and avoids needing a live Oracle in CI (Pitfall 8 in 05-RESEARCH.md).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reset worktree from `90d22c9` to `milestone/modernization` HEAD (`3d18345`) to obtain Phase 5 planning artifacts**
- **Found during:** Worktree setup (before Task 1)
- **Issue:** Worktree was spawned from an older HEAD (`90d22c9 docs: map existing codebase`) where `.planning/phases/05-config-driven-select/`, `scripts/smoke-ssrm.sh`, and `backend/rectrace/src/test/resources/application-test.properties` did not yet exist. The plan's `<worktree_setup>` block explicitly documents this case and prescribes `git reset --hard milestone/modernization`.
- **Fix:** Ran `git reset --hard milestone/modernization` (per plan's setup protocol). The reset side-effect detached HEAD onto the protected `milestone/modernization` ref; recovered safely by switching HEAD back onto the pre-existing `worktree-agent-a1013e69a59d58e75` branch (which already pointed at `3d18345`, the same commit) using `git symbolic-ref HEAD refs/heads/worktree-agent-a1013e69a59d58e75`. NO `git update-ref` on a protected ref was used.
- **Files modified:** None (no production code touched; the reset/symbolic-ref dance only affected HEAD pointer state).
- **Verification:** `git rev-parse --abbrev-ref HEAD` → `worktree-agent-a1013e69a59d58e75`; pre-commit assertion passed for both task commits.
- **Committed in:** Pre-task setup — no commit produced.

---

**Total deviations:** 1 auto-fixed (1 Rule 3 / blocking — worktree setup per plan's own protocol).
**Impact on plan:** No scope change. Plan's `<worktree_setup>` block prescribed the reset; the only addition was the HEAD-pointer recovery to comply with the executor's protected-ref pre-commit assertion.

## Issues Encountered

- **Verification grep with quadruple-escaped regex `\\\\?` in shell** returned non-zero on first run because the chained `&&` interpolation altered the escape interpretation. Switched to `grep -F` (fixed-string) over the canonical double-backslash form actually present in the Java source — confirmed the file contains the exact literal `OFFSET \\? ROWS FETCH NEXT \\? ROWS ONLY` that Wave 4 will assert against captured SQL. Acceptance criterion satisfied.
- **No JSqlParser dependency added** — Plan 01 is test scaffolding only; the actual `com.github.jsqlparser:jsqlparser:5.3` dependency lands in Wave 2/4 plans alongside the production `SqlShapeValidator`.

## Threat Flags

None — Wave 0 adds no production code, no new endpoints, no schema or trust-boundary changes. Test stubs are scoped to `src/test/` per `T-05-01` mitigation.

## Self-Check: PASSED

- `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlShapeValidatorTest.java` — FOUND
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlSearchConfigServiceV4Test.java` — FOUND
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlValidationBootFailureTest.java` — FOUND
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlQueryServiceV4Test.java` — FOUND
- `backend/rectrace/src/test/java/com/citi/gru/rectrace/config/ReadonlyDataSourceConfigTest.java` — FOUND
- `scripts/smoke-sql-search.sh` — FOUND, executable
- Commit `9b0cb35` — FOUND in git log
- Commit `cb9bdb3` — FOUND in git log
- `mvn -q -DskipTests test-compile` — exit 0
- `mvn test -Dtest='Sql*Test,ReadonlyDataSourceConfigTest'` — 9 tests, 9 skipped, 0 failures, BUILD SUCCESS

## Next Phase Readiness

- Wave 2 (Plan 05-02) can now reference `ReadonlyDataSourceConfigTest` as the contract its production class must satisfy. The plan's removal of the single class-level `@Disabled("Wave 2: ...")` annotation is the green-flip evidence.
- Wave 4 (Plan 05-04) can reference all 4 `Sql*Test` files. Each enables by:
  1. Deleting the per-method `@Disabled("Wave 4: ...")` annotation.
  2. Deleting the local private stub (`validate()` helper / `StubTabConfig` record / commented placeholder).
  3. Switching to `import static com.citi.gru.rectrace.service.v4.SqlShapeValidator.validate;` and `@Autowired SqlSearchConfigServiceV4 service;` etc.
- Smoke script is wired but will fail until Plan 05-05/05-06 ship the live `/api/v4/sql-search/*` endpoints. The unreachable-target FAIL path is proven; the green path is the SQL-06/SQL-07 verification target.

---
*Phase: 05-config-driven-select*
*Plan: 01 (Wave 0 — test scaffolding)*
*Completed: 2026-05-17*
