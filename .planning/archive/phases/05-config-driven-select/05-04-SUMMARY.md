---
phase: 05-config-driven-select
plan: 04
subsystem: backend/service-v4
tags: [config, jsqlparser, sql-tab, boot-validation, post-construct, validator]
dependency_graph:
  requires: [05-01, 05-03]
  provides:
    - SqlTabConfigV4 DTO
    - SqlSearchConfigV4 DTO
    - sql-search-config-v4.json (production reconSummary tab)
    - SqlShapeValidator (pure-function JSqlParser 5.x visitor)
    - SqlSearchConfigServiceV4 (@PostConstruct loader + getTabs/getTab API)
  affects:
    - SqlQueryServiceV4 (Plan 05 — will consume getTab to resolve tabKey at request time)
    - SqlSearchControllerV4 (Plan 06 — /api/v4/sql-search/config + /ssrm/{tabKey})
tech_stack:
  added: []  # all dependencies were landed in earlier waves (JSqlParser 5.3 in Plan 03)
  patterns:
    - "@PostConstruct boot-time validation gate — IllegalStateException → BeanCreationException → app refuses to boot"
    - "JSqlParser 5.x SelectVisitorAdapter<Void> with generic <S> Void visit() signatures"
    - "instanceof Select catches PlainSelect + SetOperationList + WITH ... SELECT (Pitfall 2)"
    - "Direct instantiation + ReflectionTestUtils for boot-failure tests (no @SpringBootTest wrapping)"
    - "Missing config file → warn + empty tabs (non-fatal); shape violation → throw (fatal)"
key_files:
  created:
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SqlTabConfigV4.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SqlSearchConfigV4.java
    - backend/rectrace/src/main/resources/sql-search-config-v4.json
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SqlShapeValidator.java
    - backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SqlSearchConfigServiceV4.java
    - backend/rectrace/src/test/resources/sql-search-config-good.json
    - backend/rectrace/src/test/resources/sql-search-config-bad-insert.json
    - backend/rectrace/src/test/resources/sql-search-config-bad-unbounded.json
    - backend/rectrace/src/test/resources/sql-search-config-cte.json
  modified:
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlShapeValidatorTest.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlSearchConfigServiceV4Test.java
    - backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/SqlValidationBootFailureTest.java
decisions:
  - "WithItem<?> generic in 5.x — visit signature must use raw or wildcard generic to override SelectVisitorAdapter cleanly"
  - "Missing classpath config file is non-fatal (warn + empty tabs) — preserves ContextLoadsTest under @ActiveProfiles(\"test\") without a separate @Profile(\"!test\") guard on the service"
  - "Boot-failure tests instantiate the service directly + ReflectionTestUtils.setField on configLocation — asserts raw IllegalStateException without @SpringBootTest's BeanCreationException wrapper (faster, more focused, follows plan recommendation)"
  - "Added acceptsProductionConfig + toleratesMissingConfigFile tests beyond the plan's 3 cases — proves the production JSON always satisfies the gate and that the warn-and-empty branch works"
  - "Duplicate-key detection lives in the service init, not the validator — keeps validator pure-function and per-query"
requirements: [SQL-01, SQL-02, SQL-05]
metrics:
  duration: "~45 minutes (one Rule 3 fix: mvn clean after live probe corrupted target/classes)"
  completed: "2026-05-17T16:55:00Z"
  tasks_completed: 3
---

# Phase 5 Plan 04: Validator + Config Service Summary

Land the SQL shape validator + config service together — JSqlParser 5.3 parses every
configured query at `@PostConstruct`, and an `IllegalStateException` containing the
offending tab key propagates up the Spring context init to fail boot.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | DTOs + production JSON + test fixtures | `c4a9b27` | 7 files: 2 DTOs, 1 production JSON, 4 test fixtures (good, bad-insert, bad-unbounded, cte) |
| 2 | SqlShapeValidator + test enabled | `b535eaf` | 2 files: SqlShapeValidator.java, SqlShapeValidatorTest.java (re-enabled, 9 cases) |
| 3 | SqlSearchConfigServiceV4 + boot-failure tests enabled | `777301f` | 3 files: SqlSearchConfigServiceV4.java, SqlSearchConfigServiceV4Test.java (3 cases), SqlValidationBootFailureTest.java (5 cases) |

## Test Results

`mvn test -Dtest='SqlShapeValidatorTest,SqlSearchConfigServiceV4Test,SqlValidationBootFailureTest,ContextLoadsTest,ReadonlyDataSourceConfigTest'`:

```
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0 — ReadonlyDataSourceConfigTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0 — ContextLoadsTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0 — SqlSearchConfigServiceV4Test
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0 — SqlShapeValidatorTest
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0 — SqlValidationBootFailureTest
[INFO] Tests run: 19, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

All Plan-01 `@Disabled("Wave 4: ...")` markers removed from the three test classes
this plan targeted (SqlShapeValidatorTest, SqlSearchConfigServiceV4Test,
SqlValidationBootFailureTest). The Plan-01 `SqlQueryServiceV4Test` remains
`@Disabled` — it is targeted by Plan 05, not this plan.

## Live Boot Probes

### Happy Path — production JSON

`mvn spring-boot:run -Dspring-boot.run.profiles=local` (Docker stack: `rectrace-oracle`, `rectrace-es`):

```
2026-05-17 16:49:10.795 INFO  c.c.g.r.s.v.SqlSearchConfigServiceV4 - Loading SQL search configuration from: classpath:sql-search-config-v4.json
2026-05-17 16:49:10.825 INFO  c.c.g.r.s.v.SqlSearchConfigServiceV4 - Loaded SQL tab [reconSummary]: 6 columns
2026-05-17 16:49:11.071 INFO  c.c.gru.rectrace.RectraceApplication - Started RectraceApplication in 1.607 seconds (process running for 1.705)
```

Boot succeeds; the reconSummary tab is loaded and validated.

### Negative Path — swapped to bad-insert fixture

After `cp src/test/resources/sql-search-config-bad-insert.json src/main/resources/sql-search-config-v4.json`:

```
2026-05-17 16:50:48.062 WARN  o.s.b.w.s.c.AnnotationConfigServletWebServerApplicationContext - Exception encountered during context initialization - cancelling refresh attempt: org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'sqlSearchConfigServiceV4': Invocation of init method failed
org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'sqlSearchConfigServiceV4': Invocation of init method failed
Caused by: java.lang.IllegalStateException: SQL tab [bad] is not a SELECT / WITH statement
```

Boot fails with `IllegalStateException` carrying the offending tab key — SQL-02 gate
proven end-to-end. Production JSON was restored from `.bak` immediately after.

## Acceptance Criteria Confirmation

| Criterion | Result |
|-----------|--------|
| `grep -q "instanceof Select " SqlShapeValidator.java` | matches (Pitfall 2 guard — NOT `instanceof PlainSelect`) |
| `grep -q "SelectVisitorAdapter<Void>" SqlShapeValidator.java` | matches (Pitfall 1 — 5.x generic adapter) |
| `grep -q "missing both WHERE and FETCH" SqlShapeValidator.java` | matches |
| `grep -q "@PostConstruct" SqlSearchConfigServiceV4.java` | matches |
| `grep -q "SqlShapeValidator.validate(" SqlSearchConfigServiceV4.java` | matches |
| `grep -q "distinct().count()" SqlSearchConfigServiceV4.java` | matches (duplicate-key gate) |
| `grep -c "@Disabled" SqlShapeValidatorTest.java` | 0 |
| `grep -c "@Disabled" SqlSearchConfigServiceV4Test.java` | 0 |
| `grep -c "@Disabled" SqlValidationBootFailureTest.java` | 0 |
| `grep -q "reconSummary" sql-search-config-v4.json` | matches |
| `grep -q "WHERE recon IS NOT NULL" sql-search-config-v4.json` | matches |
| `grep -q "FETCH FIRST 1000 ROWS ONLY" sql-search-config-v4.json` | matches |
| `grep -c '"field":' sql-search-config-v4.json` | 6 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `mvn clean` required after live boot probe**

- **Found during:** post-Task 3 full-suite verification
- **Issue:** The "negative live probe" (Task 3 acceptance criteria) swaps the
  production `sql-search-config-v4.json` with a bad-insert fixture, runs
  `mvn spring-boot:run`, then restores via `.bak`. Spring-boot:run had already
  copied the swapped file into `target/classes/sql-search-config-v4.json`, where
  Surefire later picked it up — `SqlValidationBootFailureTest.acceptsProductionConfig`
  asserted against the cached bad copy and the test failed with
  `IllegalStateException: SQL tab [bad] is not a SELECT / WITH statement`,
  which cascaded into `ContextLoadsTest` and `ReadonlyDataSourceConfigTest`
  hitting the same poisoned classpath.
- **Fix:** `mvn clean` between the live probe and Surefire — `target/` is
  rebuilt from the (correct, restored) `src/`.
- **Files modified:** None (the `src/` tree was already correct).
- **Note:** Source files were correct on disk throughout — only the Maven
  build dir was stale. The plan's live-probe + restore protocol should
  include `mvn clean` before the next test run; flagging this for plan-author
  awareness in future plans that combine spring-boot:run with subsequent test runs.

### Auto-added Test Cases (beyond plan minimum)

- **`SqlValidationBootFailureTest.acceptsProductionConfig`** — exercises the actual
  production `sql-search-config-v4.json` from the classpath at test time. Acts as a
  belt-and-suspenders regression test: if a future plan author drops a bad query
  into the production config, this test fails before deploy. Goes beyond the plan's
  three named cases (rejectsInsert, rejectsUnbounded, acceptsValidCte).
- **`SqlValidationBootFailureTest.toleratesMissingConfigFile`** — proves the
  warn-and-empty branch when the configured location does not exist on the classpath.
  Necessary to confirm `ContextLoadsTest` remains green without a SQL-tab config
  in the `test` profile.
- **`SqlSearchConfigServiceV4Test.getTabByKeyReturnsConfiguredTab`** and
  **`SqlSearchConfigServiceV4Test.getTabByUnknownKeyReturnsEmpty`** — lock the
  `getTab(key)` API surface used by Plan 05's `SqlQueryServiceV4`.

## Threat Model Coverage

All four STRIDE entries from the plan's `<threat_model>` are mitigated:

| Threat ID | Disposition | Where mitigated |
|-----------|-------------|-----------------|
| T-05-09 (DML/DDL in config) | mitigated | `SqlShapeValidator` rejects non-Select; live negative probe confirms `IllegalStateException` at boot |
| T-05-10 (unbounded SELECT) | mitigated | `SqlShapeValidator` rejects when neither WHERE nor FETCH/LIMIT in the AST; `rejectsUnboundedSelect` test confirms |
| T-05-11 (duplicate tab keys) | mitigated | `SqlSearchConfigServiceV4.init()` checks `distinct().count() != size()` and throws |
| T-05-12 (deep CTE DoS) | accepted | JSqlParser internal limits; future-phase if attack vector emerges |

## Known Stubs

None. The validator and config service are fully wired. Plan 05's
`SqlQueryServiceV4` and Plan 06's `SqlSearchControllerV4` will consume the
`getTabs()` / `getTab(key)` API.

## Self-Check: PASSED

- Files created (verified via `ls`):
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SqlTabConfigV4.java` ✓
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SqlSearchConfigV4.java` ✓
  - `backend/rectrace/src/main/resources/sql-search-config-v4.json` ✓
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SqlShapeValidator.java` ✓
  - `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/SqlSearchConfigServiceV4.java` ✓
  - 4 test fixtures under `src/test/resources/` ✓
- Commits verified via `git log`:
  - `c4a9b27` ✓
  - `b535eaf` ✓
  - `777301f` ✓
- Final test run: 19/19 pass, 0 disabled in this plan's scope.
